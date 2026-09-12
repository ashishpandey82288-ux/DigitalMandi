// ==============================================================================
// KisanFlow — Notification Bell & Dropdown Component
// Displays live unread count, popover list, and marks notifications as read
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, AlertCircle, Info, Sparkles } from 'lucide-react';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, NotificationDTO } from '../../services/notificationService.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const NotificationBell: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotifications({ limit: 8 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignore background notification failure
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAll = async () => {
    setLoading(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="notification-bell-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchUnread();
        }}
        className="relative p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl ring-1 ring-black/10 z-50 overflow-hidden border border-neutral-200">
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-neutral-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  disabled={loading}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center space-x-1"
                >
                  <CheckCheck className="w-3.5 h-3.5 mr-0.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500">
                No notifications found
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 text-xs transition-colors flex items-start justify-between gap-2 ${
                    item.isRead ? 'bg-white text-neutral-600' : 'bg-emerald-50/50 text-neutral-900 font-medium'
                  }`}
                >
                  <div className="flex items-start space-x-2.5">
                    <span className="mt-0.5">
                      {item.type.includes('PAYMENT') || item.type.includes('SUCCESS') ? (
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                      ) : item.type.includes('ALERT') ? (
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-600" />
                      )}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">{item.title}</div>
                      <p className="text-[11px] text-neutral-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <span className="text-[10px] text-neutral-400 mt-1 inline-block">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkOne(item.id, e)}
                      title="Mark as read"
                      className="text-neutral-400 hover:text-emerald-700 p-1 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
