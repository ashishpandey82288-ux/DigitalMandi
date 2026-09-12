// ==============================================================================
// KisanFlow — Phase 5: Dashboard Controller
// Exposes API handlers for Farmer, Center, and Admin dashboards
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboardService.ts';
import { ApiError } from '../middleware/errorHandler.ts';

export class DashboardController {
  /**
   * GET /api/dashboard/farmer
   * Aggregated dashboard view for the logged-in farmer
   */
  public static async getFarmerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const dashboard = await DashboardService.getFarmerDashboard(user.id);

      return res.status(200).json({
        status: 'success',
        data: dashboard,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/center/:centerId
   * Operational dashboard view for procurement center operators and inspectors
   */
  public static async getCenterDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const { centerId } = req.params;
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const cropId = typeof req.query.cropId === 'string' ? req.query.cropId : undefined;

      const dashboard = await DashboardService.getCenterDashboard(
        centerId,
        {
          id: user.id,
          role: user.role,
          operatorCenterId: user.operatorCenterId,
        },
        { date, cropId }
      );

      return res.status(200).json({
        status: 'success',
        data: dashboard,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/dashboard/admin
   * High-level aggregated dashboard view for administrators
   */
  public static async getAdminDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const centerId = typeof req.query.centerId === 'string' ? req.query.centerId : undefined;
      const cropId = typeof req.query.cropId === 'string' ? req.query.cropId : undefined;
      const state = typeof req.query.state === 'string' ? req.query.state : undefined;
      const district = typeof req.query.district === 'string' ? req.query.district : undefined;

      const dashboard = await DashboardService.getAdminDashboard({
        startDate,
        endDate,
        centerId,
        cropId,
        state,
        district,
      });

      return res.status(200).json({
        status: 'success',
        data: dashboard,
      });
    } catch (err) {
      next(err);
    }
  }
}
