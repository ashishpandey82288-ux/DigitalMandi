// ==============================================================================
// KisanFlow — Standardized API Response Helpers
// ==============================================================================

import { Response } from 'express';
import { ApiResponse } from '../../../../packages/types/src/index.ts';

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message: string = 'Success',
  statusCode: number = 200,
  meta?: ApiResponse<T>['meta']
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined ? { data } : {}),
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: unknown
): Response {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
  return res.status(statusCode).json(response);
}
