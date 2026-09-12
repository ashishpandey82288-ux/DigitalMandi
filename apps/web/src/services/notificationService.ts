// ==============================================================================
// KisanFlow — Frontend Notification Service
// ==============================================================================

import { apiClient } from './apiClient.ts';

export interface NotificationDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  isRead: boolean;
  readAt?: string;
  link?: string;
  metadata?: any;
  createdAt: string;
}

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}): Promise<{ notifications: NotificationDTO[]; total: number; unreadCount: number }> {
  const res = await apiClient.get('/notifications', { params });
  return res.data.data;
}

export async function markNotificationAsRead(id: string): Promise<NotificationDTO> {
  const res = await apiClient.patch(`/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllNotificationsAsRead(): Promise<{ count: number }> {
  const res = await apiClient.patch('/notifications/read-all');
  return res.data.data;
}
