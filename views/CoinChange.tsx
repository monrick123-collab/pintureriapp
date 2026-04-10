import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, CoinChangeRequest, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { CoinService } from '../services/coin/coinService';
import { useNavigate } from 'react-router-dom';

interface CoinChangeProps {
    user: User;
    onLogout: () => void;
}

const DENOMINATIONS = [
    { value: 500, label: '$500', type: 'billete' },
    { value: 200, label: '$200', type: 'billete' },
    { value: 100, label: '$100', type: 'billete' },
    { value: 50, label: '$50', type: 'billete' },
    { value: 20, label: '$20', type: 'billete' },
    { value: 10, label: '$10', type: 'moneda' },
    { value: 5, label: '$5', type: 'moneda' },
    { value: 2, label: '$2', type: 'moneda' },
    { value: 1, label: '$1', type: 'moneda' },
    { value: 0.5, label: '50¢', type: 'moneda' },
];

const CoinChange: React.FC<CoinChangeProps> = ({ user, onLogout }) => {
    const [requests, setRequests] = useState<CoinChangeRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const navigate = useNavigate();

    // Form State
    const [breakdown, setBreakdown] = useState<Record<string, number>>({});
    const [collectedBy, setCollectedBy] = useState('');

    const totalAmount = DENOMINATIONS.reduce((acc, d) => acc + (d.value * (breakdown[d.value.toString()] || 0)), 0);

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState(user.branchId || '');
    const branchId = selectedBranchId || user.branchId || '';

    // Fechas
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const firstDay = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(localDate);

    useEffect(() => {
        loadData();
        if (isAdmin || isWarehouse) {
            InventoryService.getBranches()
                .then(data => {
                    setBranches(data);
                    if (!selectedBranchId && data.length > 0) setSelectedBranchId(data[0].id);
                })
                .catch(e => console.error(e));
        }
    }, []);

    const loadData = async (sd = startDate, ed = endDate) => {
        try {
            setLoading(true);
            const data = await InventoryService.getCoinChangeRequests(
                isAdmin ? undefined : branchId,
                sd || undefined,
                ed || undefined
            );
            setRequests(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totalAmount <= 0) return;
        if (!branchId) {
            alert('Selecciona una sucursal antes de continuar.');
            return;
        }
        try {
            setLoading(true);
            await CoinService.createCoinChangeRequest(branchId, user.id, totalAmount, breakdown, collectedBy || undefined);
            setActiveTab('history');
            setBreakdown({});
            setCollectedBy('');
            loadData();
            alert("Solicitud de cambio creada.");
        } catch (e) {
            alert("Error al crear solicitud");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmCoinsSent = async (requestId: string) => {
        if (!confirm('¿Confirmar que las monedas fueron entregadas al mensajero?')) return;
        try {
            await CoinService.confirmCoinsSent(requestId, user.id);
            loadData();
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const handleConfirmBillsReceived = async (requestId: string) => {
        if (!confirm('¿Confirmar que recibiste los billetes a cambio?')) return;
        try {
            await CoinService.confirmBillsReceived(requestId, user.id);
            loadData();
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const updateQuantity = (value: number, qty: number) => {
        if (qty < 0) return;
        setBreakdown(prev => ({
            ...prev,
            [value.toString()]: qty
        }));
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full">
                <header className="min-h-[4rem] flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-3 shrink-0 gap-3 flex-wrap">
                    <div className="flex items-center gap-3 pl-10 lg:pl-0">
                        <span className="material-symbols-outlined text-amber-500 text-2xl md:text-3xl">currency_exchange</span>
                        <h1 className="text-base md:text-2xl font-black text-slate-800 dark:text-white">Cambio de Moneda</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nuevo', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => {
                                        setActiveTab(tab.key as 'new' | 'history');
                                        setBreakdown({});
                                        setCollectedBy('');
                                        setSelectedRequest(null);
                                    }}
                                    className={`px-3 md:px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {activeTab === 'history' ? (
                    <>
                        {/* Filtro por fechas */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <button onClick={() => loadData(startDate, endDate)} className="px-5 py-2 bg-amber-500 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-amber-500/20 hover:scale-105 transition-all">Filtrar</button>
                            {(startDate || endDate) && (
                                <button onClick={() => { setStartDate(''); setEndDate(''); loadData('', ''); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Limpiar</button>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{requests.length} solicitud{requests.length !== 1 ? 'es' : ''}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-5xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-4 md:px-6 py-5">Folio</th>
                                                <th className="px-4 md:px-6 py-5">Sucursal</th>
                                                <th className="px-4 md:px-6 py-5">Monto</th>
                                                <th className="px-4 md:px-6 py-5 hidden lg:table-cell">Mensajero</th>
                                                <th className="px-4 md:px-6 py-5 hidden xl:table-cell">Desglose</th>
                                                <th className="px-4 md:px-6 py-5">Fecha</th>
                                                <th className="px-4 md:px-6 py-5 text-center">Estado</th>
                                                <th className="px-4 md:px-6 py-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {requests.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-4 md:px-6 py-5 font-black text-amber-600">#C-{r.folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-4 md:px-6 py-5 font-bold text-slate-700 dark:text-slate-300">{r.branchName || r.branchId || 'N/A'}</td>
                                                    <td className="px-4 md:px-6 py-5 font-black text-lg text-slate-900 dark:text-white">${r.amount.toLocaleString()}</td>
                                                    <td className="px-4 md:px-6 py-5 text-sm text-slate-500 hidden lg:table-cell">{(r as any).collectedBy || <span className="text-slate-300">—</span>}</td>
                                                    <td className="px-4 md:px-6 py-5 hidden xl:table-cell">
                                                        {r.breakdown ? (
                                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                                {Object.entries(r.breakdown).map(([val, qty]) => (
                                                                    qty > 0 && (
                                                                        <span key={val} className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold border dark:border-slate-600">
                                                                            {qty}x ${val}
                                                                        </span>
                                                                    )
                                                                ))}
                                                            </div>
                                                        ) : <span className="text-slate-400 text-xs">-</span>}
                                                    </td>
                                                    <td className="px-4 md:px-6 py-5 text-sm text-slate-500 font-medium">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-4 md:px-6 py-5 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${r.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                            r.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                                            r.status === 'coins_sent' ? 'bg-blue-500/10 text-blue-500' :
                                                                'bg-amber-500/10 text-amber-500'
                                                            }`}>
                                                            {r.status === 'pending' ? 'Pendiente' : r.status === 'completed' ? 'Completado' : r.status === 'coins_sent' ? 'Monedas Enviadas' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-5 text-right">
                                                        <div className="flex justify-end gap-1.5">
                                                            <button
                                                                onClick={() => setSelectedRequest(r)}
                                                                className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                                title="Ver detalle"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">visibility</span>
                                                            </button>
                                                            {!isAdmin && r.status === 'pending' && (
                                                                <button
                                                                    onClick={() => handleConfirmCoinsSent(r.id)}
                                                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                                    title="Confirmar que las monedas fueron entregadas"
                                                                >Monedas Enviadas</button>
                                                            )}
                                                            {isAdmin && r.status === 'coins_sent' && (
                                                                <button
                                                                    onClick={() => handleConfirmBillsReceived(r.id)}
                                                                    className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                                    title="Confirmar recepción de billetes"
                                                                >Billetes Recibidos</button>
                                                            )}
                                                            <button
                                                                onClick={() => navigate(`/coin-change/${r.id}/print`)}
                                                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                                title="Imprimir comprobante"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">print</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {requests.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">currency_exchange</span>
                                                            <p className="font-black text-base text-slate-400">Sin solicitudes de cambio</p>
                                                            <p className="text-xs text-slate-400">Solicita feria o cambio de moneda desde la pestaña "Nuevo Cambio".</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex overflow-hidden justify-center">
                        <div className="w-full max-w-4xl bg-white dark:bg-slate-900 mx-8 my-4 rounded-3xl shadow-sm border dark:border-slate-800 p-8 flex flex-col h-fit max-h-[calc(100%-2rem)]">
                            <div className="mb-6 shrink-0">
                                <h3 className="text-2xl font-black mb-2">Solicitar Feria / Cambio</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ingresa la cantidad de billetes/monedas que necesitas</p>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                                {(isAdmin || isWarehouse) && branches.length > 0 && (
                                    <div className="mb-5 shrink-0">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Sucursal solicitante</label>
                                        <select
                                            required
                                            className="mt-1 w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-200 dark:border-slate-700 font-bold"
                                            value={selectedBranchId}
                                            onChange={e => {
                                            setSelectedBranchId(e.target.value);
                                            setBreakdown({});
                                            setCollectedBy('');
                                        }}
                                        >
                                            <option value="">Selecciona sucursal...</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {DENOMINATIONS.map(d => (
                                            <div key={d.value} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl flex flex-col items-center gap-2 border border-transparent focus-within:border-amber-500/50 focus-within:bg-amber-50/50 dark:focus-within:bg-slate-800 transition-colors">
                                                <span className={`text-xs font-black uppercase tracking-widest ${d.type === 'billete' ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {d.type}
                                                </span>
                                                <span className="text-xl font-black text-slate-800 dark:text-white">{d.label}</span>
                                                <div className="flex items-center gap-2 w-full">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(d.value, (breakdown[d.value.toString()] || 0) - 1)}
                                                        className="size-8 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 hover:text-amber-500"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">remove</span>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className="w-full text-center bg-transparent font-bold outline-none text-slate-900 dark:text-white"
                                                        value={breakdown[d.value.toString()] || ''}
                                                        onChange={e => updateQuantity(d.value, parseInt(e.target.value) || 0)}
                                                        placeholder="0"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => updateQuantity(d.value, (breakdown[d.value.toString()] || 0) + 1)}
                                                        className="size-8 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-slate-400 hover:text-amber-500"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6 shrink-0 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                            Mensajero / Quien lleva las monedas
                                        </label>
                                        <input
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-amber-500/20"
                                            value={collectedBy}
                                            onChange={e => setCollectedBy(e.target.value)}
                                            placeholder="Nombre del mensajero o personal"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 font-bold uppercase text-sm tracking-widest">Total a Solicitar</span>
                                        <span className="text-4xl font-black text-amber-500">${totalAmount.toLocaleString()}</span>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={totalAmount <= 0 || loading}
                                        className="w-full py-5 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-500/20 uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        Confirmar Solicitud
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* Modal de Detalle */}
                {selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedRequest(null)}>
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-6 border-b dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-amber-500 text-2xl">currency_exchange</span>
                                    <div>
                                        <h3 className="font-black text-lg">Detalle de Solicitud</h3>
                                        <p className="text-xs text-slate-400 font-bold">#C-{selectedRequest.folio.toString().padStart(4, '0')}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Sucursal</p>
                                        <p className="font-bold text-sm">{selectedRequest.branchName || selectedRequest.branchId || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Monto Total</p>
                                        <p className="font-black text-xl text-amber-500">${selectedRequest.amount.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Mensajero</p>
                                        <p className="font-bold text-sm">{selectedRequest.collectedBy || <span className="text-slate-400">No asignado</span>}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Estado</p>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedRequest.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                            selectedRequest.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                            selectedRequest.status === 'coins_sent' ? 'bg-blue-500/10 text-blue-500' :
                                                'bg-amber-500/10 text-amber-500'
                                            }`}>
                                            {selectedRequest.status === 'pending' ? 'Pendiente' : selectedRequest.status === 'completed' ? 'Completado' : selectedRequest.status === 'coins_sent' ? 'Monedas Enviadas' : 'Cancelado'}
                                        </span>
                                    </div>
                                </div>

                                {selectedRequest.breakdown && Object.values(selectedRequest.breakdown).some((v: any) => v > 0) && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Desglose de Denominaciones</p>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {Object.entries(selectedRequest.breakdown).map(([val, qty]: [string, any]) => (
                                                qty > 0 && (
                                                    <div key={val} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center border dark:border-slate-700">
                                                        <p className="text-lg font-black text-slate-800 dark:text-white">{qty}</p>
                                                        <p className="text-[10px] font-bold text-slate-400">${val}</p>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="border-t dark:border-slate-800 pt-4 space-y-3">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Historial de Fechas</p>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-bold">Creada</span>
                                            <span className="font-bold">{new Date(selectedRequest.createdAt).toLocaleString()}</span>
                                        </div>
                                        {selectedRequest.coins_sent_at && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-bold">Monedas enviadas</span>
                                                <span className="font-bold">{new Date(selectedRequest.coins_sent_at).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {selectedRequest.completed_at && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-500 font-bold">Completada</span>
                                                <span className="font-bold">{new Date(selectedRequest.completed_at).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-800 flex justify-end gap-2">
                                <button
                                    onClick={() => { navigate(`/coin-change/${selectedRequest.id}/print`); setSelectedRequest(null); }}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-sm">print</span>
                                    Imprimir
                                </button>
                                <button onClick={() => setSelectedRequest(null)} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black uppercase hover:bg-amber-600 transition-colors">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default CoinChange;
