// ==============================================================================
// KisanFlow — Security Test & RBAC Verification Endpoints (Phase 2)
// Verifies requireAuth, requireRole, requireFarmOwnership, and requireCenterAccess
// ==============================================================================

import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.ts';
import { requireFarmOwnership, requireCenterAccess } from '../middleware/ownership.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { recordAuditEvent, getRecentAuditEvents } from '../services/auditService.ts';

const router = Router();

/**
 * GET /api/users/me
 * Protected current-user endpoint
 */
router.get('/users/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  sendSuccess(res, {
    user: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      phone: req.user!.phone,
      role: req.user!.role,
      isActive: req.user!.isActive,
      assignedCenterIds: req.user!.assignedCenterIds,
    },
  }, 'User profile retrieved successfully');
});

/**
 * GET /api/admin/security-test
 * Accessible strictly to: GOVERNMENT_ADMIN, SUPER_ADMIN
 */
router.get(
  '/admin/security-test',
  requireAuth,
  requireRole('GOVERNMENT_ADMIN', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    await recordAuditEvent({
      actorId: req.user!.id,
      action: 'SECURITY_TEST_EXECUTED',
      entityType: 'Security',
      entityId: 'ADMIN_TEST',
      metadata: { role: req.user!.role, path: req.path },
    });

    sendSuccess(res, {
      authorized: true,
      role: req.user!.role,
      accessLevel: 'STATE_NATIONAL_ADMINISTRATIVE_OVERSIGHT',
      testPassed: true,
      timestamp: new Date().toISOString(),
    }, 'Government Admin & Super Admin RBAC validation succeeded');
  }
);

/**
 * GET /api/center/security-test
 * Accessible strictly to: CENTER_OPERATOR, QUALITY_INSPECTOR, GOVERNMENT_ADMIN, SUPER_ADMIN
 */
router.get(
  '/center/security-test',
  requireAuth,
  requireRole('CENTER_OPERATOR', 'QUALITY_INSPECTOR', 'GOVERNMENT_ADMIN', 'SUPER_ADMIN'),
  async (req: AuthenticatedRequest, res: Response) => {
    await recordAuditEvent({
      actorId: req.user!.id,
      action: 'SECURITY_TEST_EXECUTED',
      entityType: 'Security',
      entityId: 'CENTER_TEST',
      metadata: { role: req.user!.role, path: req.path },
    });

    sendSuccess(res, {
      authorized: true,
      role: req.user!.role,
      accessLevel: 'PROCUREMENT_CENTER_OPERATIONS',
      testPassed: true,
      timestamp: new Date().toISOString(),
    }, 'Procurement Center Operations RBAC validation succeeded');
  }
);

/**
 * GET /api/farmer/security-test
 * Accessible strictly to: FARMER
 */
router.get(
  '/farmer/security-test',
  requireAuth,
  requireRole('FARMER'),
  async (req: AuthenticatedRequest, res: Response) => {
    await recordAuditEvent({
      actorId: req.user!.id,
      action: 'SECURITY_TEST_EXECUTED',
      entityType: 'Security',
      entityId: 'FARMER_TEST',
      metadata: { role: req.user!.role, path: req.path },
    });

    sendSuccess(res, {
      authorized: true,
      role: req.user!.role,
      accessLevel: 'KISAN_PORTAL_ONLY',
      testPassed: true,
      timestamp: new Date().toISOString(),
    }, 'Farmer RBAC validation succeeded');
  }
);

/**
 * GET /api/farms/:farmId
 * IDOR Verification: Verifies farm ownership (or Admin oversight)
 */
router.get(
  '/farms/:farmId',
  requireAuth,
  requireFarmOwnership('farmId'),
  (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, {
      farmId: req.params.farmId,
      ownerUserId: req.user!.id,
      verifiedOwnership: true,
      surveyNumber: 'KH-882/19',
      areaAcres: 6.5,
      crop: 'Wheat (Gehun)',
    }, 'IDOR check passed: Farm parcel verified for authenticated owner');
  }
);

/**
 * GET /api/centers/:centerId/operations
 * Center-Level Isolation: Verifies operator assignment to this specific center
 */
router.get(
  '/centers/:centerId/operations',
  requireAuth,
  requireCenterAccess('centerId'),
  (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, {
      centerId: req.params.centerId,
      authorizedOperatorId: req.user!.id,
      role: req.user!.role,
      assignedCenters: req.user!.assignedCenterIds,
      baysActive: 4,
      dailyCapacityQuintals: 15000,
    }, 'Center authorization passed: Operator assigned to this procurement center');
  }
);

/**
 * GET /api/security/audit-trail
 * Retrieves recent cryptographic tamper-evident audit events
 */
router.get(
  '/security/audit-trail',
  requireAuth,
  requireRole('GOVERNMENT_ADMIN', 'SUPER_ADMIN', 'QUALITY_INSPECTOR', 'CENTER_OPERATOR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const events = await getRecentAuditEvents(limit);
    sendSuccess(res, { events, count: events.length }, 'Audit trail ledger retrieved successfully');
  }
);

export default router;
