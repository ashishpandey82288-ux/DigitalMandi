// ==============================================================================
// KisanFlow — Health Routes
// ==============================================================================

import { Router } from 'express';
import { getHealth, getReadiness } from '../controllers/health.controller.ts';

const router = Router();

router.get('/health', getHealth);
router.get('/ready', getReadiness);

export default router;
