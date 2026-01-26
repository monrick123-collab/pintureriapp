import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User } from '../types';
import { FinanceService } from '../services/financeService';

interface FinanceDashboardProps {
    user: User;
    onLogout: () => void;
}

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ user, onLogout }) => {
    const [metrics, setMetrics] = useState({
        accountsPayable: 0,
        monthlyExpenses: 0,
        monthlySales: 0,
        netIncome: 0
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        try {
            setLoading(true);
            const data = await FinanceService.getFinanceMetrics();
            setMetrics(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const cards = [
        { label: 'Cuentas por Pagar', value: metrics.accountsPayable, icon: 'money_off', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
        { label: 'Gastos Mes Actual', value: metrics.monthlyExpenses, icon: 'trending_down', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
        { label: 'Ventas Mensuales', value: metrics.monthlySales, icon: 'payments', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
        { label: 'Utilidad Estimada', value: metrics.netIncome, icon: 'account_balance_wallet', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    ];

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 overflow-y-auto">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">account_balance</span>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Finanzas</h1>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Tablero Financiero General</p>
                        </div>
                    </div>
                </header>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
                    ) : (
                        <div className="space-y-6">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                                {cards.map((card, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{card.label}</p>
                                            <p className={`text-2xl font-black ${card.color}`}>${card.value.toLocaleString()}</p>
                                        </div>
                                        <div className={`p-3 rounded-2xl ${card.bg}`}>
                                            <span className={`material-symbols-outlined text-xl ${card.color}`}>{card.icon}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-5xl mb-2">bar_chart</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Gráfica de Gastos vs Ingresos (Próximamente)</span>
                                </div>
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-slate-400">
                                    <span className="material-symbols-outlined text-5xl mb-2">pie_chart</span>
                                    <span className="text-xs font-black uppercase tracking-widest">Distribución de Gastos (Próximamente)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default FinanceDashboard;
