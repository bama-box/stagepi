import { createContext } from 'preact';
import { useContext, useState, useEffect, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

export type NotificationType = 'error' | 'warning' | 'info' | 'success';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
  source?: string; // e.g. "AES67", "Ethernet", "Wi-Fi", "Bluetooth", "AirPlay", "System"
  streamId?: string; // For supervisor stream log drill-down
  timestamp: string; // ISO string for easy serialization
  read: boolean;
}

export interface NotifyOptions {
  type?: NotificationType;
  title?: string;
  message: string;
  details?: string;
  source?: string;
  streamId?: string;
}

export interface NotificationContextType {
  notifications: NotificationItem[];
  activeToasts: NotificationItem[];
  unreadCount: number;
  unreadErrorCount: number;
  isDrawerOpen: boolean;
  focusedNotificationId: string | null;
  activeLogStreamId: string | null;
  notify: (options: NotifyOptions | string) => string;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  openDrawer: (focusId?: string) => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  openStreamLogs: (streamId: string) => void;
  closeStreamLogs: () => void;
}

const STORAGE_KEY = 'stagepi_notifications_v1';

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ComponentChildren }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse errors
    }
    return [];
  });

  const [activeToasts, setActiveToasts] = useState<NotificationItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedNotificationId, setFocusedNotificationId] = useState<string | null>(null);
  const [activeLogStreamId, setActiveLogStreamId] = useState<string | null>(null);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      // Keep only the latest 100 notifications
      const capped = notifications.slice(0, 100);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    } catch {
      // Ignore storage errors
    }
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((options: NotifyOptions | string) => {
    const opts: NotifyOptions = typeof options === 'string' ? { message: options, type: 'info' } : options;
    const type: NotificationType = opts.type || 'info';
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    let defaultTitle = 'Notification';
    if (type === 'error') defaultTitle = 'Error';
    else if (type === 'warning') defaultTitle = 'Warning';
    else if (type === 'success') defaultTitle = 'Success';
    else if (type === 'info') defaultTitle = 'Information';

    const newItem: NotificationItem = {
      id,
      type,
      title: opts.title || defaultTitle,
      message: opts.message,
      details: opts.details,
      source: opts.source || 'System',
      streamId: opts.streamId,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newItem, ...prev.slice(0, 99)]);
    setActiveToasts((prev) => [...prev, newItem]);

    // Auto-dismiss toast
    const dismissDuration = type === 'error' ? 7000 : type === 'warning' ? 5000 : 4000;
    setTimeout(() => {
      dismissToast(id);
    }, dismissDuration);

    return id;
  }, [dismissToast]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setActiveToasts([]);
  }, []);

  const openDrawer = useCallback((focusId?: string) => {
    setIsDrawerOpen(true);
    if (focusId) {
      setFocusedNotificationId(focusId);
      markAsRead(focusId);
    }
  }, [markAsRead]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setFocusedNotificationId(null);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((prev) => !prev);
  }, []);

  const openStreamLogs = useCallback((streamId: string) => {
    setActiveLogStreamId(streamId);
    setIsDrawerOpen(true);
  }, []);

  const closeStreamLogs = useCallback(() => {
    setActiveLogStreamId(null);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadErrorCount = notifications.filter((n) => !n.read && n.type === 'error').length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        activeToasts,
        unreadCount,
        unreadErrorCount,
        isDrawerOpen,
        focusedNotificationId,
        activeLogStreamId,
        notify,
        dismissToast,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        openStreamLogs,
        closeStreamLogs,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
