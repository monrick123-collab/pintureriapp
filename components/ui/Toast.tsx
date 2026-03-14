import React, { useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';

const Toast: React.FC = () => {
  const { notifications, removeNotification } = useUIStore();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[1000] space-y-2">
      {notifications.map((notification) => (
        <ToastItem
          key={notification.id}
          {...notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  title?: string;
  onClose: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ type, message, title, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const typeConfig = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      icon: 'check_circle',
      iconColor: 'text-emerald-500'
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: 'error',
      iconColor: 'text-red-500'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'info',
      iconColor: 'text-blue-500'
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'warning',
      iconColor: 'text-amber-500'
    }
  };

  const config = typeConfig[type];

  return (
    <div className={`
      animate-in slide-in-from-right-10 duration-300
      ${config.bg} ${config.border}
      border rounded-xl shadow-lg p-4 max-w-sm
      flex items-start gap-3
    `}>
      <div className={`${config.iconColor} flex-shrink-0`}>
        <span className="material-symbols-outlined">{config.icon}</span>
      </div>
      
      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
            {title}
          </h4>
        )}
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {message}
        </p>
      </div>
      
      <button
        onClick={onClose}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        aria-label="Cerrar notificación"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
};

export default Toast;