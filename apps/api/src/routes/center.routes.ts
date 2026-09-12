// ==============================================================================
// KisanFlow — Procurement Center, Bay & Booking Slot Routes
// Mounts /api/centers & /api/procurement-centers
// ==============================================================================

import { Router } from 'express';
import {
  getProcurementCenters,
  getProcurementCenterById,
  getCenterBays,
  getCenterSlots,
  getBookingSlotById,
} from '../controllers/center.controller.ts';

const router = Router();

// Center listings & details
router.get('/', getProcurementCenters);
router.get('/:centerId', getProcurementCenterById);

// Bays under center
router.get('/:centerId/bays', getCenterBays);

// 90-minute slots under center
router.get('/:centerId/slots', getCenterSlots);
router.get('/:centerId/slots/:slotId', getBookingSlotById);

// Direct slot query endpoint
router.get('/slots/:slotId', getBookingSlotById);

export default router;
