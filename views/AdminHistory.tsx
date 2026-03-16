import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';

interface AdminHistoryProps {
  user: User;
  onLogout: () => void;
}

interface HistoryEntry {
  id: string;
  type: 'sale' | 'restock' | 'transfer' | 'envasado' | 'user_action';
  description: string;
  user: string;
  branch: string;
  timestamp: string;
  details: any;
}

const AdminHistory: React.FC<AdminHistoryProps> = ({ user, onLogout }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Cargar diferentes tipos de historial
      const [sales, restocks, transfers, packaging] = await Promise.all([
        SalesService.getSalesWithFilters('2024-01-01', new Date().toISOString().split('T')[0]),
        InventoryService.getRestockRequests(),
        InventoryService.getStockTransfers(),
        InventoryService.getPackagingRequests()
      ]);

      // Transformar datos a formato común
      const historyEntries: HistoryEntry[] = [];

      // Ventas
      sales.forEach((sale: any) => {
        historyEntries.push({
          id: sale.id,
          type: 'sale',
          description: `Venta ${sale.isWholesale ? 'MAYORISTA' : 'MENUDEO'} - $${sale.total.toFixed(2)}`,
          user: sale.createdBy || 'Sistema',
          branch: sale.branchId,
          timestamp: sale.createdAt,
          details: sale
        });
      });

      // Restocks
      restocks.forEach((restock: any) => {
        historyEntries.push({
          id: restock.id,
          type: 'restock',
          description: `Reabastecimiento - ${restock.status}`,
          user: restock.requestedBy || 'Sistema',
          branch: restock.branchId,
          timestamp: restock.createdAt,
          details: restock
        });
      });

      // Transferencias
      transfers.forEach((transfer: any) => {
        historyEntries.push({
          id: transfer.id,
          type: 'transfer',
          description: `Transferencia ${transfer.fromBranch} → ${transfer.toBranch}`,
          user: transfer.createdBy || 'Sistema',
          branch: transfer.fromBranch,
          timestamp: transfer.createdAt,
          details: transfer
        });
      });

      // Envasados
      packaging.forEach((pack: any) => {
        historyEntries.push({
          id: pack.id,
          type: 'envasado',
          description: `Envasado a ${pack.target_package_type} - ${pack.quantity_drum} tambo(s)`,
          user: 'Sistema',
          branch: pack.branch_id,
          timestamp: pack.created_at,
          details: pack
        });
      });

      // Ordenar por fecha (más reciente primero)
      historyEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setHistory(historyEntries);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(entry => {
    if (filterType !== 'all' && entry.type !== filterType) return false;
    if (startDate && new Date(entry.timestamp) < new Date(startDate)) return false;
    if (endDate && new Date(entry.timestamp) > new Date(endDate + 'T23:59:59')) return false;
    return true;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-800';
      case 'restock': return 'bg-blue-100 text-blue-800';
      case 'transfer': return 'bg-purple-100 text-purple-800';
      case 'envasado': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return '💰';
      case 'restock': return '📦';
      case 'transfer': return '🚚';
      case 'envasado': return '🎨';
      default: return '📝';
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />
      
      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
          <h1 className="text-xl font-black">Historial de Actividades</h1>
          <span className="text-xs text-slate-400 font-bold">Admin: {user.name}</span>
        </header>

        {/* Filtros */}
        <div className="mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo</label>
            <select
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="all">Todos los tipos</option>
              <option value="sale">Ventas</option>
              <option value="restock">Reabastecimientos</option>
              <option value="transfer">Transferencias</option>
              <option value="envasado">Envasados</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
            <input
              type="date"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
            <input
              type="date"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <button
            onClick={loadHistory}
            className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            Actualizar
          </button>

          <span className="text-[10px] text-slate-400 font-bold ml-auto">
            {filteredHistory.length} actividad{filteredHistory.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {/* Tabla de historial */}
        <div className="mx-8 my-4 bg-white dark:bg-slate-900 rounded-[32px] shadow-sm border dark:border-slate-800 overflow-hidden flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="border-b dark:border-slate-800">
                <tr>
                  <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Descripción</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Usuario</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Fecha/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filteredHistory.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase ${getTypeColor(entry.type)}`}>
                        {getTypeIcon(entry.type)} {entry.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="font-bold">{entry.description}</span>
                        {entry.details.items && (
                          <span className="text-[10px] text-slate-400">
                            {entry.details.items.length} producto{entry.details.items.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-bold text-sm">{entry.user}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm">{entry.branch}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">
                          {new Date(entry.timestamp).toLocaleDateString('es-MX')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(entry.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">history</span>
                        <p className="font-black text-base text-slate-400">No hay actividades registradas</p>
                        <p className="text-xs text-slate-400">Los registros aparecerán aquí automáticamente.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminHistory;