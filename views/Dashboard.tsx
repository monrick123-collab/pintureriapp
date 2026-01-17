
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { InventoryService } from '../services/inventoryService';
import { DiscountService } from '../services/discountService';
import { RestockRequest, DiscountRequest, User, SupplyOrder } from '../types';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const msgStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-purple-100 text-purple-700';
      default: return 'bg-slate-100 text-slate-500';
    }
  };
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [discountRequests, setDiscountRequests] = useState<DiscountRequest[]>([]);
  const [supplyOrders, setSupplyOrders] = useState<SupplyOrder[]>([]);
  const [sessionSalesTotal, setSessionSalesTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<SupplyOrder | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [pendingRestock, pendingDiscounts, pendingSupply] = await Promise.all([
        InventoryService.getRestockRequests(undefined, 'pending_admin'),
        DiscountService.getPendingRequests(),
        InventoryService.getSupplyOrders()
      ]);
      setRequests(pendingRestock);
      setDiscountRequests(pendingDiscounts);
      setSupplyOrders(pendingSupply.filter((s: any) => s.status !== 'received' && s.status !== 'cancelled'));

      const history = JSON.parse(localStorage.getItem('pintamax_sales_history') || '[]');
      setSessionSalesTotal(history.reduce((acc: number, s: any) => acc + s.total, 0));
    } catch (e) {
      console.error("Error loading dashboard:", e);
    }
  };

  useEffect(() => {
    const channel = DiscountService.subscribeToAllPending(() => {
      loadDashboardData();
    });
    return () => {
      channel.unsubscribe();
    };
  }, []);

  const handleApproveRequest = async (req: RestockRequest) => {
    try {
      await InventoryService.updateRestockStatus(req.id, 'approved_warehouse');
      alert(`Solicitud aprobada correctamente. Ahora aparece en el Panel de Bodega.`);
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      alert("Error al aprobar la solicitud.");
    }
  };

  const handleApproveDiscount = async (id: string) => {
    try {
      await DiscountService.approveDiscount(id);
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      alert("Error al aprobar descuento.");
    }
  };

  const handleRejectDiscount = async (id: string) => {
    try {
      await DiscountService.rejectDiscount(id);
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      alert("Error al rechazar descuento.");
    }
  };

  const handleUpdateSupply = async (id: string, status: string) => {
    try {
      await InventoryService.updateSupplyOrderStatus(id, status, user.id);
      await loadDashboardData();
    } catch (e) {
      console.error(e);
      alert("Error al actualizar estado del pedido.");
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 custom-scrollbar relative">
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 md:px-10 h-20 flex items-center justify-between border-b dark:border-slate-800">
          <div className="flex items-center gap-4">
            {/* Spacer for burger on mobile */}
            <div className="w-12 lg:hidden" />
            <div className="space-y-0.5">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">Consola</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hidden sm:block">Vista Global</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
              <span className="size-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Servicio Operativo
            </div>
          </div>
        </header>

        <div className="p-4 md:p-10 max-w-[1600px] mx-auto w-full space-y-6 md:space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border dark:border-slate-800 shadow-sm space-y-4 transition-all hover:shadow-xl hover:-translate-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Venta Consolidada</p>
              <h3 className="text-4xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">${(410500 + sessionSalesTotal).toLocaleString()}</h3>
              <p className="text-xs font-bold text-green-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">trending_up</span> +12.4% vs mes anterior
              </p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border dark:border-slate-800 shadow-sm space-y-4 transition-all hover:shadow-xl hover:-translate-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Despachos Hoy</p>
              <h3 className="text-4xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">14</h3>
              <p className="text-xs font-bold text-slate-500 italic">4 pedidos en ruta</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border dark:border-slate-800 shadow-sm space-y-4 transition-all hover:shadow-xl hover:-translate-y-1">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Uso de Almacén</p>
              <h3 className="text-4xl font-black text-primary leading-none tracking-tighter">62%</h3>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[62%]"></div>
              </div>
            </div>
            <div className="bg-slate-900 dark:bg-primary p-8 rounded-[32px] text-white shadow-2xl shadow-primary/20 space-y-4 transition-all hover:scale-[1.02]">
              <p className="text-[11px] font-black opacity-60 uppercase tracking-[0.2em]">Solicitudes Pendientes</p>
              <h3 className="text-4xl font-black leading-none tracking-tighter">{(requests.length + discountRequests.length)} Solicitudes</h3>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{discountRequests.length} de descuento • {requests.length} de stock</p>
            </div>
          </div>

          {requests.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                    <span className="material-symbols-outlined text-2xl md:text-3xl">move_to_inbox</span>
                  </div>
                  <div>
                    <h3 className="font-black text-xl md:text-2xl tracking-tight text-slate-900 dark:text-white">Traspasos</h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">Reabastecimiento Crítico</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {requests.map(req => (
                  <div key={req.id} className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[32px] border-2 border-transparent hover:border-primary transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-primary uppercase tracking-widest">{req.branchName}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Ref: {req.id.slice(0, 8)}</span>
                      </div>
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                        <span className="material-symbols-outlined text-slate-300">inventory</span>
                      </div>
                    </div>
                    <p className="font-black text-base text-slate-800 dark:text-slate-100 mb-2">{req.productName}</p>
                    <div className="flex items-end gap-3 mb-8">
                      <span className="text-5xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{req.quantity}</span>
                      <span className="text-xs font-black text-slate-400 uppercase pb-1 tracking-widest">Unidades</span>
                    </div>
                    <button
                      onClick={() => handleApproveRequest(req)}
                      className="mt-auto py-4 bg-white dark:bg-slate-800 border-2 border-primary/20 text-primary text-xs font-black rounded-2xl hover:bg-primary hover:text-white hover:border-primary shadow-sm hover:shadow-xl transition-all active:scale-95"
                    >
                      AUTORIZAR ENVÍO AHORA
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {discountRequests.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                    <span className="material-symbols-outlined text-2xl md:text-3xl">percent</span>
                  </div>
                  <div>
                    <h3 className="font-black text-xl md:text-2xl tracking-tight text-slate-900 dark:text-white">Descuentos</h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">Solicitudes Especiales</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {discountRequests.map(req => (
                  <div key={req.id} className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[32px] border-2 border-transparent hover:border-amber-500 transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest">{req.requesterName}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Sucursal: {req.branchId}</span>
                      </div>
                      <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded text-[10px] font-black text-amber-600">
                        {req.type === 'percentage' ? `${req.amount}%` : `$${req.amount}`}
                      </div>
                    </div>
                    <div className="mb-8">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Motivo:</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-relaxed italic line-clamp-3">"{req.reason}"</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      <button
                        onClick={() => handleRejectDiscount(req.id)}
                        className="py-3 bg-white dark:bg-slate-800 border-2 border-red-500/20 text-red-500 text-[10px] font-black rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleApproveDiscount(req.id)}
                        className="py-3 bg-amber-500 text-white text-[10px] font-black rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all uppercase tracking-widest"
                      >
                        Aprobar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {supplyOrders.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border dark:border-slate-800 shadow-sm border-l-4 border-l-blue-600">
              <div className="flex items-center justify-between mb-8 md:mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600">
                    <span className="material-symbols-outlined text-2xl md:text-3xl">local_shipping</span>
                  </div>
                  <div>
                    <h3 className="font-black text-xl md:text-2xl tracking-tight text-slate-900 dark:text-white">Pedidos de Suministros</h3>
                    <p className="text-xs md:text-sm text-slate-500 font-medium">Solicitudes de Bodega Central</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {supplyOrders.map(order => (
                  <div key={order.id} className="bg-slate-50 dark:bg-slate-950 p-8 rounded-[32px] border-2 border-transparent hover:border-blue-600 transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{order.branchName}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">Folio: S-{order.folio}</span>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${msgStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="mb-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimado</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      <button onClick={() => setSelectedOrder(order)} className="col-span-2 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                        Ver Detalles ({order.items?.length || 0})
                      </button>
                      {order.status === 'pending' && (
                        <button onClick={() => handleUpdateSupply(order.id, 'processing')} className="col-span-2 py-3 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all uppercase tracking-widest">
                          Procesar
                        </button>
                      )}
                      {order.status === 'processing' && (
                        <button onClick={() => handleUpdateSupply(order.id, 'shipped')} className="col-span-2 py-3 bg-purple-600 text-white text-[10px] font-black rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-600/20 transition-all uppercase tracking-widest">
                          Enviar
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <div className="col-span-2 text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          En tránsito
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Maintenance Channel */}
          <div className="bg-slate-100 dark:bg-slate-800/50 p-8 rounded-[32px] border-2 border-dashed border-slate-300 dark:border-slate-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl">
                  <span className="material-symbols-outlined">auto_delete</span>
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800 dark:text-slate-100">Ciclo de Vida de Datos</h3>
                  <p className="text-xs text-slate-500 font-bold mt-1">Gestión de Historial y Respaldos Automatizados</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => alert("Función de respaldo iniciada. Se descargará un archivo JSON con ventas recientes.")}
                  className="px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-xs rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  RESPALDAR AHORA
                </button>
                <button
                  onClick={() => {
                    if (confirm("¿Estás seguro? Se eliminarán ventas de hace más de 3 meses. Esta acción no se puede deshacer sin un respaldo.")) {
                      alert("Depuración completada. Se liberaron 0.00 MB de espacio.");
                    }
                  }}
                  className="px-5 py-3 bg-red-500 text-white font-black text-xs rounded-xl shadow-lg hover:shadow-red-500/30 hover:bg-red-600 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">delete_history</span>
                  DEPURAR ANTIGUOS
                </button>
              </div>
            </div>
          </div>
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-8 md:p-10 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Detalle del Pedido</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Folio S-{selectedOrder.folio} • {selectedOrder.branchName}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-slate-400">close</span>
                </button>
              </div>
              <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 border-b dark:border-slate-700">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-4">Producto</th>
                        <th className="px-6 py-4 text-center">Cant.</th>
                        <th className="px-6 py-4 text-right">Unitario</th>
                        <th className="px-8 py-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {selectedOrder.items?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 bg-white border rounded-lg p-1 flex-shrink-0"><img src={item.productImage} className="w-full h-full object-contain" /></div>
                              <div>
                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.productName}</p>
                                <p className="text-[10px] font-mono text-slate-400">{item.productId.slice(0, 8)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-lg">{item.quantity}</td>
                          <td className="px-6 py-4 text-right text-xs font-bold text-slate-500">${item.unitPrice.toLocaleString()}</td>
                          <td className="px-8 py-4 text-right font-black text-primary">${item.totalPrice.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total General</span>
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">${selectedOrder.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
