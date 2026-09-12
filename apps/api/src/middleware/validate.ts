// ==============================================================================
// KisanFlow — Zod Request Validation Middleware
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';

interface ValidationTargets {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validateRequest(schemas: ValidationTargets) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        req.body = await schemas.body.parseAsync(body);
      }
      if (schemas.query) {
        const query = (req.query && typeof req.query === 'object') ? req.query : {};
        req.query = (await schemas.query.parseAsync(query)) as any;
      }
      if (schemas.params) {
        const params = (req.params && typeof req.params === 'object') ? req.params : {};
        req.params = (await schemas.params.parseAsync(params)) as any;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
