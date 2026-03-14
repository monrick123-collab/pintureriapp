import { useCartStore } from '../store/cartStore';
import { Product } from '../types';
import { useUIStore } from '../store/uiStore';

export const useCart = () => {
  const cartStore = useCartStore();
  const uiStore = useUIStore();

  const addToCart = (product: Product) => {
    const stock = product.inventory[product.id] || 0;
    const inCart = cartStore.items.find(i => i.id === product.id)?.quantity || 0;

    if (inCart >= stock) {
      uiStore.showToast('error', 'No hay suficiente stock en esta sucursal');
      return;
    }

    cartStore.addItem(product);
    uiStore.showToast('success', `${product.name} agregado al carrito`);
  };

  const removeFromCart = (productId: string) => {
    cartStore.removeItem(productId);
    uiStore.showToast('info', 'Producto removido del carrito');
  };

  const updateQuantity = (productId: string, delta: number) => {
    cartStore.updateQuantity(productId, delta);
  };

  const setQuantity = (productId: string, quantity: number) => {
    cartStore.setQuantity(productId, quantity);
  };

  const clearCart = () => {
    cartStore.clearCart();
    uiStore.showToast('info', 'Carrito vaciado');
  };

  const applyDiscount = (discount: { amount: number; type: 'percentage' | 'fixed' }) => {
    cartStore.setDiscount(discount);
    uiStore.showToast('success', 'Descuento aplicado');
  };

  const removeDiscount = () => {
    cartStore.setDiscount(null);
  };

  const getCartItem = (productId: string) => {
    return cartStore.items.find(item => item.id === productId);
  };

  const getCartItemQuantity = (productId: string) => {
    return getCartItem(productId)?.quantity || 0;
  };

  const calculateCartSummary = () => {
    return cartStore.calculateTotal();
  };

  return {
    items: cartStore.items,
    subtotal: cartStore.calculateSubtotal(),
    discount: cartStore.discount,
    addToCart,
    removeFromCart,
    updateQuantity,
    setQuantity,
    clearCart,
    applyDiscount,
    removeDiscount,
    getCartItem,
    getCartItemQuantity,
    calculateCartSummary,
    isEmpty: cartStore.items.length === 0,
    itemCount: cartStore.items.reduce((total, item) => total + item.quantity, 0)
  };
};