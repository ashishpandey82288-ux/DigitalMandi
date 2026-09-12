// ==============================================================================
// KisanFlow — Phase 5: Dashboard Routes
// Role-protected endpoints for Farmer, Center Operator, and Admin Dashboards
// ==============================================================================

import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(requireAuth);

router.get(
  '/farmer',
  requireRole(UserRole.FARMER, UserRole.SUPER_ADMIN, UserRole.GOVERNMENT_ADMIN),
  DashboardController.getFarmerDashboard
);

router.get(
  '/center/:centerId',
  requireRole(
    UserRole.CENTER_OPERATOR,
    UserRole.QUALITY_INSPECTOR,
    UserRole.GOVERNMENT_ADMIN,
    UserRole.SUPER_ADMIN
  ),
  DashboardController.getCenterDashboard
);

router.get(
  '/admin',
  requireRole(UserRole.GOVERNMENT_ADMIN, UserRole.SUPER_ADMIN),
  DashboardController.getAdminDashboard
);

export default router;
