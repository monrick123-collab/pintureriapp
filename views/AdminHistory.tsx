import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { PromotionService } from '../services/promotionService';
import { supabase } from '../services/supabase';
import { exportToCSV } from '../utils/csvExport';

interface AdminHistoryProps {
  user: User;
  onLogout: () => void;
}

interface HistoryEntry {
  id: string;
  type: 'sale' | 'restock' | 'transfer' | 'envasado' | 'user_action' | 'promocion';
  description: string;
  user: string;
  branch: string;
  timestamp: string;
  details: any;
}

const AdminHistory: React.FC<AdminHistoryProps> = ({ user, onLogout }) => {
  const PAGE_SIZE = 25;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      
      // Cargar diferentes tipos de historial
      const [sales, restocks, transfers, packaging, promotions] = await Promise.all([
        SalesService.getSalesWithFilters('2024-01-01', new Date().toISOString().split('T')[0]),
        InventoryService.getRestockRequests(),
        InventoryService.getStockTransfers(),
        InventoryService.getPackagingRequests(),
        PromotionService.getAllRequests().catch(() => [])
      ]);

      // Resolver UUIDs de sucursales y usuarios a nombres (lookup batch)
      const allBranches = await InventoryService.getBranches();
      const branchNameById = new Map(allBranches.map((b: any) => [b.id, b.name]));

      const userIds = [...new Set([
        ...restocks.map((r: any) => r.requestedBy),
        ...transfers.map((t: any) => t.requested_by),
        ...promotions.map((p: any) => p.requestedBy),
      ].filter(Boolean))];

      let userNameById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);
        userNameById = new Map((profiles || []).map((p: any) => [p.id, p.name]));
      }

      const resolveUser = (id?: string) => id ? (userNameById.get(id) || id) : 'Sistema';
      const resolveBranch = (id?: string) => id ? (branchNameById.get(id) || id) : '—';

      // Transformar datos a formato común
      const historyEntries: HistoryEntry[] = [];

      // Ventas
      sales.forEach((sale: any) => {
        historyEntries.push({
          id: sale.id,
          type: 'sale',
          description: `Venta ${sale.isWholesale ? 'MAYORISTA' : 'MENUDEO'} - $${sale.total.toFixed(2)}`,
          user: resolveUser(sale.createdBy),
          branch: sale.branchName || resolveBranch(sale.branchId),
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
          user: resolveUser(restock.requestedBy),
          branch: restock.branchName || resolveBranch(restock.branchId),
          timestamp: restock.createdAt,
          details: restock
        });
      });

      // Transferencias
      transfers.forEach((transfer: any) => {
        const fromName = transfer.fromBranchName || resolveBranch(transfer.from_branch_id);
        const toName = transfer.toBranchName || resolveBranch(transfer.to_branch_id);
        historyEntries.push({
          id: transfer.id,
          type: 'transfer',
          description: `Transferencia ${fromName} → ${toName}`,
          user: resolveUser(transfer.requested_by),
          branch: fromName,
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
          branch: pack.branches?.name || resolveBranch(pack.branch_id),
          timestamp: pack.created_at,
          details: pack
        });
      });

      // Solicitudes de promoción
      promotions.forEach((promo: any) => {
        const statusLabel = promo.status === 'approved' ? 'Aprobada' : promo.status === 'rejected' ? 'Rechazada' : 'Pendiente';
        const discountAmt = promo.requestedDiscountAmount ? ` (-$${parseFloat(promo.requestedDiscountAmount).toFixed(2)})` : '';
        historyEntries.push({
          id: promo.id,
          type: 'promocion',
          description: `Solicitud promoción ${promo.requestedDiscountPercent}% para ${promo.clientName || 'cliente'} — ${statusLabel}${discountAmt}`,
          user: resolveUser(promo.requestedBy),
          branch: resolveBranch(promo.branchId),
          timestamp: promo.createdAt,
          details: promo
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

  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);
  const pagedHistory = filteredHistory.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleExport = () => {
    exportToCSV(
      `historial-actividades-${new Date().toISOString().split('T')[0]}.csv`,
      filteredHistory,
      [
        { key: 'type', label: 'Tipo' },
        { key: 'description', label: 'Descripción' },
        { key: 'user', label: 'Usuario' },
        { key: 'branch', label: 'Sucursal' },
        { key: 'timestamp', label: 'Fecha/Hora' }
      ]
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-800';
      case 'restock': return 'bg-blue-100 text-blue-800';
      case 'transfer': return 'bg-purple-100 text-purple-800';
      case 'envasado': return 'bg-amber-100 text-amber-800';
      case 'promocion': return 'bg-rose-100 text-rose-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return '💰';
      case 'restock': return '📦';
      case 'transfer': return '🚚';
      case 'envasado': return '🎨';
      case 'promocion': return '🏷️';
      default: return '📝';
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />
      
      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
        <header className="min-h-[4rem] flex items-center justify-between px-4 md:px-8 py-3 flex-wrap gap-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
          <h1 className="text-xl font-black">Historial de Actividades</h1>
          <span className="text-xs text-slate-400 font-bold">Admin: {user.name}</span>
        </header>

        {/* Filtros */}
        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo</label>
            <select
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setCurrentPage(0); }}
            >
              <option value="all">Todos los tipos</option>
              <option value="sale">Ventas</option>
              <option value="restock">Reabastecimientos</option>
              <option value="transfer">Transferencias</option>
              <option value="envasado">Envasados</option>
              <option value="promocion">Solicitudes de Promoción</option>
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
            onClick={() => { setCurrentPage(0); loadHistory(); }}
            className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all"
          >
            Actualizar
          </button>

          <button
            onClick={handleExport}
            disabled={filteredHistory.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Exportar CSV
          </button>

          <span className="text-[10px] text-slate-400 font-bold ml-auto">
            {filteredHistory.length} actividad{filteredHistory.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {/* Tabla de historial */}
        <div className="mx-8 my-4 bg-white dark:bg-slate-900 rounded-2xl md:rounded-[32px] shadow-sm border dark:border-slate-800 overflow-hidden flex-1 overflow-y-auto">
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
                {pagedHistory.map((entry) => (
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

          {filteredHistory.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-8 py-4 border-t dark:border-slate-800">
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-4 py-2 text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-xs font-bold text-slate-400">
                Página {currentPage + 1} de {totalPages} · {filteredHistory.length} registros
              </span>
              <button
                disabled={(currentPage + 1) * PAGE_SIZE >= filteredHistory.length}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-4 py-2 text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminHistory;