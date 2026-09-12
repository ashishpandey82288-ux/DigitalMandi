// ==============================================================================
// KisanFlow — Future Modules Route Placeholders (Phase 1 Foundation)
// ==============================================================================

import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse.ts';

function createPlaceholderHandler(moduleName: string, plannedCapabilities: string[]) {
  return (_req: Request, res: Response): Response => {
    return sendSuccess(
      res,
      {
        module: moduleName,
        status: 'Architecture placeholder initialized',
        phase: 'Scheduled for Phase 2 / Phase 3 implementation',
        capabilities: plannedCapabilities,
      },
      `${moduleName} endpoint ready for phase implementation`
    );
  };
}

export function createModuleRouter(moduleName: string, capabilities: string[]): Router {
  const router = Router();
  const handler = createPlaceholderHandler(moduleName, capabilities);
  
  router.get('/', handler);
  router.post('/', handler);
  router.get('/:id', handler);
  router.put('/:id', handler);
  router.delete('/:id', handler);

  return router;
}
