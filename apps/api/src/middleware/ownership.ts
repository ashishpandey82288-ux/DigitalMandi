// ==============================================================================
// KisanFlow — Resource Ownership & Center-Level Authorization Middleware
// IDOR Prevention, Center Isolation & Broken Object Level Authorization Defense
// ==============================================================================

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.ts';
import { sendError } from '../utils/apiResponse.ts';
import { prisma } from '../config/prisma.ts';
import { recordAuditEvent } from '../services/auditService.ts';

// Demo farms for IDOR testing in synthetic environment
const demoFarms: Record<string, { id: string; userId: string; surveyNumber: string }> = {
  'farm-farmer-01': {
    id: 'farm-farmer-01',
    userId: 'user-demo-farmer-01',
    surveyNumber: 'KH-882/19',
  },
  'farm-farmer-02': {
    id: 'farm-farmer-02',
    userId: 'user-demo-farmer-02',
    surveyNumber: 'KH-102/4',
  },
};

/**
 * IDOR Defense Middleware:
 * Verifies that the authenticated user owns the requested farm parcel.
 * Admins are permitted for oversight.
 */
export function requireFarmOwnership(paramKey = 'farmId') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const farmId = req.params[paramKey] || req.body?.[paramKey] || (req.query?.[paramKey] as string);
    if (!farmId) {
      sendError(res, 'Farm ID parameter missing', 400, 'BAD_REQUEST');
      return;
    }

    // Admins have oversight authority
    if (req.user.role === 'GOVERNMENT_ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Check synthetic demo farms
    const demoFarm = demoFarms[farmId];
    if (demoFarm) {
      if (demoFarm.userId === req.user.id) {
        return next();
      }

      // IDOR breach attempt detected
      await recordAuditEvent({
        actorId: req.user.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'Farm',
        entityId: farmId,
        metadata: {
          violationType: 'IDOR_FARM_OWNERSHIP_MISMATCH',
          targetFarmId: farmId,
          requestedByUserId: req.user.id,
        },
      });

      sendError(res, 'Access forbidden: You do not have ownership of this farm land parcel', 403, 'FORBIDDEN');
      return;
    }

    // Check PostgreSQL database
    try {
      const farm = await prisma.farm.findUnique({
        where: { id: farmId },
        include: { farmerProfile: { select: { userId: true } } },
      });

      if (!farm) {
        sendError(res, 'Requested farm not found', 404, 'NOT_FOUND');
        return;
      }

      if (farm.farmerProfile.userId !== req.user.id) {
        await recordAuditEvent({
          actorId: req.user.id,
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          entityType: 'Farm',
          entityId: farmId,
          metadata: {
            violationType: 'IDOR_FARM_OWNERSHIP_MISMATCH',
            targetFarmId: farmId,
            requestedByUserId: req.user.id,
          },
        });

        sendError(res, 'Access forbidden: You do not have ownership of this farm land parcel', 403, 'FORBIDDEN');
        return;
      }

      next();
    } catch {
      sendError(res, 'Unable to verify farm ownership due to database error', 500, 'INTERNAL_SERVER_ERROR');
    }
  };
}

/**
 * Center-Level Authorization Middleware:
 * Verifies that a CENTER_OPERATOR or QUALITY_INSPECTOR is explicitly assigned
 * to the specified procurement center (PC-HR-KAR-01, etc.).
 * Prevents horizontal escalation across mandi centers.
 */
export function requireCenterAccess(paramKey = 'centerId') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401, 'UNAUTHORIZED');
      return;
    }

    const centerId = req.params[paramKey] || req.body?.[paramKey] || (req.query?.[paramKey] as string);
    if (!centerId) {
      sendError(res, 'Procurement Center ID parameter missing', 400, 'BAD_REQUEST');
      return;
    }

    // Admins possess state/national multi-center authority
    if (req.user.role === 'GOVERNMENT_ADMIN' || req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Center Operators & Quality Inspectors must be assigned
    if (req.user.role === 'CENTER_OPERATOR' || req.user.role === 'QUALITY_INSPECTOR') {
      const isAssigned =
        req.user.assignedCenterIds.includes(centerId) ||
        req.user.operatorCenterId === centerId;

      if (isAssigned) {
        return next();
      }

      // Unauthorized center access attempt
      await recordAuditEvent({
        actorId: req.user.id,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        entityType: 'ProcurementCenter',
        entityId: centerId,
        metadata: {
          violationType: 'CENTER_AUTHORIZATION_MISMATCH',
          targetCenterId: centerId,
          userAssignedCenters: req.user.assignedCenterIds,
          userRole: req.user.role,
        },
      });

      sendError(
        res,
        `Access forbidden: You are not assigned to Procurement Center '${centerId}'`,
        403,
        'FORBIDDEN'
      );
      return;
    }

    // Other roles (e.g. Farmer) do not have center operator/management rights
    await recordAuditEvent({
      actorId: req.user.id,
      action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
      entityType: 'ProcurementCenter',
      entityId: centerId,
      metadata: {
        violationType: 'ROLE_NOT_AUTHORIZED_FOR_CENTER_MANAGEMENT',
        userRole: req.user.role,
      },
    });

    sendError(res, 'Access forbidden: Role does not have procurement center operational privileges', 403, 'FORBIDDEN');
  };
}
