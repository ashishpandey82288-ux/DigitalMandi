// ==============================================================================
// KisanFlow — Phase 5: Notification Routes
// Protected endpoints for user notification feeds and state management
// ==============================================================================

import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

router.get('/', NotificationController.listNotifications);
router.post('/read-all', NotificationController.markAllAsRead);
router.get('/:id', NotificationController.getNotificationById);
router.patch('/:id/read', NotificationController.markAsRead);
router.post('/', NotificationController.createNotification);

export default router;
