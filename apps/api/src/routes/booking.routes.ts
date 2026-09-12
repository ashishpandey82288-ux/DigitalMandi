// ==============================================================================
// KisanFlow — Smart Procurement Booking & MSP Lock Routes
// Mounts /api/bookings with strict auth, RBAC, input validation, and audit logging
// ==============================================================================

import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { validateRequest } from '../middleware/validate.ts';
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
} from '../validators/booking.validator.ts';
import {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  cancelBooking,
  getBookingToken,
  getBookingMsp,
  verifyGatePass,
} from '../controllers/booking.controller.ts';
import { getSettlementByBooking } from '../controllers/settlement.controller.ts';
import { bookingRateLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

/**
 * POST /api/bookings/verify-gate-pass
 * Secure gatekeeper check-in: validates token pass, PIN, and cryptographic QR signature.
 */
router.post(
  '/verify-gate-pass',
  requireAuth,
  verifyGatePass
);

/**
 * POST /api/bookings
 * Authenticated farmer reserves a 90-minute procurement slot, locks statutory MSP rate,
 * and receives a unique token, secure PIN, and cryptographic QR signature.
 */
router.post(
  '/',
  bookingRateLimiter,
  requireAuth,
  requireRole(UserRole.FARMER),
  validateRequest({ body: createBookingSchema }),
  createBooking
);

/**
 * GET /api/bookings
 * Lists bookings with IDOR protection (farmers see their own; officials see all/filtered).
 */
router.get(
  '/',
  requireAuth,
  getBookings
);

/**
 * GET /api/bookings/:bookingId
 * Retrieves detailed booking information including farm, crop, center, bay, and MSP lock.
 */
router.get(
  '/:bookingId',
  requireAuth,
  getBookingById
);

/**
 * PATCH /api/bookings/:bookingId
 * Updates booking metadata or advances workflow status with state machine checks.
 */
router.patch(
  '/:bookingId',
  requireAuth,
  validateRequest({ body: updateBookingSchema }),
  updateBooking
);

/**
 * POST /api/bookings/:bookingId/cancel
 * Cancels a booking, releases slot capacity for other farmers, while preserving MSP snapshot.
 */
router.post(
  '/:bookingId/cancel',
  requireAuth,
  validateRequest({ body: cancelBookingSchema }),
  cancelBooking
);

/**
 * GET /api/bookings/:bookingId/token
 * Returns the digital gate token pass, 6-digit secure PIN, and HMAC QR code signature.
 */
router.get(
  '/:bookingId/token',
  requireAuth,
  getBookingToken
);

/**
 * GET /api/bookings/:bookingId/msp
 * Returns the locked statutory MSP snapshot, marketing year, and price guarantee details.
 */
router.get(
  '/:bookingId/msp',
  requireAuth,
  getBookingMsp
);

/**
 * GET /api/bookings/:bookingId/settlement
 * Returns the finalized procurement settlement for the booking.
 */
router.get(
  '/:bookingId/settlement',
  requireAuth,
  getSettlementByBooking
);

export default router;
