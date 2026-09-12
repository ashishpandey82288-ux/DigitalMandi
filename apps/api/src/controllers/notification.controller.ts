// ==============================================================================
// KisanFlow — Phase 5: Notification Controller
// Exposes endpoints for farmer notifications, mark as read, and bulk operations
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notificationService.ts';
import { ApiError } from '../middleware/errorHandler.ts';

export class NotificationController {
  /**
   * GET /api/notifications
   * List notifications for authenticated user
   */
  public static async listNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const unread = req.query.unread !== undefined ? req.query.unread === 'true' : undefined;
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await NotificationService.getNotifications(user.id, {
        unread,
        type,
        limit,
        offset,
      });

      return res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/notifications/:id
   * Get single notification with IDOR check
   */
  public static async getNotificationById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const { id } = req.params;
      const notification = await NotificationService.getNotificationById(
        user.id,
        id,
        user.role
      );

      return res.status(200).json({
        status: 'success',
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Mark single notification as read
   */
  public static async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const { id } = req.params;
      const notification = await NotificationService.markAsRead(user.id, id);

      return res.status(200).json({
        status: 'success',
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/notifications/read-all
   * Mark all unread notifications as read
   */
  public static async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      const result = await NotificationService.markAllAsRead(user.id);

      return res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/notifications
   * Create notification (Administrative/Testing endpoint)
   */
  public static async createNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new ApiError(401, 'Unauthorized');
      }

      // Allow users to create notifications for themselves, or admins for anyone
      const targetUserId = req.body.userId || user.id;
      const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'GOVERNMENT_ADMIN';

      if (targetUserId !== user.id && !isAdmin) {
        throw new ApiError(403, 'Forbidden: Cannot create notifications for other users');
      }

      const notification = await NotificationService.createNotification({
        userId: targetUserId,
        type: req.body.type || 'SYSTEM',
        title: req.body.title,
        message: req.body.message,
        severity: req.body.severity || 'INFO',
        channel: req.body.channel || 'IN_APP',
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        reference: req.body.reference,
        metadata: req.body.metadata,
      });

      return res.status(201).json({
        status: 'success',
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }
}
