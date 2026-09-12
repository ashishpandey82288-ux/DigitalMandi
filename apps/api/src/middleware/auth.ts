// ==============================================================================
// KisanFlow — Secure Authentication & Role-Based Access Control (RBAC) Middleware
// Firebase Token Verification, PostgreSQL User Synchronization & Audit Logging
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/apiResponse.ts';
import { UserRole } from '../../../../packages/types/src/index.ts';
import { verifyFirebaseToken } from '../config/firebaseAdmin.ts';
import { findUserByFirebaseUid, syncFirebaseUser, ApplicationUser } from '../services/userService.ts';
import { recordAuditEvent } from '../services/auditService.ts';

// Extend Express Request with authenticated application user
export interface AuthenticatedRequest extends Request {
  user?: ApplicationUser;
}

/**
 * Authentication Middleware:
 * 1. Extracts Bearer token from Authorization header.
 * 2. Rejects missing or malformed headers immediately with 401.
 * 3. Verifies Firebase ID token (or synthetic demo token when DEMO_MODE=true).
 * 4. Loads and synchronizes PostgreSQL application user.
 * 5. Rejects inactive or disabled accounts with 403.
 * 6. Attaches sanitized user identity to Request object.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // 1. Validate header presence and formatting
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required: Bearer token missing or malformed', 401, 'UNAUTHORIZED');
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    sendError(res, 'Authentication required: Empty Bearer token', 401, 'UNAUTHORIZED');
    return;
  }

  try {
    // 2. Verify token via Firebase Admin (or DEMO_MODE handler)
    const decoded = await verifyFirebaseToken(token);

    // 3. Locate or synchronize PostgreSQL user
    let appUser = await findUserByFirebaseUid(decoded.uid);

    if (!appUser) {
      // Auto-sync safe default user (strictly role FARMER)
      appUser = await syncFirebaseUser({
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        phone: decoded.phone_number,
      });
    }

    // 4. Verify account status
    if (!appUser.isActive) {
      await recordAuditEvent({
        actorId: appUser.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'User',
        entityId: appUser.id,
        metadata: { reason: 'ACCOUNT_DISABLED', path: req.path },
      });

      sendError(res, 'Access denied: Your account has been deactivated or disabled', 403, 'FORBIDDEN');
      return;
    }

    // 5. Attach validated application user
    req.user = appUser;
    next();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Invalid authentication token';

    // Log security event without revealing internal stack or raw tokens
    await recordAuditEvent({
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      entityType: 'Security',
      entityId: 'AUTH_FAILURE',
      metadata: { path: req.path, method: req.method },
    });

    sendError(res, errorMsg, 401, 'UNAUTHORIZED');
  }
}

/**
 * RBAC Authorization Middleware:
 * Verifies that the authenticated user possesses at least one of the permitted roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required before role check', 401, 'UNAUTHORIZED');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log unauthorized privilege escalation attempt
      await recordAuditEvent({
        actorId: req.user.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'Security',
        entityId: req.user.id,
        metadata: {
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          endpoint: req.originalUrl,
          method: req.method,
        },
      });

      sendError(
        res,
        `Access denied: Role '${req.user.role}' is not authorized to access this resource`,
        403,
        'FORBIDDEN'
      );
      return;
    }

    next();
  };
}

/**
 * Re-export authenticateUser matching specification naming
 */
export const authenticateUser = requireAuth;
