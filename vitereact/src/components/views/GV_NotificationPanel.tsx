import React, { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/main';
import axios from 'axios';

// Notification interfaces
interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  auto_dismiss: boolean;
  duration: number;
  timestamp: number;
}

interface NotificationResponse {
  notifications: any[];
  unread_count: number;
  total: number;
}

interface SystemAlertResponse {
  alerts: any[];
  total: number;
}

const GV_NotificationPanel: React.FC = () => {
  // Zustand selectors - individual to prevent infinite loops
  const currentUser = useAppStore(state => state.authentication_state.current_user);
  const authToken = useAppStore(state => state.authentication_state.auth_token);
  const isAuthenticated = useAppStore(state => state.authentication_state.authentication_status.is_authenticated);
  const notificationsState = useAppStore(state => state.notifications_state);
  const socket = useAppStore(state => state.socket);
  
  // Zustand actions
  const setUnreadNotifications = useAppStore(state => state.set_unread_notifications);
  const setSystemAlerts = useAppStore(state => state.set_system_alerts);
  const addSystemAlert = useAppStore(state => state.add_system_alert);
  const markNotificationRead = useAppStore(state => state.mark_notification_read);

  // Local state for toast notifications
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  const queryClient = useQueryClient();

  // Fetch user notifications for authenticated users
  const { data: userNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', currentUser?.user_id],
    queryFn: async (): Promise<NotificationResponse> => {
      if (!authToken || !currentUser?.user_id) {
        throw new Error('No authentication token available');
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/notifications`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
          params: {
            user_id: currentUser.user_id,
            is_read: false,
            limit: 20,
            sort_by: 'created_at',
            sort_order: 'desc'
          }
        }
      );
      return response.data;
    },
    enabled: !!authToken && !!currentUser?.user_id,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Fetch system alerts for all users
  const { data: systemAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['system-alerts'],
    queryFn: async (): Promise<SystemAlertResponse> => {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/system-alerts`,
        {
          params: {
            is_active: true,
            limit: 10
          }
        }
      );
      return response.data;
    },
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!authToken) throw new Error('No authentication token');
      
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/notifications/${notificationId}`,
        {
          is_read: true,
          read_at: new Date().toISOString()
        },
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
    },
    onSuccess: (_, notificationId) => {
      markNotificationRead(notificationId);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      console.error('Failed to mark notification as read:', error);
      addToastNotification('error', 'Failed to update notification');
    }
  });

  // Add toast notification helper
  const addToastNotification = useCallback((
    type: ToastNotification['type'], 
    message: string, 
    autoDismiss = true, 
    duration = 5000
  ) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const toast: ToastNotification = {
      id,
      type,
      message,
      auto_dismiss: autoDismiss,
      duration,
      timestamp: Date.now()
    };

    setToastNotifications(prev => [...prev, toast]);

    if (autoDismiss) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, []);

  // Dismiss toast notification
  const dismissToast = useCallback((toastId: string) => {
    setToastNotifications(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notificationId: string) => {
    try {
      await markAsReadMutation.mutateAsync(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // WebSocket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for real-time notifications
    const handleNotificationReceived = (data: any) => {
      console.log('Notification received:', data);
      addToastNotification('info', data.title || data.message);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    const handleSystemAlert = (data: any) => {
      console.log('System alert received:', data);
      addSystemAlert(data);
      
      // Show critical alerts as persistent toasts
      if (data.severity === 'critical' || data.severity === 'high') {
        addToastNotification('error', data.message, false); // No auto-dismiss for critical
      } else {
        addToastNotification('warning', data.message);
      }
    };

    const handleBookingConfirmed = (data: any) => {
      addToastNotification('success', `Booking confirmed! Confirmation #${data.booking_id}`);
    };

    const handlePaymentCompleted = (data: any) => {
      addToastNotification('success', `Payment processed successfully for ${data.currency} ${data.amount}`);
    };

    const handlePaymentFailed = (data: any) => {
      addToastNotification('error', `Payment failed: ${data.failure_reason}`, false);
    };

    // Register event listeners
    socket.on('notification_received', handleNotificationReceived);
    socket.on('system_alert_created', handleSystemAlert);
    socket.on('booking_confirmed', handleBookingConfirmed);
    socket.on('payment_completed', handlePaymentCompleted);
    socket.on('payment_failed', handlePaymentFailed);

    // Cleanup listeners
    return () => {
      socket.off('notification_received', handleNotificationReceived);
      socket.off('system_alert_created', handleSystemAlert);
      socket.off('booking_confirmed', handleBookingConfirmed);
      socket.off('payment_completed', handlePaymentCompleted);
      socket.off('payment_failed', handlePaymentFailed);
    };
  }, [socket, addToastNotification, addSystemAlert, queryClient]);

  // Update global state when data changes
  useEffect(() => {
    if (userNotifications) {
      setUnreadNotifications(userNotifications.unread_count);
    }
  }, [userNotifications, setUnreadNotifications]);

  useEffect(() => {
    if (systemAlerts?.alerts) {
      setSystemAlerts(systemAlerts.alerts);
    }
  }, [systemAlerts, setSystemAlerts]);

  // Toast notification component
  const ToastItem: React.FC<{ toast: ToastNotification }> = ({ toast }) => {
    const getToastStyles = () => {
      switch (toast.type) {
        case 'success':
          return 'bg-green-50 border-green-200 text-green-800';
        case 'error':
          return 'bg-red-50 border-red-200 text-red-800';
        case 'warning':
          return 'bg-yellow-50 border-yellow-200 text-yellow-800';
        case 'info':
        default:
          return 'bg-blue-50 border-blue-200 text-blue-800';
      }
    };

    const getIconPath = () => {
      switch (toast.type) {
        case 'success':
          return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
        case 'error':
          return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
        case 'warning':
          return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z';
        case 'info':
        default:
          return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      }
    };

    return (
      <div
        role="alert"
        aria-live="polite"
        className={`relative flex items-start p-4 border rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 ${getToastStyles()}`}
      >
        <div className="flex-shrink-0">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d={getIconPath()} clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Close notification"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Toast Notifications Container */}
      <div 
        className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toastNotifications.map((toast) => (
          <div key={toast.id} className="pointer-events-auto animate-slide-in-right">
            <ToastItem toast={toast}/api/>
          </div>
        ))}
      </div>

      {/* Notification Bell/Badge (if authenticated) */}
      {isAuthenticated && (
        <div className="fixed top-20 right-4 z-40">
          <button
            type="button"
            onClick={() => setShowNotificationPanel(!showNotificationPanel)}
            className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 bg-white rounded-full shadow-md"
            aria-label={`Notifications ${notificationsState.unread_notifications > 0 ? `(${notificationsState.unread_notifications} unread)` : ''}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notificationsState.unread_notifications > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                {notificationsState.unread_notifications > 99 ? '99+' : notificationsState.unread_notifications}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Notification Panel Dropdown */}
      {isAuthenticated && showNotificationPanel && (
        <div className="fixed top-32 right-4 z-40 w-80 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <button
                type="button"
                onClick={() => setShowNotificationPanel(false)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label="Close notifications panel"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-80">
            {notificationsLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <span className="ml-2 text-gray-600">Loading notifications...</span>
              </div>
            ) : userNotifications?.notifications && userNotifications.notifications.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {userNotifications.notifications.map((notification: any) => (
                  <div
                    key={notification.notification_id}
                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification.notification_id)}
                  >
                    <div className="flex items-start">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(notification.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="mt-2 text-sm">No notifications yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Alerts Banner (for critical alerts) */}
      {systemAlerts?.alerts && systemAlerts.alerts.some((alert: any) => alert.severity === 'critical') && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">
                  {systemAlerts.alerts.find((alert: any) => alert.severity === 'critical')?.title}
                </span>
              </div>
              <button
                type="button"
                className="text-white hover:text-gray-200 focus:outline-none"
                aria-label="Dismiss alert"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for notification panel */}
      {showNotificationPanel && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-25"
          onClick={() => setShowNotificationPanel(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default GV_NotificationPanel;