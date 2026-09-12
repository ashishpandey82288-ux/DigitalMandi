// ==============================================================================
// KisanFlow — Payment Controller
// Handles Direct Benefit Transfer (DBT) disbursement, payment tracking,
// retries, and farmer payment history with idempotency & RBAC checks.
// ==============================================================================

import { Request, Response } from 'express';
import { paymentService } from '../services/paymentService.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function initiatePayment(req: Request, res: Response): Promise<void> {
  try {
    const {
      settlementId,
      paymentMethod,
      idempotencyKey: bodyKey,
      amount,
      simulateFailure,
      simulateFailureReason,
      metadata,
    } = req.body;

    // Support idempotency key in header or body
    const headerKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const idempotencyKey = (bodyKey || headerKey) as string | undefined;

    if (!settlementId) {
      res.status(400).json({
        success: false,
        error: 'settlementId is required to initiate payment.',
        code: 'MISSING_SETTLEMENT_ID',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';
    const actorRole = authReq.user?.role;

    const payment = await paymentService.initiatePayment({
      settlementId,
      paymentMethod,
      idempotencyKey,
      amount: amount !== undefined ? Number(amount) : undefined,
      simulateFailure: simulateFailure === true,
      simulateFailureReason,
      metadata,
      actorId,
      actorRole,
    });

    res.status(200).json({
      success: true,
      message:
        payment.status === 'SUCCESS'
          ? 'Direct Benefit Transfer (DBT) disbursed successfully.'
          : 'Payment processing encountered a provider failure.',
      data: payment,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to initiate payment',
      code: err.code || 'PAYMENT_INITIATION_FAILED',
    });
  }
}

export async function retryPayment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { simulateFailure, simulateFailureReason } = req.body;
    const authReq = req as AuthenticatedRequest;

    const payment = await paymentService.retryPayment(id, {
      simulateFailure: simulateFailure === true,
      simulateFailureReason,
      actorId: authReq.user?.id || 'system',
      actorRole: authReq.user?.role,
    });

    res.status(200).json({
      success: true,
      message: 'Payment retry processed successfully.',
      data: payment,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to retry payment',
      code: err.code || 'PAYMENT_RETRY_FAILED',
    });
  }
}

export async function getPayment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;

    const payment = await paymentService.getPaymentById(
      id,
      authReq.user?.id,
      authReq.user?.role
    );

    if (!payment) {
      res.status(404).json({
        success: false,
        error: `Payment ${id} not found.`,
        code: 'PAYMENT_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to retrieve payment',
      code: err.code || 'PAYMENT_FETCH_FAILED',
    });
  }
}

export async function getPaymentsBySettlement(req: Request, res: Response): Promise<void> {
  try {
    const { settlementId } = req.params;
    const authReq = req as AuthenticatedRequest;

    const payments = await paymentService.getPaymentsBySettlementId(
      settlementId,
      authReq.user?.id,
      authReq.user?.role
    );

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to retrieve payments for settlement',
      code: err.code || 'PAYMENT_FETCH_FAILED',
    });
  }
}

export async function getPaymentsByFarmer(req: Request, res: Response): Promise<void> {
  try {
    const { farmerId } = req.params;
    const authReq = req as AuthenticatedRequest;

    const payments = await paymentService.getPaymentsByFarmerId(
      farmerId,
      authReq.user?.id,
      authReq.user?.role
    );

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to retrieve farmer payment history',
      code: err.code || 'PAYMENT_HISTORY_FETCH_FAILED',
    });
  }
}

export async function listPayments(req: Request, res: Response): Promise<void> {
  try {
    const { settlementId, farmerProfileId, status } = req.query as any;
    const authReq = req as AuthenticatedRequest;

    const payments = await paymentService.listPayments(
      { settlementId, farmerProfileId, status },
      authReq.user?.id,
      authReq.user?.role
    );

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to list payments',
      code: err.code || 'PAYMENT_LIST_FAILED',
    });
  }
}
