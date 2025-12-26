
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
    // Nota: En una app real, el vendedor tendría su branch asignada en su perfil.

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

        // Set explicit time boundaries
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        switch (period) {
            case 'today':
                // Start is already today 00:00
                break;
            case 'week':
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
                start.setDate(diff);
                break;
            case 'fortnight':
                start.setDate(start.getDate() - 15);
                break;
            case 'month':
                start.setDate(1); // First day of current month
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
            alert("Error cargando historial de ventas");
        } finally {
            setLoading(false);
        }
    };

    // Metrics
    const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
    const totalCash = sales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.total, 0);
    const totalCard = sales.filter(s => s.paymentMethod === 'card').reduce((acc, s) => acc + s.total, 0);
    const totalTransfer = sales.filter(s => s.paymentMethod === 'transfer').reduce((acc, s) => acc + s.total, 0);

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Corte de Caja y Ventas</h1>

                    <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {(['today', 'week', 'fortnight', 'month'] as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${period === p
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {{ today: 'Hoy', week: 'Semana', fortnight: 'Quincena', month: 'Mes' }[p]}
                            </button>
                        ))}
                        <button
                            onClick={() => setPeriod('custom')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${period === 'custom'
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-slate-500'
                                }`}
                        >
                            Personalizado
                        </button>
                    </div>
                </header>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">

                    {/* Controls Bar */}
                    <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-slate-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm">
                        {user.role === UserRole.ADMIN && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal</label>
                                <select
                                    className="block w-48 px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20"
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                >
                                    <option value="ALL">Todas las Sucursales</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        )}

                        {period === 'custom' && (
                            <>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                    <input type="date" className="block px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                    <input type="date" className="block px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>

                    {/* KPI Cards (Corte de Caja) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="p-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
                            <p className="text-xs font-medium opacity-80 uppercase tracking-widest mb-1">Total Ventas</p>
                            <h3 className="text-3xl font-black">${totalSales.toLocaleString()}</h3>
                            <p className="text-[10px] opacity-60 mt-2">{sales.length} transacciones</p>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo (Caja)</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">${totalCash.toLocaleString()}</h3>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Tarjeta / TPV</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">${totalCard.toLocaleString()}</h3>
                        </div>
                        <div className="p-6 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-sm">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Transferencias</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white">${totalTransfer.toLocaleString()}</h3>
                        </div>
                    </div>

                    {/* Sales Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-800">
                                <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                                    <th className="px-6 py-4">Folio / Fecha</th>
                                    <th className="px-6 py-4">Detalle Venta</th>
                                    <th className="px-6 py-4">Método Pago</th>
                                    <th className="px-6 py-4 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {sales.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                                            No se encontraron ventas en este periodo.
                                        </td>
                                    </tr>
                                ) : (
                                    sales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{sale.id.slice(0, 8)}...</span>
                                                    <span className="text-[10px] text-slate-500">{new Date(sale.createdAt).toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {sale.items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-slate-300 max-w-xs">
                                                            <span>{item.quantity}x {item.productName}</span>
                                                            <span className="text-slate-400 font-mono">${item.total.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                    {sale.branchName && (
                                                        <span className="mt-1 text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded w-fit text-slate-500">
                                                            {sale.branchName}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide
                           ${sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                                                        sale.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
                         `}>
                                                    {sale.paymentMethod === 'cash' ? 'Efectivo' : sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transf.'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-sm font-black text-slate-900 dark:text-white">${sale.total.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default SalesHistory;
