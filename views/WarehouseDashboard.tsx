
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, RestockRequest } from '../types';
import { InventoryService } from '../services/inventoryService';

interface WarehouseDashboardProps {
    user: User;
    onLogout: () => void;
}

const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({ user, onLogout }) => {
    const [requests, setRequests] = useState<RestockRequest[]>([]);
    const [historyRequests, setHistoryRequests] = useState<RestockRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentTab, setCurrentTab] = useState<'pending' | 'history'>('pending');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [pending, history] = await Promise.all([
                InventoryService.getRestockRequests(undefined, 'approved_warehouse'),
                InventoryService.getRestockRequests(undefined, ['shipped', 'completed'])
            ]);
            setRequests(pending);
            setHistoryRequests(history);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleShip = async (id: string, branchName?: string, productName?: string) => {
        if (!confirm(`¿Confirmar envío de ${productName} a ${branchName}?`)) return;
        try {
            setLoading(true);
            await InventoryService.updateRestockStatus(id, 'shipped');
            await loadData();
            alert("Pedido marcado como Enviado");
        } catch (e) {
            console.error(e);
            alert("Error al actualizar envío");
        } finally {
            setLoading(false);
        }
    };

    const activeRequests = currentTab === 'pending' ? requests : historyRequests;

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-6 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400 hidden sm:block">
                            <span className="material-symbols-outlined text-2xl">warehouse</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Bodega</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden xs:block">Despachos</p>
                        </div>
                    </div>
                    <button onClick={loadData} className="p-2 text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined">refresh</span></button>
                </header>

                {/* Tabs */}
                <div className="px-6 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex gap-4 md:gap-8 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setCurrentTab('pending')}
                        className={`py-4 text-[10px] md:text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${currentTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
                    >
                        Pendientes ({requests.length})
                    </button>
                    <button
                        onClick={() => setCurrentTab('history')}
                        className={`py-4 text-[10px] md:text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${currentTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
                    >
                        Envíos ({historyRequests.length})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center p-20 animate-pulse text-slate-400 font-bold uppercase tracking-widest">Cargando...</div>
                    ) : activeRequests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">
                                {currentTab === 'pending' ? 'local_shipping' : 'history'}
                            </span>
                            <p className="font-bold">
                                {currentTab === 'pending' ? 'No hay pedidos pendientes por surtir' : 'El historial de envíos está vacío'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {activeRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className="size-12 md:size-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center p-2 shrink-0">
                                            <img src={(req as any).productImage || 'https://via.placeholder.com/150'} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide ${req.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    req.status === 'shipped' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {req.status === 'shipped' ? 'En Camino' : req.status === 'completed' ? 'Entregado' : `${req.branchName}`}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    {new Date(req.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <h3 className="text-sm md:text-lg font-black text-slate-900 dark:text-white leading-tight">{req.productName}</h3>
                                            <p className="text-xs font-bold text-slate-500">
                                                <span className="text-primary">{req.quantity}</span> unidades
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Link
                                            to={`/shipping-note/${req.id}`}
                                            className="flex-1 sm:flex-none px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 border"
                                            title="Imprimir Vale"
                                        >
                                            <span className="material-symbols-outlined text-lg">print</span>
                                        </Link>
                                        {currentTab === 'pending' && (
                                            <button
                                                onClick={() => handleShip(req.id, req.branchName, req.productName)}
                                                className="flex-[2] sm:flex-none px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 text-xs uppercase"
                                            >
                                                <span>Despachar</span>
                                                <span className="material-symbols-outlined text-lg">local_shipping</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default WarehouseDashboard;
