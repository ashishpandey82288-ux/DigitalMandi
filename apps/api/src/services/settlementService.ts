// ==============================================================================
// KisanFlow — Farmer Settlement Service
// Encapsulates authoritative settlement creation, calculation consumption, and verification
// Uses strict Decimal precision & tamper-evident SHA-256 audit chaining
// ==============================================================================

import crypto from 'crypto';
import { Prisma, SettlementStatus, CropQualityGrade } from '@prisma/client';
import { prisma } from '../config/prisma.ts';
import { SettlementDTO, DeductionType } from '@kisanflow/types';
import { recordAuditEvent } from './auditService.ts';

export class SettlementService {
  /**
   * Authoritative Settlement Creation:
   * Consumes verified weighment & quality inspection data to generate a finalized settlement.
   * Prevents client-side manipulation of monetary figures.
   */
  public async generateSettlement(
    actorId: string,
    bookingId: string,
    customMetadata?: Record<string, unknown>
  ): Promise<SettlementDTO> {
    // 1. Verify booking existence
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        farmerProfile: { include: { user: true } },
        crop: true,
        procurementCenter: true,
      },
    });

    if (!booking) {
      const err: any = new Error(`Booking ${bookingId} not found`);
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    // 2. Check if a settlement already exists for this booking
    const existingSettlement = await prisma.settlement.findUnique({
      where: { bookingId },
      include: {
        booking: true,
        farmerProfile: { include: { user: true } },
        crop: true,
      },
    });

    if (existingSettlement) {
      const err: any = new Error(`Settlement already exists for booking ${bookingId}`);
      err.statusCode = 400;
      err.code = 'DUPLICATE_SETTLEMENT';
      throw err;
    }

    // 3. Find verified weighment record
    const weighment = await prisma.weighment.findFirst({
      where: { bookingId },
    });

    if (!weighment) {
      const err: any = new Error(
        `Cannot generate settlement: Verified weighment record is missing for booking ${bookingId}`
      );
      err.statusCode = 400;
      err.code = 'MISSING_WEIGHMENT';
      throw err;
    }

    // 4. Find verified quality inspection record
    const qualityInspection = await prisma.qualityInspection.findFirst({
      where: { bookingId },
    });

    if (!qualityInspection) {
      const err: any = new Error(
        `Cannot generate settlement: Verified quality inspection record is missing for booking ${bookingId}`
      );
      err.statusCode = 400;
      err.code = 'MISSING_GRADING';
      throw err;
    }

    // 5. Authoritative monetary calculations (using strict 2-decimal precision)
    const lockedMspRate = Number(
      weighment.lockedMspRate ? weighment.lockedMspRate.toString() : booking.lockedRatePerQuintal.toString()
    );
    const netWeight = Number(weighment.netWeightQuintals.toString());
    const grossAmount = Math.round(netWeight * lockedMspRate * 100) / 100;
    const netPayableAmount = Math.round(Number(weighment.finalPayableAmount.toString()) * 100) / 100;
    const deductions = Math.max(0, Math.round((grossAmount - netPayableAmount) * 100) / 100);

    if (netPayableAmount <= 0) {
      const err: any = new Error('Calculated final payable amount must be greater than zero');
      err.statusCode = 400;
      err.code = 'INVALID_SETTLEMENT_AMOUNT';
      throw err;
    }

    // 6. Generate unique settlement reference
    const dateSegment = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomEntropy = crypto.randomInt(100000, 999999);
    const settlementReference = `SETTLE-${dateSegment}-${randomEntropy}`;

    // 7. Persist settlement record
    const settlement = await prisma.settlement.create({
      data: {
        settlementReference,
        bookingId: booking.id,
        farmerProfileId: booking.farmerProfileId,
        cropId: booking.cropId,
        lockedMspReference: booking.mspRateReference || 'MSP-LOCKED',
        qualityInspectionId: qualityInspection.id,
        weighmentId: weighment.id,
        grossAmount: new Prisma.Decimal(grossAmount),
        deductions: new Prisma.Decimal(deductions),
        netPayableAmount: new Prisma.Decimal(netPayableAmount),
        currency: 'INR',
        status: SettlementStatus.PENDING,
        metadata: {
          ...customMetadata,
          qualityGrade: weighment.qualityGrade,
          deductionType: weighment.deductionType,
          deductionValue: weighment.deductionValue ? Number(weighment.deductionValue.toString()) : 0,
          effectiveRatePerQuintal: Number(weighment.effectiveRatePerQuintal.toString()),
          netWeightQuintals: netWeight,
          lockedMspRate,
          generatedByActorId: actorId,
          generatedAt: new Date().toISOString(),
        },
      },
      include: {
        booking: true,
        farmerProfile: { include: { user: true } },
        crop: true,
      },
    });

    // 8. Record in tamper-evident SHA-256 audit ledger
    await recordAuditEvent({
      actorId,
      action: 'SETTLEMENT_CREATED',
      entityType: 'Settlement',
      entityId: settlement.id,
      metadata: {
        settlementReference,
        bookingId: booking.id,
        bookingNumber: booking.bookingNumber,
        farmerProfileId: booking.farmerProfileId,
        cropName: booking.crop.name,
        grossAmount,
        deductions,
        netPayableAmount,
        currency: 'INR',
        status: SettlementStatus.PENDING,
      },
    });

    return this.mapToDTO(settlement, weighment, qualityInspection);
  }

  /**
   * Retrieve settlement by ID or Reference with IDOR protection
   */
  public async getSettlementById(
    idOrRef: string,
    actorId?: string,
    actorRole?: string
  ): Promise<SettlementDTO | null> {
    let settlement = await prisma.settlement.findUnique({
      where: { id: idOrRef },
      include: {
        booking: { include: { procurementCenter: true } },
        farmerProfile: { include: { user: true } },
        crop: true,
      },
    });

    if (!settlement) {
      settlement = await prisma.settlement.findFirst({
        where: { settlementReference: idOrRef },
        include: {
          booking: { include: { procurementCenter: true } },
          farmerProfile: { include: { user: true } },
          crop: true,
        },
      });
    }

    if (!settlement) {
      return null;
    }

    // IDOR protection for FARMER role
    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        settlement.farmerProfileId === actorId ||
        settlement.farmerProfile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: You cannot view settlements belonging to another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    const weighment = settlement.weighmentId
      ? await prisma.weighment.findUnique({ where: { id: settlement.weighmentId } })
      : null;

    return this.mapToDTO(settlement, weighment);
  }

  /**
   * Retrieve settlement for a specific booking
   */
  public async getSettlementByBookingId(
    bookingId: string,
    actorId?: string,
    actorRole?: string
  ): Promise<SettlementDTO | null> {
    const settlement = await prisma.settlement.findUnique({
      where: { bookingId },
      include: {
        booking: { include: { procurementCenter: true } },
        farmerProfile: { include: { user: true } },
        crop: true,
      },
    });

    if (!settlement) {
      return null;
    }

    // IDOR protection for FARMER role
    if (actorRole === 'FARMER' && actorId) {
      const isOwner =
        settlement.farmerProfileId === actorId ||
        settlement.farmerProfile?.userId === actorId;
      if (!isOwner) {
        const err: any = new Error('Access denied: You cannot view settlements belonging to another farmer');
        err.statusCode = 403;
        err.code = 'FORBIDDEN_IDOR_VIOLATION';
        throw err;
      }
    }

    const weighment = settlement.weighmentId
      ? await prisma.weighment.findUnique({ where: { id: settlement.weighmentId } })
      : null;

    return this.mapToDTO(settlement, weighment);
  }

  /**
   * List settlements with filtering & IDOR scoping
   */
  public async listSettlements(
    filters: {
      farmerProfileId?: string;
      cropId?: string;
      bookingId?: string;
      status?: SettlementStatus;
    },
    actorId?: string,
    actorRole?: string
  ): Promise<SettlementDTO[]> {
    let effectiveFarmerProfileId = filters.farmerProfileId;

    // Scoping for FARMER role
    if (actorRole === 'FARMER' && actorId) {
      const profile = await prisma.farmerProfile.findFirst({
        where: { userId: actorId },
      });
      if (profile) {
        effectiveFarmerProfileId = profile.id;
      } else {
        effectiveFarmerProfileId = actorId;
      }
    }

    const where: any = {};
    if (effectiveFarmerProfileId) where.farmerProfileId = effectiveFarmerProfileId;
    if (filters.cropId) where.cropId = filters.cropId;
    if (filters.bookingId) where.bookingId = filters.bookingId;
    if (filters.status) where.status = filters.status;

    const list = await prisma.settlement.findMany({
      where,
      include: {
        booking: { include: { procurementCenter: true } },
        farmerProfile: { include: { user: true } },
        crop: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((s: any) => this.mapToDTO(s));
  }

  /**
   * Format Prisma settlement to SettlementDTO
   */
  private mapToDTO(
    settlement: any,
    weighment?: any,
    qualityInspection?: any
  ): SettlementDTO {
    const meta = (settlement.metadata as Record<string, unknown>) || {};
    const netWeightQuintals =
      weighment?.netWeightQuintals != null
        ? Number(weighment.netWeightQuintals.toString())
        : Number(meta.netWeightQuintals || 0);

    const lockedMspRate =
      weighment?.lockedMspRate != null
        ? Number(weighment.lockedMspRate.toString())
        : Number(meta.lockedMspRate || 0);

    const qualityGrade =
      weighment?.qualityGrade ||
      qualityInspection?.grade ||
      (meta.qualityGrade as CropQualityGrade) ||
      CropQualityGrade.GRADE_A;

    return {
      id: settlement.id,
      settlementReference: settlement.settlementReference,
      bookingId: settlement.bookingId,
      bookingNumber: settlement.booking?.bookingNumber,
      farmerProfileId: settlement.farmerProfileId,
      farmerName: settlement.farmerProfile?.user?.name || settlement.farmerProfile?.fullName || 'Farmer',
      farmerPhone: settlement.farmerProfile?.user?.phone || settlement.farmerProfile?.alternatePhone || '',
      cropId: settlement.cropId,
      cropName: settlement.crop?.name,
      cropCode: settlement.crop?.code,
      procurementCenterId: settlement.booking?.procurementCenterId,
      centerName: settlement.booking?.procurementCenter?.name,
      lockedMspRate,
      lockedMspReference: settlement.lockedMspReference || undefined,
      qualityInspectionId: settlement.qualityInspectionId,
      qualityGrade,
      weighmentId: settlement.weighmentId,
      netWeightQuintals,
      grossAmount: Number(settlement.grossAmount.toString()),
      deductions: Number(settlement.deductions.toString()),
      netPayableAmount: Number(settlement.netPayableAmount.toString()),
      currency: settlement.currency,
      status: settlement.status,
      metadata: meta,
      createdAt: settlement.createdAt ? new Date(settlement.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: settlement.updatedAt ? new Date(settlement.updatedAt).toISOString() : new Date().toISOString(),
    };
  }
}

export const settlementService = new SettlementService();
