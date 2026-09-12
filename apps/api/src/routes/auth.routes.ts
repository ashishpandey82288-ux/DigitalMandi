// ==============================================================================
// KisanFlow — Authentication & Identity API Routes
// Endpoints for /api/auth/me, /api/auth/sync, /api/auth/logout, and demo login
// ==============================================================================

import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest, requireRole } from '../middleware/auth.ts';
import { sendSuccess, sendError } from '../utils/apiResponse.ts';
import { env } from '../config/env.ts';
import { findUserByEmail, ApplicationUser } from '../services/userService.ts';
import { recordAuditEvent, getRecentAuditEvents, verifyAuditChainIntegrity } from '../services/auditService.ts';
import { authRateLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

/**
 * GET /api/auth/me
 * Returns authenticated application user details
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    sendError(res, 'User identity not found in request context', 401, 'UNAUTHORIZED');
    return;
  }

  sendSuccess(res, {
    user: {
      id: req.user.id,
      firebaseUid: req.user.firebaseUid,
      email: req.user.email,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      isActive: req.user.isActive,
      operatorCenterId: req.user.operatorCenterId,
      assignedCenterIds: req.user.assignedCenterIds,
      createdAt: req.user.createdAt,
    },
  }, 'Authenticated user profile retrieved successfully');
});

/**
 * POST /api/auth/sync
 * Synchronizes user upon Firebase login/registration
 */
router.post('/sync', authRateLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    sendError(res, 'User identity not found in request context', 401, 'UNAUTHORIZED');
    return;
  }

  await recordAuditEvent({
    actorId: req.user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: req.user.id,
    metadata: {
      loginMethod: req.headers.authorization?.startsWith('Bearer demo-token-') ? 'DEMO_TOKEN' : 'FIREBASE_ID_TOKEN',
      role: req.user.role,
    },
  });

  sendSuccess(res, {
    user: {
      id: req.user.id,
      firebaseUid: req.user.firebaseUid,
      email: req.user.email,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      isActive: req.user.isActive,
      assignedCenterIds: req.user.assignedCenterIds,
    },
  }, 'User identity synchronized successfully');
});

/**
 * POST /api/auth/logout
 * Logs out user and records cryptographic audit trail
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: req.user.id,
      metadata: { role: req.user.role },
    });
  }

  sendSuccess(res, { loggedOut: true }, 'Successfully logged out');
});

/**
 * POST /api/auth/demo-login
 * Available strictly when DEMO_MODE=true for Smart India Hackathon evaluation
 */
router.post('/demo-login', authRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  if (!env.DEMO_MODE) {
    sendError(res, 'Demo mode authentication is disabled in production environments', 403, 'FORBIDDEN');
    return;
  }

  const roleOrEmail = req.body?.role || req.body?.email || 'FARMER';
  let tokenKey = 'farmer';

  if (typeof roleOrEmail === 'string') {
    const lower = roleOrEmail.toLowerCase();
    if (lower.includes('superadmin')) tokenKey = 'superadmin';
    else if (lower.includes('admin')) tokenKey = 'admin';
    else if (lower.includes('inspector')) tokenKey = 'inspector';
    else if (lower.includes('operator')) tokenKey = 'operator';
    else tokenKey = 'farmer';
  }

  const token = `demo-token-${tokenKey}`;

  // Find user details corresponding to token
  const demoEmailMap: Record<string, string> = {
    farmer: 'demo.farmer@kisanflow.local',
    operator: 'demo.operator@kisanflow.local',
    inspector: 'demo.inspector@kisanflow.local',
    admin: 'demo.admin@kisanflow.local',
    superadmin: 'demo.superadmin@kisanflow.local',
  };

  const user = await findUserByEmail(demoEmailMap[tokenKey]);

  if (user) {
    await recordAuditEvent({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { demoMode: true, role: user.role },
    });
  }

  sendSuccess(res, {
    token,
    user: user ? {
      id: user.id,
      firebaseUid: user.firebaseUid,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      assignedCenterIds: user.assignedCenterIds,
    } : null,
  }, `Authenticated as synthetic demo account (${tokenKey.toUpperCase()})`);
});

/**
 * GET /api/auth/audit-trail
 * Protected administrative view of cryptographic audit events
 */
router.get('/audit-trail', requireAuth, requireRole('GOVERNMENT_ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const events = await getRecentAuditEvents(25);
  sendSuccess(res, { events }, 'Cryptographic audit ledger retrieved');
});

/**
 * GET /api/auth/audit-trail/verify
 * Cryptographic SHA-256 verification of the full tamper-evident audit ledger chain
 */
router.get('/audit-trail/verify', requireAuth, requireRole('GOVERNMENT_ADMIN', 'SUPER_ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const verification = await verifyAuditChainIntegrity();
  sendSuccess(res, verification, 'Cryptographic audit ledger chain verification completed');
});

/**
 * Development & Verification RBAC Test Endpoints (Phase 2 Specification)
 */
router.get('/test/farmer', requireAuth, requireRole('FARMER', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, { authorized: true, role: req.user?.role, userId: req.user?.id }, 'Farmer role authorization verified');
});

router.get('/test/operator', requireAuth, requireRole('CENTER_OPERATOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, { authorized: true, role: req.user?.role, userId: req.user?.id }, 'Center Operator role authorization verified');
});

router.get('/test/inspector', requireAuth, requireRole('QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, { authorized: true, role: req.user?.role, userId: req.user?.id }, 'Quality Inspector role authorization verified');
});

router.get('/test/admin', requireAuth, requireRole('GOVERNMENT_ADMIN', 'SUPER_ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, { authorized: true, role: req.user?.role, userId: req.user?.id }, 'Government Admin role authorization verified');
});

export default router;
