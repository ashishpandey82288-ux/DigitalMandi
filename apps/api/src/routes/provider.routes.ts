// ==============================================================================
// KisanFlow — Provider Status Routes
// ==============================================================================

import { Router, Request, Response } from 'express';
import { defaultProviderStatusService } from '../services/providerStatusService.ts';
import { sendSuccess } from '../utils/apiResponse.ts';

const router = Router();

// GET /api/providers/status
router.get('/status', (_req: Request, res: Response) => {
  const status = defaultProviderStatusService.getStatus();
  return sendSuccess(res, status, 'Provider integration status retrieved');
});

router.get('/', (_req: Request, res: Response) => {
  const status = defaultProviderStatusService.getStatus();
  return sendSuccess(res, status, 'Provider integration status retrieved');
});

export default router;
