import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Lease } from '../types';
import { FinanceService } from '../services/financeService';

interface LeasingProps {
    user: User;
    onLogout: () => void;
}

const Leasing: React.FC<LeasingProps> = ({ user, onLogout }) => {
    const [leases, setLeases] = useState<Lease[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadLeases();
    }, []);

    const loadLeases = async () => {
        try {
            setLoading(true);
            const data = await FinanceService.getLeases();
            setLeases(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePayDraft = (lease: Lease) => {
        const confirm = window.confirm(`¿Registrar pago de renta para ${lease.propertyName} por $${lease.monthlyAmount}?`)
        if (confirm) {
            FinanceService.registerLeasePayment({
                leaseId: lease.id,
                amount: lease.monthlyAmount,
                paymentDate: new Date().toISOString().split('T')[0],
                notes: 'Pago mensual registrado desde panel'
            }).then(() => {
                alert("Pago registrado correctamente");
            }).catch(e => {
                console.error(e);
                alert("Error al registrar pago");
            });
        }
    };

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 overflow-y-auto">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">apartment</span>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Arrendamientos</h1>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Contratos de Renta y Locales</p>
                        </div>
                    </div>
                    {/* Add Modal later */}
                </header>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {leases.map(lease => (
                                <div key={lease.id} className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <span className="material-symbols-outlined text-9xl">apartment</span>
                                    </div>
                                    <div className="relative z-10">
                                        <div className="mb-4">
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{lease.propertyName}</h3>
                                            <p className="text-sm font-bold text-slate-500">{lease.landlordName}</p>
                                        </div>

                                        <div className="flex items-end justify-between mb-6">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Renta Mensual</p>
                                                <p className="text-3xl font-black text-primary">${lease.monthlyAmount.toLocaleString()}</p>
                                            </div>
                                            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Día de Pago: <span className="text-slate-900 dark:text-white">{lease.paymentDay}</span></p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handlePayDraft(lease)}
                                            className="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">payments</span>
                                            Registrar Pago Mes Actual
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {leases.length === 0 && (
                                <div className="col-span-full py-20 text-center">
                                    <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">apartment</span>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No hay contratos registrados</p>
                                    <p className="text-xs text-slate-400 mt-2">Agregue registros manualmente en la base de datos por ahora.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Leasing;
