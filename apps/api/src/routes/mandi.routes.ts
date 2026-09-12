// ==============================================================================
// KisanFlow — Mandi Routes
// ==============================================================================

import { Router } from 'express';
import { getMandiPrices, getMandiPriceByCommodity } from '../controllers/mandi.controller.ts';

const router = Router();

// GET /api/mandi/prices?commodity=...&state=...
router.get('/prices', getMandiPrices);
router.get('/', getMandiPrices);

// GET /api/mandi/prices/:commodity
router.get('/prices/:commodity', getMandiPriceByCommodity);

export default router;
