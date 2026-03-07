import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, PackagingRequest, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';
import AuthorizationModal from '../components/AuthorizationModal';

interface PackagingProps {
    user: User;
    onLogout: () => void;
}

const Packaging: React.FC<PackagingProps> = ({ user, onLogout }) => {
    const [bulkProducts, setBulkProducts] = useState<Product[]>([]);
    const [requests, setRequests] = useState<PackagingRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    const [bulkId, setBulkId] = useState('');
    const [targetType, setTargetType] = useState<'litro' | 'galon'>('litro');
    const [drumQty, setDrumQty] = useState(1);
    const [branchId, setBranchId] = useState('');
    const [branches, setBranches] = useState<any[]>([]);

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const isStoreManager = user.role === UserRole.STORE_MANAGER;
    const isSub = user.role === UserRole.WAREHOUSE_SUB;
    const [showAuth, setShowAuth] = useState(false);

    // Pasos del flujo de envasado en orden
    const PACKAGING_STEPS = [
        { key: 'sent_to_branch', label: 'Enviado', icon: 'local_shipping' },
        { key: 'received_at_branch', label: 'Recibido', icon: 'inventory' },
        { key: 'processing', label: 'Envasando', icon: 'colors' },
        { key: 'completed', label: 'Completado', icon: 'check_circle' },
    ];

    const getStepIndex = (status: string) => {
        const idx = PACKAGING_STEPS.findIndex(s => s.key === status);
        return idx >= 0 ? idx : (status === 'cancelled' ? -1 : 0);
    };

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (sd = startDate, ed = endDate) => {
        try {
            setLoading(true);
            const [prods, requestsData, branchesData] = await Promise.all([
                InventoryService.getProducts(),
                // Bodega y Admin ven todo; Encargado solo ve su sucursal
                InventoryService.getPackagingRequests(
                    (isAdmin || isWarehouse) ? undefined : user.branchId,
                    sd || undefined,
                    ed || undefined
                ),
                InventoryService.getBranches()
            ]);
            setBulkProducts(prods.filter(p => (p.description || '').toLowerCase().includes('tambo') || p.sku.includes('200L')));
            setRequests(requestsData as unknown as PackagingRequest[]);
            setBranches(branchesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await InventoryService.createPackagingRequest({
                bulkProductId: bulkId,
                targetPackageType: targetType,
                quantityDrum: drumQty,
                branchId: branchId || user.branchId
            });
            setActiveTab('history');
            setBulkId('');
            setDrumQty(1);
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await InventoryService.updatePackagingStatus(id, status);
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleConfirmReceipt = async (id: string) => {
        if (!confirm("¿Confirmar recepción del tambo?")) return;
        try {
            await InventoryService.confirmPackagingReceipt(id);
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleAuthorize = async (id: string) => {
        if (!confirm("¿Autorizar venta de este lote envasado?")) return;
        try {
            await InventoryService.authorizePackaging(id);
            loadData();
            alert("Lote autorizado para venta.");
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <h1 className="text-xl font-black">Envasado (Litreados)</h1>
                    {/* Bodega crea solicitudes; Encargado solo gestiona las que llegan a su sucursal */}
                    {isWarehouse && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nueva Solicitud', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => {
                                    if (tab.key === 'new' && isSub) {
                                        setShowAuth(true);
                                    } else {
                                        setActiveTab(tab.key as 'new' | 'history')
                                    }
                                }}
                                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>{tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {isStoreManager && (
                        <span className="text-xs text-slate-400 font-bold mr-4">Solo visualización y recepciones</span>
                    )}
                </header>

                <AuthorizationModal
                    isOpen={showAuth}
                    onClose={() => setShowAuth(false)}
                    onAuthorized={() => setActiveTab('new')}
                    description="El subencargado requiere autorización para solicitar envasado."
                />

                {activeTab === 'history' || isStoreManager ? (
                    <>

                        {/* Barra de filtro por fechas */}
                        <div className="mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input
                                    type="date"
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input
                                    type="date"
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={() => loadData(startDate, endDate)}
                                className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                            >
                                Filtrar
                            </button>
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); loadData('', ''); }}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors"
                                >
                                    Limpiar
                                </button>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{requests.length} solicitud{requests.length !== 1 ? 'es' : ''}</span>
                        </div>
                        <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 uppercase text-[10px] font-black text-slate-400">
                                        <tr>
                                            <th className="px-8 py-5">Producto Granel</th>
                                            <th className="px-6 py-5">Sucursal Responsable</th>
                                            <th className="px-6 py-5">Envase / Tambos</th>
                                            <th className="px-6 py-5">Fechas</th>
                                            <th className="px-6 py-5">Progreso</th>
                                            <th className="px-8 py-5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {requests.map((r: any) => (
                                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                                <td className="px-8 py-5 font-bold">{r.products?.name}</td>
                                                <td className="px-6 py-5 text-sm text-slate-500">{r.branches?.name}</td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black uppercase text-xs">{r.target_package_type}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">{r.quantity_drum} tambo{r.quantity_drum !== 1 ? 's' : ''}</span>
                                                    </div>
                                                </td>
                                                {/* Columna de fechas */}
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                                                        <span className="text-slate-400">
                                                            📅 {new Date(r.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </span>
                                                        {r.started_at && (
                                                            <span className="text-amber-500">
                                                                🎨 {new Date(r.started_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        )}
                                                        {r.completed_at && (
                                                            <span className="text-green-500">
                                                                ✅ {new Date(r.completed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {r.status === 'cancelled' ? (
                                                        <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-600">Cancelado</span>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            {PACKAGING_STEPS.map((step, idx) => {
                                                                const currentIdx = getStepIndex(r.status);
                                                                const isDone = idx < currentIdx;
                                                                const isCurrent = idx === currentIdx;
                                                                return (
                                                                    <div key={step.key} className="flex items-center">
                                                                        <div className={`flex flex-col items-center gap-0.5 ${isDone ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-30'
                                                                            }`}>
                                                                            <div className={`size-7 rounded-full flex items-center justify-center transition-all ${isDone ? 'bg-green-500 text-white' :
                                                                                isCurrent ? 'bg-primary text-white ring-2 ring-primary/30 ring-offset-1' :
                                                                                    'bg-slate-100 dark:bg-slate-700 text-slate-400'
                                                                                }`}>
                                                                                <span className="material-symbols-outlined text-[14px]">
                                                                                    {isDone ? 'check' : step.icon}
                                                                                </span>
                                                                            </div>
                                                                            <span className={`text-[8px] font-black uppercase ${isCurrent ? 'text-primary' : isDone ? 'text-green-500' : 'text-slate-400'
                                                                                }`}>{step.label}</span>
                                                                        </div>
                                                                        {idx < PACKAGING_STEPS.length - 1 && (
                                                                            <div className={`h-0.5 w-4 mx-0.5 mb-3 rounded ${isDone ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'
                                                                                }`} />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                                                    {/* Bodega: finalizar envasado */}
                                                    {(isWarehouse || isAdmin) && r.status === 'processing' && (
                                                        <button onClick={() => handleUpdateStatus(r.id, 'completed')} className="text-xs font-black text-primary uppercase hover:underline">Finalizar</button>
                                                    )}

                                                    {/* Encargado de tienda: confirmar llegada del tambo */}
                                                    {(isStoreManager || isAdmin) && user.branchId === r.branch_id && r.status === 'sent_to_branch' && (
                                                        <button
                                                            onClick={() => handleConfirmReceipt(r.id)}
                                                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                        >
                                                            ✅ Confirmar Llegada
                                                        </button>
                                                    )}

                                                    {/* Encargado de tienda: iniciar envasado */}
                                                    {(isStoreManager || isAdmin) && user.branchId === r.branch_id && r.status === 'received_at_branch' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(r.id, 'processing')}
                                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                        >
                                                            🎨 Iniciar Envasado
                                                        </button>
                                                    )}

                                                    {/* Encargado de tienda: marcar como completado */}
                                                    {(isStoreManager || isAdmin) && user.branchId === r.branch_id && r.status === 'processing' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(r.id, 'completed')}
                                                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                        >
                                                            🏁 Completar
                                                        </button>
                                                    )}

                                                    {/* Admin: autorizar venta */}
                                                    {isAdmin && r.status === 'completed' && !r.stockReleased && (
                                                        <button onClick={() => handleAuthorize(r.id)} className="px-3 py-1 bg-green-500 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-green-500/20 hover:scale-105 transition-all">
                                                            Autorizar Venta
                                                        </button>
                                                    )}
                                                    {r.status === 'completed' && r.stockReleased && (
                                                        <span className="text-[10px] font-black text-green-600 uppercase flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-sm">verified</span>
                                                            Autorizado
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex overflow-hidden justify-center items-start pt-8">
                        <div className="w-full max-w-md bg-white dark:bg-slate-900 mx-8 my-4 rounded-[40px] shadow-sm border dark:border-slate-800 p-10 flex flex-col h-fit">
                            <h3 className="text-2xl font-black mb-8">Nueva Solicitud</h3>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500">Tambo (200L)</label>
                                    <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={bulkId} onChange={e => setBulkId(e.target.value)}>
                                        <option value="">Selecciona...</option>
                                        {bulkProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Envase Destino</label>
                                        <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={targetType} onChange={e => setTargetType(e.target.value as any)}>
                                            <option value="litro">LITRO</option>
                                            <option value="galon">GALÓN</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Cantidad Tambos</label>
                                        <input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black" value={drumQty} onChange={e => setDrumQty(parseInt(e.target.value) || 0)} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500">Sucursal que envasa</label>
                                    <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={branchId} onChange={e => setBranchId(e.target.value)}>
                                        <option value="">Selecciona sucursal...</option>
                                        {branches.filter(b => b.type === 'store').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button type="button" onClick={() => setActiveTab('history')} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                                        Cancelar
                                    </button>
                                    <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                                        Solicitar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Packaging;

