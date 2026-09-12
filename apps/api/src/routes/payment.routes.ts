// ==============================================================================
// KisanFlow — Payment API Routes
// Mounts /api/payments
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { paymentRateLimiter } from '../middleware/rateLimiter.ts';
import { validateRequest } from '../middleware/validate.ts';
import { initiatePaymentSchema } from '../validators/payment.validator.ts';
import {
  initiatePayment,
  retryPayment,
  getPayment,
  getPaymentsBySettlement,
  getPaymentsByFarmer,
  listPayments,
} from '../controllers/payment.controller.ts';

const router = Router();

/**
 * POST /api/payments
 * Initiates DBT disbursement for a finalized settlement with idempotency and audit logs
 */
router.post(
  '/',
  paymentRateLimiter,
  requireAuth,
  validateRequest({ body: initiatePaymentSchema }),
  initiatePayment
);

/**
 * GET /api/payments
 * Lists payments with filtering & RBAC / IDOR checks
 */
router.get('/', requireAuth, listPayments);

/**
 * POST /api/payments/:id/retry
 * Retries a previously failed DBT payment
 */
router.post('/:id/retry', paymentRateLimiter, requireAuth, retryPayment);

/**
 * GET /api/payments/farmer/:farmerId
 * Retrieves payment history for a farmer
 */
router.get('/farmer/:farmerId', requireAuth, getPaymentsByFarmer);

/**
 * GET /api/payments/settlement/:settlementId
 * Retrieves payments for a settlement
 */
router.get('/settlement/:settlementId', requireAuth, getPaymentsBySettlement);

/**
 * GET /api/payments/:id
 * Retrieves payment by ID, reference, or UTR
 */
router.get('/:id', requireAuth, getPayment);

export default router;
