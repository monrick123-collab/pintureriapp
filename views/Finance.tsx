
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Expense, ExpenseCategory, PriceRequest } from '../types';
import { AccountingService } from '../services/accountingService';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';

interface FinanceProps {
  user: User;
  onLogout: () => void;
}

const Finance: React.FC<FinanceProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'expenses' | 'audit' | 'inventory'>('dashboard');
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [priceRequests, setPriceRequests] = useState<PriceRequest[]>([]);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PriceRequest | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);

  // Form states for new expense
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: 0,
    category: 'otros' as ExpenseCategory,
    branchId: 'BR-MAIN'
  });

  useEffect(() => {
    loadBaseData();
    loadTabData();
  }, [activeTab, selectedBranch]);

  const loadBaseData = async () => {
    const b = await InventoryService.getBranches();
    setBranches(b);
  };

  const loadTabData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      if (activeTab === 'dashboard') {
        const s = await AccountingService.getFinancialSummary(firstDay, lastDay, selectedBranch);
        setSummary(s);
      } else if (activeTab === 'expenses') {
        const e = await AccountingService.getExpenses(selectedBranch);
        setExpenses(e);
      } else if (activeTab === 'inventory') {
        const pr = await InventoryService.getPriceRequests();
        setPriceRequests(pr);
      }
    } catch (error) {
      console.error("Error loading finance data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await AccountingService.createExpense(newExpense);
      setIsExpenseModalOpen(false);
      loadTabData();
      alert("Gasto registrado correctamente");
    } catch (err) {
      alert("Error al registrar gasto");
    }
  };

  const handleResolvePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await InventoryService.resolvePriceRequest(selectedRequest.id, selectedRequest.productId, newPrice);
      setIsPriceModalOpen(false);
      setSelectedRequest(null);
      setNewPrice(0);
      loadTabData();
      alert("Precio actualizado y solicitud resuelta.");
    } catch (err) {
      alert("Error al actualizar precio");
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
        <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Panel de Contabilidad</h1>
            <div className="flex gap-4 mt-2">
              {['dashboard', 'expenses', 'audit', 'inventory'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
                >
                  {tab === 'dashboard' ? 'Resumen' : tab === 'expenses' ? 'Gastos' : tab === 'audit' ? 'Auditoría' : 'Inventario'}
                </button>
              ))}
            </div>
          </div>
          <select
            className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-4 py-2"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            <option value="ALL">Todas las Sucursales</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'dashboard' && summary && (
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventas Brutas (Mes)</p>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">${summary.totalSales.toLocaleString()}</h2>
                  <p className="text-xs text-green-500 font-bold mt-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">trending_up</span> Incluye IVA
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Utilidad Bruta</p>
                  <h2 className="text-3xl font-black text-primary">${summary.grossProfit.toLocaleString()}</h2>
                  <p className="text-xs text-slate-400 font-bold mt-2">Ventas - Costo de Productos</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Utilidad Neta</p>
                  <h2 className={`text-3xl font-black ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${summary.netProfit.toLocaleString()}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold mt-2">Después de gastos operativos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700">
                  <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
                    Desglose Fiscal
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                      <span className="text-sm font-bold text-slate-500">IVA por Pagar (16%)</span>
                      <span className="text-sm font-black text-red-500">${summary.totalIva.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                      <span className="text-sm font-bold text-slate-500">Costo de Mercancía</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">${summary.totalCogs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-3">
                      <span className="text-sm font-bold text-slate-500">Gastos Operativos</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">${summary.totalExpenses.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 flex flex-col justify-center items-center text-center">
                  <span className="material-symbols-outlined text-5xl text-primary mb-4">insights</span>
                  <h4 className="text-xl font-black text-primary mb-2">Margen de Operación</h4>
                  <div className="text-5xl font-black text-primary mb-2">
                    {summary.totalSales > 0 ? ((summary.netProfit / summary.totalSales) * 100).toFixed(1) : 0}%
                  </div>
                  <p className="text-xs font-bold text-primary/60 uppercase tracking-widest">Rendimiento sobre venta total</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-xl">Registro de Gastos</h3>
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="bg-primary text-white px-6 py-2.5 rounded-xl font-black text-xs shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                  NUEVO GASTO
                </button>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-6 py-4">Descripción</th>
                        <th className="px-6 py-4">Categoría</th>
                        <th className="px-6 py-4">Sucursal</th>
                        <th className="px-6 py-4">Fecha</th>
                        <th className="px-6 py-4 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {expenses.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold">{e.description}</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-[10px] font-black uppercase tracking-tighter text-slate-500">{translateStatus(e.category)}</span>
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-400">{e.branchId}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right font-black text-slate-900 dark:text-white">${e.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {expenses.length === 0 && <div className="p-20 text-center text-slate-300 italic font-bold">No hay gastos registrados en este periodo.</div>}
            </div>
            </div>
          )}

        {activeTab === 'inventory' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-black text-xl">Gestión de Catálogo y Precios</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Solicitudes Pendientes de Bodega</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Producto Solicitado</th>
                      <th className="px-6 py-4">Solicitante (ID)</th>
                      <th className="px-6 py-4">Fecha</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                    {priceRequests.map(pr => (
                      <tr key={pr.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{pr.productName || 'Producto no encontrado'}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase">{pr.productId.slice(0, 8)}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{pr.requesterName}</td>
                        <td className="px-6 py-4 text-xs font-medium text-slate-400">{new Date(pr.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${pr.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {translateStatus(pr.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {pr.status === 'pending' && (
                            <button
                              onClick={() => { setSelectedRequest(pr); setIsPriceModalOpen(true); }}
                              className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-black uppercase hover:scale-105 transition-all"
                            >
                              Asignar Precio
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {priceRequests.length === 0 && <div className="p-20 text-center text-slate-300 italic font-bold">No hay solicitudes de precio pendientes.</div>}
          </div>
            </div>
  )
}

{
  activeTab === 'audit' && (
    <div className="h-full flex flex-col items-center justify-center p-20 text-center opacity-30">
      <span className="material-symbols-outlined text-6xl mb-4">construction</span>
      <h3 className="text-2xl font-black uppercase tracking-widest">Módulo en Desarrollo</h3>
      <p className="max-w-md mt-2 font-bold">Estamos conectando los flujos de auditoría y valoración en tiempo real con la base de datos de Supabase.</p>
    </div>
  )
}
        </div >

  {/* MODAL: ASIGNAR PRECIO */ }
{
  isPriceModalOpen && selectedRequest && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95">
        <h3 className="text-xl font-black mb-1 uppercase tracking-tighter text-slate-900 dark:text-white">Asignar Precio</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">{selectedRequest.productName}</p>

        <form onSubmit={handleResolvePrice} className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Precio al Público ($)</label>
            <input
              type="number"
              required
              autoFocus
              step="0.01"
              className="w-full p-6 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-4xl text-center focus:border-primary outline-none transition-all"
              value={newPrice}
              onChange={e => setNewPrice(parseFloat(e.target.value))}
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => { setIsPriceModalOpen(false); setSelectedRequest(null); }} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancelar</button>
            <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase text-xs tracking-widest">Confirmar</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* MODAL: NUEVO GASTO */ }
{
  isExpenseModalOpen && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-8 animate-in zoom-in-95">
        <h3 className="text-xl font-black mb-6">Registrar Gasto Operativo</h3>
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Descripción</label>
            <input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-bold" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Monto ($)</label>
              <input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-black" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Categoría</label>
              <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-bold" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value as any })}>
                <option value="renta">Renta</option>
                <option value="servicios">Servicios</option>
                <option value="salarios">Salarios</option>
                <option value="suministros">Suministros</option>
                <option value="otros">Otros</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Sucursal</label>
            <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 border rounded-xl font-bold" value={newExpense.branchId} onChange={e => setNewExpense({ ...newExpense, branchId: e.target.value })}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="flex-1 py-3 font-bold text-slate-400">Cancelar</button>
            <button type="submit" className="flex-1 py-3 bg-primary text-white font-black rounded-xl shadow-lg">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  )
}
      </main >
    </div >
  );
};

export default Finance;
