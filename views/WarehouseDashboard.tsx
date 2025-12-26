
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, RestockRequest } from '../types';
import { InventoryService } from '../services/inventoryService';

interface WarehouseDashboardProps {
    user: User;
    onLogout: () => void;
}

const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({ user, onLogout }) => {
    const [requests, setRequests] = useState<RestockRequest[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    const loadRequests = async () => {
        try {
            setLoading(true);
            // Fetch only requests approved for warehouse processing
            const data = await InventoryService.getRestockRequests(undefined, 'approved_warehouse');
            setRequests(data);
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
            await loadRequests();
            alert("Pedido marcado como Enviado");
        } catch (e) {
            console.error(e);
            alert("Error al actualizar envío");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                            <span className="material-symbols-outlined text-2xl">warehouse</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Panel de Bodega</h1>
                            <p className="text-xs font-bold text-slate-400">Pedidos pendientes de surtir</p>
                        </div>
                    </div>
                    <button onClick={loadRequests} className="p-2 text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined">refresh</span></button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {requests.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <span className="material-symbols-outlined text-6xl mb-4 opacity-50">local_shipping</span>
                            <p className="font-bold">No hay pedidos pendientes por surtir</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {requests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <div className="size-16 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center p-2">
                                            <img src={(req as any).productImage || 'https://via.placeholder.com/150'} className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wide">Para: {req.branchName}</span>
                                                <span className="text-[10px] text-slate-400 font-bold">{new Date(req.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white">{req.productName}</h3>
                                            <p className="text-sm font-bold text-slate-500">Cantidad: <span className="text-slate-900 dark:text-white">{req.quantity} unidades</span></p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleShip(req.id, req.branchName, req.productName)}
                                        className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-slate-200 hover:scale-105 transition-all flex items-center gap-2"
                                    >
                                        <span>Despachar Envío</span>
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </button>
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
