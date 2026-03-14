import { create } from 'zustand';
import { CartItem, Product } from '../types';

interface CartStore {
  items: CartItem[];
  subtotal: number;
  discount: { amount: number; type: 'percentage' | 'fixed' } | null;
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setDiscount: (discount: { amount: number; type: 'percentage' | 'fixed' } | null) => void;
  calculateSubtotal: () => number;
  calculateTotal: () => { subtotal: number; discountAmount: number; iva: number; total: number };
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  subtotal: 0,
  discount: null,

  addItem: (product: Product) => {
    set((state) => {
      const existingItem = state.items.find(item => item.id === product.id);
      
      if (existingItem) {
        return {
          items: state.items.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        };
      }
      
      return {
        items: [...state.items, { ...product, quantity: 1 }]
      };
    });
  },

  removeItem: (id: string) => {
    set((state) => ({
      items: state.items.filter(item => item.id !== id)
    }));
  },

  updateQuantity: (id: string, delta: number) => {
    set((state) => {
      const updatedItems = state.items.map(item => {
        if (item.id === id) {
          const newQuantity = Math.max(0, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(item => item.quantity > 0);

      return { items: updatedItems };
    });
  },

  setQuantity: (id: string, quantity: number) => {
    set((state) => {
      const updatedItems = state.items.map(item => {
        if (item.id === id) {
          return { ...item, quantity: Math.max(0, quantity) };
        }
        return item;
      }).filter(item => item.quantity > 0);

      return { items: updatedItems };
    });
  },

  clearCart: () => {
    set({ items: [], discount: null });
  },

  setDiscount: (discount) => {
    set({ discount });
  },

  calculateSubtotal: () => {
    const { items } = get();
    return items.reduce((acc, item) => {
      const isWholesale = item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty;
      const priceToUse = (isWholesale ? item.wholesalePrice : item.price) || 0;
      return acc + (priceToUse * item.quantity);
    }, 0);
  },

  calculateTotal: () => {
    const subtotal = get().calculateSubtotal();
    const discount = get().discount;
    
    const discountAmount = discount
      ? discount.type === 'percentage'
        ? subtotal * (discount.amount / 100)
        : discount.amount
      : 0;
    
    const subtotalWithDiscount = subtotal - discountAmount;
    const iva = subtotalWithDiscount * 0.16;
    const total = subtotalWithDiscount + iva;

    return { subtotal, discountAmount, iva, total };
  }
}));