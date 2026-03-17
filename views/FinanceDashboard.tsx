import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User } from '../types';
import { FinanceService } from '../services/financeService';
import { exportToCSV } from '../utils/csvExport';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface FinanceDashboardProps {
    user: User;
    onLogout: () => void;
}

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ user, onLogout }) => {
    const [metrics, setMetrics] = useState({
        accountsPayable: 0,
        monthlyExpenses: 0,
        monthlySales: 0,
        netIncome: 0
    });
    const [monthlyData, setMonthlyData] = useState<{ month: string; ingresos: number; gastos: number }[]>([]);
    const [expenseData, setExpenseData] = useState<{ category: string; value: number }[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        try {
            setLoading(true);
            const [metricsData, monthly, expenses] = await Promise.all([
                FinanceService.getFinanceMetrics(),
                FinanceService.getMonthlyFinancials(6),
                FinanceService.getExpenseDistribution()
            ]);
            setMetrics(metricsData);
            setMonthlyData(monthly);
            setExpenseData(expenses);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportMonthly = () => {
        exportToCSV(
            `finanzas-mensuales-${new Date().toISOString().split('T')[0]}.csv`,
            monthlyData,
            [
                { key: 'month', label: 'Mes' },
                { key: 'ingresos', label: 'Ingresos' },
                { key: 'gastos', label: 'Gastos' }
            ]
        );
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
                    <button
                        onClick={handleExportMonthly}
                        disabled={monthlyData.length === 0}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-40"
                    >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Exportar CSV
                    </button>
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
                                {/* Gráfica de Gastos vs Ingresos */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Gastos vs Ingresos — Últimos 6 meses</p>
                                    {monthlyData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-56 text-slate-300 dark:text-slate-600">
                                            <span className="material-symbols-outlined text-5xl mb-2">bar_chart</span>
                                            <span className="text-xs font-black uppercase tracking-widest">Sin datos</span>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} />
                                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                                                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} />
                                                <Legend formatter={v => v === 'ingresos' ? 'Ingresos' : 'Gastos'} />
                                                <Bar dataKey="ingresos" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                                <Bar dataKey="gastos" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>

                                {/* Distribución de Gastos */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Distribución de Gastos por Proveedor</p>
                                    {expenseData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-56 text-slate-300 dark:text-slate-600">
                                            <span className="material-symbols-outlined text-5xl mb-2">pie_chart</span>
                                            <span className="text-xs font-black uppercase tracking-widest">Sin gastos registrados</span>
                                        </div>
                                    ) : (
                                        <ResponsiveContainer width="100%" height={250}>
                                            <PieChart>
                                                <Pie
                                                    data={expenseData}
                                                    dataKey="value"
                                                    nameKey="category"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={90}
                                                    label={({ category, percent }) =>
                                                        `${category.slice(0, 12)} ${(percent * 100).toFixed(0)}%`
                                                    }
                                                    labelLine={false}
                                                >
                                                    {expenseData.map((_, index) => (
                                                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monto']} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
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
