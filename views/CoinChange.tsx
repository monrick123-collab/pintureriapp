
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, CoinChangeRequest, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';

interface CoinChangeProps {
    user: User;
    onLogout: () => void;
}

const CoinChange: React.FC<CoinChangeProps> = ({ user, onLogout }) => {
    const [requests, setRequests] = useState<CoinChangeRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [amount, setAmount] = useState(0);

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
        if (amount <= 0) return;
        try {
            setLoading(true);
            await InventoryService.createCoinChangeRequest(branchId, user.id, amount);
            setIsModalOpen(false);
            setAmount(0);
            loadData();
            alert("Solicitud de cambio creada.");
        } catch (e) {
            alert("Error al crear solicitud");
        } finally {
            setLoading(false);
        }
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
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-8 py-5">Folio</th>
                                        <th className="px-8 py-5">Sucursal</th>
                                        <th className="px-8 py-5">Monto</th>
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
                                            <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic font-medium">No hay solicitudes de cambio.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95">
                            <h3 className="text-2xl font-black mb-2">Solicitar Feria / Cambio</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">El monto será notificado a Administración</p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2 text-center">
                                    <label className="text-xs font-black uppercase text-slate-400">Monto total solicitado</label>
                                    <input
                                        type="number"
                                        className="w-full p-8 bg-slate-50 dark:bg-slate-900 rounded-[32px] font-black text-5xl text-center focus:ring-8 focus:ring-amber-500/10 text-amber-500 outline-none transition-all"
                                        value={amount}
                                        onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest underline decoration-2 underline-offset-8">Cancelar</button>
                                    <button
                                        type="submit"
                                        disabled={amount <= 0 || loading}
                                        className="flex-1 py-4 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-500/20 uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        Enviar Solicitud
                                    </button>
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
