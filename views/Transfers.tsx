
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, StockTransfer, UserRole, CartItem, BarterTransfer, BarterItem, BarterSelection, BarterSuggestion, ShippingOrder } from '../types';
import { InventoryService } from '../services/inventoryService';
import { ShippingService, CARRIER_OPTIONS, SHIPPING_STATUS_LABELS } from '../services/shippingService';
import { exportToCSV } from '../utils/csvExport';
import { useToast } from '../hooks/useToast';
import { translateStatus, getStatusColor } from '../utils/formatters';
import Badge from '../components/ui/Badge';

interface TransfersProps {
    user: User;
    onLogout: () => void;
}

const Transfers: React.FC<TransfersProps> = ({ user, onLogout }) => {
    const PAGE_SIZE = 25;
    const [transferPage, setTransferPage] = useState(0);
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [barters, setBarters] = useState<BarterTransfer[]>([]);
    const [pendingBarters, setPendingBarters] = useState<BarterTransfer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [receivedCart, setReceivedCart] = useState<CartItem[]>([]);
    const [selectionCart, setSelectionCart] = useState<{ productId: string; productName: string; quantity: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isBarterDetailOpen, setIsBarterDetailOpen] = useState(false);
    const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
    const [selectedBarter, setSelectedBarter] = useState<BarterTransfer | null>(null);
    const [barterWithInventory, setBarterWithInventory] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'history' | 'barter_pending'>('new');
    const [historyFilter, setHistoryFilter] = useState<'all' | 'transfers' | 'barters'>('all');
    const [mobilePanel, setMobilePanel] = useState<'give' | 'browse' | 'receive'>('browse');
    const [search, setSearch] = useState('');
    const [toBranchId, setToBranchId] = useState('');
    const [notes, setNotes] = useState('');

    // Shipping States
    const [shippingOrder, setShippingOrder] = useState<ShippingOrder | null>(null);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    const [shippingCarrier, setShippingCarrier] = useState('');
    const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
    const [shippingNotes, setShippingNotes] = useState('');

    const [suggestions, setSuggestions] = useState<BarterSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const toast = useToast();

    const isAdmin = user.role === UserRole.ADMIN;
    // userBranchId: rama real del usuario — para comparaciones de identidad en historial
    const userBranchId = user.branchId || '';
    // fromBranchId: sucursal ORIGEN al crear un traspaso (admin puede cambiarla)
    const [adminFromBranchId, setAdminFromBranchId] = useState('');
    const fromBranchId = isAdmin ? adminFromBranchId : userBranchId;
    // Alias para compatibilidad con historial (no debe cambiar con el selector)
    const branchId = userBranchId;
    const isBarter = receivedCart.length > 0;

    // Fechas
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const firstDay = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(localDate);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async (sd = startDate, ed = endDate) => {
        try {
            setLoading(true);
            const [t, b_trans, p, b] = await Promise.all([
                InventoryService.getStockTransfers(
                    isAdmin ? undefined : branchId,
                    sd || undefined,
                    ed || undefined
                ),
                InventoryService.getBarterTransfers(
                    isAdmin ? undefined : branchId,
                    sd || undefined,
                    ed || undefined
                ).catch(err => {
                    console.error("No se pudieron cargar los trueques:", err);
                    return [] as BarterTransfer[];
                }),
                fromBranchId ? InventoryService.getProductsByBranch(fromBranchId) : Promise.resolve([] as Product[]),
                InventoryService.getBranches()
            ]);

            // Cargar ofertas pendientes si el usuario puede verlas
            if (user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB || user.role === UserRole.STORE_MANAGER || isAdmin) {
                try {
                    if (fromBranchId) {
                        const pending = await InventoryService.getPendingBarterOffers(fromBranchId);
                        setPendingBarters(pending);
                    }
                } catch (e) {
                    console.error("No se pudieron cargar ofertas pendientes:", e);
                }
            }

            setTransfers(t);
            setBarters(b_trans);
            setProducts(p);
            setAllBranches(b);
            setBranches(b.filter(branch => branch.id !== fromBranchId));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (p: Product) => {
        const available = p.inventory[fromBranchId] || 0;
        const existing = cart.find(item => item.id === p.id);
        const currentQty = existing ? existing.quantity : 0;
        if (currentQty + 1 > available) {
            toast.warning('Stock insuficiente', `Stock actual: ${available}`);
            return;
        }
        if (existing) {
            setCart(cart.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...p, quantity: 1 }]);
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateQty = (id: string, qty: number) => {
        const product = products.find(p => p.id === id);
        const available = product ? product.inventory[fromBranchId] || 0 : Infinity;
        const clamped = Math.max(0, Math.min(qty, available));
        setCart(cart.map(item => item.id === id ? { ...item, quantity: clamped } : item));
    };

    const handleSubmit = async () => {
        if (cart.length === 0 || !toBranchId) return;
        if (!fromBranchId) {
            toast.warning('Selecciona sucursal origen', 'Elige la sucursal desde la que se realizará el traspaso.');
            return;
        }
        try {
            setLoading(true);
            const items = cart.map(c => ({
                productId: c.id,
                quantity: c.quantity
            }));
            await InventoryService.createStockTransfer(fromBranchId, toBranchId, notes, items);
            setIsModalOpen(false);
            setActiveTab('history');
            setCart([]);
            setToBranchId('');
            setNotes('');
            loadData();
            toast.success('Traspaso iniciado', 'El traspaso fue creado correctamente.');
        } catch (e: any) {
            console.error("Error en createStockTransfer:", e);
            toast.error('Error al crear traspaso', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleViewTransfer = async (transfer: StockTransfer) => {
        try {
            setLoading(true);
            const detail = await InventoryService.getStockTransferDetail(transfer.id);
            setSelectedTransfer(detail);
            setIsDetailModalOpen(true);
        } catch (e: any) {
            console.error("Error al cargar detalles:", e);
            toast.error('Error', 'No se pudieron obtener los detalles del traspaso.');
        } finally {
            setLoading(false);
        }
    };

    const addToReceivedCart = (p: Product) => {
        const existing = receivedCart.find(item => item.id === p.id);
        if (existing) {
            setReceivedCart(receivedCart.map(item => item.id === p.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setReceivedCart([...receivedCart, { ...p, quantity: 1 }]);
        }
    };

    const removeFromReceivedCart = (id: string) => {
        setReceivedCart(receivedCart.filter(item => item.id !== id));
    };

    const updateReceivedQty = (id: string, qty: number) => {
        setReceivedCart(receivedCart.map(item => item.id === id ? { ...item, quantity: Math.max(0, qty) } : item));
    };

    const handleViewBarter = async (barter: BarterTransfer) => {
        try {
            setLoading(true);
            const detail = await InventoryService.getBarterDetail(barter.id);
            setSelectedBarter(detail);
            setIsBarterDetailOpen(true);
        } catch (e: any) {
            console.error("Error al cargar detalles del trueque:", e);
            toast.error('Error', 'No se pudieron obtener los detalles del trueque.');
        } finally {
            setLoading(false);
        }
    };

    const handleViewPendingBarter = async (barter: BarterTransfer) => {
        try {
            setLoading(true);
            const detail = await InventoryService.getBarterOfferWithInventory(barter.id);
            setBarterWithInventory(detail);
            setSelectedBarter(barter);
            setIsSelectionModalOpen(true);
        } catch (e: any) {
            console.error("Error al cargar detalles del trueque:", e);
            toast.error('Error', 'No se pudieron cargar los detalles del trueque.');
        } finally {
            setLoading(false);
        }
    };

    const handleBarterSubmit = async () => {
        if (cart.length === 0 || !toBranchId) {
            toast.warning('Datos incompletos', 'Agrega productos a dar y selecciona una sucursal destino.');
            return;
        }
        if (!fromBranchId) {
            toast.warning('Selecciona sucursal origen', 'Elige la sucursal desde la que se realizará el trueque.');
            return;
        }
        try {
            setLoading(true);
            await InventoryService.createBarterOffer({
                fromBranchId: fromBranchId,
                toBranchId: toBranchId,
                requestedBy: user.id,
                notes: notes,
                givenItems: cart.map(c => ({ productId: c.id, quantity: c.quantity }))
            });
            setActiveTab('history');
            setCart([]);
            setReceivedCart([]);
            setSuggestions([]);
            setToBranchId('');
            setNotes('');
            loadData();
            toast.success('Oferta enviada', 'La sucursal destino seleccionará qué productos desea recibir.');
        } catch (e: any) {
            console.error("Error en createBarterOffer:", e);
            toast.error('Error al crear oferta', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleSelectBarterItems = async () => {
        if (!selectedBarter || selectionCart.length === 0) {
            toast.warning('Selección vacía', 'Selecciona al menos un producto del inventario del solicitante.');
            return;
        }
        try {
            setLoading(true);
            await InventoryService.selectBarterItems(
                selectedBarter.id,
                user.id,
                selectionCart.map(s => ({ productId: s.productId, quantity: s.quantity }))
            );
            setIsSelectionModalOpen(false);
            setSelectionCart([]);
            loadData();
            toast.success('Selección enviada', 'El administrador revisará la solicitud de trueque.');
        } catch (e: any) {
            console.error("Error al seleccionar items:", e);
            toast.error('Error al enviar selección', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleCounterOffer = async () => {
        if (!selectedBarter || selectionCart.length === 0) {
            toast.warning('Selección vacía', 'Agrega productos a tu contra-oferta.');
            return;
        }
        try {
            setLoading(true);
            await InventoryService.proposeCounterOffer(
                selectedBarter.id,
                user.id,
                notes,
                selectionCart.map(s => ({ productId: s.productId, quantity: s.quantity }))
            );
            setIsSelectionModalOpen(false);
            setSelectionCart([]);
            setNotes('');
            loadData();
            toast.success('Contra-oferta enviada', 'La sucursal solicitante revisará tu propuesta.');
        } catch (e: any) {
            console.error("Error al enviar contra-oferta:", e);
            toast.error('Error al enviar contra-oferta', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const addToSelectionCart = (productId: string, productName: string, maxQty: number) => {
        const existing = selectionCart.find(s => s.productId === productId);
        if (existing) {
            if (existing.quantity + 1 > maxQty) {
                toast.warning('Límite alcanzado', `No puedes seleccionar más de ${maxQty} unidades.`);
                return;
            }
            setSelectionCart(selectionCart.map(s => 
                s.productId === productId ? { ...s, quantity: s.quantity + 1 } : s
            ));
        } else {
            setSelectionCart([...selectionCart, { productId, productName, quantity: 1 }]);
        }
    };

    const removeFromSelectionCart = (productId: string) => {
        setSelectionCart(selectionCart.filter(s => s.productId !== productId));
    };

    const updateSelectionQty = (productId: string, qty: number, maxQty: number) => {
        const clamped = Math.max(0, Math.min(qty, maxQty));
        if (clamped === 0) {
            removeFromSelectionCart(productId);
        } else {
            setSelectionCart(selectionCart.map(s => 
                s.productId === productId ? { ...s, quantity: clamped } : s
            ));
        }
    };

    const handleApproveBarter = async (id: string) => {
        if (!isAdmin) return;
        if (!confirm("¿Aprobar este trueque? El stock quedará reservado hasta que ambas sucursales confirmen el intercambio.")) return;
        try {
            setLoading(true);
            await InventoryService.approveBarterTransfer(id, user.id);
            setIsBarterDetailOpen(false);
            loadData();
            toast.success('Trueque aprobado', 'El stock está reservado. La sucursal origen debe confirmar el envío.');
        } catch (e: any) {
            console.error("Error al aprobar trueque:", e);
            toast.error('Error al aprobar', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleRejectBarter = async (id: string) => {
        if (!isAdmin) return;
        if (!confirm("¿Estás seguro de rechazar este trueque?")) return;
        try {
            setLoading(true);
            await InventoryService.rejectBarterTransfer(id);
            setIsBarterDetailOpen(false);
            loadData();
        } catch (e: any) {
            console.error("Error al rechazar trueque:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDispatch = async (barterId: string) => {
        if (!confirm("¿Confirmar que los productos ya fueron enviados?")) return;
        try {
            setLoading(true);
            await InventoryService.confirmBarterDispatch(barterId, user.id);
            setIsBarterDetailOpen(false);
            loadData();
            toast.success('Envío confirmado', 'El trueque está en tránsito. Esperando confirmación de recepción.');
        } catch (e: any) {
            toast.error('Error al confirmar envío', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReception = async (barterId: string) => {
        if (!confirm("¿Confirmar la recepción de los productos? El inventario se actualizará en este momento.")) return;
        try {
            setLoading(true);
            await InventoryService.confirmBarterReception(barterId, user.id);
            setIsBarterDetailOpen(false);
            loadData();
            toast.success('Trueque completado', 'El inventario de ambas sucursales ha sido actualizado.');
        } catch (e: any) {
            toast.error('Error al confirmar recepción', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleLoadSuggestions = async () => {
        if (!toBranchId) {
            toast.warning('Selecciona sucursal destino', 'Elige primero la sucursal con la que quieres hacer el trueque.');
            return;
        }
        try {
            setLoadingSuggestions(true);
            const result = await InventoryService.suggestBarterItems(fromBranchId, toBranchId);
            setSuggestions(result);
            if (result.length === 0) {
                toast.info('Sin sugerencias', 'No hay excedentes claros entre tu sucursal y la destino.');
            }
        } catch (e: any) {
            toast.error('Error al cargar sugerencias', e.message || e.toString());
        } finally {
            setLoadingSuggestions(false);
        }
    };

    // Shipping Functions
    const handleViewShipping = async (entityType: 'stock_transfer' | 'barter_transfer' | 'restock_sheet', entityId: string) => {
        try {
            const shipping = await ShippingService.getShippingByEntity(entityType, entityId);
            setShippingOrder(shipping);
        } catch (e) {
            console.error("Error al obtener shipping:", e);
            setShippingOrder(null);
        }
    };

    const handleCreateShipping = async (entityType: 'stock_transfer' | 'barter_transfer', entityId: string, originId: string, destId: string) => {
        if (!shippingCarrier || !shippingTrackingNumber) {
            toast.warning('Datos incompletos', 'Ingrese paquetería y número de guía.');
            return;
        }
        try {
            setLoading(true);
            const shippingId = await ShippingService.createShippingOrder({
                entityType,
                entityId,
                originBranchId: originId,
                destinationBranchId: destId,
                createdBy: user.id,
                carrier: shippingCarrier,
                trackingNumber: shippingTrackingNumber,
                notes: shippingNotes
            });
            await ShippingService.updateShippingStatus({
                shippingId,
                newStatus: 'shipped',
                carrier: shippingCarrier,
                trackingNumber: shippingTrackingNumber,
                notes: shippingNotes
            });
            setIsShippingModalOpen(false);
            setShippingCarrier('');
            setShippingTrackingNumber('');
            setShippingNotes('');
            loadData();
            toast.success('Envío registrado', 'El seguimiento ha sido creado correctamente.');
        } catch (e: any) {
            toast.error('Error al crear envío', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateShippingStatus = async (shippingId: string, newStatus: 'in_transit' | 'delivered') => {
        try {
            setLoading(true);
            await ShippingService.updateShippingStatus({
                shippingId,
                newStatus,
                notes: newStatus === 'delivered' ? 'Entregado al destinatario' : 'En tránsito'
            });
            setShippingOrder(null);
            loadData();
        } catch (e: any) {
            toast.error('Error al actualizar envío', e.message || e.toString());
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    );

    const pagedTransfers = transfers.slice(transferPage * PAGE_SIZE, (transferPage + 1) * PAGE_SIZE);
    const transferTotalPages = Math.ceil(transfers.length / PAGE_SIZE);

    const handleExportTransfers = () => {
        exportToCSV(
            `traspasos-${new Date().toISOString().split('T')[0]}.csv`,
            transfers,
            [
                { key: 'folio', label: 'Folio' },
                { key: 'fromBranchName', label: 'Origen' },
                { key: 'toBranchName', label: 'Destino' },
                { key: 'status', label: 'Estado' },
                { key: 'createdAt', label: 'Fecha' }
            ]
        );
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full">
                <header className="min-h-[4rem] flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-3 flex-wrap gap-2 shrink-0">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
                        Traspasos
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nuevo Traspaso', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' },
                                { key: 'barter_pending', label: 'Ofertas Pendientes', icon: 'inbox', badge: pendingBarters.length },
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => { setActiveTab(tab.key as any); setIsDetailModalOpen(false); setIsBarterDetailOpen(false); setIsSelectionModalOpen(false); }}
                                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all relative ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>{tab.label}
                                    {'badge' in tab && tab.badge > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center">{tab.badge}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {activeTab === 'history' ? (
                    <>
                        {/* Historial Unificado (Traspasos + Trueques) */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <button onClick={() => { setTransferPage(0); loadData(startDate, endDate); }} className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">Filtrar</button>
                            <button onClick={handleExportTransfers} disabled={transfers.length === 0} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-40">
                                <span className="material-symbols-outlined text-sm">download</span>
                                Exportar CSV
                            </button>
                            {/* Sub-filtro Traspasos/Trueques */}
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 ml-auto gap-0.5">
                                {(['all', 'transfers', 'barters'] as const).map(f => (
                                    <button key={f} onClick={() => setHistoryFilter(f)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${historyFilter === f ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                        {f === 'all' ? 'Todos' : f === 'transfers' ? 'Traspasos' : 'Trueques'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-6 py-5">Tipo</th>
                                                <th className="px-6 py-5">Folio</th>
                                                <th className="px-6 py-5">Origen</th>
                                                <th className="px-6 py-5">Destino</th>
                                                <th className="px-6 py-5 text-center">Estado</th>
                                                <th className="px-6 py-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {[
                                                ...(historyFilter !== 'barters' ? transfers.map(t => ({ type: 'transfer' as const, data: t, date: t.createdAt })) : []),
                                                ...(historyFilter !== 'transfers' ? barters.map(b => ({ type: 'barter' as const, data: b, date: b.createdAt })) : []),
                                            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map(item => item.type === 'transfer' ? (
                                                <tr key={`t-${item.data.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-[9px] font-black uppercase">
                                                            <span className="material-symbols-outlined text-[11px]">local_shipping</span>
                                                            Traspaso
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-primary">#T-{(item.data as StockTransfer).folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{(item.data as StockTransfer).fromBranchName}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{(item.data as StockTransfer).toBranchName}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${(item.data as StockTransfer).status === 'completed' ? 'bg-green-500/10 text-green-500' : (item.data as StockTransfer).status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                            {(item.data as StockTransfer).status === 'pending' ? 'Pendiente' : (item.data as StockTransfer).status === 'in_transit' ? 'En Tránsito' : (item.data as StockTransfer).status === 'completed' ? 'Completado' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => handleViewTransfer(item.data as StockTransfer)} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <tr key={`b-${item.data.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 rounded-lg text-[9px] font-black uppercase">
                                                            <span className="material-symbols-outlined text-[11px]">swap_horiz</span>
                                                            Trueque
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-primary">#B-{(item.data as BarterTransfer).folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{(item.data as BarterTransfer).fromBranchName}</td>
                                                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{(item.data as BarterTransfer).toBranchName}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <Badge variant={getStatusColor((item.data as BarterTransfer).status)} size="sm">{translateStatus((item.data as BarterTransfer).status)}</Badge>
                                                        {((item.data as BarterTransfer).status === 'approved' || (item.data as BarterTransfer).status === 'in_transit') && (
                                                            <span className="ml-1 inline-flex items-center gap-0.5 text-[8px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
                                                                <span className="material-symbols-outlined text-[9px]">lock</span>Reservado
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right flex items-center gap-2 justify-end">
                                                        {(item.data as BarterTransfer).status === 'approved' && (item.data as BarterTransfer).fromBranchId === branchId && (
                                                            <button onClick={() => handleConfirmDispatch(item.data.id)} className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 transition-all flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-sm">local_shipping</span>
                                                                Enviar
                                                            </button>
                                                        )}
                                                        {(item.data as BarterTransfer).status === 'in_transit' && (item.data as BarterTransfer).toBranchId === branchId && (
                                                            <button onClick={() => handleConfirmReception(item.data.id)} className="px-3 py-1.5 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-green-600 transition-all flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-sm">inventory_2</span>
                                                                Recibir
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleViewBarter(item.data as BarterTransfer)} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                ) : activeTab === 'barter_pending' ? (
                    <>
                        {/* Ofertas de Trueque Pendientes */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{pendingBarters.length} oferta{pendingBarters.length !== 1 ? 's' : ''} pendiente{pendingBarters.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-6">
                                {pendingBarters.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] p-12 text-center">
                                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">inbox</span>
                                        <p className="text-slate-400 font-bold">No hay ofertas de trueque pendientes</p>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <th className="px-8 py-5">Folio</th>
                                                    <th className="px-8 py-5">Sucursal Origen</th>
                                                    <th className="px-8 py-5 text-center">Estado</th>
                                                    <th className="px-8 py-5 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {pendingBarters.map(b => (
                                                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                        <td className="px-8 py-5 font-black text-primary">#B-{b.folio.toString().padStart(4, '0')}</td>
                                                        <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{b.fromBranchName}</td>
                                                        <td className="px-8 py-5 text-center">
                                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                                                b.status === 'counter_proposed' ? 'bg-orange-500/10 text-orange-500' : 'bg-amber-500/10 text-amber-500'
                                                            }`}>
                                                                {b.status === 'counter_proposed' ? 'Contra-Oferta' : 'Esperando Selección'}
                                                            </span>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <button onClick={() => handleViewPendingBarter(b)} className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all">
                                                                Ver Inventario
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Mobile panel switcher */}
                        <div className="flex md:hidden bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mx-3 mt-3 gap-1 shrink-0">
                            {(['give', 'browse', 'receive'] as const).map(panel => (
                                <button key={panel} onClick={() => setMobilePanel(panel)}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mobilePanel === panel ? (panel === 'give' ? 'bg-amber-100 text-amber-700' : panel === 'receive' ? 'bg-blue-100 text-blue-700' : 'bg-white text-primary shadow-sm') : 'text-slate-400'}`}>
                                    {panel === 'give' ? `Doy (${cart.length})` : panel === 'browse' ? 'Productos' : `Recibo (${receivedCart.length})`}
                                </button>
                            ))}
                        </div>

                        {/* Top bar: Sucursal origen (admin) + destino + mode badge */}
                        <div className="mx-3 md:mx-8 mt-3 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-3 shadow-sm shrink-0">
                            {isAdmin && (
                                <div className="flex-1 min-w-[200px] max-w-xs">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Sucursal Origen</label>
                                    <select
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm"
                                        value={adminFromBranchId}
                                        onChange={e => {
                                            setAdminFromBranchId(e.target.value);
                                            setCart([]);
                                            setReceivedCart([]);
                                            setToBranchId('');
                                            if (e.target.value) {
                                                InventoryService.getProductsByBranch(e.target.value)
                                                    .then(setProducts)
                                                    .catch(console.error);
                                            } else {
                                                setProducts([]);
                                            }
                                        }}
                                    >
                                        <option value="">Seleccionar origen...</option>
                                        {allBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="flex-1 min-w-[200px] max-w-xs">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Sucursal Destino</label>
                                <select
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm text-primary"
                                    value={toBranchId}
                                    onChange={e => setToBranchId(e.target.value)}
                                >
                                    <option value="">Seleccionar...</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div className="shrink-0">
                                {isBarter ? (
                                    <span className="px-3 py-1.5 bg-gradient-to-r from-amber-500/10 to-blue-500/10 border border-amber-200 dark:border-amber-800 rounded-full text-[10px] font-black text-amber-600 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                        Modo: Trueque
                                    </span>
                                ) : (
                                    <span className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                                        Modo: Traspaso
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 3-column split view body */}
                        <div className="flex-1 flex flex-col md:flex-row mx-3 md:mx-8 my-3 gap-3 overflow-hidden min-h-0">

                            {/* LEFT: Lo que Doy */}
                            <div className={`w-full md:w-72 lg:w-80 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border-2 border-amber-200 dark:border-amber-900/40 overflow-hidden shrink-0 ${mobilePanel !== 'give' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-900/30 shrink-0">
                                    <h3 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                        Lo que Doy
                                    </h3>
                                    <p className="text-[9px] text-amber-500 mt-0.5">{cart.length === 0 ? 'Sin productos' : `${cart.length} producto(s)`}</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400">
                                            <span className="material-symbols-outlined text-4xl mb-2 block">inventory_2</span>
                                            <p className="text-[10px] font-bold">Agrega productos<br/>con "Doy"</p>
                                        </div>
                                    ) : cart.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 p-2.5 bg-amber-50/70 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold truncate">{item.name}</p>
                                                <p className="text-[9px] text-slate-400">{item.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded text-xs font-black hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors">-</button>
                                                <span className="text-[10px] font-black w-5 text-center">{item.quantity}</span>
                                                <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded text-xs font-black hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors">+</button>
                                                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 ml-1"><span className="material-symbols-outlined text-sm">close</span></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* CENTER: Products browser */}
                            <div className={`flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 overflow-hidden min-w-0 ${mobilePanel !== 'browse' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-4 border-b dark:border-slate-800 shrink-0">
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm">search</span>
                                        <input
                                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/10 transition-all"
                                            placeholder="Buscar producto..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 xl:grid-cols-3 gap-3 content-start custom-scrollbar">
                                    {filteredProducts.map(p => {
                                        const stock = p.inventory[branchId] || 0;
                                        const inGiveCart = cart.some(c => c.id === p.id);
                                        const inReceiveCart = receivedCart.some(c => c.id === p.id);
                                        return (
                                            <div key={p.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-lg transition-all group flex flex-col">
                                                <div className="h-14 w-full flex-shrink-0 bg-white dark:bg-slate-700 rounded-xl p-1.5 mb-2 mx-auto">
                                                    <img src={p.image} className="w-full h-full object-contain" alt={p.name} />
                                                </div>
                                                <p className="font-black text-[10px] text-slate-800 dark:text-white line-clamp-2 mb-1 flex-1">{p.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mb-1 uppercase">{p.sku}</p>
                                                <p className="text-[9px] font-black text-slate-400 mb-2">Stock: <span className={stock > 0 ? 'text-primary' : 'text-red-400'}>{stock}</span></p>
                                                <div className="flex gap-1.5">
                                                    <button
                                                        onClick={() => addToCart(p)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 flex items-center justify-center gap-0.5 ${inGiveCart ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-xs">arrow_back</span>
                                                        Doy
                                                    </button>
                                                    <button
                                                        onClick={() => addToReceivedCart(p)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 flex items-center justify-center gap-0.5 ${inReceiveCart ? 'bg-blue-500 text-white' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500 hover:text-white'}`}
                                                    >
                                                        Recibo
                                                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* RIGHT: Lo que Recibo */}
                            <div className={`w-full md:w-72 lg:w-80 flex flex-col bg-white dark:bg-slate-800 rounded-2xl border-2 border-blue-200 dark:border-blue-900/40 overflow-hidden shrink-0 ${mobilePanel !== 'receive' ? 'hidden md:flex' : 'flex'}`}>
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-900/30 shrink-0">
                                    <h3 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                                        Lo que Recibo
                                    </h3>
                                    <p className="text-[9px] text-blue-500 mt-0.5">{receivedCart.length === 0 ? 'Opcional — convierte en Trueque' : `${receivedCart.length} producto(s)`}</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                    {receivedCart.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <span className="material-symbols-outlined text-3xl mb-2 block">swap_horiz</span>
                                            <p className="text-[10px] font-bold">Solo dar = Traspaso.<br/>Agrega aquí para<br/>convertir en Trueque.</p>
                                        </div>
                                    ) : receivedCart.map(item => (
                                        <div key={item.id} className="flex items-center gap-2 p-2.5 bg-blue-50/70 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold truncate">{item.name}</p>
                                                <p className="text-[9px] text-slate-400">{item.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={() => updateReceivedQty(item.id, item.quantity - 1)} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded text-xs font-black hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">-</button>
                                                <span className="text-[10px] font-black w-5 text-center">{item.quantity}</span>
                                                <button onClick={() => updateReceivedQty(item.id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center bg-slate-200 dark:bg-slate-700 rounded text-xs font-black hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">+</button>
                                                <button onClick={() => removeFromReceivedCart(item.id)} className="text-red-400 hover:text-red-600 ml-1"><span className="material-symbols-outlined text-sm">close</span></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Suggestions */}
                                <div className="p-3 border-t border-blue-100 dark:border-blue-900/30 space-y-2 shrink-0">
                                    <button
                                        onClick={handleLoadSuggestions}
                                        disabled={loadingSuggestions || !toBranchId}
                                        className="w-full py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 font-black rounded-xl text-[9px] uppercase hover:bg-amber-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                    >
                                        <span className="material-symbols-outlined text-sm">lightbulb</span>
                                        {loadingSuggestions ? 'Calculando...' : 'Sugerencias automáticas'}
                                    </button>
                                    {suggestions.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-[9px] font-black uppercase text-amber-600 tracking-widest">Excedentes sugeridos</p>
                                            {suggestions.slice(0, 5).map(s => {
                                                const alreadyInCart = cart.some(c => c.id === s.productId);
                                                return (
                                                    <div key={s.productId} className="flex items-center justify-between p-2 bg-amber-50/60 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <p className="text-[9px] font-bold truncate">{s.productName}</p>
                                                            <p className="text-[8px] text-slate-400 font-mono">{s.productSku} · +{s.surplus}</p>
                                                        </div>
                                                        {!alreadyInCart ? (
                                                            <button onClick={() => { const product = products.find(p => p.id === s.productId); if (product) addToCart(product); }} className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-amber-600 transition-all shrink-0">Agregar</button>
                                                        ) : (
                                                            <span className="text-[9px] text-green-500 font-black shrink-0">✓</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom bar: Notes + Submit */}
                        <div className="mx-3 md:mx-8 mb-3 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-3 shadow-sm shrink-0">
                            <textarea
                                className="flex-1 min-w-[140px] p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium resize-none h-11"
                                placeholder="Notas..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                            <button
                                onClick={isBarter ? handleBarterSubmit : handleSubmit}
                                disabled={loading || !toBranchId || cart.length === 0}
                                className={`px-8 py-3 font-black rounded-2xl shadow-xl uppercase text-xs tracking-wide hover:scale-[1.02] transition-all disabled:opacity-50 ${isBarter ? 'bg-gradient-to-r from-amber-500 to-blue-500 text-white' : 'bg-primary text-white'}`}
                            >
                                {isBarter ? (
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                        Enviar Trueque ({cart.length} → {receivedCart.length})
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                                        Confirmar Traspaso ({cart.length} producto{cart.length !== 1 ? 's' : ''})
                                    </span>
                                )}
                            </button>
                        </div>
                    </>
                )}

                {/* Modal Detalles del Traspaso */}
                {isDetailModalOpen && selectedTransfer && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">local_shipping</span>
                                        Detalle de Traspaso #T-{selectedTransfer.folio.toString().padStart(4, '0')}
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium mt-1">
                                        Creado el {new Date(selectedTransfer.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6 flex-1">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-800">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Origen</span>
                                        <p className="font-bold text-slate-800 dark:text-white">{selectedTransfer.fromBranchName}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border dark:border-slate-800">
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Destino</span>
                                        <p className="font-bold text-slate-800 dark:text-white">{selectedTransfer.toBranchName}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2 uppercase tracking-widest">
                                        <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                                        Materiales Trasladados
                                    </h4>
                                    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <th className="px-4 py-3">Producto</th>
                                                    <th className="px-4 py-3 text-center">SKU</th>
                                                    <th className="px-4 py-3 text-right">Cantidad</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {selectedTransfer.items?.map((item: any) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-10 bg-slate-100 dark:bg-slate-700 rounded-xl p-1 flex-shrink-0">
                                                                    {item.productImage ? (
                                                                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-contain" />
                                                                    ) : (
                                                                        <span className="material-symbols-outlined text-slate-300 mx-auto mt-1 block">image</span>
                                                                    )}
                                                                </div>
                                                                <span className="font-bold text-sm text-slate-800 dark:text-white">{item.productName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-center text-xs font-bold text-slate-400">{item.productSku}</td>
                                                        <td className="px-4 py-4 text-right">
                                                            <span className="font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-lg text-sm">{item.quantity}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {selectedTransfer.notes && (
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl">
                                        <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest block mb-2">Notas / Observaciones</p>
                                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">{selectedTransfer.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Detalles del Trueque */}
                {isBarterDetailOpen && selectedBarter && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">swap_horiz</span>
                                        Detalle de Trueque #B-{selectedBarter.folio.toString().padStart(4, '0')}
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-2">
                                        Estado: <Badge variant={getStatusColor(selectedBarter.status)} size="sm">{translateStatus(selectedBarter.status)}</Badge>
                                        {(selectedBarter.status === 'approved' || selectedBarter.status === 'in_transit') && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                                <span className="material-symbols-outlined text-[10px]">lock</span>
                                                Stock Reservado
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <button onClick={() => setIsBarterDetailOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-8">
                                {/* Stepper de estado */}
                                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                                    {[
                                        { key: 'pending_offer', label: 'Oferta' },
                                        { key: 'pending_approval', label: 'Aprobación' },
                                        { key: 'approved', label: 'Aprobado' },
                                        { key: 'in_transit', label: 'En Tránsito' },
                                        { key: 'completed', label: 'Completado' },
                                    ].map((step, i, arr) => {
                                        const statusOrder = ['pending_offer', 'counter_proposed', 'pending_selection', 'pending_approval', 'approved', 'in_transit', 'completed'];
                                        const currentIdx = statusOrder.indexOf(selectedBarter.status);
                                        const stepIdx = statusOrder.indexOf(step.key);
                                        const isDone = currentIdx > stepIdx;
                                        const isCurrent = currentIdx === stepIdx || (step.key === 'pending_approval' && ['counter_proposed', 'pending_selection'].includes(selectedBarter.status));
                                        return (
                                            <React.Fragment key={step.key}>
                                                <div className={`flex flex-col items-center min-w-[72px] text-center ${isDone ? 'text-green-500' : isCurrent ? 'text-primary' : 'text-slate-300 dark:text-slate-600'}`}>
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 mb-1 ${isDone ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : isCurrent ? 'border-primary bg-primary/10' : 'border-slate-200 dark:border-slate-700'}`}>
                                                        {isDone ? <span className="material-symbols-outlined text-sm">check</span> : i + 1}
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-wide leading-tight">{step.label}</span>
                                                </div>
                                                {i < arr.length - 1 && (
                                                    <div className={`flex-1 h-0.5 mt-3.5 ${isDone ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Lo que Entrega */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                            {selectedBarter.fromBranchName} Entrega
                                        </h4>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800 overflow-hidden text-xs">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-100 dark:bg-slate-900">
                                                    <tr className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                                                        <th className="px-4 py-3">Producto</th>
                                                        <th className="px-4 py-3 text-right">Cant.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-slate-800">
                                                    {selectedBarter.givenItems?.map((item: any) => (
                                                        <tr key={item.id}>
                                                            <td className="px-4 py-3 font-bold">{item.productName}</td>
                                                            <td className="px-4 py-3 text-right font-black">{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Lo que Recibe */}
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">arrow_downward</span>
                                            {selectedBarter.fromBranchName} Recibe de {selectedBarter.toBranchName}
                                        </h4>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800 overflow-hidden text-xs">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-100 dark:bg-slate-900">
                                                    <tr className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                                                        <th className="px-4 py-3">Producto</th>
                                                        <th className="px-4 py-3 text-right">Cant.</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y dark:divide-slate-800">
                                                    {selectedBarter.receivedItems?.map((item: any) => (
                                                        <tr key={item.id}>
                                                            <td className="px-4 py-3 font-bold">{item.productName}</td>
                                                            <td className="px-4 py-3 text-right font-black">{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {selectedBarter.notes && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-800">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Notas / Observaciones</p>
                                        <p className="text-sm font-medium">{selectedBarter.notes}</p>
                                    </div>
                                )}
                            </div>

                            {isAdmin && selectedBarter.status === 'pending_approval' && (
                                <div className="p-6 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex gap-4">
                                    <button onClick={() => handleRejectBarter(selectedBarter.id)} className="flex-1 py-4 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/30 text-red-500 font-black rounded-2xl text-[10px] uppercase hover:bg-red-50 transition-colors">
                                        Rechazar
                                    </button>
                                    <button onClick={() => handleApproveBarter(selectedBarter.id)} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl text-[10px] uppercase shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                                        Aprobar y Reservar Stock
                                    </button>
                                </div>
                            )}
                            {selectedBarter.status === 'approved' && selectedBarter.fromBranchId === branchId && (
                                <div className="p-6 border-t dark:border-slate-700 bg-blue-50 dark:bg-blue-900/10 flex gap-4">
                                    <p className="flex-1 text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">lock</span>
                                        El stock está reservado. Confirma cuando hayas despachado la mercancía.
                                    </p>
                                    <button onClick={() => handleConfirmDispatch(selectedBarter.id)} disabled={loading} className="px-6 py-3 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                                        Confirmar Envío
                                    </button>
                                </div>
                            )}
                            {selectedBarter.status === 'in_transit' && selectedBarter.toBranchId === branchId && (
                                <div className="p-6 border-t dark:border-slate-700 bg-green-50 dark:bg-green-900/10 flex gap-4">
                                    <p className="flex-1 text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">local_shipping</span>
                                        Los productos están en camino. Confirma la recepción para finalizar el trueque.
                                    </p>
                                    <button onClick={() => handleConfirmReception(selectedBarter.id)} disabled={loading} className="px-6 py-3 bg-green-600 text-white font-black rounded-2xl text-[10px] uppercase shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                                        Confirmar Recepción
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Modal de Selección de Trueque Bidireccional */}
                {isSelectionModalOpen && barterWithInventory && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in max-h-[90vh]">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 shrink-0">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">swap_horiz</span>
                                        Seleccionar Productos del Trueque #B-{barterWithInventory.folio?.toString().padStart(4, '0')}
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium mt-1">
                                        {barterWithInventory.fromBranchName} ofrece productos. Selecciona qué deseas recibir de su inventario.
                                    </p>
                                </div>
                                <button onClick={() => { setIsSelectionModalOpen(false); setSelectionCart([]); }} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Productos ofrecidos */}
                                <div className="flex-1 overflow-y-auto p-6 border-r dark:border-slate-700">
                                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-4">
                                        Productos que {barterWithInventory.fromBranchName} Ofrece
                                    </h4>
                                    <div className="space-y-2">
                                        {barterWithInventory.givenItems?.map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                                <span className="text-xs font-bold">{item.productName}</span>
                                                <span className="text-xs font-black text-amber-600">x{item.quantity}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 mt-8">
                                        Inventario Disponible de {barterWithInventory.fromBranchName}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {barterWithInventory.offeredProducts?.filter((p: any) => p.stock > 0).map((p: any) => (
                                            <div key={p.productId} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border dark:border-slate-800">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold truncate pr-2">{p.productName}</span>
                                                    <span className="text-[10px] font-black text-primary bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">Stock: {p.stock}</span>
                                                </div>
                                                <button 
                                                    onClick={() => addToSelectionCart(p.productId, p.productName, p.stock)}
                                                    className="w-full py-2 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all"
                                                >
                                                    Agregar a Selección
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Carrito de selección */}
                                <div className="w-80 flex flex-col bg-slate-50 dark:bg-slate-900/50 shrink-0">
                                    <div className="flex-1 overflow-y-auto p-6">
                                        <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">
                                            Tu Selección (lo que recibirás)
                                        </h4>
                                        <div className="space-y-2">
                                            {selectionCart.length === 0 ? (
                                                <p className="text-xs text-slate-400 text-center py-4">No has seleccionado productos</p>
                                            ) : (
                                                selectionCart.map(s => (
                                                    <div key={s.productId} className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                                        <span className="text-xs font-bold truncate pr-2">{s.productName}</span>
                                                        <div className="flex items-center gap-2">
                                                            <input 
                                                                type="number" 
                                                                value={s.quantity} 
                                                                onChange={(e) => {
                                                                    const product = barterWithInventory.offeredProducts?.find((p: any) => p.productId === s.productId);
                                                                    if (product) {
                                                                        updateSelectionQty(s.productId, parseInt(e.target.value) || 0, product.stock);
                                                                    }
                                                                }}
                                                                className="w-14 px-2 py-1 text-center text-xs font-bold bg-white dark:bg-slate-800 rounded border dark:border-slate-700"
                                                                min="1"
                                                            />
                                                            <button onClick={() => removeFromSelectionCart(s.productId)} className="text-red-500">
                                                                <span className="material-symbols-outlined text-sm">close</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="mt-6">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Notas (opcional)</label>
                                            <textarea
                                                className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 text-xs resize-none h-20"
                                                placeholder="Agregar notas..."
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="p-6 border-t dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3 shrink-0">
                                        <button
                                            onClick={handleSelectBarterItems}
                                            disabled={loading || selectionCart.length === 0}
                                            className="w-full py-3 bg-primary text-white font-black rounded-2xl text-[10px] uppercase shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50"
                                        >
                                            Enviar Selección
                                        </button>
                                        <button
                                            onClick={handleCounterOffer}
                                            disabled={loading}
                                            className="w-full py-3 bg-orange-500 text-white font-black rounded-2xl text-[10px] uppercase hover:bg-orange-600 transition-all disabled:opacity-50"
                                        >
                                            Enviar como Contra-Oferta
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Shipping Modal */}
                {isShippingModalOpen && selectedTransfer && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
                                <h3 className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined">local_shipping</span>
                                    Registrar Envío
                                </h3>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Traspaso #T-{selectedTransfer.folio.toString().padStart(4, '0')}
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                        Paquetería
                                    </label>
                                    <select
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                        value={shippingCarrier}
                                        onChange={e => setShippingCarrier(e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {CARRIER_OPTIONS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                        Número de Guía
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                        value={shippingTrackingNumber}
                                        onChange={e => setShippingTrackingNumber(e.target.value)}
                                        placeholder="Ej: 1234567890"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                        Notas (opcional)
                                    </label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border dark:border-slate-700 h-20 resize-none"
                                        value={shippingNotes}
                                        onChange={e => setShippingNotes(e.target.value)}
                                        placeholder="Observaciones del envío..."
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={() => { setIsShippingModalOpen(false); setShippingCarrier(''); setShippingTrackingNumber(''); setShippingNotes(''); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleCreateShipping('stock_transfer', selectedTransfer.id, selectedTransfer.fromBranchId, selectedTransfer.toBranchId)}
                                    disabled={loading || !shippingCarrier || !shippingTrackingNumber}
                                    className="flex-1 py-3 bg-primary text-white font-black rounded-2xl uppercase text-xs shadow-lg disabled:opacity-50"
                                >
                                    {loading ? 'Guardando...' : 'Registrar Envío'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Transfers;
