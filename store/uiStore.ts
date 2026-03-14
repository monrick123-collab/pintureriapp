import { create } from 'zustand';

interface UIStore {
  // Modals
  isPaymentModalOpen: boolean;
  isDiscountModalOpen: boolean;
  isCartOpen: boolean;
  
  // Loading states
  loading: boolean;
  historyLoading: boolean;
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    title?: string;
  }>;
  
  // Actions
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  openDiscountModal: () => void;
  closeDiscountModal: () => void;
  toggleCart: () => void;
  setCartOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setHistoryLoading: (loading: boolean) => void;
  
  // Notification actions
  addNotification: (notification: Omit<UIStore['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Toast helper
  showToast: (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  isPaymentModalOpen: false,
  isDiscountModalOpen: false,
  isCartOpen: false,
  loading: false,
  historyLoading: false,
  notifications: [],

  openPaymentModal: () => set({ isPaymentModalOpen: true }),
  closePaymentModal: () => set({ isPaymentModalOpen: false }),
  openDiscountModal: () => set({ isDiscountModalOpen: true }),
  closeDiscountModal: () => set({ isDiscountModalOpen: false }),
  toggleCart: () => set(state => ({ isCartOpen: !state.isCartOpen })),
  setCartOpen: (open: boolean) => set({ isCartOpen: open }),
  setLoading: (loading: boolean) => set({ loading }),
  setHistoryLoading: (loading: boolean) => set({ historyLoading: loading }),

  addNotification: (notification) => {
    const id = Date.now().toString();
    set(state => ({
      notifications: [...state.notifications, { ...notification, id }]
    }));
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().removeNotification(id);
    }, 5000);
  },

  removeNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  showToast: (type, message, title) => {
    get().addNotification({ type, message, title });
  }
}));