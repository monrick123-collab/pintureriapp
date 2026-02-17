import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, CoinChangeRequest, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';

interface CoinChangeProps {
    user: User;
    onLogout: () => void;
}

const DENOMINATIONS = [
    { value: 500, label: '$500', type: 'billete' },
    { value: 200, label: '$200', type: 'billete' },
    { value: 100, label: '$100', type: 'billete' },
    { value: 50, label: '$50', type: 'billete' },
    { value: 20, label: '$20', type: 'billete' },
    { value: 10, label: '$10', type: 'moneda' },
    { value: 5, label: '$5', type: 'moneda' },
    { value: 2, label: '$2', type: 'moneda' },
    { value: 1, label: '$1', type: 'moneda' },
    { value: 0.5, label: '50¢', type: 'moneda' },
];

const CoinChange: React.FC<CoinChangeProps> = ({ user, onLogout }) => {
    const [requests, setRequests] = useState<CoinChangeRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [breakdown, setBreakdown] = useState<Record<string, number>>({});

    const totalAmount = DENOMINATIONS.reduce((acc, d) => acc + (d.value * (breakdown[d.value.toString()] || 0)), 0);

    const isAdmin = user.role === UserRole.ADMIN;
    const branchId = user.branchId || 'BR-MAIN';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await InventoryService.getCoinChangeRequests(isAdmin ? undefined : branchId);
            setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totalAmount <= 0) return;
        try {
            setLoading(true);
            // Convert numbers to strings for JSON Record
            await InventoryService.createCoinChangeRequest(branchId, user.id, totalAmount, breakdown);
            setIsModalOpen(false);
            setBreakdown({});
            loadData();
            alert("Solicitud de cambio creada.");
        } catch (e) {
            alert("Error al crear solicitud");
        } finally {
            setLoading(false);
        }
    };

    const updateQuantity = (value: number, qty: number) => {
        if (qty < 0) return;
        setBreakdown(prev => ({
            ...prev,
            [value.toString()]: qty
        }));
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full">
                <header className="flex h-20 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 shrink-0">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-3xl">payments</span>
                        Cambio de Moneda
                    </h1>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-12 px-6 bg-amber-500 text-white rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition-all"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Solicitar Cambio
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-8 py-5">Folio</th>
                                        <th className="px-8 py-5">Sucursal</th>
                                        <th className="px-8 py-5">Monto Total</th>
                                        <th className="px-8 py-5">Desglose</th>
                                        <th className="px-8 py-5">Fecha</th>
                                        <th className="px-8 py-5 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {requests.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                            <td className="px-8 py-5 font-black text-amber-600">#C-{r.folio.toString().padStart(4, '0')}</td>
                                            <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">Sucursal {r.branchId}</td>
                                            <td className="px-8 py-5 font-black text-lg text-slate-900 dark:text-white">${r.amount.toLocaleString()}</td>
                                            <td className="px-8 py-5">
                                                {r.breakdown ? (
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {Object.entries(r.breakdown).map(([val, qty]) => (
                                                            qty > 0 && (
                                                                <span key={val} className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold border dark:border-slate-600">
                                                                    {qty}x ${val}
                                                                </span>
                                                            )
                                                        ))}
                                                    </div>
                                                ) : <span className="text-slate-400 text-xs">-</span>}
                                            </td>
                                            <td className="px-8 py-5 text-sm text-slate-500 font-medium">{new Date(r.createdAt).toLocaleDateString()}</td>
                                            <td className="px-8 py-5 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${r.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                    r.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                                        'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                    {r.status === 'pending' ? 'Pendiente' : r.status === 'completed' ? 'Completado' : 'Cancelado'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {requests.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic font-medium">No hay solicitudes de cambio.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[40px] shadow-2xl p-8 flex flex-col max-h-[90vh]">
                            <h3 className="text-2xl font-black mb-2">Solicitar Feria / Cambio</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">Ingresa la cantidad de billetes/monedas que necesitas</p>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                                        {DENOMINATIONS.map(d => (
                                            <div key={d.value} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl flex flex-col items-center gap-2 border border-transparent focus-within:border-amber-500/50 focus-within:bg-amber-50/50 dark:focus-within:bg-slate-800 transition-colors">
                                                <span className={`text-xs font-black uppercase tracking-widest ${d.type === 'billete' ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {d.type}
                                                </span>
                                                <span className="text-xl font-black text-slate-800 dark:text-white">{d.label}</span>
                                                <div className="flex items-center gap-2 w-full">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(d.value, (breakdown[d.value.toString()] || 0) - 1)}
                                                        className="size-8 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 hover:text-amber-500"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">remove</span>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className="w-full text-center bg-transparent font-bold outline-none text-slate-900 dark:text-white"
                                                        value={breakdown[d.value.toString()] || ''}
                                                        onChange={e => updateQuantity(d.value, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(d.value, (breakdown[d.value.toString()] || 0) + 1)}
                                                        className="size-8 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 hover:text-amber-500"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-2">
                                    <div className="flex justify-between items-center mb-6 px-4">
                                        <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">Total a Solicitar</span>
                                        <span className="text-3xl font-black text-amber-500">${totalAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest underline decoration-2 underline-offset-8">Cancelar</button>
                                        <button
                                            type="submit"
                                            disabled={totalAmount <= 0 || loading}
                                            className="flex-1 py-4 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-500/20 uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            Confirmar Solicitud
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CoinChange;
