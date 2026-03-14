import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole } from '../types';
import { SalesService } from '../services/salesService';
import { DiscountService } from '../services/discountService';
import { DiscountRequest } from '../types';

// Import new hooks and components
import { useProducts } from '../hooks/useProducts';
import { useCart } from '../hooks/useCart';
import { useSales } from '../hooks/useSales';
import { useToast } from '../hooks/useToast';
import { useUIStore } from '../store/uiStore';
import { useAuthStore } from '../store/authStore';

// Import UI components
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

interface POSProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'pos' | 'history';
type PaymentMethod = 'cash' | 'card' | 'transfer';

const POS: React.FC<POSProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('pos');
  const currentBranchId = user.branchId || 'BR-CENTRO';
  
  // Use new hooks
  const { products, loading, getProductsByCategory, searchProducts } = useProducts(currentBranchId);
  const { 
    items: cart, 
    addToCart, 
    updateQuantity, 
    setQuantity, 
    clearCart, 
    applyDiscount, 
    removeDiscount,
    discount,
    calculateCartSummary,
    isEmpty,
    itemCount
  } = useCart();
  
  const {
    sales: historySales,
    loading: historyLoading,
    period: historyPeriod,
    setPeriod: setHistoryPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    totalSales,
    totalCash,
    totalCard,
    totalTransfer,
    fetchSales
  } = useSales(user.role === UserRole.ADMIN ? 'ALL' : currentBranchId);
  
  const toast = useToast();
  const uiStore = useUIStore();
  const { isAdmin } = useAuthStore();
  
  // Local state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountReason, setDiscountReason] = useState('');
  const [activeDiscountRequest, setActiveDiscountRequest] = useState<DiscountRequest | null>(null);
  const [selectedHistorySale, setSelectedHistorySale] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Filter products based on search and category
  const filteredProducts = getProductsByCategory(category).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );
  
  const { subtotal, discountAmount, iva, total } = calculateCartSummary();
  const change = Math.max(0, parseFloat(cashReceived || '0') - total);
  
  const handleRequestDiscount = async () => {
    if (!discountValue || !discountReason) {
      toast.error('Complete todos los campos del descuento');
      return;
    }
    
    try {
      uiStore.setLoading(true);
      const requestId = await DiscountService.requestDiscount(
        user.id,
        user.name,
        currentBranchId,
        parseFloat(discountValue),
        discountType,
        discountReason
      );
      
      DiscountService.subscribeToRequest(requestId, (updated) => {
        setActiveDiscountRequest(updated);
        if (updated.status === 'approved') {
          applyDiscount({ amount: updated.amount, type: updated.type });
          toast.success('¡Descuento aprobado!');
        } else if (updated.status === 'rejected') {
          toast.error('El descuento fue rechazado.');
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
      
      uiStore.closeDiscountModal();
      setDiscountValue('');
      setDiscountReason('');
    } catch (e: any) {
      toast.error('Error al solicitar descuento');
      console.error(e);
    } finally {
      uiStore.setLoading(false);
    }
  };
  
  const handleFinalizeSale = async () => {
    if (paymentMethod === 'card' || paymentMethod === 'transfer') {
      const bank = (document.getElementById('billing-bank') as HTMLInputElement)?.value;
      const social = (document.getElementById('billing-social') as HTMLInputElement)?.value;
      const invoice = (document.getElementById('billing-invoice') as HTMLInputElement)?.value;
      
      if (!bank || !social || !invoice) {
        toast.error('Escriba Banco, Razón Social y No. Factura para continuar.');
        return;
      }
    }
    
    try {
      uiStore.setLoading(true);
      
      const saleItems = cart.map(item => {
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
        undefined,
        { subtotal, discountAmount, iva }
      );
      
      setShowSuccess(true);
      clearCart();
      setCashReceived('');
      
      setTimeout(() => {
        setShowSuccess(false);
        uiStore.closePaymentModal();
      }, 2000);
      
      toast.success('¡Venta procesada exitosamente!');
    } catch (e: any) {
      toast.error('Error al procesar la venta. Verifique la conexión o el stock.');
      console.error(e);
    } finally {
      uiStore.setLoading(false);
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
              <Button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                variant={activeTab === tab.key ? 'primary' : 'ghost'}
                size="sm"
                className="px-3 lg:px-5 uppercase tracking-widest"
              >
                {tab.label}
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === 'pos' && (
              <Button
                onClick={() => uiStore.setCartOpen(true)}
                variant="ghost"
                size="sm"
                className="lg:hidden relative"
                leftIcon={<span className="material-symbols-outlined">shopping_cart</span>}
              >
                {itemCount > 0 && (
                  <Badge variant="primary" size="sm" className="absolute -top-1 -right-1">
                    {itemCount}
                  </Badge>
                )}
              </Button>
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
                  <Input
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftIcon={<span className="material-symbols-outlined">search</span>}
                  />
                  
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {['Todos', 'Interiores', 'Exteriores', 'Esmaltes', 'Accesorios'].map(cat => (
                      <Button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        variant={category === cat ? 'primary' : 'outline'}
                        size="sm"
                        className="rounded-full"
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 custom-scrollbar">
                  {loading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-slate-400">Cargando productos...</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredProducts.map(product => {
                        const stock = product.inventory[currentBranchId] || 0;
                        const isLowStock = stock <= (product.min_stock || 10);
                        
                        return (
                          <Card
                            key={product.id}
                            hoverable
                            bordered
                            className="cursor-pointer group"
                            onClick={() => addToCart(product)}
                          >
                            <div className="relative aspect-square bg-slate-100 dark:bg-slate-900">
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform" 
                              />
                              <Badge
                                variant={stock === 0 ? 'danger' : isLowStock ? 'warning' : 'default'}
                                className="absolute top-2 right-2"
                              >
                                {stock} DISP.
                              </Badge>
                            </div>
                            <div className="p-3">
                              <p className="text-xs font-bold truncate">{product.name}</p>
                              <p className="text-primary font-black mt-1">${product.price.toLocaleString()}</p>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Cart Sidebar */}
              <div className={`
                fixed lg:static top-0 right-0 h-full w-[320px] md:w-[380px] bg-white dark:bg-slate-800 
                border-l border-slate-200 dark:border-slate-700 flex flex-col z-[45] shadow-2xl transition-all duration-300
                ${uiStore.isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
              `}>
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => uiStore.setCartOpen(false)}
                      variant="ghost"
                      size="sm"
                      className="lg:hidden"
                      leftIcon={<span className="material-symbols-outlined">arrow_forward_ios</span>}
                    />
                    <h3 className="font-bold text-sm">Venta Actual</h3>
                  </div>
                  <Button
                    onClick={clearCart}
                    variant="ghost"
                    size="sm"
                    leftIcon={<span className="material-symbols-outlined">delete</span>}
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-10 h-10 rounded bg-slate-100 p-1">
                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold truncate">{item.name}</p>
                        <div className="flex justify-between items-center mt-1">
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => updateQuantity(item.id, -1)}
                              variant="outline"
                              size="sm"
                              className="size-5 p-0"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-12 text-center p-0"
                            />
                            <Button
                              onClick={() => updateQuantity(item.id, 1)}
                              variant="outline"
                              size="sm"
                              className="size-5 p-0"
                            >
                              +
                            </Button>
                          </div>
                          <div className="flex flex-col items-end">
                            {item.wholesalePrice && item.wholesaleMinQty && item.quantity >= item.wholesaleMinQty ? (
                              <>
                                <Badge variant="success" size="sm" className="mb-0.5">MAYOREO</Badge>
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
                  <Card padding="sm">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold">SUBTOTAL</span>
                        <span className="font-bold">${subtotal.toLocaleString()}</span>
                      </div>
                      {discount && (
                        <div className="flex justify-between text-xs text-green-600 font-bold">
                          <span>DESCUENTO ({discount.type === 'percentage' ? `${discount.amount}%` : `$${discount.amount}`})</span>
                          <span>-${discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-bold">IVA (16%)</span>
                        <span className="font-bold">${iva.toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>
                  
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-slate-400">TOTAL</span>
                    <span className="text-2xl font-black text-primary">${total.toLocaleString()}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      disabled={isEmpty || !!activeDiscountRequest || !!discount}
                      onClick={() => uiStore.openDiscountModal()}
                      variant="secondary"
                      fullWidth
                    >
                      {activeDiscountRequest?.status === 'pending' ? 'Esperando...' : 'Descuento'}
                    </Button>
                    <Button
                      disabled={isEmpty || activeDiscountRequest?.status === 'pending'}
                      onClick={() => uiStore.openPaymentModal()}
                      variant="primary"
                      fullWidth
                    >
                      Pagar Ahora
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Payment Modal */}
            <Modal
              isOpen={uiStore.isPaymentModalOpen}
              onClose={() => uiStore.closePaymentModal()}
              title="Confirmar Pago"
              size="md"
            >
              <div className="space-y-4">
                <Card>
                  <p className="text-xs font-bold text-slate-400">Monto a Cobrar</p>
                  <p className="text-3xl font-black text-primary">${total.toLocaleString()}</p>
                </Card>
                
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">
                    Método de Pago
                  </label>
                  <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                    {(['cash', 'card', 'transfer'] as PaymentMethod[]).map(method => (
                      <Button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        variant={paymentMethod === method ? 'primary' : 'ghost'}
                        fullWidth
                        className="text-xs uppercase"
                      >
                        {{ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transf.' }[method]}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {(paymentMethod === 'card' || paymentMethod === 'transfer') && (
                  <Card className="border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-blue-500 text-sm">receipt_long</span>
                      <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">
                        Datos de Facturación Obligatorios
                      </span>
                    </div>
                    <div className="space-y-3">
                      <Input label="Banco" id="billing-bank" placeholder="Ej: BBVA, Santander" />
                      <Input label="Razón Social" id="billing-social" placeholder="Nombre o Razón Social" />
                      <Input label="No. Factura / Referencia" id="billing-invoice" placeholder="Folio de Factura" />
                    </div>
                  </Card>
                )}
                
                <Input
                  label="Monto Recibido"
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="text-xl font-black"
                />
                
                <div className="flex justify-between text-sm font-bold pt-2">
                  <span className="text-slate-500">Cambio:</span>
                  <span className="text-green-600">${change.toLocaleString()}</span>
                </div>
                
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={() => uiStore.closePaymentModal()}
                    variant="ghost"
                    fullWidth
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleFinalizeSale}
                    disabled={uiStore.loading}
                    variant="primary"
                    fullWidth
                  >
                    {uiStore.loading ? 'Procesando...' : 'Finalizar'}
                  </Button>
                </div>
              </div>
              
              {showSuccess && (
                <div className="absolute inset-0 bg-white dark:bg-slate-800 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95">
                  <div className="size-20 rounded-full bg-green-500 text-white flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-5xl">check</span>
                  </div>
                  <h3 className="text-2xl font-black">¡Venta Exitosa!</h3>
                  <p className="text-slate-500">Inventario actualizado en tiempo real.</p>
                </div>
              )}
            </Modal>
            
            {/* Discount Modal */}
            <Modal
              isOpen={uiStore.isDiscountModalOpen}
              onClose={() => uiStore.closeDiscountModal()}
              title="Solicitar Descuento"
              size="sm"
            >
              <div className="space-y-4">
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                  {(['percentage', 'fixed'] as const).map(type => (
                    <Button
                      key={type}
                      onClick={() => setDiscountType(type)}
                      variant={discountType === type ? 'primary' : 'ghost'}
                      fullWidth
                      className="text-[10px] uppercase"
                    >
                      {type === 'percentage' ? 'Porcentaje (%)' : 'Monto Fijo ($)'}
                    </Button>
                  ))}
                </div>
                
                <Input
                  label="Valor del Descuento"
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Ej: 10' : 'Ej: 50'}
                />
                
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">
                    Motivo
                  </label>
                  <textarea
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-medium text-sm h-24 resize-none"
                    placeholder="Escriba la razón para este descuento..."
                  />
                </div>
                
                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={() => uiStore.closeDiscountModal()}
                    variant="ghost"
                    fullWidth
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRequestDiscount}
                    disabled={!discountValue || !discountReason || uiStore.loading}
                    variant="primary"
                    fullWidth
                  >
                    {uiStore.loading ? 'Enviando...' : 'Solicitar'}
                  </Button>
                </div>
              </div>
            </Modal>
          </>
        )}
        
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6 md:space-y-8">
              {/* Controls Bar */}
              <Card>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                  {/* Period Selector */}
                  <div className="lg:hidden w-full">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">
                      Periodo
                    </label>
                    <select
                      className="block w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold"
                      value={historyPeriod}
                      onChange={e => setHistoryPeriod(e.target.value as any)}
                    >
                      <option value="today">Hoy</option>
                      <option value="week">Esta Semana</option>
                      <option value="fortnight">Quincena</option>
                      <option value="month">Este Mes</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                  
                  {isAdmin && (
                    <div className="w-full md:w-auto">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 block">
                        Sucursal
                      </label>
                      <select
                        className="block w-full md:w-48 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold"
                        value={user.role === UserRole.ADMIN ? 'ALL' : currentBranchId}
                        onChange={e => {/* Handle branch change */}}
                      >
                        <option value="ALL">Todas</option>
                        {/* Add branch options here */}
                      </select>
                    </div>
                  )}
                  
                  {historyPeriod === 'custom' && (
                    <div className="flex gap-4 w-full md:w-auto">
                      <div className="flex-1">
                        <Input
                          label="Desde"
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          label="Hasta"
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
              
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <p className="text-xs font-medium opacity-80 uppercase tracking-widest mb-1">Total</p>
                  <h3 className="text-2xl md:text-3xl font-black">${totalSales.toLocaleString()}</h3>
                  <p className="text-[10px] opacity-60 mt-2">{historySales.length} ventas</p>
                </Card>
                <Card>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">${totalCash.toLocaleString()}</h3>
                </Card>
                <Card>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Tarjeta</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">${totalCard.toLocaleString()}</h3>
                </Card>
                <Card>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Transf.</p>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">${totalTransfer.toLocaleString()}</h3>
                </Card>
              </div>
              
              {/* Sales Table - Simplified for now */}
              <Card>
                <div className="overflow-x-auto">
                  {historyLoading ? (
                    <div className="px-6 py-20 text-center text-slate-400 font-bold">
                      Cargando transacciones...
                    </div>
                  ) : historySales.length === 0 ? (
                    <div className="px-6 py-12 text-center text-slate-400 italic">
                      No hay registros
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historySales.slice(0, 10).map(sale => (
                        <div key={sale.id} className="p-4 border-b dark:border-slate-800 last:border-0">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white">
                                {sale.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-[9px] text-slate-400">
                                {new Date(sale.createdAt).toLocaleDateString()} • {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                ${sale.total.toLocaleString()}
                              </p>
                              <Badge
                                variant={
                                  sale.paymentMethod === 'cash' ? 'success' :
                                  sale.paymentMethod === 'card' ? 'primary' : 'info'
                                }
                                size="sm"
                              >
                                {sale.paymentMethod === 'cash' ? 'Efectivo' : 
                                 sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transf.'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default POS;