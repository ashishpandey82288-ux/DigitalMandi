// ==============================================================================
// KisanFlow — Payment Execution & DBT Service
// Manages Direct Benefit Transfer (DBT) disbursement, provider orchestration,
// state transitions, idempotency, and audit ledger chaining.
// ==============================================================================

import crypto from 'crypto';
import { Prisma, PaymentStatus, SettlementStatus, BookingStatus } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import { PaymentDTO } from '@kisanflow/types';
import { defaultPaymentProvider, IPaymentProvider } from '../providers/paymentProvider.ts';
import { recordAuditEvent } from './auditService.ts';
import { NotificationService } from './notificationService.ts';

export interface InitiatePaymentParams {
  settlementId: string;
  paymentMethod?: string;
  idempotencyKey?: string | null;
  amount?: number;
  simulateFailure?: boolean;
  simulateFailureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  actorId?: string;
  actorRole?: string;
}

export class PaymentService {
  private provider: IPaymentProvider;

  constructor(provider: IPaymentProvider = defaultPaymentProvider) {
    this.provider = provider;
  }

  /**
   * Authoritative Payment Initiation:
   * Consumes finalized settlement, verifies idempotency and status,
   * invokes payment provider, updates state machine, and logs audit hashes.
   */
  public async initiatePayment(params: InitiatePaymentParams): Promise<PaymentDTO> {
    const {
      settlementId,
      paymentMethod = 'DBT_PFMS',
      idempotencyKey,
      amount: clientAmount,
      simulateFailure,
      simulateFailureReason,
      metadata = {},
      actorId = 'system',
      actorRole,
    } = params;

    // 1. Fetch settlement with relations
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: {
        booking: { include: { crop: true, procurementCenter: true } },
        farmerProfile: { include: { user: true } },
        crop: true,
      },
    });

    if (!settlement) {
      const err: any = new Error(`Settlement with ID ${settlementId} was not found`);
      err.statusCode = 404;
      err.code = 'SETTLEMENT_NOT_FOUND';
      throw err;
    }

    // 2. IDOR check for farmers
    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        settlement.farmerProfileId === actorId ||
        settlement.farmerProfile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: Cannot initiate payment for another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    // 3. Security Check: Client-side amount mismatch check
    const authoritativeAmount = Number(settlement.netPayableAmount.toString());
    if (clientAmount != null && Math.abs(clientAmount - authoritativeAmount) > 0.001) {
      const err: any = new Error(
        `Supplied amount (₹${clientAmount}) does not match authoritative finalized settlement amount (₹${authoritativeAmount})`
      );
      err.statusCode = 400;
      err.code = 'AMOUNT_MISMATCH';
      throw err;
    }

    // 4. Idempotency Check
    if (idempotencyKey) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          idempotencyKey,
          settlementId: settlement.id,
        },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });

      if (existingPayment) {
        // Return existing payment idempotently
        return this.mapToDTO(existingPayment);
      }
    }

    // 5. Check if settlement is already successfully settled
    if (settlement.status === SettlementStatus.SETTLED || (settlement.status as string) === 'SETTLED') {
      const err: any = new Error('Settlement has already been successfully paid and settled.');
      err.statusCode = 400;
      err.code = 'ALREADY_PAID';
      throw err;
    }

    const successfulPayment = await prisma.payment.findFirst({
      where: {
        settlementId: settlement.id,
        status: PaymentStatus.SUCCESS,
      },
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
    });

    if (successfulPayment) {
      const err: any = new Error('Settlement has already been successfully paid and settled.');
      err.statusCode = 400;
      err.code = 'ALREADY_PAID';
      throw err;
    }

    // 6. Generate payment reference
    const dateSegment = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomEntropy = crypto.randomInt(10000, 99999);
    const paymentReference = `PAY-DBT-${dateSegment}-${randomEntropy}`;

    // 7. Step 1: Create payment in INITIATED status
    const payment = await prisma.payment.create({
      data: {
        paymentReference,
        settlementId: settlement.id,
        farmerProfileId: settlement.farmerProfileId,
        amountInr: settlement.netPayableAmount,
        currency: settlement.currency || 'INR',
        paymentMode: paymentMethod,
        bankAccountNumber: settlement.farmerProfile?.bankAccountNumber || null,
        ifscCode: settlement.farmerProfile?.bankIfsc || null,
        idempotencyKey: idempotencyKey || null,
        status: PaymentStatus.INITIATED,
        isSimulated: true,
        initiatedAt: new Date(),
        metadata: {
          ...metadata,
          initiatedBy: actorId,
          farmerName: settlement.farmerProfile?.user?.name || settlement.farmerProfile?.fullName || 'Farmer',
          cropName: settlement.crop?.name,
        },
      },
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
    });

    // 8. Log audit event: PAYMENT_INITIATED
    await recordAuditEvent({
      actorId,
      action: 'PAYMENT_INITIATED',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        paymentReference,
        settlementReference: settlement.settlementReference,
        amount: authoritativeAmount,
        currency: settlement.currency,
        farmerProfileId: settlement.farmerProfileId,
        idempotencyKey,
      },
    });

    // 9. Step 2: Transition to PROCESSING
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PROCESSING },
    });

    await recordAuditEvent({
      actorId,
      action: 'PAYMENT_PROCESSING',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        paymentReference,
        status: PaymentStatus.PROCESSING,
        provider: this.provider.name,
      },
    });

    // 10. Step 3: Invoke Payment Provider
    const providerResult = await this.provider.processPayment({
      settlementId: settlement.id,
      settlementReference: settlement.settlementReference,
      bookingId: settlement.bookingId,
      farmerProfileId: settlement.farmerProfileId,
      farmerName: settlement.farmerProfile?.user?.name || settlement.farmerProfile?.fullName || 'Farmer',
      bankAccountNumber: settlement.farmerProfile?.bankAccountNumber,
      bankIfsc: settlement.farmerProfile?.bankIfsc,
      amount: authoritativeAmount,
      currency: settlement.currency,
      paymentMethod,
      idempotencyKey,
      simulateFailure,
      simulateFailureReason,
      metadata,
    });

    // 11. Step 4: Advance to SUCCESS or FAILED based on provider response
    if (providerResult.success && providerResult.status === 'SUCCESS') {
      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          providerTransactionId: providerResult.providerTransactionId,
          utrNumber: providerResult.providerTransactionId,
          isSimulated: providerResult.isSimulated,
          processedAt: providerResult.processedAt,
          disbursedAt: providerResult.processedAt,
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            ...providerResult.metadata,
            providerName: providerResult.providerName,
          },
        },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });

      // Advance settlement to SETTLED
      await prisma.settlement.update({
        where: { id: settlement.id },
        data: { status: SettlementStatus.SETTLED },
      });

      // Advance booking to COMPLETED
      await prisma.booking.update({
        where: { id: settlement.bookingId },
        data: { status: BookingStatus.COMPLETED },
      });

      // Record audit logs
      await recordAuditEvent({
        actorId,
        action: 'PAYMENT_SUCCEEDED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          paymentReference,
          providerTransactionId: providerResult.providerTransactionId,
          amount: authoritativeAmount,
          settlementId: settlement.id,
          bookingId: settlement.bookingId,
          isSimulated: providerResult.isSimulated,
        },
      });

      await recordAuditEvent({
        actorId,
        action: 'SETTLEMENT_FINALIZED',
        entityType: 'Settlement',
        entityId: settlement.id,
        metadata: {
          settlementReference: settlement.settlementReference,
          paymentReference,
          status: SettlementStatus.SETTLED,
          totalDisbursed: authoritativeAmount,
        },
      });

      // Dispatch notification to farmer
      if (settlement.farmerProfile?.userId) {
        NotificationService.notifyPaymentSuccess({
          id: payment.id,
          paymentReference: payment.paymentReference,
          amountInr: Number(updatedPayment.amountInr),
          utrNumber: updatedPayment.utrNumber,
          farmerUserId: settlement.farmerProfile.userId,
        }).catch(() => {});
      }

      return this.mapToDTO(updatedPayment);
    } else {
      // Payment Failed
      const failedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: providerResult.failureReason || 'PROVIDER_EXECUTION_FAILED',
          isSimulated: providerResult.isSimulated,
          processedAt: providerResult.processedAt,
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            ...providerResult.metadata,
            providerName: providerResult.providerName,
          },
        },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });

      await recordAuditEvent({
        actorId,
        action: 'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          paymentReference,
          failureReason: providerResult.failureReason,
          settlementId: settlement.id,
          isSimulated: providerResult.isSimulated,
        },
      });

      // Dispatch failure alert to farmer
      if (settlement.farmerProfile?.userId) {
        NotificationService.notifyPaymentFailed(
          {
            id: payment.id,
            paymentReference: payment.paymentReference,
            amountInr: Number(failedPayment.amountInr),
            farmerUserId: settlement.farmerProfile.userId,
          },
          providerResult.failureReason || 'Provider Execution Failed'
        ).catch(() => {});
      }

      return this.mapToDTO(failedPayment);
    }
  }

  /**
   * Retry a Failed Payment:
   * Only permits retrying payments that are in FAILED state.
   */
  public async retryPayment(
    paymentId: string,
    params: {
      simulateFailure?: boolean;
      simulateFailureReason?: string | null;
      actorId?: string;
      actorRole?: string;
    } = {}
  ): Promise<PaymentDTO> {
    const { simulateFailure, simulateFailureReason, actorId = 'system', actorRole } = params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
    });

    if (!payment) {
      const err: any = new Error(`Payment ${paymentId} not found`);
      err.statusCode = 404;
      err.code = 'PAYMENT_NOT_FOUND';
      throw err;
    }

    // IDOR check
    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        payment.farmerProfileId === actorId ||
        payment.farmerProfile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: Cannot retry payment for another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    // Check valid state transition
    if (payment.status === PaymentStatus.SUCCESS) {
      const err: any = new Error('Invalid state transition: Cannot retry a payment that has already succeeded');
      err.statusCode = 400;
      err.code = 'INVALID_STATE_TRANSITION';
      throw err;
    }

    // Set to PROCESSING
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PROCESSING },
    });

    await recordAuditEvent({
      actorId,
      action: 'PAYMENT_RETRIED',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        paymentReference: payment.paymentReference,
        previousStatus: payment.status,
      },
    });

    const authoritativeAmount = Number(payment.amountInr.toString());

    // Call Provider
    const providerResult = await this.provider.processPayment({
      settlementId: payment.settlementId,
      settlementReference: payment.settlement?.settlementReference || 'SETTLEMENT',
      bookingId: payment.settlement?.bookingId,
      farmerProfileId: payment.farmerProfileId,
      farmerName: payment.farmerProfile?.user?.name || payment.farmerProfile?.fullName || 'Farmer',
      bankAccountNumber: payment.farmerProfile?.bankAccountNumber,
      bankIfsc: payment.farmerProfile?.bankIfsc,
      amount: authoritativeAmount,
      currency: payment.currency,
      paymentMethod: payment.paymentMode,
      simulateFailure,
      simulateFailureReason,
      metadata: (payment.metadata as Record<string, unknown>) || {},
    });

    if (providerResult.success && providerResult.status === 'SUCCESS') {
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          providerTransactionId: providerResult.providerTransactionId,
          utrNumber: providerResult.providerTransactionId,
          failureReason: null,
          isSimulated: providerResult.isSimulated,
          processedAt: providerResult.processedAt,
          disbursedAt: providerResult.processedAt,
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            ...providerResult.metadata,
          },
        },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });

      await prisma.settlement.update({
        where: { id: payment.settlementId },
        data: { status: SettlementStatus.SETTLED },
      });

      if (payment.settlement?.bookingId) {
        await prisma.booking.update({
          where: { id: payment.settlement.bookingId },
          data: { status: BookingStatus.COMPLETED },
        });
      }

      await recordAuditEvent({
        actorId,
        action: 'PAYMENT_SUCCEEDED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          paymentReference: payment.paymentReference,
          providerTransactionId: providerResult.providerTransactionId,
          isRetry: true,
        },
      });

      return this.mapToDTO(updated);
    } else {
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: providerResult.failureReason || 'RETRY_ATTEMPT_FAILED',
          isSimulated: providerResult.isSimulated,
          processedAt: providerResult.processedAt,
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            ...providerResult.metadata,
          },
        },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });

      await recordAuditEvent({
        actorId,
        action: 'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: payment.id,
        metadata: {
          paymentReference: payment.paymentReference,
          failureReason: providerResult.failureReason,
          isRetry: true,
        },
      });

      return this.mapToDTO(updated);
    }
  }

  /**
   * Get payment by ID, reference, or UTR
   */
  public async getPaymentById(
    idOrRef: string,
    actorId?: string,
    actorRole?: string
  ): Promise<PaymentDTO | null> {
    let payment = await prisma.payment.findUnique({
      where: { id: idOrRef },
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
    });

    if (!payment) {
      payment = await prisma.payment.findFirst({
        where: { paymentReference: idOrRef },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });
    }

    if (!payment) {
      payment = await prisma.payment.findFirst({
        where: { providerTransactionId: idOrRef },
        include: {
          settlement: { include: { booking: true, crop: true } },
          farmerProfile: { include: { user: true } },
        },
      });
    }

    if (!payment) return null;

    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        payment.farmerProfileId === actorId ||
        payment.farmerProfile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: Cannot view payment for another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    return this.mapToDTO(payment);
  }

  /**
   * Get all payments for a settlement
   */
  public async getPaymentsBySettlementId(
    settlementId: string,
    actorId?: string,
    actorRole?: string
  ): Promise<PaymentDTO[]> {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { farmerProfile: true },
    });

    if (!settlement) {
      const err: any = new Error(`Settlement ${settlementId} not found`);
      err.statusCode = 404;
      err.code = 'SETTLEMENT_NOT_FOUND';
      throw err;
    }

    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        settlement.farmerProfileId === actorId ||
        settlement.farmerProfile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: Cannot view payments for another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    const payments = await prisma.payment.findMany({
      where: { settlementId },
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p: any) => this.mapToDTO(p));
  }

  /**
   * Get payment history for a farmer profile
   */
  public async getPaymentsByFarmerId(
    farmerProfileIdOrUserId: string,
    actorId?: string,
    actorRole?: string
  ): Promise<PaymentDTO[]> {
    // Resolve farmer profile
    let profile = await prisma.farmerProfile.findFirst({
      where: {
        id: farmerProfileIdOrUserId,
        userId: farmerProfileIdOrUserId,
      },
    });

    if (!profile) {
      profile = await prisma.farmerProfile.findFirst({
        where: { id: farmerProfileIdOrUserId },
      });
    }

    const targetProfileId = profile ? profile.id : farmerProfileIdOrUserId;

    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        targetProfileId === actorId ||
        profile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: Cannot view financial history for another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    const payments = await prisma.payment.findMany({
      where: { farmerProfileId: targetProfileId },
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p: any) => this.mapToDTO(p));
  }

  /**
   * List payments with filtering & scoping
   */
  public async listPayments(
    filters: {
      settlementId?: string;
      farmerProfileId?: string;
      status?: PaymentStatus;
    },
    actorId?: string,
    actorRole?: string
  ): Promise<PaymentDTO[]> {
    let effectiveFarmerProfileId = filters.farmerProfileId;

    if (actorRole === 'FARMER' && actorId) {
      const profile = await prisma.farmerProfile.findFirst({
        where: { userId: actorId },
      });
      effectiveFarmerProfileId = profile ? profile.id : actorId;
    }

    const where: any = {};
    if (filters.settlementId) where.settlementId = filters.settlementId;
    if (effectiveFarmerProfileId) where.farmerProfileId = effectiveFarmerProfileId;
    if (filters.status) where.status = filters.status;

    const list = await prisma.payment.findMany({
      where,
      include: {
        settlement: { include: { booking: true, crop: true } },
        farmerProfile: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((p: any) => this.mapToDTO(p));
  }

  /**
   * Format Prisma payment to PaymentDTO
   */
  private mapToDTO(payment: any): PaymentDTO {
    const meta = (payment.metadata as Record<string, unknown>) || {};
    return {
      id: payment.id,
      paymentReference: payment.paymentReference,
      settlementId: payment.settlementId,
      settlementReference: payment.settlement?.settlementReference,
      bookingId: payment.settlement?.bookingId,
      bookingNumber: payment.settlement?.booking?.bookingNumber,
      farmerProfileId: payment.farmerProfileId,
      farmerName: payment.farmerProfile?.user?.name || payment.farmerProfile?.fullName || 'Farmer',
      farmerPhone: payment.farmerProfile?.user?.phone || payment.farmerProfile?.alternatePhone || '',
      cropId: payment.settlement?.cropId,
      cropName: payment.settlement?.crop?.name,
      amount: Number(payment.amountInr.toString()),
      currency: payment.currency || 'INR',
      paymentMethod: payment.paymentMode,
      providerTransactionId: payment.providerTransactionId || payment.utrNumber || null,
      status: payment.status,
      isSimulated: payment.isSimulated !== false,
      failureReason: payment.failureReason || null,
      idempotencyKey: payment.idempotencyKey || null,
      initiatedAt: payment.initiatedAt ? new Date(payment.initiatedAt).toISOString() : new Date().toISOString(),
      processedAt: payment.processedAt ? new Date(payment.processedAt).toISOString() : null,
      metadata: meta,
      createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: payment.updatedAt ? new Date(payment.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export const paymentService = new PaymentService();
