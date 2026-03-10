import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Notification } from '../types';
import { NotificationService } from '../services/notificationService';
import { supabase } from '../services/supabase';

interface NotificationBellProps {
  user: User;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();

    // Setup realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload: any) => {
          const newNotif = payload.new as any;
          // Check if notification is for this user or their role
          if (
            newNotif.user_id === user.id ||
            newNotif.target_role === user.role ||
            newNotif.target_role === 'ALL'
          ) {
            fetchNotifications(); // Refresh list to get formatted data
          }
        }
      )
      .subscribe();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user.id, user.role]);

  const fetchNotifications = async () => {
    try {
      const data = await NotificationService.getUnreadNotifications(user.id, user.role);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read immediately in UI
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      
      // Mark in DB
      await NotificationService.markAsRead(notification.id);
      
      setIsOpen(false);
      
      // Navigate if URL exists
      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
    } catch (error) {
      console.error('Error marking notification as read', error);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setNotifications([]);
      await NotificationService.markAllAsRead(user.id, user.role);
    } catch (error) {
      console.error('Error marking all as read', error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
        title="Notificaciones"
      >
        <span className="material-symbols-outlined">notifications</span>
        
        {notifications.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 text-[8px] font-black text-white items-center justify-center">
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[100] animate-in slide-in-from-top-2 fade-in duration-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
            <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Notificaciones</h3>
            {notifications.length > 0 && (
              <button 
                onClick={handleMarkAllAsRead}
                className="text-[10px] uppercase font-bold text-primary hover:text-primary/80 transition-colors"
              >
                Marcar todas leídas
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined animate-spin mb-2">sync</span>
                <p className="text-xs font-bold">Cargando...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">notifications_off</span>
                <p className="text-sm font-bold">No tienes notificaciones nuevas</p>
                <p className="text-xs mt-1 opacity-70">¡Todo está al día!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {notifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex gap-3 items-start group relative"
                  >
                    <div className="shrink-0 size-8 mt-1 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <span className="material-symbols-outlined text-sm">
                            {notif.actionUrl?.includes('restocks') ? 'inventory_2' : 
                             notif.actionUrl?.includes('returns') ? 'assignment_return' : 
                             notif.actionUrl?.includes('history') ? 'receipt_long' : 'notifications'}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{notif.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                        {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    <div className="shrink-0 size-2 rounded-full bg-red-500 mt-2 absolute right-4 top-4" />
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center">
             <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">PintureriApp Notifications</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
