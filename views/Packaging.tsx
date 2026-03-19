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
    const [activeTab, setActiveTab] = useState<'new' | 'history' | 'drums'>('new');

    const [bulkId, setBulkId] = useState('');
    const [targetType, setTargetType] = useState<'cuarto_litro' | 'medio_litro' | 'litro' | 'galon'>('cuarto_litro');
    const [targetProductId, setTargetProductId] = useState('');
    const [drumQty, setDrumQty] = useState(1);
    const [litersRequested, setLitersRequested] = useState(200);
    const [branchId, setBranchId] = useState('');
    const [branches, setBranches] = useState<any[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);

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

    const formatPackageType = (type: string) => {
        switch (type) {
            case 'cuarto_litro': return '¼ LITRO (0.25 L)';
            case 'medio_litro': return '½ LITRO (0.5 L)';
            case 'litro': return 'LITRO (1 L)';
            case 'galon': return 'GALÓN (3.8 L)';
            default: return type.toUpperCase();
        }
    };

    const getLitersPerPackage = (type: string): number => {
        switch (type) {
            case 'cuarto_litro': return 0.25;
            case 'medio_litro': return 0.5;
            case 'litro': return 1;
            case 'galon': return 3.8;
            default: return 0;
        }
    };

    const calculatePackagesPerDrum = (drumQty: number, packageType: string): number => {
        const litersPerPackage = getLitersPerPackage(packageType);
        if (litersPerPackage === 0) return 0;
        const totalLiters = drumQty * 200; // Cada tambo es 200L
        return Math.floor(totalLiters / litersPerPackage);
    };

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    // Estados para tabla de tambos
    const [drumProducts, setDrumProducts] = useState<Product[]>([]);
    const [drumInventory, setDrumInventory] = useState<Record<string, Record<string, number>>>({});
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

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
            
            // Filtrar productos de tambo
            const drumProds = prods.filter(p => (p.description || '').toLowerCase().includes('tambo') || p.sku.includes('200L'));
            setBulkProducts(drumProds);
            setDrumProducts(drumProds);
            setAllProducts(prods);
            setRequests(requestsData as unknown as PackagingRequest[]);
            setBranches(branchesData);
            
            // Cargar inventario de tambos
            await loadDrumInventory(drumProds, branchesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadDrumInventory = async (drumProducts: Product[], branches: any[]) => {
        try {
            const inventoryData: Record<string, Record<string, number>> = {};
            
            // Para cada producto de tambo, obtener inventario por sucursal
            for (const product of drumProducts) {
                inventoryData[product.id] = {};
                
                // El inventario ya viene en el campo inventory del producto
                if (product.inventory) {
                    inventoryData[product.id] = product.inventory;
                }
            }
            
            setDrumInventory(inventoryData);
        } catch (e) {
            console.error('Error cargando inventario de tambos:', e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const maxLiters = drumQty * 200;
        if (litersRequested <= 0 || litersRequested > maxLiters) {
            alert(`Los litros a envasar deben estar entre 1 y ${maxLiters}.`);
            return;
        }
        try {
            await InventoryService.createPackagingRequest({
                bulkProductId:    bulkId,
                targetPackageType: targetType,
                targetProductId:  targetProductId || undefined,
                quantityDrum:     drumQty,
                litersRequested,
                branchId:         branchId || user.branchId
            });
            setActiveTab('history');
            setBulkId('');
            setTargetProductId('');
            setDrumQty(1);
            setLitersRequested(200);
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await InventoryService.updatePackagingStatus(id, status, user.id);
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
                <header className="min-h-[4rem] flex items-center justify-between px-4 md:px-8 py-3 flex-wrap gap-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <h1 className="text-xl font-black">Envasado (Litreados)</h1>
                    {/* Bodega y Admin ven las pestañas; Encargado solo ve la lista por defecto */}
                    {(isWarehouse || isAdmin) && (
                         <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nueva Solicitud', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' },
                                { key: 'drums', label: 'Tambos', icon: 'inventory' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => {
                                    if (tab.key === 'new' && isSub) {
                                        setShowAuth(true);
                                    } else {
                                        setActiveTab(tab.key as 'new' | 'history' | 'drums')
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

                {activeTab === 'drums' ? (
                    // TABLA DE TAMBOS POR SUCURSAL
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Barra de filtro por sucursal */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Filtrar por Sucursal</label>
                                <select
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                                    value={selectedBranchFilter}
                                    onChange={e => setSelectedBranchFilter(e.target.value)}
                                >
                                    <option value="ALL">Todas las sucursales</option>
                                    {branches.filter(b => b.type === 'store').map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">
                                {drumProducts.length} producto{drumProducts.length !== 1 ? 's' : ''} de tambo
                            </span>
                        </div>

                        {/* Tabla de tambos */}
                        <div className="mx-8 my-4 bg-white dark:bg-slate-900 rounded-2xl md:rounded-[32px] shadow-sm border dark:border-slate-800 overflow-hidden flex-1 overflow-y-auto">
                            <table className="w-full">
                                <thead className="border-b dark:border-slate-800">
                                    <tr>
                                        <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Producto</th>
                                        {branches
                                            .filter(b => b.type === 'store')
                                            .filter(b => selectedBranchFilter === 'ALL' || b.id === selectedBranchFilter)
                                            .map(branch => (
                                                <th key={branch.id} className="px-6 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                                    {branch.name}
                                                </th>
                                            ))}
                                        <th className="px-6 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-800">
                                    {drumProducts.map(product => {
                                        // Calcular total por producto
                                        let total = 0;
                                        const branchQuantities = branches
                                            .filter(b => b.type === 'store')
                                            .filter(b => selectedBranchFilter === 'ALL' || b.id === selectedBranchFilter)
                                            .map(branch => {
                                                const quantity = drumInventory[product.id]?.[branch.id] || 0;
                                                total += quantity;
                                                return quantity;
                                            });

                                        return (
                                            <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{product.name}</span>
                                                        <span className="text-[10px] text-slate-400">{product.sku}</span>
                                                    </div>
                                                </td>
                                                {branchQuantities.map((quantity, index) => {
                                                    const branch = branches
                                                        .filter(b => b.type === 'store')
                                                        .filter(b => selectedBranchFilter === 'ALL' || b.id === selectedBranchFilter)[index];
                                                    return (
                                                        <td key={branch.id} className="px-6 py-5">
                                                            <div className={`px-3 py-1.5 rounded-lg text-center font-black text-sm ${quantity === 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : quantity < 5 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-green-50 dark:bg-green-900/20 text-green-500'}`}>
                                                                {quantity.toLocaleString()} L
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-6 py-5">
                                                    <div className={`px-3 py-1.5 rounded-lg text-center font-black text-sm ${total === 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : total < 10 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-green-50 dark:bg-green-900/20 text-green-500'}`}>
                                                        {total.toLocaleString()} L
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {drumProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={branches.filter(b => b.type === 'store').length + 2} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">inventory</span>
                                                    <p className="font-black text-base text-slate-400">No hay productos de tambo</p>
                                                    <p className="text-xs text-slate-400">Agrega productos de tipo tambo en el inventario.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'history' || isStoreManager ? (
                    <>

                        {/* Barra de filtro por fechas */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm">
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
                        <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
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
                                                        <span className="font-black uppercase text-xs">{formatPackageType(r.target_package_type)}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                            {r.liters_requested ?? r.quantity_drum * 200} L envasados
                                                            {r.quantity_drum * 200 - (r.liters_requested ?? r.quantity_drum * 200) > 0 &&
                                                                <span className="text-amber-500"> · {r.quantity_drum * 200 - (r.liters_requested ?? r.quantity_drum * 200)} L restantes</span>
                                                            }
                                                        </span>
                                                        <span className="text-[10px] text-green-600 font-black">
                                                            {r.packages_produced != null
                                                                ? `${r.packages_produced.toLocaleString()} envases producidos`
                                                                : `~${Math.floor((r.liters_requested ?? r.quantity_drum * 200) / getLitersPerPackage(r.target_package_type)).toLocaleString()} envases estimados`
                                                            }
                                                        </span>
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
                                                    {(isStoreManager || isAdmin) && !!user.branchId && user.branchId === r.branch_id && r.status === 'sent_to_branch' && (
                                                        <button
                                                            onClick={() => handleConfirmReceipt(r.id)}
                                                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                        >
                                                            ✅ Confirmar Llegada
                                                        </button>
                                                    )}

                                                    {/* Encargado de tienda: iniciar envasado */}
                                                    {(isStoreManager || isAdmin) && !!user.branchId && user.branchId === r.branch_id && r.status === 'received_at_branch' && (
                                                        <button
                                                            onClick={() => handleUpdateStatus(r.id, 'processing')}
                                                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                        >
                                                            🎨 Iniciar Envasado
                                                        </button>
                                                    )}

                                                    {/* Encargado de tienda: marcar como completado */}
                                                    {(isStoreManager || isAdmin) && !!user.branchId && user.branchId === r.branch_id && r.status === 'processing' && (
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
                                        {requests.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-20 text-center">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">colors</span>
                                                        <p className="font-black text-base text-slate-400">Sin solicitudes de envasado</p>
                                                        <p className="text-xs text-slate-400">Crea la primera solicitud desde la pesta&ntilde;a "Nueva Solicitud".</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
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
                                    <label className="text-[10px] font-black uppercase text-slate-500">Tambo (producto granel)</label>
                                    <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={bulkId} onChange={e => setBulkId(e.target.value)}>
                                        <option value="">Selecciona...</option>
                                        {bulkProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500">Sucursal que envasa</label>
                                    <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={branchId} onChange={e => setBranchId(e.target.value)}>
                                        <option value="">Selecciona sucursal...</option>
                                        {branches.filter(b => b.type === 'store').map(b => {
                                            const available = (bulkId && b.id) ? (drumInventory[bulkId]?.[b.id] ?? 0) : null;
                                            return <option key={b.id} value={b.id}>{b.name}{available !== null ? ` — ${available.toLocaleString()} L disponibles` : ''}</option>;
                                        })}
                                    </select>
                                    {bulkId && branchId && (
                                        <p className="text-xs font-black mt-1 px-1">
                                            {(() => {
                                                const avail = drumInventory[bulkId]?.[branchId] ?? 0;
                                                return <span className={avail === 0 ? 'text-red-500' : 'text-green-600'}>
                                                    Disponible en sucursal: {avail.toLocaleString()} L
                                                </span>;
                                            })()}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Envase Destino</label>
                                        <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={targetType} onChange={e => setTargetType(e.target.value as any)}>
                                            <option value="cuarto_litro">¼ LITRO (0.25 L)</option>
                                            <option value="medio_litro">½ LITRO (0.5 L)</option>
                                            <option value="litro">LITRO (1 L)</option>
                                            <option value="galon">GALÓN (3.8 L)</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Tambos a enviar</label>
                                        <input type="number" min={1} required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black" value={drumQty}
                                            onChange={e => {
                                                const qty = parseInt(e.target.value) || 1;
                                                setDrumQty(qty);
                                                setLitersRequested(qty * 200);
                                            }} />
                                    </div>
                                </div>

                                {/* Litros a envasar (puede ser parcial) */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500">
                                        Litros a envasar <span className="text-slate-400 normal-case font-medium">(máx. {drumQty * 200} L · deja el resto en la sucursal)</span>
                                    </label>
                                    <input
                                        type="number" min={1} max={drumQty * 200} required
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black"
                                        value={litersRequested}
                                        onChange={e => setLitersRequested(Math.min(parseInt(e.target.value) || 0, drumQty * 200))}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500">Producto resultado (botella en inventario)</label>
                                    <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={targetProductId} onChange={e => setTargetProductId(e.target.value)}>
                                        <option value="">Selecciona producto botella...</option>
                                        {allProducts
                                            .filter(p => !((p.description || '').toLowerCase().includes('tambo') || p.sku.includes('200L')))
                                            .map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                                    </select>
                                </div>

                                {/* Resumen de cálculo */}
                                {litersRequested > 0 && (
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-2">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400">A envasar</p>
                                                <p className="font-black text-lg text-primary">{litersRequested.toLocaleString()} L</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400">Envases</p>
                                                <p className="font-black text-lg text-green-600">{Math.floor(litersRequested / getLitersPerPackage(targetType)).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-slate-400">Restante</p>
                                                <p className="font-black text-lg text-amber-500">{(drumQty * 200 - litersRequested).toLocaleString()} L</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-center">
                                            {formatPackageType(targetType)} · {litersRequested} L ÷ {getLitersPerPackage(targetType)} L/env
                                        </p>
                                    </div>
                                )}
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

