// ==============================================================================
// KisanFlow — Crop Master Catalog Routes
// Mounts /api/crops endpoints for querying official commodities & quality standards
// ==============================================================================

import { Router } from 'express';
import { getMasterCrops, getMasterCropById } from '../controllers/crop.controller.ts';

const router = Router();

/**
 * GET /api/crops
 * List all active master crops with standard moisture limits & current MSP snapshot
 */
router.get('/', getMasterCrops);

/**
 * GET /api/crops/:cropId
 * Detailed view of a single master crop
 */
router.get('/:cropId', getMasterCropById);

export default router;
