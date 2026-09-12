// ==============================================================================
// KisanFlow — Centralized Global Error Handler Middleware
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.ts';
import { sendError } from '../utils/apiResponse.ts';

export class ApiError extends Error {
  public status: number;
  public statusCode: number;
  public code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusCode = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): Response {
  logger.error(
    `Unhandled error on [${req.method}] ${req.originalUrl}: ${err instanceof Error ? err.message : String(err)}`,
    'ErrorHandler',
    err instanceof Error ? { stack: err.stack } : undefined
  );

  // 1. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    return sendError(
      res,
      'Request validation failed',
      400,
      'VALIDATION_ERROR',
      (err.issues || []).map((e) => ({
        path: Array.isArray(e.path) ? e.path.join('.') : String(e.path),
        message: e.message,
      }))
    );
  }

  // 2. Handle Custom API Errors / standard Error
  if (err instanceof Error) {
    const isClientError = 'status' in err && typeof (err as { status: unknown }).status === 'number';
    const statusCode = isClientError ? ((err as { status: number }).status) : 500;
    
    return sendError(
      res,
      process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : err.message,
      statusCode,
      'SERVER_ERROR'
    );
  }

  // 3. Fallback for unknown exceptions
  return sendError(res, 'An unexpected error occurred', 500, 'UNKNOWN_ERROR');
}
