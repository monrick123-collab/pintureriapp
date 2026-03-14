import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, CartItem, SaleItem, Branch, Sale, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { DiscountService } from '../services/discountService';
import { DiscountRequest } from '../types';

interface POSProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'pos' | 'history';
type PaymentMethod = 'cash' | 'card' | 'transfer';
type Period = 'today' | 'week' | 'fortnight' | 'month' | 'custom';

const POS: React.FC<POSProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('pos');
  const currentBranchId = user.branchId || 'BR-CENTRO';

  // --- POS STATES ---
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

  // --- HISTORY STATES ---
  const [historySales, setHistorySales] = useState<Sale[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<Period>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedHistoryBranch, setSelectedHistoryBranch] = useState<string>(
    user.role === UserRole.ADMIN ? 'ALL' : 'BR-CENTRO'
  );
  const [selectedHistorySale, setSelectedHistorySale] = useState<Sale | null>(null);


  // --- POS EFFECTS ---
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

  // --- HISTORY EFFECTS ---
  useEffect(() => {
    if (activeTab === 'history') {
      loadBranches();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistorySales();
    }
  }, [activeTab, historyPeriod, customStart, customEnd, selectedHistoryBranch]);

  const loadBranches = async () => {
    try {
      const data = await InventoryService.getBranches();
      setBranches(data);
    } catch (e) {
      console.error(e);
    }
  };

  const calculateDateRange = () => {
    const end = new Date();
    let start = new Date();
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    switch (historyPeriod) {
      case 'today': break;
      case 'week':
        const day = start.getDay();
        start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
        break;
      case 'fortnight':
        start.setDate(start.getDate() - 15);
        break;
      case 'month':
        start.setDate(1);
        break;
      case 'custom':
        if (!customStart || !customEnd) return null;
        start = new Date(customStart);
        const endCustom = new Date(customEnd);
        endCustom.setHours(23, 59, 59, 999);
        return { start: start.toISOString(), end: endCustom.toISOString() };
    }
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchHistorySales = async () => {
    const range = calculateDateRange();
    if (!range) return;

    setHistoryLoading(true);
    try {
      const data = await SalesService.getSalesWithFilters(range.start, range.end, selectedHistoryBranch);
      setHistorySales(data);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalSales = historySales.reduce((acc, s) => acc + s.total, 0);
  const totalCash = historySales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.total, 0);
  const totalCard = historySales.filter(s => s.paymentMethod === 'card').reduce((acc, s) => acc + s.total, 0);
  const totalTransfer = historySales.filter(s => s.paymentMethod === 'transfer').reduce((acc, s) => acc + s.total, 0);
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
    setAppliedDiscount(null);
    setActiveDiscountRequest(null);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
    setAppliedDiscount(null);
    setActiveDiscountRequest(null);
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
      const priceToUse = (isWholesale ? item.wholesalePrice : item.price) || 0;
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
        const priceToUse = (isWholesale ? item.wholesalePrice : item.price) || 0;
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

      <main className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50 dark:bg-slate-950">
        <header className="h-16 lg:h-20 flex items-center justify-between px-6 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 lg:hidden" />
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-primary group-hover:rotate-12 transition-transform">store</span>
              <h2 className="text-base md:text-lg font-bold hidden sm:block">Punto de Venta</h2>
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl lg:rounded-2xl p-1 gap-1">
            {([
              { key: 'pos', label: 'Nueva Venta' },
              { key: 'history', label: 'Historial' }
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-3 lg:px-5 py-2 rounded-lg lg:rounded-xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'pos' && (
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
            )}
            <div className="text-[10px] md:text-xs font-bold text-slate-400 hidden sm:block">
              {user.name}
            </div>
          </div>
        </header>
        {activeTab === 'pos' && (
          <>
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
                            <input
                              type="number"
                              min="0"
                              className="w-12 text-center text-xs font-bold bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none p-0 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i));
                              }}
                              onBlur={(e) => {
                                if (!e.target.value || parseInt(e.target.value) === 0) {
                                  updateQuantity(item.id, -item.quantity);
                                }
                              }}
                            />
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
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-8 max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-black mb-6">Confirmar Pago</h2>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <p className="text-xs font-bold text-slate-400">Monto a Cobrar</p>
                      <p className="text-3xl font-black text-primary">${total.toLocaleString()}</p>
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

                    {(paymentMethod === 'card' || paymentMethod === 'transfer') && (
                      <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-blue-500 text-sm">receipt_long</span>
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">Datos de Facturación Obligatorios</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400">Banco</label>
                          <input id="billing-bank" className="w-full p-2 bg-white dark:bg-slate-800 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700" placeholder="Ej: BBVA, Santander" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400">Razón Social</label>
                          <input id="billing-social" className="w-full p-2 bg-white dark:bg-slate-800 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700" placeholder="Nombre o Razón Social" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-slate-400">No. Factura / Referencia</label>
                          <input id="billing-invoice" className="w-full p-2 bg-white dark:bg-slate-800 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700" placeholder="Folio de Factura" />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase text-slate-500">Monto Recibido</label>
                      <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-black text-xl" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
                    </div>

                    <div className="flex justify-between text-sm font-bold pt-2">
                      <span className="text-slate-500">Cambio:</span>
                      <span className="text-green-600">${change.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 font-bold text-slate-400">Cancelar</button>
                      <button onClick={() => {
                        if (paymentMethod === 'card' || paymentMethod === 'transfer') {
                          const bank = (document.getElementById('billing-bank') as HTMLInputElement).value;
                          const social = (document.getElementById('billing-social') as HTMLInputElement).value;
                          const invoice = (document.getElementById('billing-invoice') as HTMLInputElement).value;

                          if (!bank || !social || !invoice) {
                            alert("Escriba Banco, Razón Social y No. Factura para continuar.");
                            return;
                          }
                        }
                        handleFinalizeSale();
                      }} disabled={loading} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl">
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
          </>
        )}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6 md:space-y-8">
              {/* Controls Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-end bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/10">

                {/* Period Selector (Mobile only) */}
                <div className="lg:hidden w-full space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Periodo</label>
                  <select
                    className="block w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold"
                    value={historyPeriod}
                    onChange={e => setHistoryPeriod(e.target.value as Period)}
                  >
                    <option value="today">Hoy</option>
                    <option value="week">Esta Semana</option>
                    <option value="fortnight">Quincena</option>
                    <option value="month">Este Mes</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </div>

                {user.role === UserRole.ADMIN && (
                  <div className="space-y-1 w-full md:w-auto">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal</label>
                    <select
                      className="block w-full md:w-48 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold"
                      value={selectedHistoryBranch}
                      onChange={e => setSelectedHistoryBranch(e.target.value)}
                    >
                      <option value="ALL">Todas</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}

                {historyPeriod === 'custom' && (
                  <div className="flex gap-4 w-full md:w-auto">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                      <input type="date" className="block w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                      <input type="date" className="block w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                  <p className="text-xs font-medium opacity-80 uppercase tracking-widest mb-1">Total</p>
                  <h3 className="text-2xl md:text-3xl font-black">${totalSales.toLocaleString()}</h3>
                  <p className="text-[10px] opacity-60 mt-2">{historySales.length} ventas</p>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">${totalCash.toLocaleString()}</h3>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Tarjeta</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">${totalCard.toLocaleString()}</h3>
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Transf.</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">${totalTransfer.toLocaleString()}</h3>
                </div>
              </div>

              {/* Sales Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 shadow-sm overflow-hidden transition-all hover:shadow-lg">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                      <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                        <th className="px-6 py-5">Folio / Fecha</th>
                        <th className="px-6 py-5">Detalle Venta</th>
                        <th className="px-6 py-5">Método</th>
                        <th className="px-6 py-5 text-right">Total</th>
                        <th className="px-6 py-5 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {historyLoading ? (
                        <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">Cargando transacciones...</td></tr>
                      ) : historySales.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No hay registros</td></tr>
                      ) : (
                        historySales.map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{sale.id.slice(0, 8).toUpperCase()}</span>
                                <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                                  {new Date(sale.createdAt).toLocaleDateString()} • {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1.5">
                                {sale.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 max-w-xs group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                    <span className="truncate pr-4 font-medium">{item.quantity}x {item.productName}</span>
                                    <span className="text-slate-400 font-mono tracking-tighter shrink-0">${item.total.toLocaleString()}</span>
                                  </div>
                                ))}
                                {sale.discountAmount > 0 && (
                                  <div className="flex justify-between items-center text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg max-w-xs mt-1 border border-amber-100 dark:border-amber-900/30">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[10px]">percent</span>
                                      DESCUENTO
                                    </span>
                                    <span className="font-mono">-${sale.discountAmount.toLocaleString()}</span>
                                  </div>
                                )}
                                {sale.branchName && (
                                  <span className="mt-1 text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md w-fit text-slate-500 uppercase tracking-tighter">
                                    {sale.branchName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest
                                                                    ${sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                                  sale.paymentMethod === 'card' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}
                                                                `}>
                                {sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transf.'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">${sale.total.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <button
                                onClick={() => setSelectedHistorySale(sale)}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-all"
                                title="Ver Detalles"
                              >
                                <span className="material-symbols-outlined">visibility</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Details Modal */}
            {selectedHistorySale && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedHistorySale(null)}>
                <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-2xl border dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800 p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-lg">Detalle de Venta</h3>
                      <p className="text-xs text-slate-500 font-mono">ID: {selectedHistorySale.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <button
                      onClick={() => setSelectedHistorySale(null)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {/* Products */}
                    <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Productos</p>
                      <div className="space-y-2">
                        {selectedHistorySale.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-800">
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">{item.productName}</p>
                              <p className="text-[10px] text-slate-500">Cantidad: {item.quantity}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-slate-900 dark:text-white">${item.total.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">${item.price.toLocaleString()} c/u</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Billing Info */}
                    {(selectedHistorySale.billingSocialReason || selectedHistorySale.billingInvoiceNumber || selectedHistorySale.billingBank) && (
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Datos Fiscales y Bancarios</p>
                        <div className="grid grid-cols-2 gap-3">
                          {selectedHistorySale.billingSocialReason && (
                            <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl">
                              <p className="text-[9px] uppercase font-bold text-blue-400 mb-1">Razón Social</p>
                              <p className="text-xs font-bold text-blue-900 dark:text-blue-100">{selectedHistorySale.billingSocialReason}</p>
                            </div>
                          )}
                          {selectedHistorySale.billingInvoiceNumber && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                              <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">No. Factura</p>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedHistorySale.billingInvoiceNumber}</p>
                            </div>
                          )}
                          {selectedHistorySale.billingBank && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                              <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Banco</p>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedHistorySale.billingBank}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="border-t dark:border-slate-800 pt-4 space-y-2">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Subtotal</span>
                        <span>${selectedHistorySale.subtotal.toLocaleString()}</span>
                      </div>
                      {selectedHistorySale.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-amber-600 font-bold">
                          <span>Descuento</span>
                          <span>-${selectedHistorySale.discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2">
                        <span>Total Pagado</span>
                        <span>${selectedHistorySale.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-end pt-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase
                                                        ${selectedHistorySale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                            selectedHistorySale.paymentMethod === 'card' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}
                                                    `}>
                          Método: {selectedHistorySale.paymentMethod === 'cash' ? 'Efectivo' : selectedHistorySale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
        }
      </main >
    </div >
  );
};

export default POS;
