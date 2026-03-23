import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, PackagingRequest, PackagingSettings, PackagingOrderLine, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { PackagingService } from '../services/packaging/packagingService';
import AuthorizationModal from '../components/AuthorizationModal';

interface PackagingProps {
    user: User;
    onLogout: () => void;
}

type PackageType = 'galon' | 'litro' | 'medio_litro' | 'cuarto_litro';

interface CalcLine {
    packageType: PackageType;
    qty: number;
    targetProductId: string;
}

const PACKAGE_DEFS: { type: PackageType; label: string; icon: string; colorBg: string; colorText: string }[] = [
    { type: 'galon',        label: 'Galón',    icon: 'water_drop',   colorBg: 'bg-blue-50 dark:bg-blue-900/30',    colorText: 'text-blue-600 dark:text-blue-400' },
    { type: 'litro',        label: 'Litro',    icon: 'local_drink',  colorBg: 'bg-cyan-50 dark:bg-cyan-900/30',    colorText: 'text-cyan-600 dark:text-cyan-400' },
    { type: 'medio_litro',  label: '½ Litro',  icon: 'water',        colorBg: 'bg-teal-50 dark:bg-teal-900/30',    colorText: 'text-teal-600 dark:text-teal-400' },
    { type: 'cuarto_litro', label: '¼ Litro',  icon: 'opacity',      colorBg: 'bg-emerald-50 dark:bg-emerald-900/30', colorText: 'text-emerald-600 dark:text-emerald-400' },
];

const INITIAL_CALC_LINES: CalcLine[] = [
    { packageType: 'galon',        qty: 0, targetProductId: '' },
    { packageType: 'litro',        qty: 0, targetProductId: '' },
    { packageType: 'medio_litro',  qty: 0, targetProductId: '' },
    { packageType: 'cuarto_litro', qty: 0, targetProductId: '' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    sent_to_branch:     { label: 'Enviado a Sucursal',    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
    received_at_branch: { label: 'Recibido en Sucursal',  color: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-400' },
    processing:         { label: 'En Proceso',             color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
    completed:          { label: 'Completado',             color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' },
    cancelled:          { label: 'Cancelado',              color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
};

const Packaging: React.FC<PackagingProps> = ({ user, onLogout }) => {
    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const isStoreManager = user.role === UserRole.STORE_MANAGER;
    const isSub = user.role === UserRole.WAREHOUSE_SUB;

    // ─── Settings ───
    const [settings, setSettings] = useState<PackagingSettings>({ galon_liters: 3.785, drum_liters: 200 });
    const [showSettings, setShowSettings] = useState(false);
    const [settingsGalon, setSettingsGalon] = useState(3.785);
    const [savingSettings, setSavingSettings] = useState(false);

    // ─── Tabs ───
    const [activeTab, setActiveTab] = useState<'new' | 'history' | 'drums'>('new');

    // ─── Calculator V3 ───
    const [bulkId, setBulkId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [drumQty, setDrumQty] = useState(1);
    const [calcLines, setCalcLines] = useState<CalcLine[]>(INITIAL_CALC_LINES);
    const [submitting, setSubmitting] = useState(false);

    // ─── History & Details ───
    const [requests, setRequests] = useState<any[]>([]);
    const [detailOrder, setDetailOrder] = useState<any>(null);
    const [detailLines, setDetailLines] = useState<PackagingOrderLine[]>([]);
    const [detailWaste, setDetailWaste] = useState<number | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [noBranchWarning, setNoBranchWarning] = useState(false);

    // ─── Drums ───
    const [bulkProducts, setBulkProducts] = useState<Product[]>([]);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [drumInventory, setDrumInventory] = useState<Record<string, Record<string, number>>>({});
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
    const [loading, setLoading] = useState(false);

    // ─── Auth Modal ───
    const [showAuth, setShowAuth] = useState(false);

    // ─── Derived calculations ───
    const getLitersPerUnit = (type: PackageType): number => {
        if (type === 'galon') return settings.galon_liters;
        if (type === 'litro') return 1;
        if (type === 'medio_litro') return 0.5;
        return 0.25;
    };

    const totalCapacity = drumQty * settings.drum_liters;
    const totalUsed = calcLines.reduce((sum, l) => sum + l.qty * getLitersPerUnit(l.packageType), 0);
    const merma = totalUsed > 0 ? Math.max(0, totalCapacity - totalUsed) : 0;
    const isOverCapacity = totalUsed > totalCapacity;
    const activeLines = calcLines.filter(l => l.qty > 0);
    const canSubmit = !isOverCapacity && activeLines.length > 0 && !!bulkId && !!branchId && activeLines.every(l => !!l.targetProductId);

    // Reset lines when tambo changes
    useEffect(() => {
        setCalcLines(INITIAL_CALC_LINES);
    }, [bulkId]);

    // ─── Lifecycle ───
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (sd = startDate, ed = endDate) => {
        try {
            setLoading(true);
            setNoBranchWarning(false);

            const needsBranch = !isAdmin && !isWarehouse;
            if (needsBranch && !user.branchId) {
                setNoBranchWarning(true);
                setRequests([]);
                const [prods, branchesData, settingsData] = await Promise.all([
                    InventoryService.getProducts().catch(() => [] as any[]),
                    InventoryService.getBranches().catch(() => []),
                    PackagingService.getSettings().catch(() => ({ galon_liters: 3.785, drum_liters: 200 }))
                ]);
                const drumProds = prods.filter((p: any) =>
                    (p.description || '').toLowerCase().includes('tambo') ||
                    (p.sku || '').toUpperCase().includes('200L')
                );
                setBulkProducts(drumProds);
                setAllProducts(prods);
                setBranches(branchesData);
                setSettings(settingsData);
                setSettingsGalon(settingsData.galon_liters);
                setLoading(false);
                return;
            }

            const branchFilter = (isAdmin || isWarehouse) ? undefined : user.branchId;
            const [prods, requestsData, branchesData, settingsData] = await Promise.all([
                InventoryService.getProducts().catch(() => [] as any[]),
                PackagingService.getPackagingRequests(
                    branchFilter,
                    sd || undefined,
                    ed || undefined
                ).catch(() => []),
                InventoryService.getBranches().catch(() => []),
                PackagingService.getSettings().catch(() => ({ galon_liters: 3.785, drum_liters: 200 }))
            ]);

            const drumProds = prods.filter((p: any) =>
                (p.description || '').toLowerCase().includes('tambo') ||
                (p.sku || '').toUpperCase().includes('200L')
            );
            setBulkProducts(drumProds);
            setAllProducts(prods);
            setRequests(requestsData as any[]);
            setBranches(branchesData);
            setSettings(settingsData);
            setSettingsGalon(settingsData.galon_liters);

            // Load drum inventory
            const inventoryData: Record<string, Record<string, number>> = {};
            for (const product of drumProds) {
                inventoryData[product.id] = product.inventory || {};
            }
            setDrumInventory(inventoryData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (settingsGalon <= 0) {
            alert('El galón debe ser mayor a 0 litros');
            return;
        }
        setSavingSettings(true);
        try {
            await PackagingService.updateSetting('galon_liters', settingsGalon);
            setSettings({ ...settings, galon_liters: settingsGalon });
            setShowSettings(false);
            alert('Configuración guardada');
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSubmitV3 = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        try {
            const selectedBranch = branches.find((b: any) => b.id === branchId);
            const selectedProduct = bulkProducts.find(p => p.id === bulkId);
            await PackagingService.createPackagingOrderV3(
                branchId, bulkId, drumQty, user.id,
                activeLines.map(l => ({
                    packageType: l.packageType,
                    targetProductId: l.targetProductId,
                    quantity: l.qty,
                    litersPerUnit: getLitersPerUnit(l.packageType)
                })),
                selectedBranch?.name,
                selectedProduct?.name
            );
            setCalcLines(INITIAL_CALC_LINES);
            setBulkId('');
            setBranchId('');
            setDrumQty(1);
            setActiveTab('history');
            await loadData();
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCompletePackaging = async (id: string, branchName?: string, productName?: string) => {
        if (!confirm('¿Confirmar que el envasado está terminado? Se actualizará el inventario.')) return;
        try {
            await PackagingService.completePackagingOrder(id, user.id, branchName, productName);
            await loadData();
        } catch (e: any) {
            alert('Error al completar envasado: ' + e.message);
        }
    };

    const handleOpenDetail = async (order: any) => {
        try {
            const [lines, waste] = await Promise.all([
                PackagingService.getOrderLines(order.id),
                PackagingService.getOrderWaste(order.id)
            ]);
            setDetailOrder(order);
            setDetailLines(lines);
            setDetailWaste(waste);
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await PackagingService.updatePackagingStatus(id, status, user.id);
            await loadData();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleConfirmReceipt = async (id: string) => {
        if (!confirm('¿Confirmar recepción del tambo?')) return;
        try {
            await PackagingService.confirmPackagingReceipt(id);
            await loadData();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleAuthorize = async (id: string) => {
        if (!confirm('¿Autorizar venta de este lote envasado?')) return;
        try {
            await PackagingService.authorizePackaging(id);
            await loadData();
            alert('Lote autorizado para venta.');
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    // ─── UI: Progress Bar ───
    const progressPercent = Math.min(100, (totalUsed / totalCapacity) * 100);
    const progressColor = isOverCapacity ? 'bg-red-500' : progressPercent > 95 ? 'bg-amber-500' : progressPercent > 80 ? 'bg-amber-400' : 'bg-green-500';

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <header className="min-h-[4rem] flex items-center justify-between px-4 md:px-8 py-3 flex-wrap gap-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <h1 className="text-xl font-black">Envasado (Litreados)</h1>
                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={() => setShowSettings(true)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                title="Configurar galón"
                            >
                                <span className="material-symbols-outlined">settings</span>
                            </button>
                        )}
                        {(isWarehouse || isAdmin) && (
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                                {([
                                    { key: 'new', label: 'Nueva Solicitud', icon: 'add_circle' },
                                    { key: 'history', label: 'Historial', icon: 'list' },
                                    { key: 'drums', label: 'Tambos', icon: 'inventory' }
                                ] as const).map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => {
                                            if (tab.key === 'new' && isSub) {
                                                setShowAuth(true);
                                            } else {
                                                setActiveTab(tab.key);
                                            }
                                        }}
                                        className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                                            activeTab === tab.key
                                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </header>

                {/* Settings Modal */}
                {showSettings && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
                            <h2 className="text-xl font-black mb-4">Configurar Galón</h2>
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
                                    <p className="text-sm text-slate-600 dark:text-slate-400">Valor actual</p>
                                    <p className="text-2xl font-black text-primary">{settingsGalon.toFixed(2)} L</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSettingsGalon(3.785)}
                                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                                            settingsGalon === 3.785
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        3.785 L (Estándar)
                                    </button>
                                    <button
                                        onClick={() => setSettingsGalon(4.0)}
                                        className={`flex-1 py-2 px-3 rounded-lg font-bold text-sm transition-all ${
                                            settingsGalon === 4.0
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        4.0 L (Cubeta)
                                    </button>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase">Valor personalizado</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={settingsGalon}
                                        onChange={e => setSettingsGalon(parseFloat(e.target.value) || 0)}
                                        className="w-full p-2 mt-1 border dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg font-bold"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowSettings(false)}
                                        className="flex-1 py-2 px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveSettings}
                                        disabled={savingSettings}
                                        className="flex-1 py-2 px-3 bg-primary text-white rounded-lg font-bold hover:scale-105 transition-all disabled:opacity-50"
                                    >
                                        {savingSettings ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail Modal V3 */}
                {detailOrder && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-black">Detalle de Orden</h2>
                                <button onClick={() => setDetailOrder(null)} className="text-slate-400 hover:text-slate-600">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <p className="text-xs text-slate-500 font-bold">Orden ID</p>
                                    <p className="font-bold">{detailOrder.id}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-500 mb-2">Líneas de Producción</h3>
                                    <div className="space-y-2">
                                        {detailLines.map(line => (
                                            <div key={line.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-bold">Presentación</p>
                                                        <p className="font-bold">{line.packageType.replace(/_/g, ' ').toUpperCase()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-bold">Producto</p>
                                                        <p className="font-bold">{line.targetProductName}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-bold">Cantidad</p>
                                                        <p className="font-bold">{line.quantityRequested} unidades</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-bold">Subtotal</p>
                                                        <p className="font-bold text-primary">{line.litersSubtotal.toFixed(2)} L</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Barra de capacidad */}
                                {(() => {
                                    const totalLiters = detailLines.reduce((sum, l) => sum + (l.litersSubtotal || 0), 0);
                                    const drumCapacity = (detailOrder.quantity_drum || 1) * settings.drum_liters;
                                    const pct = drumCapacity > 0 ? Math.min(100, (totalLiters / drumCapacity) * 100) : 0;
                                    const remaining = Math.max(0, drumCapacity - totalLiters);
                                    return (
                                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                                <span>Llenado</span>
                                                <span>{totalLiters.toFixed(1)} / {drumCapacity.toFixed(1)} L ({pct.toFixed(0)}%)</span>
                                            </div>
                                            <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${pct > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                                                    style={{ width: `${Math.min(100, pct)}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">Restante: {remaining.toFixed(1)} L</p>
                                        </div>
                                    );
                                })()}
                                {detailWaste !== null && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                                        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">Merma Registrada</p>
                                        <p className="text-lg font-black text-amber-600 dark:text-amber-400">{detailWaste.toFixed(2)} L</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Auth Modal */}
                <AuthorizationModal
                    isOpen={showAuth}
                    onClose={() => setShowAuth(false)}
                    onAuthorized={() => setActiveTab('new')}
                    description="El subencargado requiere autorización para solicitar envasado."
                />

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    {activeTab === 'new' && (isAdmin || isWarehouse) ? (
                        // ─── Calculator Tab ───
                        <div className="p-8">
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Top Controls */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className="text-xs font-black uppercase text-slate-500">Tambo (Granel)</label>
                                            <select
                                                value={bulkId}
                                                onChange={e => setBulkId(e.target.value)}
                                                className="w-full mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none font-bold"
                                            >
                                                <option value="">Selecciona...</option>
                                                {bulkProducts.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-black uppercase text-slate-500">Sucursal</label>
                                            <select
                                                value={branchId}
                                                onChange={e => setBranchId(e.target.value)}
                                                className="w-full mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none font-bold"
                                            >
                                                <option value="">Selecciona...</option>
                                                {branches
                                                    .filter(b => b.type === 'store')
                                                    .map(b => (
                                                        <option key={b.id} value={b.id}>
                                                            {b.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-black uppercase text-slate-500">Tambos</label>
                                            <div className="mt-1 flex items-center gap-2">
                                                <button
                                                    onClick={() => setDrumQty(Math.max(1, drumQty - 1))}
                                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-black hover:bg-slate-300 dark:hover:bg-slate-600"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={drumQty}
                                                    onChange={e => setDrumQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="flex-1 text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg font-black"
                                                />
                                                <button
                                                    onClick={() => setDrumQty(drumQty + 1)}
                                                    className="px-3 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg font-black hover:bg-slate-300 dark:hover:bg-slate-600"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                        Capacidad total: <span className="text-primary font-black">{totalCapacity.toLocaleString()} L</span>
                                    </p>
                                </div>

                                {/* Cards Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {PACKAGE_DEFS.map((def, idx) => {
                                        const line = calcLines.find(l => l.packageType === def.type)!;
                                        const litersPerUnit = getLitersPerUnit(def.type);
                                        const subtotal = line.qty * litersPerUnit;

                                        return (
                                            <div key={def.type} className={`${def.colorBg} border border-slate-200 dark:border-slate-700 rounded-2xl p-5`}>
                                                <h3 className={`font-black text-lg mb-1 ${def.colorText}`}>{def.label}</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-bold">
                                                    {litersPerUnit.toFixed(2)} L / unidad
                                                </p>

                                                <div className="mb-4">
                                                    <select
                                                        value={line.targetProductId}
                                                        onChange={e =>
                                                            setCalcLines(
                                                                calcLines.map((l, i) =>
                                                                    i === idx ? { ...l, targetProductId: e.target.value } : l
                                                                )
                                                            )
                                                        }
                                                        className={`w-full p-2 text-xs font-bold rounded-lg outline-none border dark:border-slate-700 bg-white dark:bg-slate-800 ${line.qty > 0 && !line.targetProductId ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                                                    >
                                                        <option value="">Selecciona SKU destino...</option>
                                                        {allProducts.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.sku} - {p.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="flex items-center gap-2 mb-4">
                                                    <button
                                                        onClick={() =>
                                                            setCalcLines(
                                                                calcLines.map((l, i) =>
                                                                    i === idx ? { ...l, qty: Math.max(0, l.qty - 1) } : l
                                                                )
                                                            )
                                                        }
                                                        className="px-3 py-2 bg-slate-300 dark:bg-slate-600 rounded-lg font-black hover:bg-slate-400 dark:hover:bg-slate-500 text-lg"
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={line.qty}
                                                        onChange={e =>
                                                            setCalcLines(
                                                                calcLines.map((l, i) =>
                                                                    i === idx ? { ...l, qty: Math.max(0, parseInt(e.target.value) || 0) } : l
                                                                )
                                                            )
                                                        }
                                                        className="flex-1 text-center p-2 bg-white dark:bg-slate-800 rounded-lg text-lg font-black outline-none border dark:border-slate-700"
                                                    />
                                                    <button
                                                        onClick={() =>
                                                            setCalcLines(
                                                                calcLines.map((l, i) =>
                                                                    i === idx ? { ...l, qty: l.qty + 1 } : l
                                                                )
                                                            )
                                                        }
                                                        className="px-3 py-2 bg-slate-300 dark:bg-slate-600 rounded-lg font-black hover:bg-slate-400 dark:hover:bg-slate-500 text-lg"
                                                    >
                                                        +
                                                    </button>
                                                </div>

                                                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-center">
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Subtotal</p>
                                                    <p className="text-lg font-black text-primary">{subtotal.toFixed(2)} L</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Progress Bar */}
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Llenado</p>
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                            {totalUsed.toFixed(1)} / {totalCapacity.toFixed(1)} L ({progressPercent.toFixed(0)}%)
                                        </p>
                                    </div>
                                    <div className="w-full h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all ${progressColor}`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-bold">
                                        Merma estimada: {merma.toFixed(1)} L
                                    </p>
                                </div>

                                {/* Error & Submit */}
                                {isOverCapacity && (
                                    <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl">
                                        <p className="font-black text-red-600 dark:text-red-400">
                                            ⚠️ Excediste la capacidad. Reduce la cantidad.
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-end">
                                    <button
                                        onClick={handleSubmitV3}
                                        disabled={!canSubmit || submitting}
                                        className={`px-8 py-4 rounded-2xl font-black text-white uppercase transition-all ${
                                            !canSubmit || isOverCapacity
                                                ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                                : 'bg-primary hover:scale-105 shadow-lg shadow-primary/30'
                                        }`}
                                    >
                                        {submitting ? 'Enviando...' : 'Enviar Solicitud a Sucursal'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'history' || isStoreManager ? (
                        // ─── History Tab ───
                        <div className="p-8">
                            <div className="max-w-6xl mx-auto space-y-4">
                                {noBranchWarning && (
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl flex items-center gap-3">
                                        <span className="material-symbols-outlined text-amber-500">warning</span>
                                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                            No tienes sucursal asignada. Contacta al administrador para que te asigne una sucursal.
                                        </p>
                                    </div>
                                )}

                                {/* Tarjeta de sucursal para STORE_MANAGER */}
                                {isStoreManager && user.branchId && (() => {
                                    const myBranch = branches.find(b => b.id === user.branchId);
                                    const myTambos = bulkProducts.reduce((sum, p) => {
                                        return sum + (drumInventory[p.id]?.[user.branchId!] || 0);
                                    }, 0);
                                    return (
                                        <div className="bg-gradient-to-r from-primary/10 to-teal-500/10 border border-primary/20 rounded-2xl p-4 flex items-center gap-4">
                                            <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-primary text-2xl">store</span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Tu Sucursal</p>
                                                <p className="text-xl font-black text-slate-800 dark:text-slate-200">{myBranch?.name || user.branchId}</p>
                                            </div>
                                            <div className="ml-auto text-right">
                                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Tambos en Sucursal</p>
                                                <p className="text-2xl font-black text-primary">{myTambos} <span className="text-sm font-bold text-slate-400">u</span></p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border dark:border-slate-800 flex flex-wrap items-end gap-3">
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-500">Desde</label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={e => setStartDate(e.target.value)}
                                            className="mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm font-bold border-none outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-500">Hasta</label>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={e => setEndDate(e.target.value)}
                                            className="mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm font-bold border-none outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={() => loadData(startDate, endDate)}
                                        className="px-5 py-2 bg-primary text-white rounded-lg font-black text-xs uppercase"
                                    >
                                        Filtrar
                                    </button>
                                    {(startDate || endDate) && (
                                        <button
                                            onClick={() => {
                                                setStartDate('');
                                                setEndDate('');
                                                loadData('', '');
                                            }}
                                            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                    <span className="text-xs text-slate-400 font-bold ml-auto">
                                        {requests.length} solicitud{requests.length !== 1 ? 'es' : ''}
                                    </span>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-700">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold text-xs uppercase text-slate-500">Producto</th>
                                                    <th className="px-6 py-4 font-bold text-xs uppercase text-slate-500">Sucursal</th>
                                                    <th className="px-6 py-4 font-bold text-xs uppercase text-slate-500">Envase</th>
                                                    <th className="px-6 py-4 font-bold text-xs uppercase text-slate-500">Estado</th>
                                                    <th className="px-6 py-4 font-bold text-xs uppercase text-slate-500 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {requests.map((r: any) => (
                                                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="px-6 py-4 font-bold">{r.products?.name}</td>
                                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{r.branches?.name}</td>
                                                        <td className="px-6 py-4">
                                                            {r.isV3 ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-bold">
                                                                    <span className="material-symbols-outlined text-sm">layers</span>
                                                                    Multi-línea
                                                                </span>
                                                            ) : (
                                                                <span className="text-sm font-bold">{r.target_package_type?.replace(/_/g, ' ').toUpperCase()}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {(() => {
                                                                const s = STATUS_LABELS[r.status] ?? { label: r.status, color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' };
                                                                return (
                                                                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold ${s.color}`}>
                                                                        {s.label}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4 text-right space-x-2">
                                                            {r.isV3 && (
                                                                <button
                                                                    onClick={() => handleOpenDetail(r)}
                                                                    className="text-xs font-bold text-primary hover:underline"
                                                                >
                                                                    Ver Detalle
                                                                </button>
                                                            )}
                                                            {/* Paso 1: Confirmar recepción de tambos */}
                                                            {r.status === 'sent_to_branch' && (isAdmin || (isStoreManager && !!user.branchId && user.branchId === r.branch_id)) && (
                                                                <button
                                                                    onClick={() => handleConfirmReceipt(r.id)}
                                                                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600"
                                                                >
                                                                    ✅ Confirmar Recepción de Tambos
                                                                </button>
                                                            )}
                                                            {/* Paso 2: Iniciar envasado */}
                                                            {r.status === 'received_at_branch' && (isAdmin || (isStoreManager && !!user.branchId && user.branchId === r.branch_id)) && (
                                                                <button
                                                                    onClick={() => handleUpdateStatus(r.id, 'processing')}
                                                                    className="px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600"
                                                                >
                                                                    ▶ Iniciar Envasado
                                                                </button>
                                                            )}
                                                            {/* Paso 3: Completar envasado — llama al RPC y actualiza inventario */}
                                                            {r.status === 'processing' && (isAdmin || (isStoreManager && !!user.branchId && user.branchId === r.branch_id)) && (
                                                                <button
                                                                    onClick={() => handleCompletePackaging(r.id, r.branches?.name, r.products?.name)}
                                                                    className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold hover:bg-green-600"
                                                                >
                                                                    ✅ Completar Envasado
                                                                </button>
                                                            )}
                                                            {/* Autorizar venta (Admin) */}
                                                            {isAdmin && r.status === 'completed' && !r.stockReleased && (
                                                                <button
                                                                    onClick={() => handleAuthorize(r.id)}
                                                                    className="px-2 py-1 bg-violet-500 text-white rounded text-xs font-bold hover:bg-violet-600"
                                                                >
                                                                    Autorizar Venta
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {requests.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="py-12 text-center">
                                                            <p className="text-slate-400 font-bold">Sin solicitudes</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // ─── Drums Tab ───
                        <div className="p-8">
                            <div className="max-w-6xl mx-auto">
                                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border dark:border-slate-800 mb-4 flex items-end gap-3">
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-500">Filtrar por Sucursal</label>
                                        <select
                                            value={selectedBranchFilter}
                                            onChange={e => setSelectedBranchFilter(e.target.value)}
                                            className="mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm font-bold"
                                        >
                                            <option value="ALL">Todas las sucursales</option>
                                            {branches
                                                .filter(b => b.type === 'store')
                                                .map(b => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    <span className="text-xs text-slate-400 font-bold ml-auto">
                                        {bulkProducts.length} productos de tambo
                                    </span>
                                </div>

                                <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-700">
                                                <tr>
                                                    <th className="px-6 py-4 text-left font-bold text-xs uppercase text-slate-500">Producto</th>
                                                    {branches
                                                        .filter(b => b.type === 'store')
                                                        .filter(b => selectedBranchFilter === 'ALL' || b.id === selectedBranchFilter)
                                                        .map(b => (
                                                            <th key={b.id} className="px-6 py-4 text-left font-bold text-xs uppercase text-slate-500">
                                                                {b.name}
                                                            </th>
                                                        ))}
                                                    <th className="px-6 py-4 text-left font-bold text-xs uppercase text-slate-500">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {bulkProducts.map(product => {
                                                    let total = 0;
                                                    const quantities = branches
                                                        .filter(b => b.type === 'store')
                                                        .filter(b => selectedBranchFilter === 'ALL' || b.id === selectedBranchFilter)
                                                        .map(b => {
                                                            const qty = drumInventory[product.id]?.[b.id] || 0;
                                                            total += qty;
                                                            return qty;
                                                        });

                                                    return (
                                                        <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                            <td className="px-6 py-4 font-bold">{product.name}</td>
                                                            {quantities.map((qty, i) => (
                                                                <td key={i} className="px-6 py-4">
                                                                    <span
                                                                        className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${
                                                                            qty === 0
                                                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                                                                : qty < 50
                                                                                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                                                                : 'bg-green-50 dark:bg-green-900/20 text-green-600'
                                                                        }`}
                                                                    >
                                                                        {qty.toLocaleString()} L
                                                                    </span>
                                                                </td>
                                                            ))}
                                                            <td className="px-6 py-4">
                                                                <span
                                                                    className={`inline-block px-3 py-1 rounded-lg font-bold text-sm ${
                                                                        total === 0
                                                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600'
                                                                            : total < 50
                                                                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                                                                            : 'bg-green-50 dark:bg-green-900/20 text-green-600'
                                                                    }`}
                                                                >
                                                                    {total.toLocaleString()} L
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Packaging;
