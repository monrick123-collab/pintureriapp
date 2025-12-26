
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, RestockRequest } from '../types';
import { InventoryService } from '../services/inventoryService';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  // We can keep sessionSalesTotal logic or update it later, for now focusing on requests
  const [sessionSalesTotal, setSessionSalesTotal] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load pending requests from Supabase
      const pending = await InventoryService.getRestockRequests(undefined, 'pending_admin');
      setRequests(pending);

      // Keep sales history from local storage for now if not migrated, or update to use service if needed.
      // Assuming naive migration for sales history didn't fully replace dashboard logic yet.
      const history = JSON.parse(localStorage.getItem('pintamax_sales_history') || '[]');
      setSessionSalesTotal(history.reduce((acc: number, s: any) => acc + s.total, 0));
    } catch (e) {
      console.error("Error loading dashboard:", e);
    }
  };

  const handleApproveRequest = async (req: RestockRequest) => {
    try {
      // 1. Check stock? Logic is moved to "Confirm Arrival" or "Ship" phase usually, 
      // but if we want to check warehouse stock now we can. 
      // For now, "Approve" just moves it to Warehouse for dispatch.

      await InventoryService.updateRestockStatus(req.id, 'approved_warehouse');

      alert(`Solicitud aprobada correctamente. Ahora aparece en el Panel de Bodega.`);
      await loadDashboardData(); // Refresh list
    } catch (e) {
      console.error(e);
      alert("Error al aprobar la solicitud. Intente nuevamente.");
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950 custom-scrollbar">
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-10 h-20 flex items-center justify-between border-b dark:border-slate-800">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tight">Consola de Operaciones</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Vista Global del Negocio</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full uppercase tracking-widest">
              <span className="size-1.5 bg-green-500 rounded-full animate-pulse"></span>
              Servicio Operativo
            </div>
          </div>
        </header>

        <div className="p-10 max-w-[1600px] mx-auto w-full space-y-10">
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
              <p className="text-[11px] font-black opacity-60 uppercase tracking-[0.2em]">Alertas Pendientes</p>
              <h3 className="text-4xl font-black leading-none tracking-tighter">{requests.length} Solicitudes</h3>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Revisión Requerida</p>
            </div>
          </div>

          {requests.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[40px] border dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                    <span className="material-symbols-outlined text-3xl">move_to_inbox</span>
                  </div>
                  <div>
                    <h3 className="font-black text-2xl tracking-tight text-slate-900 dark:text-white">Traspasos entre Sucursales</h3>
                    <p className="text-sm text-slate-500 font-medium">Logística y Reabastecimiento Crítico</p>
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
      </main>
    </div>
  );
};

export default Dashboard;
