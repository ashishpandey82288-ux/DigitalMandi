// ==============================================================================
// KisanFlow — Weighment & Procurement Value Calculation Routes
// Mounts /api/weighments
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import {
  recordWeighment,
  getWeighmentById,
  getWeighmentByBookingId,
  listWeighments,
  previewProcurementCalculation,
} from '../controllers/weighment.controller.ts';

const router = Router();

/**
 * POST /api/weighments
 * Records calibrated weighment, executes statutory calculation, transitions booking to WEIGHED
 */
router.post('/', requireAuth, recordWeighment);

/**
 * POST /api/weighments/preview
 * Calculates dry-run procurement payable snapshot
 */
router.post('/preview', requireAuth, previewProcurementCalculation);

/**
 * GET /api/weighments
 * Lists weighment records
 */
router.get('/', requireAuth, listWeighments);

/**
 * GET /api/weighments/booking/:bookingId
 * Retrieves weighment record for a booking
 */
router.get('/booking/:bookingId', requireAuth, getWeighmentByBookingId);

/**
 * GET /api/weighments/:id
 * Retrieves weighment by ID
 */
router.get('/:id', requireAuth, getWeighmentById);

export default router;
