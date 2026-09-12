// ==============================================================================
// KisanFlow — Kisan Credit Card (KCC) Routes
// ==============================================================================

import { Router } from 'express';
import { getAdvisories, verifyKCC } from '../controllers/kcc.controller.ts';

const router = Router();

// GET /api/kcc/advisories?state=...&crop=...
router.get('/advisories', getAdvisories);
router.get('/', getAdvisories);

// GET /api/kcc/verify/:kccNumber & POST /api/kcc/verify
router.get('/verify/:kccNumber', verifyKCC);
router.post('/verify', verifyKCC);

export default router;
