
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Sale, Branch, UserRole } from '../types';
import { SalesService } from '../services/salesService';
import { InventoryService } from '../services/inventoryService';

interface SalesHistoryProps {
    user: User;
    onLogout: () => void;
}

type Period = 'today' | 'week' | 'fortnight' | 'month' | 'custom';

const SalesHistory: React.FC<SalesHistoryProps> = ({ user, onLogout }) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [period, setPeriod] = useState<Period>('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedBranch, setSelectedBranch] = useState<string>(user.role === UserRole.ADMIN ? 'ALL' : 'BR-CENTRO');

    useEffect(() => {
        loadBranches();
    }, []);

    useEffect(() => {
        fetchSales();
    }, [period, customStart, customEnd, selectedBranch]);

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

        switch (period) {
            case 'today':
                break;
            case 'week':
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1);
                start.setDate(diff);
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

    const fetchSales = async () => {
        const range = calculateDateRange();
        if (!range) return;

        setLoading(true);
        try {
            const data = await SalesService.getSalesWithFilters(range.start, range.end, selectedBranch);
            setSales(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const totalCash = sales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.total, 0);
    const totalCard = sales.filter(s => s.paymentMethod === 'card').reduce((acc, s) => acc + s.total, 0);
    const totalTransfer = sales.filter(s => s.paymentMethod === 'transfer').reduce((acc, s) => acc + s.total, 0);

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-6 md:px-8 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Corte de Caja</h1>
                    </div>

                    <div className="hidden lg:flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {(['today', 'week', 'fortnight', 'month'] as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${period === p
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {{ today: 'Hoy', week: 'Semana', fortnight: 'Quincena', month: 'Mes', custom: 'Personalizado' }[p]}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6 md:space-y-8">
                    {/* Controls Bar */}
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-end bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/10">

                        {/* Period Selector (Mobile only) */}
                        <div className="lg:hidden w-full space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Periodo</label>
                            <select
                                className="block w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold"
                                value={period}
                                onChange={e => setPeriod(e.target.value as Period)}
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
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                >
                                    <option value="ALL">Todas</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        )}

                        {period === 'custom' && (
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
                            <p className="text-[10px] opacity-60 mt-2">{sales.length} ventas</p>
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loading ? (
                                        <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-bold">Cargando transacciones...</td></tr>
                                    ) : sales.length === 0 ? (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No hay registros</td></tr>
                                    ) : (
                                        sales.map(sale => (
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
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SalesHistory;
