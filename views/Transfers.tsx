
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, StockTransfer, UserRole, CartItem, BarterTransfer, BarterItem, BarterSelection, ShippingOrder } from '../types';
import { InventoryService } from '../services/inventoryService';
import { ShippingService, CARRIER_OPTIONS, SHIPPING_STATUS_LABELS } from '../services/shippingService';
import { exportToCSV } from '../utils/csvExport';

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
    const [activeTab, setActiveTab] = useState<'new' | 'history' | 'barter_new' | 'barter_history' | 'barter_pending'>('new');
    const [search, setSearch] = useState('');
    const [toBranchId, setToBranchId] = useState('');
    const [notes, setNotes] = useState('');

    // Shipping States
    const [shippingOrder, setShippingOrder] = useState<ShippingOrder | null>(null);
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    const [shippingCarrier, setShippingCarrier] = useState('');
    const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
    const [shippingNotes, setShippingNotes] = useState('');

    const isAdmin = user.role === UserRole.ADMIN;
    const branchId = user.branchId || 'BR-MAIN';

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
                InventoryService.getProductsByBranch(branchId),
                InventoryService.getBranches()
            ]);
            
            // Cargar ofertas pendientes si el usuario puede verlas
            if (user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB || user.role === UserRole.STORE_MANAGER || isAdmin) {
                try {
                    const pending = await InventoryService.getPendingBarterOffers(branchId);
                    setPendingBarters(pending);
                } catch (e) {
                    console.error("No se pudieron cargar ofertas pendientes:", e);
                }
            }
            
            setTransfers(t);
            setBarters(b_trans);
            setProducts(p);
            setBranches(b.filter(branch => branch.id !== branchId));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (p: Product) => {
        const available = p.inventory[branchId] || 0;
        const existing = cart.find(item => item.id === p.id);
        const currentQty = existing ? existing.quantity : 0;
        if (currentQty + 1 > available) {
            alert(`No hay suficiente stock disponible. Stock actual: ${available}`);
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
        const available = product ? product.inventory[branchId] || 0 : Infinity;
        const clamped = Math.max(0, Math.min(qty, available));
        setCart(cart.map(item => item.id === id ? { ...item, quantity: clamped } : item));
    };

    const handleSubmit = async () => {
        if (cart.length === 0 || !toBranchId) return;
        try {
            setLoading(true);
            const items = cart.map(c => ({
                productId: c.id,
                quantity: c.quantity
            }));
            await InventoryService.createStockTransfer(branchId, toBranchId, notes, items);
            setIsModalOpen(false);
            setActiveTab('history');
            setCart([]);
            setToBranchId('');
            setNotes('');
            loadData();
            alert("Traspaso iniciado correctamente.");
        } catch (e: any) {
            console.error("Error en createStockTransfer:", e);
            alert("Error al crear traspaso: " + (e.message || e.toString()));
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
            alert("Error al obtener los detalles: " + (e.message || e.toString()));
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
            alert("Error al obtener los detalles del trueque: " + (e.message || e.toString()));
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
            alert("Error al obtener los detalles del trueque: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleBarterSubmit = async () => {
        if (cart.length === 0 || !toBranchId) {
            alert("Agrega productos a dar y selecciona una sucursal destino.");
            return;
        }
        try {
            setLoading(true);
            await InventoryService.createBarterOffer({
                fromBranchId: branchId,
                toBranchId: toBranchId,
                requestedBy: user.id,
                notes: notes,
                givenItems: cart.map(c => ({ productId: c.id, quantity: c.quantity }))
            });
            setActiveTab('barter_history');
            setCart([]);
            setReceivedCart([]);
            setToBranchId('');
            setNotes('');
            loadData();
            alert("Oferta de trueque enviada correctamente. La sucursal destino seleccionará qué productos desea recibir.");
        } catch (e: any) {
            console.error("Error en createBarterOffer:", e);
            alert("Error al crear oferta de trueque: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleSelectBarterItems = async () => {
        if (!selectedBarter || selectionCart.length === 0) {
            alert("Selecciona al menos un producto del inventario del solicitante.");
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
            alert("Selección enviada. El administrador revisará la solicitud.");
        } catch (e: any) {
            console.error("Error al seleccionar items:", e);
            alert("Error al enviar selección: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleCounterOffer = async () => {
        if (!selectedBarter || selectionCart.length === 0) {
            alert("Agrega productos a tu contra-oferta.");
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
            alert("Contra-oferta enviada correctamente.");
        } catch (e: any) {
            console.error("Error al enviar contra-oferta:", e);
            alert("Error al enviar contra-oferta: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const addToSelectionCart = (productId: string, productName: string, maxQty: number) => {
        const existing = selectionCart.find(s => s.productId === productId);
        if (existing) {
            if (existing.quantity + 1 > maxQty) {
                alert(`No puedes seleccionar más de ${maxQty} unidades.`);
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
        if (!confirm("¿Estás seguro de aprobar este trueque? El inventario se ajustará automáticamente.")) return;
        try {
            setLoading(true);
            await InventoryService.approveBarterTransfer(id, user.id);
            setIsBarterDetailOpen(false);
            loadData();
            alert("Trueque aprobado y procesado correctamente.");
        } catch (e: any) {
            console.error("Error al aprobar trueque:", e);
            alert("Error al aprobar: " + (e.message || e.toString()));
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
            alert("Ingrese paquetería y número de guía");
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
            alert("Envío registrado correctamente");
        } catch (e: any) {
            alert("Error al crear envío: " + (e.message || e.toString()));
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
            alert("Error al actualizar envío: " + (e.message || e.toString()));
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
                                { key: 'barter_new', label: 'Nuevo Trueque', icon: 'swap_horiz' },
                                { key: 'barter_pending', label: 'Ofertas Pendientes', icon: 'inbox', badge: pendingBarters.length },
                                { key: 'barter_history', label: 'Historial Trueques', icon: 'history_edu' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
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
                        {/* Historial de Traspasos (Existente) */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            {/* ... (Contenido de filtros existente) */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <button onClick={() => { setTransferPage(0); loadData(startDate, endDate); }} className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">Filtrar</button>
                            <button
                                onClick={handleExportTransfers}
                                disabled={transfers.length === 0}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-40"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                Exportar CSV
                            </button>
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{transfers.length} traspaso{transfers.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-8 py-5">Folio</th>
                                                <th className="px-8 py-5">Origen</th>
                                                <th className="px-8 py-5">Destino</th>
                                                <th className="px-8 py-5 text-center">Estado</th>
                                                <th className="px-8 py-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {pagedTransfers.map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-8 py-5 font-black text-primary">#T-{t.folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{t.fromBranchName}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{t.toBranchName}</td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${t.status === 'completed' ? 'bg-green-500/10 text-green-500' : t.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                            {t.status === 'pending' ? 'Pendiente' : t.status === 'in_transit' ? 'En Tránsito' : t.status === 'completed' ? 'Completado' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <button onClick={() => handleViewTransfer(t)} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {transfers.length > PAGE_SIZE && (
                                        <div className="flex items-center justify-between px-8 py-4 border-t dark:border-slate-700">
                                            <button
                                                disabled={transferPage === 0}
                                                onClick={() => setTransferPage(p => p - 1)}
                                                className="px-4 py-2 text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                ← Anterior
                                            </button>
                                            <span className="text-xs font-bold text-slate-400">
                                                Página {transferPage + 1} de {transferTotalPages} · {transfers.length} traspasos
                                            </span>
                                            <button
                                                disabled={(transferPage + 1) * PAGE_SIZE >= transfers.length}
                                                onClick={() => setTransferPage(p => p + 1)}
                                                className="px-4 py-2 text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                Siguiente →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : activeTab === 'barter_history' ? (
                    <>
                        {/* Historial de Trueques */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{barters.length} trueque{barters.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-8 py-5">Folio</th>
                                                <th className="px-8 py-5">Sucursal</th>
                                                <th className="px-8 py-5 text-center">Estado</th>
                                                <th className="px-8 py-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {barters.map(b => (
                                                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-8 py-5 font-black text-primary">#B-{b.folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">
                                                        {b.fromBranchId === branchId ? b.toBranchName : b.fromBranchName}
                                                        <span className="ml-2 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[9px] text-slate-400 uppercase">
                                                            {b.fromBranchId === branchId ? 'Solicitado' : 'Recibido'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                                            b.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                            b.status === 'rejected' || b.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                                            b.status === 'approved' ? 'bg-blue-500/10 text-blue-500' :
                                                            b.status === 'pending_approval' ? 'bg-purple-500/10 text-purple-500' :
                                                            b.status === 'counter_proposed' ? 'bg-orange-500/10 text-orange-500' :
                                                            'bg-amber-500/10 text-amber-500'
                                                        }`}>
                                                            {b.status === 'pending_offer' ? 'Oferta Enviada' : 
                                                             b.status === 'pending_selection' ? 'Pendiente Selección' :
                                                             b.status === 'pending_approval' ? 'Pendiente Aprobación' :
                                                             b.status === 'counter_proposed' ? 'Contra-Oferta' :
                                                             b.status === 'approved' ? 'Aprobado' : 
                                                             b.status === 'completed' ? 'Completado' : 
                                                             b.status === 'rejected' ? 'Rechazado' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <button onClick={() => handleViewBarter(b)} className="p-2 text-slate-400 hover:text-primary transition-colors">
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
                    <div className="flex-1 flex overflow-hidden">
                        <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-slate-900 mx-8 my-4 rounded-3xl shadow-sm border dark:border-slate-800 overflow-hidden">
                            {/* Selector de Productos */}
                            <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Sucursal Destino</label>
                                            <select
                                                className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm font-bold text-primary"
                                                value={toBranchId}
                                                onChange={e => setToBranchId(e.target.value)}
                                            >
                                                <option value="">Seleccionar Sucursal...</option>
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Buscar Producto</label>
                                            <div className="relative">
                                                <input
                                                    className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                                    placeholder="Nombre o SKU..."
                                                    value={search}
                                                    onChange={e => setSearch(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 pt-0 grid grid-cols-2 lg:grid-cols-3 gap-6 custom-scrollbar">
                                    {filteredProducts.map(p => (
                                        <div key={p.id} className="p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group flex flex-col h-[280px]">
                                            <div className="size-16 w-full flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-2xl p-2 mb-3 group-hover:scale-105 transition-transform duration-300 mx-auto">
                                                <img src={p.image} className="w-full h-full object-contain" alt={p.name} />
                                            </div>
                                            <div className="flex-1 flex flex-col w-full min-w-0">
                                                <p className="font-black text-slate-800 dark:text-white text-xs line-clamp-1 mb-1">{p.name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-tight">{p.sku}</p>
                                                <p className="text-[10px] font-black text-slate-400 mb-3">Existencia: <span className="text-primary">{p.inventory[branchId] || 0}</span></p>
                                                <div className="mt-auto space-y-2">
                                                    <button onClick={() => addToCart(p)} className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase hover:bg-primary hover:text-white transition-all active:scale-95">
                                                        Yo Doy
                                                    </button>
                                                    {activeTab === 'barter_new' && (
                                                        <button onClick={() => addToReceivedCart(p)} className="w-full py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all active:scale-95">
                                                            Yo Recibo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Carritos Sidebar */}
                            <div className="w-full md:w-96 lg:w-[400px] flex flex-col bg-white dark:bg-slate-800 shrink-0">
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                    {/* Carrito de Salida */}
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-4">Lo que entrego</h4>
                                        <div className="space-y-3">
                                            {cart.map(item => (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/20">
                                                    <span className="text-xs font-bold truncate pr-2">{item.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black">x{item.quantity}</span>
                                                        <button onClick={() => removeFromCart(item.id)} className="text-red-500"><span className="material-symbols-outlined text-sm">close</span></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Carrito de Entrada (Solo para Trueques) */}
                                    {activeTab === 'barter_new' && (
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-4">Lo que recibo</h4>
                                            <div className="space-y-3">
                                                {receivedCart.map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                                        <span className="text-xs font-bold truncate pr-2">{item.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black">x{item.quantity}</span>
                                                            <button onClick={() => removeFromReceivedCart(item.id)} className="text-red-500"><span className="material-symbols-outlined text-sm">close</span></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                                    <textarea
                                        className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-medium resize-none h-20"
                                        placeholder="Notas..."
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                    />
                                    <button
                                        onClick={activeTab === 'barter_new' ? handleBarterSubmit : handleSubmit}
                                        disabled={loading || !toBranchId || (activeTab === 'new' ? cart.length === 0 : (cart.length === 0 || receivedCart.length === 0))}
                                        className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-wide hover:scale-[1.02] transition-all disabled:opacity-50"
                                    >
                                        {activeTab === 'barter_new' ? 'Enviar Trueque' : 'Confirmar Traspaso'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
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
                                    <p className="text-slate-500 text-sm font-medium mt-1">
                                        Estado: <span className="font-bold uppercase tracking-widest">{selectedBarter.status}</span>
                                    </p>
                                </div>
                                <button onClick={() => setIsBarterDetailOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto max-h-[70vh] space-y-8">
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
                                        Aprobar y Procesar
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
