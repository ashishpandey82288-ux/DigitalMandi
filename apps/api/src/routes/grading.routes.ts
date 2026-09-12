// ==============================================================================
// KisanFlow — AI Computer Vision Grading & Quality Assessment Routes
// Mounts /api/grading and /api/quality-inspections
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { gradingRateLimiter } from '../middleware/rateLimiter.ts';
import { validateRequest } from '../middleware/validate.ts';
import {
  createQualityInspectionSchema,
  verifyQualityInspectionSchema,
} from '../validators/grading.validator.ts';
import {
  createQualityInspection,
  getQualityInspectionById,
  getQualityInspectionByBookingId,
  listQualityInspections,
  verifyQualityInspection,
} from '../controllers/grading.controller.ts';

const router = Router();

/**
 * POST /api/grading
 * POST /api/grading/assess
 * Runs AI optical assessment & moisture deduction engine
 */
router.post(
  '/',
  gradingRateLimiter,
  requireAuth,
  validateRequest({ body: createQualityInspectionSchema }),
  createQualityInspection
);
router.post(
  '/assess',
  gradingRateLimiter,
  requireAuth,
  validateRequest({ body: createQualityInspectionSchema }),
  createQualityInspection
);

/**
 * GET /api/grading
 * Lists all quality inspection records
 */
router.get('/', requireAuth, listQualityInspections);

/**
 * GET /api/grading/booking/:bookingId
 * Retrieves quality inspection record for a specific booking
 */
router.get('/booking/:bookingId', requireAuth, getQualityInspectionByBookingId);

/**
 * GET /api/grading/:id
 * Retrieves quality inspection by ID
 */
router.get('/:id', requireAuth, getQualityInspectionById);

/**
 * PUT /api/grading/:id/verify
 * Allows authorized inspector to review/override grade
 */
router.put(
  '/:id/verify',
  requireAuth,
  validateRequest({ body: verifyQualityInspectionSchema }),
  verifyQualityInspection
);

export default router;
