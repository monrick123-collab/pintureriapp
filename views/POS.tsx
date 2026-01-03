
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, CartItem, SaleItem } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { DiscountService } from '../services/discountService';
import { DiscountRequest } from '../types';

interface POSProps {
  user: User;
  onLogout: () => void;
}

type PaymentMethod = 'cash' | 'card' | 'transfer';

const POS: React.FC<POSProps> = ({ user, onLogout }) => {
  // Use user's assigned branch or fallback to 'BR-CENTRO' if undefined
  const currentBranchId = user.branchId || 'BR-CENTRO';
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountReason, setDiscountReason] = useState('');
  const [activeDiscountRequest, setActiveDiscountRequest] = useState<DiscountRequest | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{ amount: number, type: 'percentage' | 'fixed' } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [currentBranchId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await InventoryService.getProductsByBranch(currentBranchId);
      setProducts(data);
    } catch (e) {
      console.error("Failed to load products:", e);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    const localStock = product.stock || 0;
    const inCart = cart.find(i => i.id === product.id)?.quantity || 0;

    if (inCart >= localStock) {
      alert("No hay suficiente stock en esta sucursal");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'Todos' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleRequestDiscount = async () => {
    try {
      setLoading(true);
      const requestId = await DiscountService.requestDiscount(
        user.id,
        user.name,
        currentBranchId,
        parseFloat(discountValue),
        discountType,
        discountReason
      );

      // Subscribe to updates for this request
      DiscountService.subscribeToRequest(requestId, (updated) => {
        setActiveDiscountRequest(updated);
        if (updated.status === 'approved') {
          setAppliedDiscount({ amount: updated.amount, type: updated.type });
          alert("¡Descuento aprobado!");
        } else if (updated.status === 'rejected') {
          alert("El descuento fue rechazado.");
          setActiveDiscountRequest(null);
        }
      });

      setActiveDiscountRequest({
        id: requestId,
        requesterId: user.id,
        requesterName: user.name,
        branchId: currentBranchId,
        amount: parseFloat(discountValue),
        type: discountType,
        status: 'pending',
        reason: discountReason,
        createdAt: new Date().toISOString()
      });

      setIsDiscountModalOpen(false);
      setDiscountValue('');
      setDiscountReason('');
    } catch (e) {
      console.error(e);
      alert("Error al solicitar descuento.");
    } finally {
      setLoading(false);
    }
  };

  const calculateSubtotal = () => {
    return cart.reduce((acc, item) => {
      const isWholesale = item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty;
      const priceToUse = isWholesale ? item.wholesalePrice : item.price;
      return acc + (priceToUse * item.quantity);
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const discountAmount = appliedDiscount
    ? (appliedDiscount.type === 'percentage' ? (subtotal * (appliedDiscount.amount / 100)) : appliedDiscount.amount)
    : 0;
  const subtotalWithDiscount = subtotal - discountAmount;
  const iva = subtotalWithDiscount * 0.16;
  const total = subtotalWithDiscount + iva;
  const change = Math.max(0, parseFloat(cashReceived || '0') - total);

  const handleFinalizeSale = async () => {
    try {
      setLoading(true);

      const saleItems: SaleItem[] = cart.map(item => {
        const isWholesale = item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty;
        const priceToUse = isWholesale ? item.wholesalePrice : item.price;
        return {
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          price: priceToUse,
          total: priceToUse * item.quantity
        };
      });

      await SalesService.processSale(
        currentBranchId,
        saleItems,
        total,
        paymentMethod,
        undefined, // clientId
        { subtotal, discountAmount, iva }
      );

      setShowSuccess(true);

      // Refresh inventory from DB
      await loadProducts();

      setTimeout(() => {
        setShowSuccess(false);
        setIsPaymentModalOpen(false);
        setCart([]);
        setCashReceived('');
      }, 2000);

    } catch (e) {
      console.error(e);
      alert("Error al procesar la venta. Verifique la conexión o el stock.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 lg:hidden" />
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-primary group-hover:rotate-12 transition-transform">store</span>
              <h2 className="text-base md:text-lg font-bold">Punto de Venta</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="lg:hidden relative p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              <span className="material-symbols-outlined">shopping_cart</span>
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] size-5 rounded-full flex items-center justify-center font-black animate-in zoom-in">
                  {cart.length}
                </span>
              )}
            </button>
            <div className="text-[10px] md:text-xs font-bold text-slate-400 hidden sm:block">
              {user.name}
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 pb-2 space-y-4">
              <div className="flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-12 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                <div className="flex items-center justify-center px-4 text-slate-400">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Todos', 'Interiores', 'Exteriores', 'Esmaltes', 'Accesorios'].map(cat => (
                  <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${category === cat ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border dark:border-slate-700'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 custom-scrollbar">
              <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(p => {
                  const stock = p.inventory[currentBranchId] || 0;
                  return (
                    <div key={p.id} className="group flex flex-col bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-primary transition-all cursor-pointer" onClick={() => addToCart(p)}>
                      <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
                        <img src={p.image} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform" />
                        <div className={`absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm ${stock < 5 ? 'bg-red-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                          {stock} DISP.
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-bold truncate">{p.name}</p>
                        <p className="text-primary font-black mt-1">${p.price.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cart Overlay for Mobile */}
          {isCartOpen && (
            <div className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-all" onClick={() => setIsCartOpen(false)} />
          )}

          <div className={`
            fixed lg:static top-0 right-0 h-full w-[320px] md:w-[380px] bg-white dark:bg-slate-800 
            border-l border-slate-200 dark:border-slate-700 flex flex-col z-[45] shadow-2xl transition-all duration-300
            ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          `}>
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <button onClick={() => setIsCartOpen(false)} className="lg:hidden text-slate-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">arrow_forward_ios</span>
                </button>
                <h3 className="font-bold text-sm">Venta Actual</h3>
              </div>
              <button onClick={() => setCart([])} className="text-slate-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined text-xl">delete</span></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-10 h-10 rounded bg-slate-100 p-1"><img src={item.image} className="w-full h-full object-contain" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{item.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, -1) }} className="size-5 rounded border flex items-center justify-center text-xs">-</button>
                        <span className="text-xs font-bold">{item.quantity}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, 1) }} className="size-5 rounded border flex items-center justify-center text-xs">+</button>
                      </div>
                      <div className="flex flex-col items-end">
                        {item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty ? (
                          <>
                            <span className="text-[10px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded mb-0.5">MAYOREO</span>
                            <span className="text-xs font-black">${(item.wholesalePrice * item.quantity).toLocaleString()}</span>
                          </>
                        ) : (
                          <span className="text-xs font-bold">${(item.price * item.quantity).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold">SUBTOTAL</span>
                  <span className="font-bold">${subtotal.toLocaleString()}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex justify-between text-xs text-green-600 font-bold">
                    <span>DESCUENTO ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.amount}%` : `$${appliedDiscount.amount}`})</span>
                    <span>-${discountAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-bold">IVA (16%)</span>
                  <span className="font-bold">${iva.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-slate-400">TOTAL</span>
                <span className="text-2xl font-black text-primary">${total.toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={cart.length === 0 || !!activeDiscountRequest || !!appliedDiscount}
                  onClick={() => setIsDiscountModalOpen(true)}
                  className="py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  {activeDiscountRequest?.status === 'pending' ? 'Esperando...' : 'Descuento'}
                </button>
                <button
                  disabled={cart.length === 0 || activeDiscountRequest?.status === 'pending'}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="py-3 bg-primary text-white font-bold rounded-xl shadow-lg active:scale-95 disabled:opacity-50 transition-all"
                >
                  Pagar Ahora
                </button>
              </div>
            </div>
          </div>
        </div>

        {isPaymentModalOpen && (
          // ... existing payment modal ...
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Payment Modal Content */}
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8">
              <h2 className="text-2xl font-black mb-6">Confirmar Pago</h2>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                  <p className="text-xs font-bold text-slate-400">Monto a Cobrar</p>
                  <p className="text-3xl font-black text-primary">${total.toLocaleString()}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Recibido</label>
                  <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-black text-xl" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Método de Pago</label>
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                    {(['cash', 'card', 'transfer'] as PaymentMethod[]).map(method => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-all ${paymentMethod === method
                          ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                          }`}
                      >
                        {{ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transf.' }[method]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2">
                  <span className="text-slate-500">Cambio:</span>
                  <span className="text-green-600">${change.toLocaleString()}</span>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 font-bold text-slate-400">Cancelar</button>
                  <button onClick={handleFinalizeSale} disabled={loading} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl">
                    {loading ? 'Procesando...' : 'Finalizar'}
                  </button>
                </div>
              </div>
              {showSuccess && (
                <div className="absolute inset-0 bg-white dark:bg-slate-800 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95">
                  <div className="size-20 rounded-full bg-green-500 text-white flex items-center justify-center mb-4"><span className="material-symbols-outlined text-5xl">check</span></div>
                  <h3 className="text-2xl font-black">¡Venta Exitosa!</h3>
                  <p className="text-slate-500">Inventario actualizado en tiempo real.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {isDiscountModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-8">
              <h2 className="text-xl font-black mb-6">Solicitar Descuento</h2>
              <div className="space-y-4">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  {(['percentage', 'fixed'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setDiscountType(type)}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${discountType === type ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}
                    >
                      {type === 'percentage' ? 'Porcentaje (%)' : 'Monto Fijo ($)'}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Valor del Descuento</label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-bold"
                    placeholder={discountType === 'percentage' ? 'Ej: 10' : 'Ej: 50'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Motivo</label>
                  <textarea
                    value={discountReason}
                    onChange={e => setDiscountReason(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-medium text-sm h-24 resize-none"
                    placeholder="Escriba la razón para este descuento..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsDiscountModalOpen(false)} className="flex-1 py-3 font-bold text-slate-400">Cancelar</button>
                  <button
                    onClick={handleRequestDiscount}
                    disabled={!discountValue || !discountReason || loading}
                    className="flex-1 py-3 bg-primary text-white font-bold rounded-xl disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Solicitar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default POS;
