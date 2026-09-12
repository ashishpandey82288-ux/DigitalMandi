// ==============================================================================
// KisanFlow — Phase 5: Report Controller
// Exposes API handlers for Procurement, Payments, Quality, Logistics, & Center Reports
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/reportService.ts';
import { ApiError } from '../middleware/errorHandler.ts';

export class ReportController {
  /**
   * GET /api/reports/procurement
   */
  public static async getProcurementReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const cropId = typeof req.query.cropId === 'string' ? req.query.cropId : undefined;
      const centerId = typeof req.query.centerId === 'string' ? req.query.centerId : undefined;
      const state = typeof req.query.state === 'string' ? req.query.state : undefined;
      const district = typeof req.query.district === 'string' ? req.query.district : undefined;

      const report = await ReportService.getProcurementReport({
        startDate,
        endDate,
        cropId,
        centerId,
        state,
        district,
      });

      return res.status(200).json({
        status: 'success',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/payments
   */
  public static async getPaymentReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const cropId = typeof req.query.cropId === 'string' ? req.query.cropId : undefined;
      const centerId = typeof req.query.centerId === 'string' ? req.query.centerId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const report = await ReportService.getPaymentReport({
        startDate,
        endDate,
        cropId,
        centerId,
        status,
      });

      return res.status(200).json({
        status: 'success',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/quality
   */
  public static async getQualityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const cropId = typeof req.query.cropId === 'string' ? req.query.cropId : undefined;
      const centerId = typeof req.query.centerId === 'string' ? req.query.centerId : undefined;

      const report = await ReportService.getQualityReport({
        startDate,
        endDate,
        cropId,
        centerId,
      });

      return res.status(200).json({
        status: 'success',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/logistics
   */
  public static async getLogisticsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const cropId = typeof req.query.cropId === 'string' ? req.query.cropId : undefined;
      const centerId = typeof req.query.centerId === 'string' ? req.query.centerId : undefined;
      const transporterId = typeof req.query.transporterId === 'string' ? req.query.transporterId : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;

      const report = await ReportService.getLogisticsReport({
        startDate,
        endDate,
        cropId,
        centerId,
        transporterId,
        status,
      });

      return res.status(200).json({
        status: 'success',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/center-performance
   */
  public static async getCenterPerformanceReport(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const centerId = typeof req.query.centerId === 'string' ? req.query.centerId : undefined;
      const district = typeof req.query.district === 'string' ? req.query.district : undefined;
      const state = typeof req.query.state === 'string' ? req.query.state : undefined;

      const report = await ReportService.getCenterPerformanceReport({
        startDate,
        endDate,
        centerId,
        district,
        state,
      });

      return res.status(200).json({
        status: 'success',
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }
}
