// ==============================================================================
// KisanFlow — 404 Route Not Found Middleware
// ==============================================================================

import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse.ts';

export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(
    res,
    `Route [${req.method}] ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
}
