// ==============================================================================
// KisanFlow — Settlement API Routes
// Mounts /api/settlements
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  createSettlement,
  getSettlement,
  getSettlementByBooking,
  listSettlements,
} from '../controllers/settlement.controller.ts';
import { getPaymentsBySettlement } from '../controllers/payment.controller.ts';

const router = Router();

/**
 * POST /api/settlements
 * Generates authoritative settlement from verified weighment and grading calculation
 */
router.post('/', requireAuth, createSettlement);

/**
 * GET /api/settlements
 * Lists settlements with filter & IDOR support
 */
router.get('/', requireAuth, listSettlements);

/**
 * GET /api/settlements/booking/:bookingId
 * Retrieves settlement by booking ID
 */
router.get('/booking/:bookingId', requireAuth, getSettlementByBooking);

/**
 * GET /api/settlements/:settlementId/payments
 * Retrieves all payments for a settlement
 */
router.get('/:settlementId/payments', requireAuth, getPaymentsBySettlement);
router.get('/:settlementId/payment', requireAuth, getPaymentsBySettlement);

/**
 * GET /api/settlements/:id
 * Retrieves settlement by ID or Reference
 */
router.get('/:id', requireAuth, getSettlement);

export default router;
