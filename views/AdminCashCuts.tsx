import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User } from '../types';
import { supabase } from '../services/supabase';
import { InventoryService } from '../services/inventoryService';

interface AdminCashCutsProps {
    user: User;
    onLogout: () => void;
}

const AdminCashCuts: React.FC<AdminCashCutsProps> = ({ user, onLogout }) => {
    const [cuts, setCuts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);

    useEffect(() => {
        loadBranches();
        loadCuts();
    }, []);

    const loadBranches = async () => {
        const b = await InventoryService.getBranches();
        setBranches(b);
    };

    const loadCuts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('cash_cuts')
            .select('*')
            .order('date', { ascending: false });

        if (!error && data) {
            setCuts(data);
        }
        setLoading(false);
    };

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        if (!confirm(`¿Estás seguro de marcar este corte como ${status === 'approved' ? 'APROBADO' : 'RECHAZADO'}?`)) return;

        const { error } = await supabase
            .from('cash_cuts')
            .update({
                status,
                approved_by: user.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            alert('Error al actualizar estado');
        } else {
            loadCuts();
        }
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <header className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                            Aprobación de Cortes
                        </h1>
                        <p className="text-slate-500 font-medium">Revisa y autoriza los cierres de caja de las sucursales.</p>
                    </div>
                    <button
                        onClick={loadCuts}
                        className="p-2 bg-white dark:bg-slate-800 border rounded-xl hover:bg-slate-50 transition-colors"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                </header>

                <div className="space-y-4">
                    {cuts.map((cut) => {
                        const branchName = branches.find(b => b.id === cut.branch_id)?.name || cut.branch_id;
                        return (
                            <div key={cut.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${cut.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                                            cut.status === 'approved' ? 'bg-green-100 text-green-600' :
                                                'bg-red-100 text-red-600'
                                        }`}>
                                        <span className="material-symbols-outlined text-2xl">
                                            {cut.status === 'pending' ? 'hourglass_top' :
                                                cut.status === 'approved' ? 'check_circle' : 'cancel'}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg text-slate-500">
                                                {branchName}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">
                                                {new Date(cut.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 text-sm">
                                            <p><span className="font-bold text-slate-400">Efectivo:</span> <b>${cut.total_cash.toLocaleString()}</b></p>
                                            <p><span className="font-bold text-slate-400">Gastos:</span> <b className="text-red-500">-${cut.expenses_amount.toLocaleString()}</b></p>
                                            <p><span className="font-bold text-slate-400">Total:</span> <b className="text-primary">${cut.calculated_total.toLocaleString()}</b></p>
                                        </div>
                                    </div>
                                </div>

                                {cut.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleUpdateStatus(cut.id, 'rejected')}
                                            className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-colors text-xs uppercase"
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus(cut.id, 'approved')}
                                            className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl hover:scale-105 transition-all shadow-lg text-xs uppercase"
                                        >
                                            Aprobar
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {cuts.length === 0 && !loading && (
                        <div className="text-center py-20 text-slate-400">
                            <span className="material-symbols-outlined text-5xl mb-2">inbox</span>
                            <p>No hay cortes registrados</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminCashCuts;
