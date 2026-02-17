
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Sale, Branch, UserRole } from '../types';
import { SalesService } from '../services/salesService';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';
import { Link } from 'react-router-dom';

interface WholesaleHistoryProps {
    user: User;
    onLogout: () => void;
}

const WholesaleHistory: React.FC<WholesaleHistoryProps> = ({ user, onLogout }) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

    useEffect(() => {
        loadBranches();
        fetchSales();
    }, [selectedBranch]);

    const loadBranches = async () => {
        try {
            const data = await InventoryService.getBranches();
            setBranches(data);
        } catch (e) {
            console.error(e);
        }
    };

    const fetchSales = async () => {
        setLoading(true);
        try {
            // Get last 30 days for now
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 30);

            const data = await SalesService.getSalesWithFilters(start.toISOString(), end.toISOString(), selectedBranch);
            // Filter only wholesale
            setSales(data.filter(s => s.isWholesale));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-6 md:px-8 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <span className="material-symbols-outlined text-primary font-black">history_edu</span>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Historial Mayoreo</h1>
                    </div>
                </header>

                <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-4">
                            <label className="text-[10px] font-black uppercase text-slate-400">Filtrar por Sucursal</label>
                            <select
                                className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-xs font-bold px-3 py-2"
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                            >
                                <option value="ALL">Todas</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Total Periodo</p>
                                <p className="text-xl font-black text-primary">${sales.reduce((acc, s) => acc + s.total, 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-950/50 border-b dark:border-slate-800">
                                    <tr className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
                                        <th className="px-6 py-5">Folio / Fecha</th>
                                        <th className="px-6 py-5">Cliente / Pago</th>
                                        <th className="px-6 py-5">Atiende / Despacha</th>
                                        <th className="px-6 py-5 text-right">Total</th>
                                        <th className="px-8 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {loading ? (
                                        <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">Cargando historial...</td></tr>
                                    ) : sales.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No hay registros de ventas al mayoreo</td></tr>
                                    ) : (
                                        sales.map(sale => (
                                            <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-black text-primary font-mono tracking-tighter">#{sale.id.slice(0, 8).toUpperCase()}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold mt-1">
                                                            {new Date(sale.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{sale.clientName || 'Cliente General'}</span>
                                                        <span className={`w-fit mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase ${sale.paymentType === 'credito' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {translateStatus(sale.paymentType || 'contado')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                                            <span className="material-symbols-outlined text-xs">person</span>
                                                            Despacha: <span className="text-slate-900 dark:text-slate-200">{sale.departureAdminName || 'No reg.'}</span>
                                                        </div>
                                                        {sale.branchName && (
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sale.branchName}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-lg text-slate-900 dark:text-white">
                                                    ${sale.total.toLocaleString()}
                                                </td>
                                                <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedSale(sale)}
                                                        className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                                                        title="Ver Detalles"
                                                    >
                                                        <span className="material-symbols-outlined">visibility</span>
                                                    </button>
                                                    <Link
                                                        to={`/wholesale-note/${sale.id}`}
                                                        className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-all inline-flex"
                                                    >
                                                        <span className="material-symbols-outlined">print</span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Details Modal */}
                {selectedSale && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSale(null)}>
                        <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-2xl border dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800 p-4 flex justify-between items-center">
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg">Detalle de Venta Mayoreo</h3>
                                    <p className="text-xs text-slate-500 font-mono">ID: {selectedSale.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedSale(null)}
                                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                {/* Products */}
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Productos</p>
                                    <div className="space-y-2">
                                        {selectedSale.items.map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-800">
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{item.productName}</p>
                                                    <p className="text-[10px] text-slate-500">Cantidad: {item.quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-slate-900 dark:text-white">${item.total.toLocaleString()}</p>
                                                    <p className="text-[10px] text-slate-400">${item.price.toLocaleString()} c/u</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Delivery Info */}
                                {selectedSale.deliveryReceiverName && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl">
                                        <p className="text-[9px] uppercase font-bold text-amber-500 mb-1">Entregado A</p>
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-amber-600 text-lg">local_shipping</span>
                                            <p className="text-sm font-black text-amber-900 dark:text-amber-100">{selectedSale.deliveryReceiverName}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Billing Info */}
                                {(selectedSale.billingSocialReason || selectedSale.billingInvoiceNumber || selectedSale.billingBank) && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Datos Fiscales y Bancarios</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {selectedSale.billingSocialReason && (
                                                <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl">
                                                    <p className="text-[9px] uppercase font-bold text-blue-400 mb-1">Razón Social</p>
                                                    <p className="text-xs font-bold text-blue-900 dark:text-blue-100">{selectedSale.billingSocialReason}</p>
                                                </div>
                                            )}
                                            {selectedSale.billingInvoiceNumber && (
                                                <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                                                    <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">No. Factura</p>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedSale.billingInvoiceNumber}</p>
                                                </div>
                                            )}
                                            {selectedSale.billingBank && (
                                                <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                                                    <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Banco</p>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedSale.billingBank}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Totals */}
                                <div className="border-t dark:border-slate-800 pt-4 space-y-2">
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <span>Subtotal</span>
                                        <span>${selectedSale.subtotal.toLocaleString()}</span>
                                    </div>
                                    {selectedSale.discountAmount > 0 && (
                                        <div className="flex justify-between text-xs text-amber-600 font-bold">
                                            <span>Descuento</span>
                                            <span>-${selectedSale.discountAmount.toLocaleString()}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2">
                                        <span>Total Pagado</span>
                                        <span>${selectedSale.total.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-end pt-1 gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase
                                            ${selectedSale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                                                selectedSale.paymentMethod === 'card' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}
                                        `}>
                                            Método: {selectedSale.paymentMethod === 'cash' ? 'Efectivo' : selectedSale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase
                                            ${selectedSale.paymentType === 'credito' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}
                                        `}>
                                            Tipo: {selectedSale.paymentType === 'credito' ? 'Crédito' : 'Contado'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WholesaleHistory;
