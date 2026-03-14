
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole, Branch } from '../types';
import { AccountingService } from '../services/accountingService';
import { InventoryService } from '../services/inventoryService';

interface CashCutProps {
    user: User;
    onLogout: () => void;
}

const CashCut: React.FC<CashCutProps> = ({ user, onLogout }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState(user.branchId || 'BR-MAIN');

    // Manejar Timezones locamente para evitar que pase de día antes de tiempo
    const sysDate = new Date();
    const localDateString = sysDate.getFullYear() + '-' + String(sysDate.getMonth() + 1).padStart(2, '0') + '-' + String(sysDate.getDate()).padStart(2, '0');
    const [selectedDate, setSelectedDate] = useState(localDateString);

    const isAdmin = user.role === UserRole.ADMIN;

    useEffect(() => {
        loadBranches();
    }, []);

    useEffect(() => {
        loadData();
    }, [selectedBranch, selectedDate]);

    const loadBranches = async () => {
        const b = await InventoryService.getBranches();
        setBranches(b);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await AccountingService.getDailyCashCut(selectedBranch, selectedDate);
            const statusRes = await AccountingService.getCashCutStatus(selectedBranch, selectedDate);
            setData({ ...res, status: statusRes?.status });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const wasDark = document.documentElement.classList.contains('dark');
        if (wasDark) document.documentElement.classList.remove('dark');
        setTimeout(() => {
            window.print();
            if (wasDark) document.documentElement.classList.add('dark');
        }, 150);
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full print-format-container">
                <header className="flex h-20 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 shrink-0 print:hidden">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">point_of_sale</span>
                        Corte de Caja
                    </h1>
                    <div className="flex gap-4">
                        <input
                            type="date"
                            className="p-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                        {isAdmin && (
                            <select
                                className="p-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-xs"
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                            >
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:scale-105 transition-all"
                        >
                            Imprimir Reporte
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white dark:bg-slate-950 print:p-0">
                    <div className="max-w-5xl mx-auto space-y-8 print:max-w-none">
                        {/* Header Reporte (Print only) */}
                        <div className="hidden print:block text-center mb-10 border-b-4 border-slate-900 pb-6">
                            <h2 className="text-3xl font-black uppercase tracking-tighter">PINTAMAX</h2>
                            <p className="font-bold text-xs">REPORTE DE CORTE DIARIO - {branches.find(b => b.id === selectedBranch)?.name}</p>
                            <p className="text-[10px] font-black">{new Date(selectedDate).toLocaleDateString('es-MX', { dateStyle: 'full' })}</p>
                        </div>

                        {data && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm print:border-slate-300">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Efectivo</p>
                                        <h3 className="text-xl font-black text-green-600">${data.summary.cash.toLocaleString()}</h3>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm print:border-slate-300">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarjeta</p>
                                        <h3 className="text-xl font-black text-blue-600">${data.summary.card.toLocaleString()}</h3>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm print:border-slate-300">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Transferencia</p>
                                        <h3 className="text-xl font-black text-amber-600">${data.summary.transfer.toLocaleString()}</h3>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border shadow-sm print:border-slate-300">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vales</p>
                                        <h3 className="text-xl font-black text-purple-600">${data.coupons.reduce((acc: number, c: any) => acc + Number(c.amount), 0).toLocaleString()}</h3>
                                    </div>
                                    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl print:bg-transparent print:border print:border-slate-300 print:text-slate-900 print:shadow-none">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 print:text-slate-500">Venta Total</p>
                                        <h3 className="text-xl font-black print:text-slate-900">${data.summary.total.toLocaleString()}</h3>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <h3 className="text-xl font-black flex items-center gap-2">
                                            <span className="material-symbols-outlined">receipt_long</span>
                                            Gastos Registrados
                                        </h3>
                                        <div className="border dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <th className="px-6 py-3 text-left">Descripción</th>
                                                        <th className="px-6 py-3 text-right">Monto</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-slate-700">
                                                    {data.expenses.map((e: any) => (
                                                        <tr key={e.id}>
                                                            <td className="px-6 py-3 font-bold print:text-black">{e.description}</td>
                                                            <td className="px-6 py-3 text-right font-black text-red-500 print:text-red-700">-${e.amount.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    {data.expenses.length === 0 && (
                                                        <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-300 italic">No hay gastos hoy.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-xl font-black flex items-center gap-2">
                                            <span className="material-symbols-outlined">confirmation_number</span>
                                            Vales Canjeados
                                        </h3>
                                        <div className="border dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        <th className="px-6 py-3 text-left">Código / Ref</th>
                                                        <th className="px-6 py-3 text-right">Monto</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-slate-700">
                                                    {data.coupons.map((c: any) => (
                                                        <tr key={c.id}>
                                                            <td className="px-6 py-3 font-black text-primary uppercase print:text-black">{c.code}</td>
                                                            <td className="px-6 py-3 text-right font-black text-purple-600 print:text-purple-700">${Number(c.amount).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    {data.coupons.length === 0 && (
                                                        <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-300 italic">No hay vales hoy.</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-10 border-t-2 border-dashed dark:border-slate-700 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tickets de Venta</p>
                                        <p className="text-2xl font-black">{data.salesCount} registros</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Saldo en Caja (Efectivo)</p>
                                        <p className="text-3xl font-black text-primary">
                                            ${(data.summary.cash - data.expenses.reduce((acc: number, e: any) => acc + e.amount, 0)).toLocaleString()}
                                        </p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Efectivo - Gastos</p>
                                    </div>
                                </div>

                                <div className="pt-10 space-y-6">
                                    <h3 className="text-xl font-black flex items-center gap-2">
                                        <span className="material-symbols-outlined">history</span>
                                        Historial de Ventas
                                    </h3>
                                    <div className="border dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <th className="px-6 py-3 text-left">Hora</th>
                                                    <th className="px-6 py-3 text-left">Folio / ID</th>
                                                    <th className="px-6 py-3 text-left">Método</th>
                                                    <th className="px-6 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {data.sales.map((s: any) => (
                                                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-6 py-3 font-medium text-slate-500 whitespace-nowrap print:text-black">
                                                            {new Date(s.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-300 print:text-black">
                                                            {s.id.split('-')[0].toUpperCase()}
                                                        </td>
                                                        <td className="px-6 py-3 print:text-black">
                                                            <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 print:text-black print:bg-slate-200">
                                                                {s.payment_method || 'Efectivo'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-right font-black text-emerald-600 print:text-black">
                                                            ${Number(s.total).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {data.sales.length === 0 && (
                                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-300 italic">No hay ventas registradas hoy.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {!data && !loading && (
                            <div className="h-96 flex flex-col items-center justify-center text-slate-300">
                                <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                                <p className="font-black uppercase tracking-widest text-xs">No hay información disponible</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Approval Footer / Action Bar */}
            {data && (
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 print:hidden z-40">
                    <div className="max-w-5xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${data.status === 'approved' ? 'bg-green-100 text-green-600' :
                                data.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                    data.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                                        'bg-slate-100 text-slate-500'
                                }`}>
                                <span className="material-symbols-outlined">
                                    {data.status === 'approved' ? 'check_circle' :
                                        data.status === 'rejected' ? 'cancel' :
                                            data.status === 'pending' ? 'hourglass_top' : 'radio_button_unchecked'}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs font-black uppercase text-slate-500">Estado del Corte</p>
                                <p className="font-bold capitalize">{
                                    data.status === 'approved' ? 'Aprobado' :
                                        data.status === 'rejected' ? 'Rechazado' :
                                            data.status === 'pending' ? 'Pendiente de Aprobación' : 'No Enviado'
                                }</p>
                            </div>
                        </div>

                        {!data.status && (
                            <button
                                onClick={async () => {
                                    try {
                                        if (!confirm('¿Estás seguro de enviar el corte? Una vez enviado no podrás modificar gastos.')) return;
                                        setLoading(true);
                                        await AccountingService.submitCashCut({
                                            branchId: selectedBranch,
                                            date: selectedDate,
                                            totalCash: data.summary.cash,
                                            totalCard: data.summary.card,
                                            totalTransfer: data.summary.transfer,
                                            expensesAmount: data.expenses.reduce((acc: number, e: any) => acc + Number(e.amount), 0),
                                            calculatedTotal: (data.summary.cash - data.expenses.reduce((acc: number, e: any) => acc + Number(e.amount), 0)),
                                            notes: 'Cierre de turno automático'
                                        });
                                        // Reload to get status
                                        loadData();
                                        alert('Corte enviado a revisión correctamente.');
                                    } catch (e) {
                                        console.error(e);
                                        alert('Error al enviar corte.');
                                        setLoading(false);
                                    }
                                }}
                                disabled={loading}
                                className="bg-primary text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined">send</span>
                                ENVIAR A REVISIÓN
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashCut;
