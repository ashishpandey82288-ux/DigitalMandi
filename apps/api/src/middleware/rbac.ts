// ==============================================================================
// KisanFlow — Role-Based Access Control (RBAC) Middleware
// Enforces Server-Side Least-Privilege & Default-Deny Authorization
// ==============================================================================

import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from './auth.ts';
import { sendError } from '../utils/apiResponse.ts';
import { recordAuditEvent } from '../services/auditService.ts';

/**
 * Reusable Role-Based Authorization Middleware
 * Enforces default-deny: If the authenticated user's role is not within permitted roles,
 * rejects with 403 FORBIDDEN and logs a security audit event.
 */
export function requireRole(...allowedRoles: (UserRole | string)[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required before evaluating role authorization', 401, 'UNAUTHORIZED');
      return;
    }

    const userRole = req.user.role;

    // Super Admin has system-wide oversight
    if (userRole === UserRole.SUPER_ADMIN) {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Role unauthorized — record in tamper-evident audit ledger
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'ROLE_DENIED',
      entityType: 'Security',
      entityId: req.path,
      metadata: {
        userRole,
        allowedRoles,
        path: req.path,
        method: req.method,
      },
    });

    sendError(
      res,
      `Forbidden: Your role (${userRole}) is not authorized to access this resource`,
      403,
      'FORBIDDEN'
    );
  };
}
