// ==============================================================================
// KisanFlow — Phase 5: Notification Service
// Handles persistent domain notifications, deduplication, and IDOR protection
// ==============================================================================

import { prisma } from '../config/prisma.ts';
import {
  NotificationDTO,
  CreateNotificationDTO,
  NotificationType,
  NotificationSeverity,
} from '@kisanflow/types';
import { ApiError } from '../middleware/errorHandler.ts';

export interface GetNotificationFilters {
  unread?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  /**
   * Create a persistent notification with deduplication protection.
   */
  public static async createNotification(
    params: CreateNotificationDTO
  ): Promise<NotificationDTO> {
    const {
      userId,
      type,
      title,
      message,
      severity = 'INFO',
      channel = 'IN_APP',
      entityType,
      entityId,
      reference,
      metadata,
    } = params;

    // Deduplication check: prevent multiple identical unread notifications for the same entity event
    if (entityType && entityId) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type,
          entityType,
          entityId,
          isRead: false,
        },
      });

      if (existing) {
        return this.formatNotification(existing);
      }
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type as string,
        title,
        message,
        severity: severity as string,
        channel: channel as any,
        isRead: false,
        sentStatus: 'DELIVERED',
        entityType: entityType || null,
        entityId: entityId || null,
        reference: reference || null,
        metadata: metadata || null,
        readAt: null,
      },
    });

    return this.formatNotification(notification);
  }

  /**
   * Get paginated notifications for a specific user.
   */
  public static async getNotifications(
    userId: string,
    filters?: GetNotificationFilters
  ): Promise<{ notifications: NotificationDTO[]; total: number; unreadCount: number }> {
    const whereClause: {
      userId: string;
      type?: string;
      isRead?: boolean;
    } = { userId };

    if (filters?.unread !== undefined) {
      whereClause.isRead = !filters.unread ? undefined : true;
      if (filters.unread === true) {
        whereClause.isRead = false; // "unread = true" means isRead = false
      }
    }

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    const [allList, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: filters?.offset || 0,
        take: filters?.limit || 50,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications: allList.map((n: any) => this.formatNotification(n)),
      total,
      unreadCount,
    };
  }

  /**
   * Get single notification by ID with strict IDOR verification.
   */
  public static async getNotificationById(
    userId: string,
    notificationId: string,
    userRole?: string
  ): Promise<NotificationDTO> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    // IDOR protection: only recipient or administrative users can access
    const isOwner = notification.userId === userId;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'GOVERNMENT_ADMIN';

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'Forbidden: You are not authorized to access this notification');
    }

    return this.formatNotification(notification);
  }

  /**
   * Mark a single notification as read with ownership validation.
   */
  public static async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<NotificationDTO> {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new ApiError(404, 'Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ApiError(403, 'Forbidden: You cannot modify another user’s notification');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.formatNotification(updated);
  }

  /**
   * Mark all unread notifications for a user as read.
   */
  public static async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Event Helpers
   */
  public static async notifyBookingConfirmed(booking: {
    id: string;
    bookingNumber: string;
    farmerProfile: { userId: string };
    crop?: { name: string };
    estimatedQuantityQuintals: number | { toString: () => string };
    tokenNumber: string;
  }): Promise<NotificationDTO | null> {
    if (!booking.farmerProfile?.userId) return null;
    return this.createNotification({
      userId: booking.farmerProfile.userId,
      type: 'BOOKING_CONFIRMED',
      title: `Booking Confirmed: #${booking.bookingNumber}`,
      message: `Your procurement slot for ${booking.crop?.name || 'crop'} (${booking.estimatedQuantityQuintals} Qtl) has been confirmed. Gate Token: ${booking.tokenNumber}.`,
      severity: 'SUCCESS',
      entityType: 'BOOKING',
      entityId: booking.id,
      reference: booking.bookingNumber,
    });
  }

  public static async notifyBookingCancelled(
    booking: {
      id: string;
      bookingNumber: string;
      farmerProfile: { userId: string };
    },
    reason?: string
  ): Promise<NotificationDTO | null> {
    if (!booking.farmerProfile?.userId) return null;
    return this.createNotification({
      userId: booking.farmerProfile.userId,
      type: 'BOOKING_CANCELLED',
      title: `Booking Cancelled: #${booking.bookingNumber}`,
      message: `Your booking #${booking.bookingNumber} was cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      severity: 'WARNING',
      entityType: 'BOOKING',
      entityId: booking.id,
      reference: booking.bookingNumber,
    });
  }

  public static async notifyGateCheckIn(booking: {
    id: string;
    bookingNumber: string;
    tokenNumber: string;
    farmerProfile: { userId: string };
  }): Promise<NotificationDTO | null> {
    if (!booking.farmerProfile?.userId) return null;
    return this.createNotification({
      userId: booking.farmerProfile.userId,
      type: 'GATE_CHECKIN',
      title: `Gate Check-In Verified: Token ${booking.tokenNumber}`,
      message: `Your arrival at the procurement center has been verified. Please proceed to the assigned quality inspection bay.`,
      severity: 'INFO',
      entityType: 'BOOKING',
      entityId: booking.id,
      reference: booking.bookingNumber,
    });
  }

  public static async notifyQualityCompleted(inspection: {
    id: string;
    bookingId: string;
    farmerProfile: { userId: string };
    finalGrade: string;
    moisturePercentage: number | { toString: () => string };
    isMoisturePass: boolean;
  }): Promise<NotificationDTO | null> {
    if (!inspection.farmerProfile?.userId) return null;
    const isPass = inspection.isMoisturePass;
    return this.createNotification({
      userId: inspection.farmerProfile.userId,
      type: isPass ? 'QUALITY_COMPLETED' : 'QUALITY_REVIEW_REQUIRED',
      title: isPass ? `Quality Assessment Passed: Grade ${inspection.finalGrade}` : `Quality Inspection Notice`,
      message: isPass
        ? `Moisture: ${inspection.moisturePercentage}%. Final Grade: ${inspection.finalGrade}. Please proceed to the weighbridge.`
        : `Moisture: ${inspection.moisturePercentage}% exceeded standard threshold. Quality deduction applied or re-drying recommended.`,
      severity: isPass ? 'SUCCESS' : 'WARNING',
      entityType: 'QUALITY_INSPECTION',
      entityId: inspection.id,
      reference: inspection.bookingId,
    });
  }

  public static async notifyWeighmentCompleted(weighment: {
    id: string;
    bookingId: string;
    netWeightQuintals: number | { toString: () => string };
    finalPayableAmount: number | { toString: () => string };
    farmerUserId: string;
  }): Promise<NotificationDTO | null> {
    if (!weighment.farmerUserId) return null;
    return this.createNotification({
      userId: weighment.farmerUserId,
      type: 'WEIGHMENT_COMPLETED',
      title: `Official Weighment Recorded`,
      message: `Net Weight: ${weighment.netWeightQuintals} Quintals. Calculated Gross Amount: ₹${weighment.finalPayableAmount}. Settlement generation initiated.`,
      severity: 'SUCCESS',
      entityType: 'WEIGHMENT',
      entityId: weighment.id,
      reference: weighment.bookingId,
    });
  }

  public static async notifyPaymentSuccess(payment: {
    id: string;
    paymentReference: string;
    amountInr: number | { toString: () => string };
    utrNumber?: string | null;
    farmerUserId: string;
  }): Promise<NotificationDTO | null> {
    if (!payment.farmerUserId) return null;
    return this.createNotification({
      userId: payment.farmerUserId,
      type: 'PAYMENT_SUCCESS',
      title: `Direct Benefit Transfer (DBT) Credited: ₹${payment.amountInr}`,
      message: `Payment reference #${payment.paymentReference} was successfully processed via PFMS/DBT. UTR: ${payment.utrNumber || 'N/A'}.`,
      severity: 'SUCCESS',
      entityType: 'PAYMENT',
      entityId: payment.id,
      reference: payment.paymentReference,
    });
  }

  public static async notifyPaymentFailed(
    payment: {
      id: string;
      paymentReference: string;
      amountInr: number | { toString: () => string };
      farmerUserId: string;
    },
    reason?: string
  ): Promise<NotificationDTO | null> {
    if (!payment.farmerUserId) return null;
    return this.createNotification({
      userId: payment.farmerUserId,
      type: 'PAYMENT_FAILED',
      title: `Payment Processing Alert`,
      message: `Direct disbursement for ₹${payment.amountInr} encountered an issue: ${reason || 'Bank processing error'}. Automatic retry scheduled.`,
      severity: 'ERROR',
      entityType: 'PAYMENT',
      entityId: payment.id,
      reference: payment.paymentReference,
    });
  }

  public static async notifyTransportDispatched(request: {
    id: string;
    requestReference: string;
    farmerUserId?: string;
    destinationName: string;
    vehicleRegistration?: string | null;
  }): Promise<NotificationDTO | null> {
    if (!request.farmerUserId) return null;
    return this.createNotification({
      userId: request.farmerUserId,
      type: 'TRANSPORT_DISPATCHED',
      title: `Crop Shipment Dispatched`,
      message: `Your procured grain is in transit to ${request.destinationName} via vehicle ${request.vehicleRegistration || 'assigned transport'}.`,
      severity: 'INFO',
      entityType: 'TRANSPORT_REQUEST',
      entityId: request.id,
      reference: request.requestReference,
    });
  }

  public static async notifyTransportDelivered(request: {
    id: string;
    requestReference: string;
    farmerUserId?: string;
    destinationName: string;
  }): Promise<NotificationDTO | null> {
    if (!request.farmerUserId) return null;
    return this.createNotification({
      userId: request.farmerUserId,
      type: 'TRANSPORT_DELIVERED',
      title: `Shipment Successfully Delivered`,
      message: `Your procured grain has arrived and been unloaded safely at ${request.destinationName}.`,
      severity: 'SUCCESS',
      entityType: 'TRANSPORT_REQUEST',
      entityId: request.id,
      reference: request.requestReference,
    });
  }

  private static formatNotification(n: any): NotificationDTO {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      severity: (n.severity as NotificationSeverity) || 'INFO',
      channel: n.channel || 'IN_APP',
      isRead: n.isRead,
      sentStatus: n.sentStatus || 'DELIVERED',
      entityType: n.entityType || null,
      entityId: n.entityId || null,
      reference: n.reference || null,
      metadata: n.metadata || null,
      readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
      createdAt: new Date(n.createdAt).toISOString(),
      updatedAt: n.updatedAt ? new Date(n.updatedAt).toISOString() : undefined,
    };
  }
}
