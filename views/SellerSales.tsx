
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabase';

interface SellerSalesProps {
  user: User;
  onLogout: () => void;
}

interface SellerSummary {
  sellerId: string;
  fullName: string;
  role: string;
  monthTotal: number;
  salesCount: number;
}

const SellerSales: React.FC<SellerSalesProps> = ({ user, onLogout }) => {
  const [sellers, setSellers] = useState<SellerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const branchId = user.branchId || '';
      if (!branchId) { setLoading(false); return; }

      const { data: branch } = await supabase.from('branches').select('name').eq('id', branchId).single();
      if (branch) setBranchName(branch.name);

      const { data, error } = await supabase.rpc('get_seller_sales_summary', { p_branch_id: branchId });
      if (error) throw error;

      setSellers((data || []).map((s: any) => ({
        sellerId: s.seller_id,
        fullName: s.full_name || 'Sin nombre',
        role: s.role,
        monthTotal: Number(s.month_total) || 0,
        salesCount: Number(s.sales_count) || 0,
      })));
    } catch (e) {
      console.error('Error loading seller sales:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalBranch = sellers.reduce((acc, s) => acc + s.monthTotal, 0);
  const totalSales = sellers.reduce((acc, s) => acc + s.salesCount, 0);
  const topSeller = sellers.length > 0 ? sellers[0] : null;
  const currentMonth = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const roleLabels: Record<string, string> = { 'SELLER': 'Vendedor', 'STORE_MANAGER': 'Encargado' };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
        <header className="min-h-[4rem] flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">leaderboard</span>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white">Ventas Individuales</h1>
              <p className="text-xs text-slate-500 font-bold capitalize">{currentMonth} — {branchName || user.branchId}</p>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sucursal</p>
                <h3 className="text-2xl font-black text-primary mt-1">${totalBranch.toLocaleString()}</h3>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas del Mes</p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalSales}</h3>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mejor Vendedor</p>
                <h3 className="text-sm font-black text-green-600 mt-1">{topSeller ? topSeller.fullName : '—'}</h3>
                {topSeller && <p className="text-xs text-slate-400">${topSeller.monthTotal.toLocaleString()}</p>}
              </div>
            </div>
            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : sellers.length === 0 ? (
              <div className="text-center py-20">
                <span className="material-symbols-outlined text-5xl text-slate-300">person_off</span>
                <p className="font-bold text-slate-400 mt-3">No hay vendedores registrados en esta sucursal</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                    <tr className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Vendedor</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4 text-center"># Ventas</th>
                      <th className="px-6 py-4 text-right">Total Vendido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {sellers.map((s, idx) => (
                      <tr key={s.sellerId} className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors ${idx === 0 ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {idx === 0 && <span className="material-symbols-outlined text-yellow-500 text-lg">emoji_events</span>}
                            <span className="font-bold text-slate-900 dark:text-white">{s.fullName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {roleLabels[s.role] || s.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600 dark:text-slate-300">{s.salesCount}</td>
                        <td className="px-6 py-4 text-right font-black text-primary text-lg">${s.monthTotal.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-t-2 dark:border-slate-700">
                      <td colSpan={2} className="px-6 py-4 font-black text-slate-500 uppercase text-xs tracking-widest">Total Sucursal</td>
                      <td className="px-6 py-4 text-center font-black text-slate-600 dark:text-slate-300">{totalSales}</td>
                      <td className="px-6 py-4 text-right font-black text-primary text-xl">${totalBranch.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <p className="text-center text-xs text-slate-400 font-medium">
              Solo lectura · Las ventas se actualizan en tiempo real conforme se registran nuevas ventas en el mes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SellerSales;
