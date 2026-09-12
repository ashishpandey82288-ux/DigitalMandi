// ==============================================================================
// KisanFlow — MSP Rate Engine Routes
// Mounts /api/msp endpoints for querying official statutory Minimum Support Prices
// ==============================================================================

import { Router } from 'express';
import { getOfficialMSPRates } from '../controllers/crop.controller.ts';

const router = Router();

/**
 * GET /api/msp
 * Query official MSP price benchmarks for current or specified marketing year
 */
router.get('/', getOfficialMSPRates);

export default router;
