import { create } from 'zustand';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Selectors
  isAuthenticated: boolean;
  isAdmin: boolean;
  isWarehouse: boolean;
  isFinance: boolean;
  isStoreManager: boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  login: (user: User) => {
    localStorage.setItem('pintamax_user', JSON.stringify(user));
    set({ user, error: null });
  },

  logout: async () => {
    localStorage.removeItem('pintamax_user');
    // Also sign out from Supabase Auth
    try {
      const { supabase } = await import('../services/supabase');
      await supabase.auth.signOut();
    } catch (_) {}
    set({ user: null });
  },

  setUser: (user: User | null) => {
    set({ user });
  },

  setLoading: (loading: boolean) => {
    set({ loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  // Selectors
  get isAuthenticated() {
    return get().user !== null;
  },

  get isAdmin() {
    return get().user?.role === 'ADMIN';
  },

  get isWarehouse() {
    const role = get().user?.role;
    return role === 'WAREHOUSE' || role === 'WAREHOUSE_SUB';
  },

  get isFinance() {
    return get().user?.role === 'FINANCE';
  },

  get isStoreManager() {
    return get().user?.role === 'STORE_MANAGER';
  }
}));