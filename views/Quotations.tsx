
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Client, CartItem } from '../types';
import { InventoryService } from '../services/inventoryService';
import { ClientService } from '../services/clientService';
import { DiscountService } from '../services/discountService';
import { DiscountRequest } from '../types';

interface QuotationsProps {
  user: User;
  onLogout: () => void;
}

const Quotations: React.FC<QuotationsProps> = ({ user, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountReason, setDiscountReason] = useState('');
  const [activeDiscountRequest, setActiveDiscountRequest] = useState<DiscountRequest | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<{ amount: number, type: 'percentage' | 'fixed' } | null>(null);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Generate random data for the quotation header
  const quoteNumber = `COT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  const date = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loadedProducts, loadedClients] = await Promise.all([
        InventoryService.getProducts(),
        ClientService.getClients()
      ]);
      setProducts(loadedProducts);
      setClients(loadedClients);
    } catch (e) {
      console.error("Error loading quotation data:", e);
    }
  };

  const addItem = (p: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === p.id);
      if (existing) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRequestDiscount = async () => {
    try {
      setLoading(true);
      const requestId = await DiscountService.requestDiscount(
        user.id,
        user.name,
        user.branchId || 'BR-CENTRO',
        parseFloat(discountValue),
        discountType,
        discountReason
      );

      DiscountService.subscribeToRequest(requestId, (updated) => {
        setActiveDiscountRequest(updated);
        if (updated.status === 'approved') {
          setAppliedDiscount({ amount: updated.amount, type: updated.type });
        } else if (updated.status === 'rejected') {
          setActiveDiscountRequest(null);
        }
      });

      setActiveDiscountRequest({
        id: requestId,
        requesterId: user.id,
        requesterName: user.name,
        branchId: user.branchId || 'BR-CENTRO',
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

  const subtotal = items.reduce((acc, i) => {
    const isWholesale = i.wholesalePrice && i.wholesaleMinQty && i.quantity >= i.wholesaleMinQty;
    const priceToUse = isWholesale ? i.wholesalePrice : i.price;
    return acc + (priceToUse * i.quantity);
  }, 0);

  const discountAmount = appliedDiscount
    ? (appliedDiscount.type === 'percentage' ? (subtotal * (appliedDiscount.amount / 100)) : appliedDiscount.amount)
    : 0;
  const subtotalWithDiscount = subtotal - discountAmount;
  const iva = subtotalWithDiscount * 0.16;
  const total = subtotalWithDiscount + iva;

  const QuoteDocument = () => (
    <div className="w-[210mm] min-h-[297mm] bg-white text-slate-800 p-[20mm] mx-auto font-sans relative flex flex-col border border-slate-200 print:border-none print:p-[15mm]">
      <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8 relative z-10">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-4xl">format_paint</span>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Pintamax<span className="text-primary text-xl ml-1">®</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Pintamax S.A. de C.V. • Professional Paint Solutions</p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Folio de Cotización</div>
          <div className="text-xl font-black text-primary tracking-tighter">{quoteNumber}</div>
          <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase">{date}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-16 relative z-10">
        <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
          <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">person</span>
            Información del Cliente
          </h4>
          <div className="space-y-3">
            <p className="text-xl font-black text-slate-900 leading-tight">{selectedClient?.name || 'Cliente de Mostrador'}</p>
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-3 text-slate-500 font-medium text-xs">
                <span className="material-symbols-outlined text-sm text-primary/50">mail</span>
                {selectedClient?.email || 'ventas@pintamax.com.mx'}
              </div>
              <div className="flex items-center gap-3 text-slate-500 font-medium text-xs">
                <span className="material-symbols-outlined text-sm text-primary/50">phone</span>
                {selectedClient?.phone || '01 800 PINTAMAX'}
              </div>
              <div className="mt-4 inline-flex items-center px-4 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                RFC: {selectedClient?.taxId || 'XAXX010101000'}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-2 border-slate-100 rounded-[32px] flex flex-col justify-center">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-xs">badge</span>
            Atendido por
          </h4>
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">support_agent</span>
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 leading-none">{user.name}</p>
              <p className="text-xs text-slate-500 font-bold mt-1.5">Asesor Especialista</p>
              <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1 italic">Sucursal Centro</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative z-10">
        <div className="rounded-[24px] overflow-hidden border border-slate-100 shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-5 text-left">Referencia / Descripción</th>
                <th className="px-6 py-5 text-center">Cantidad</th>
                <th className="px-6 py-5 text-right">Precio Unitario</th>
                <th className="px-8 py-5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item, idx) => (
                <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">{item.sku}</span>
                      <span className="text-sm font-bold text-slate-800 tracking-tight">{item.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 text-center">
                    <span className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-black text-slate-600">
                      {item.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-6 text-right">
                    <span className="text-xs font-bold text-slate-500">
                      ${(item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty ? item.wholesalePrice : item.price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <span className="text-sm font-black text-slate-900">
                      ${((item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty ? item.wholesalePrice : item.price) * item.quantity).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-300 italic font-medium">
                    No se han seleccionado productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
        <div className="space-y-6">
          <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">gavel</span>
              Condiciones Comerciales
            </h5>
            <ul className="space-y-2 text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-tighter">
              <li className="flex gap-2"><span>•</span> Precios incluyen IVA (16.0%).</li>
              <li className="flex gap-2"><span>•</span> Validez de la oferta: 15 días naturales.</li>
              <li className="flex gap-2"><span>•</span> Entrega inmediata sujeta a stock.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="text-center">
              <div className="h-16 border-b border-slate-300 mb-2"></div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Firma Autorizada</p>
            </div>
            <div className="text-center">
              <div className="h-16 border-b border-slate-300 mb-2"></div>
              <p className="text-[8px] font-black text-slate-400 uppercase">Aceptación Cliente</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-slate-900/40 relative overflow-hidden">
          <div className="absolute -bottom-10 -left-10 size-40 bg-white/5 rounded-full blur-2xl" />
          <div className="space-y-4 relative z-10">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Subtotal</span>
              <span className="text-white">${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            {appliedDiscount && (
              <div className="flex justify-between items-center text-[10px] font-black text-green-400 uppercase tracking-widest">
                <span>Descuento</span>
                <span>-${discountAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>IVA (16%)</span>
              <span className="text-white">${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="pt-6 mt-2 border-t border-white/10 flex flex-col items-end">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">Inversión Total</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold text-white/40">MXN</span>
                <span className="text-4xl font-black text-white tracking-tighter">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10 flex justify-between items-end border-t border-slate-100 relative z-10">
        <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">
          Pintamax © Copyright 2025
        </div>
        <div className="flex items-center gap-6">
          <p className="text-[10px] font-black text-slate-900">pintamax.com.mx</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 relative">
        <header className="h-20 flex items-center justify-between px-6 md:px-10 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 lg:hidden" />
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Cotizador</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Gestión de Presupuestos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsBudgetOpen(true)}
              className="lg:hidden relative p-3 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-2xl"
            >
              <span className="material-symbols-outlined">receipt_long</span>
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] size-5 rounded-full flex items-center justify-center font-black">
                  {items.length}
                </span>
              )}
            </button>
            <div className="flex gap-3 h-10 print:hidden">
              <button
                disabled={items.length === 0}
                onClick={() => setIsPreviewOpen(true)}
                className="flex h-10 px-3 md:px-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black text-xs rounded-xl hover:bg-slate-100 transition-all items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">visibility</span>
                <span className="hidden md:inline">VISTA PREVIA</span>
              </button>
              <button
                disabled={items.length === 0}
                onClick={handlePrint}
                className="h-10 px-6 bg-primary text-white font-black text-xs rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-lg">print</span>
                <span className="hidden sm:inline">IMPRIMIR</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-4 md:p-8 flex flex-col gap-6 overflow-hidden">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                <input
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-primary shadow-sm transition-all text-sm font-medium"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full md:w-80 relative flex items-center bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-1.5 shadow-sm transition-all focus-within:border-primary">
                <span className="material-symbols-outlined text-slate-400 mr-2">person</span>
                <select
                  className="flex-1 bg-transparent border-none text-xs font-black uppercase p-2 focus:ring-0 outline-none cursor-pointer"
                  onChange={e => {
                    const client = clients.find(c => c.id === e.target.value);
                    setSelectedClient(client || null);
                  }}
                >
                  <option value="">Consumidor Final</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())).map(p => (
                  <div key={p.id} onClick={() => addItem(p)} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 border-transparent hover:border-primary hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all group relative">
                    <div className="aspect-square bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 mb-4 flex items-center justify-center overflow-hidden">
                      <img src={p.image} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1.5">{p.sku}</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{p.name}</p>
                    <p className="text-primary font-black mt-3 text-lg">${p.price.toLocaleString()}</p>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-white rounded-xl p-2 shadow-lg">
                      <span className="material-symbols-outlined text-base">add</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Budget Overlay for Mobile */}
          {isBudgetOpen && (
            <div className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-all" onClick={() => setIsBudgetOpen(false)} />
          )}

          <div className={`
            fixed lg:static top-0 right-0 h-full w-[320px] md:w-[440px] bg-white dark:bg-slate-800 
            border-l dark:border-slate-700 flex flex-col z-[45] shadow-2xl transition-all duration-300
            ${isBudgetOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          `}>
            <div className="p-6 md:p-8 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsBudgetOpen(false)} className="lg:hidden text-slate-400 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">arrow_forward_ios</span>
                </button>
                <h3 className="font-black text-lg leading-tight">Presupuesto</h3>
              </div>
              <button onClick={() => setItems([])} className="size-10 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                <span className="material-symbols-outlined">delete_sweep</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
              {items.map(item => (
                <div key={item.id} className="flex gap-4">
                  <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-900 p-2 flex-shrink-0 flex items-center justify-center">
                    <img src={item.image} className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate pr-2">{item.name}</p>
                      <span className="text-sm font-black text-primary">${(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl p-0.5">
                        <button onClick={() => updateQty(item.id, -1)} className="size-7 flex items-center justify-center hover:bg-white dark:hover:bg-slate-600 rounded-lg text-lg font-bold transition-colors">-</button>
                        <span className="text-xs font-black w-8 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="size-7 flex items-center justify-center hover:bg-white dark:hover:bg-slate-600 rounded-lg text-lg font-bold transition-colors">+</button>
                      </div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                        ${item.price.toLocaleString()} C/U
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center py-20 opacity-40">
                  <span className="material-symbols-outlined text-6xl text-slate-300">shopping_bag</span>
                  <p className="text-xs font-black uppercase mt-4">Lista Vacía</p>
                </div>
              )}
            </div>

            <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-100 dark:border-slate-700 space-y-4">
              <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="text-slate-900 dark:text-white">${subtotal.toLocaleString()}</span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between text-xs font-black text-green-600 uppercase tracking-widest">
                  <span>Descuento</span>
                  <span>-${discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                <span>IVA (16.0%)</span>
                <span className="text-slate-900 dark:text-white">${iva.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-end pt-5 border-t-4 border-primary mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">IMPORTE TOTAL</span>
                  <span className="text-2xl md:text-4xl font-black text-primary tracking-tighter leading-none mt-2">${total.toLocaleString()}</span>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <button
                    disabled={items.length === 0 || !!activeDiscountRequest || !!appliedDiscount}
                    onClick={() => setIsDiscountModalOpen(true)}
                    className="text-[9px] font-black text-primary uppercase hover:underline disabled:opacity-50"
                  >
                    {activeDiscountRequest?.status === 'pending' ? 'Esperando Aprobación...' : 'Solicitar Descuento'}
                  </button>
                  <button
                    disabled={items.length === 0}
                    onClick={() => setIsPreviewOpen(true)}
                    className="lg:hidden flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase hover:text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    Vista Previa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODALS */}
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-100 dark:bg-slate-950 p-4 md:p-10 overflow-y-auto flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center shrink-0">
              <button onClick={() => setIsPreviewOpen(false)} className="flex items-center gap-2 text-slate-500 font-black hover:text-slate-900 dark:hover:text-white transition-all uppercase tracking-widest text-xs">
                <span className="material-symbols-outlined">arrow_back</span> Regresar
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-primary/30 hover:scale-105 transition-all uppercase tracking-widest text-xs">
                <span className="material-symbols-outlined">print</span> Imprimir
              </button>
            </div>
            <div className="w-full flex-1 overflow-auto flex flex-col items-center custom-scrollbar pb-20">
              <div className="w-fit bg-white shadow-2xl rounded-sm mb-10">
                <QuoteDocument />
              </div>
              <p className="pb-10 text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">--- Fin de la Vista Previa ---</p>
            </div>
          </div>
        )}

        {isDiscountModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden p-8 md:p-10">
              <h2 className="text-2xl font-black mb-6">Descuento Especial</h2>
              <div className="space-y-6">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                  {(['percentage', 'fixed'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setDiscountType(type)}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${discountType === type ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}
                    >
                      {type === 'percentage' ? 'Porcentaje' : 'Monto Fijo'}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Monto</label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 rounded-2xl font-black text-xl outline-none focus:border-primary transition-all"
                    placeholder={discountType === 'percentage' ? 'Ej: 15' : 'Ej: 500'}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Justificación</label>
                  <textarea
                    value={discountReason}
                    onChange={e => setDiscountReason(e.target.value)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 rounded-2xl font-bold text-sm h-32 resize-none outline-none focus:border-primary transition-all"
                    placeholder="Motivo..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsDiscountModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button>
                  <button
                    onClick={handleRequestDiscount}
                    disabled={!discountValue || !discountReason || loading}
                    className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-50 uppercase text-xs tracking-widest"
                  >
                    {loading ? 'Enviando...' : 'Pedir Descuento'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="hidden print:block w-full">
          <QuoteDocument />
        </div>
      </main>
    </div>
  );
};

export default Quotations;
