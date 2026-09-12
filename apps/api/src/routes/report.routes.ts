// ==============================================================================
// KisanFlow — Phase 5: Report Routes
// Role-protected endpoints for Operational & Analytical Reports
// ==============================================================================

import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(requireAuth);

router.get(
  '/procurement',
  requireRole(UserRole.CENTER_OPERATOR, UserRole.GOVERNMENT_ADMIN, UserRole.SUPER_ADMIN),
  ReportController.getProcurementReport
);

router.get(
  '/payments',
  requireRole(UserRole.GOVERNMENT_ADMIN, UserRole.SUPER_ADMIN),
  ReportController.getPaymentReport
);

router.get(
  '/quality',
  requireRole(
    UserRole.QUALITY_INSPECTOR,
    UserRole.CENTER_OPERATOR,
    UserRole.GOVERNMENT_ADMIN,
    UserRole.SUPER_ADMIN
  ),
  ReportController.getQualityReport
);

router.get(
  '/logistics',
  requireRole(UserRole.CENTER_OPERATOR, UserRole.GOVERNMENT_ADMIN, UserRole.SUPER_ADMIN),
  ReportController.getLogisticsReport
);

router.get(
  '/center-performance',
  requireRole(UserRole.CENTER_OPERATOR, UserRole.GOVERNMENT_ADMIN, UserRole.SUPER_ADMIN),
  ReportController.getCenterPerformanceReport
);

export default router;
