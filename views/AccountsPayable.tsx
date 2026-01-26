import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, SupplierInvoice, Supplier } from '../types';
import { FinanceService } from '../services/financeService';

interface AccountsPayableProps {
    user: User;
    onLogout: () => void;
}

const AccountsPayable: React.FC<AccountsPayableProps> = ({ user, onLogout }) => {
    const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // Form state
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [invoiceFolio, setInvoiceFolio] = useState('');
    const [amount, setAmount] = useState('');
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [invData, supData] = await Promise.all([
                FinanceService.getInvoices(),
                FinanceService.getSuppliers()
            ]);
            setInvoices(invData);
            setSuppliers(supData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplierId || !amount || !invoiceFolio) return;

        const supplier = suppliers.find(s => s.id === selectedSupplierId);
        const terms = supplier?.paymentTermsDays || 0;
        const dueDate = new Date(new Date(issueDate).getTime() + terms * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        try {
            await FinanceService.createInvoice({
                supplierId: selectedSupplierId,
                invoiceFolio,
                amount: parseFloat(amount),
                issueDate,
                dueDate
            } as any);
            setIsUploadModalOpen(false);
            setInvoiceFolio('');
            setAmount('');
            loadData();
        } catch (e) {
            console.error(e);
            alert("Error al registrar factura");
        }
    };

    const updateStatus = async (id: string, newStatus: any) => {
        try {
            await FinanceService.updateInvoiceStatus(id, newStatus);
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'received': return 'bg-slate-100 text-slate-600';
            case 'verified': return 'bg-blue-100 text-blue-700';
            case 'authorized': return 'bg-purple-100 text-purple-700';
            case 'paid': return 'bg-green-100 text-green-700';
            case 'rejected': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'received': return 'Recibida';
            case 'verified': return 'Verificada';
            case 'authorized': return 'Autorizada';
            case 'paid': return 'Pagada';
            case 'rejected': return 'Rechazada';
            default: return status;
        }
    };

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 overflow-y-auto">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">request_quote</span>
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Cuentas por Pagar</h1>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Gestión de Facturas de Proveedores</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                        <span className="material-symbols-outlined">upload_file</span>
                        Registrar Factura
                    </button>
                </header>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs font-black uppercase text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="p-4 pl-6">Proveedor</th>
                                        <th className="p-4">Folio</th>
                                        <th className="p-4">Fecha Vencimiento</th>
                                        <th className="p-4">Monto</th>
                                        <th className="p-4 text-center">Estado</th>
                                        <th className="p-4 text-right pr-6">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {invoices.map(inv => (
                                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">{inv.supplierName}</td>
                                            <td className="p-4 text-sm font-mono text-slate-500">{inv.invoiceFolio}</td>
                                            <td className="p-4 text-sm font-bold">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-base text-slate-400">event</span>
                                                    {inv.dueDate}
                                                </div>
                                            </td>
                                            <td className="p-4 font-black text-slate-900 dark:text-white">${inv.amount.toLocaleString()}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getStatusColor(inv.status)}`}>
                                                    {getStatusLabel(inv.status)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right pr-6">
                                                <div className="flex justify-end gap-2">
                                                    {inv.status === 'received' && (
                                                        <button onClick={() => updateStatus(inv.id, 'verified')} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-xs font-bold" title="Verificar">Verificar</button>
                                                    )}
                                                    {inv.status === 'verified' && (
                                                        <button onClick={() => updateStatus(inv.id, 'authorized')} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 text-xs font-bold" title="Autorizar">Autorizar</button>
                                                    )}
                                                    {inv.status === 'authorized' && (
                                                        <button onClick={() => updateStatus(inv.id, 'paid')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-xs font-bold" title="Pagada">Pagar</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {invoices.length === 0 && (
                                        <tr><td colSpan={6} className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No hay facturas pendientes</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {isUploadModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                            <h2 className="text-xl font-black mb-6">Registrar Factura</h2>
                            <form onSubmit={handleUpload} className="space-y-4">
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400">Proveedor</label>
                                    <select
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                        value={selectedSupplierId}
                                        onChange={e => setSelectedSupplierId(e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-400">Folio</label>
                                        <input
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                            value={invoiceFolio}
                                            onChange={e => setInvoiceFolio(e.target.value)}
                                            placeholder="F-12345"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-400">Monto</label>
                                        <input
                                            type="number"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                            value={amount}
                                            onChange={e => setAmount(e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400">Fecha Emisión</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                        value={issueDate}
                                        onChange={e => setIssueDate(e.target.value)}
                                    />
                                </div>
                                <div className="pt-2 text-xs text-slate-500">
                                    * La fecha de vencimiento se calculará automáticamente según los días de crédito del proveedor.
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setIsUploadModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 font-bold rounded-xl text-slate-500 hover:bg-slate-200">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AccountsPayable;
