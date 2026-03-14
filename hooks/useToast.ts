import { useUIStore } from '../store/uiStore';

export const useToast = () => {
  const { showToast } = useUIStore();

  const success = (message: string, title?: string) => {
    showToast('success', message, title);
  };

  const error = (message: string, title?: string) => {
    showToast('error', message, title);
  };

  const info = (message: string, title?: string) => {
    showToast('info', message, title);
  };

  const warning = (message: string, title?: string) => {
    showToast('warning', message, title);
  };

  return {
    success,
    error,
    info,
    warning
  };
};