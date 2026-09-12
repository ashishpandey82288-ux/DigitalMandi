// ==============================================================================
// KisanFlow — Settlement Controller
// Handles settlement generation, authoritative calculation consumption,
// and retrieval endpoints with IDOR & RBAC validation.
// ==============================================================================

import { Request, Response } from 'express';
import { settlementService } from '../services/settlementService.ts';
import { AuthenticatedRequest } from '../middleware/auth.ts';

export async function createSettlement(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId, metadata } = req.body;

    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'bookingId is required to generate a settlement.',
        code: 'MISSING_BOOKING_ID',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const actorId = authReq.user?.id || 'system';

    const settlement = await settlementService.generateSettlement(actorId, bookingId, metadata);

    res.status(201).json({
      success: true,
      message: 'Settlement generated successfully from authoritative weighment & grading data.',
      data: settlement,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to generate settlement',
      code: err.code || 'SETTLEMENT_GENERATION_FAILED',
    });
  }
}

export async function getSettlement(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;

    const settlement = await settlementService.getSettlementById(
      id,
      authReq.user?.id,
      authReq.user?.role
    );

    if (!settlement) {
      res.status(404).json({
        success: false,
        error: `Settlement ${id} not found.`,
        code: 'SETTLEMENT_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: settlement,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to retrieve settlement',
      code: err.code || 'SETTLEMENT_FETCH_FAILED',
    });
  }
}

export async function getSettlementByBooking(req: Request, res: Response): Promise<void> {
  try {
    const { bookingId } = req.params;
    const authReq = req as AuthenticatedRequest;

    const settlement = await settlementService.getSettlementByBookingId(
      bookingId,
      authReq.user?.id,
      authReq.user?.role
    );

    if (!settlement) {
      res.status(404).json({
        success: false,
        error: `No settlement found for booking ${bookingId}.`,
        code: 'SETTLEMENT_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: settlement,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to retrieve settlement for booking',
      code: err.code || 'SETTLEMENT_FETCH_FAILED',
    });
  }
}

export async function listSettlements(req: Request, res: Response): Promise<void> {
  try {
    const { farmerProfileId, cropId, bookingId, status } = req.query as any;
    const authReq = req as AuthenticatedRequest;

    const settlements = await settlementService.listSettlements(
      { farmerProfileId, cropId, bookingId, status },
      authReq.user?.id,
      authReq.user?.role
    );

    res.status(200).json({
      success: true,
      count: settlements.length,
      data: settlements,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to list settlements',
      code: err.code || 'SETTLEMENT_LIST_FAILED',
    });
  }
}
