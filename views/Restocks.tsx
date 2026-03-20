
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, RestockSheet, UserRole, CartItem, Branch, RestockItemWithReceived } from '../types';
import { InventoryService } from '../services/inventoryService';
import { ShippingService, CARRIER_OPTIONS } from '../services/shippingService';
import { exportToCSV } from '../utils/csvExport';

interface RestocksProps {
    user: User;
    onLogout: () => void;
}

const Restocks: React.FC<RestocksProps> = ({ user, onLogout }) => {
    const PAGE_SIZE = 25;
    const [sheets, setSheets] = useState<RestockSheet[]>([]);
    const [currentPage, setCurrentPage] = useState(0);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedSheet, setSelectedSheet] = useState<RestockSheet | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

    // Diferences Modal States
    const [isDifferencesModalOpen, setIsDifferencesModalOpen] = useState(false);
    const [receivedItems, setReceivedItems] = useState<{ productId: string; productName: string; expectedQuantity: number; receivedQuantity: number; reason: string }[]>([]);

    // Shipping States
    const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
    const [shippingCarrier, setShippingCarrier] = useState('');
    const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');

    // Fechas por defecto (mes actual)
    const today = new Date();
    const localDateString = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const firstDayString = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';

    const [startDate, setStartDate] = useState(firstDayString);
    const [endDate, setEndDate] = useState(localDateString);

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const myBranchId = user.branchId || 'BR-MAIN';
    // State for filtering history
    const [selectedBranchId, setSelectedBranchId] = useState<string>(myBranchId);
    // State for selecting target branch when creating a new request
    const [targetBranchId, setTargetBranchId] = useState<string>(myBranchId);

    useEffect(() => {
        loadData(startDate, endDate);
    }, [selectedBranchId]);

    const loadData = async (sd: string = startDate, ed: string = endDate) => {
        try {
            setLoading(true);
            const [s, p, b] = await Promise.all([
                InventoryService.getRestockSheets(
                    (isAdmin || isWarehouse) ? (selectedBranchId === 'all' ? undefined : selectedBranchId) : myBranchId,
                    sd,
                    ed
                ),
                InventoryService.getProductsByBranch('BR-MAIN'),
                InventoryService.getBranches()
            ]);
            setSheets(s);
            setProducts(p);
            setBranches(b);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (p: Product) => {
        const existing = cart.find(item => item.id === p.id);
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
        setCart(cart.map(item => item.id === id ? { ...item, quantity: Math.max(0, qty) } : item));
    };

    const handleUpdateRestockTime = async (sheetId: string, type: 'departure' | 'arrival') => {
        const action = type === 'departure' ? 'registrar salida de bodega' : 'confirmar llegada a sucursal';
        if (!confirm(`¿Estás seguro de ${action}? Esto actualizará el estado.`)) return;

        try {
            await InventoryService.updateRestockSheetTime(sheetId, type, new Date().toISOString());
            loadData();
            alert(`Tiempo de ${type === 'departure' ? 'salida' : 'llegada'} registrado.`);
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleSubmit = async () => {
        if (cart.length === 0) return;
        const targetBranch = (isAdmin || isWarehouse) ? targetBranchId : myBranchId;

        try {
            setLoading(true);
            const items = cart.map(c => ({
                productId: c.id,
                quantity: c.quantity,
                unitPrice: c.costPrice || c.price
            }));
            await InventoryService.createRestockSheet(targetBranch, items);
            setIsModalOpen(false);
            setActiveTab('history');
            setCart([]);
            loadData();
            alert("Hoja de resurtido creada correctamente.");
        } catch (e) {
            alert("Error al crear resurtido");
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = async (id: string) => {
        try {
            setLoading(true);
            const detail = await InventoryService.getRestockSheetDetail(id);
            setSelectedSheet(detail);
            setIsDetailModalOpen(true);
        } catch (e) {
            console.error(e);
            alert("Error al cargar los detalles de la solicitud.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDifferencesModal = () => {
        if (!selectedSheet || !selectedSheet.items) return;
        
        setReceivedItems(selectedSheet.items.map((item: any) => ({
            productId: item.productId,
            productName: item.product?.name || 'Producto',
            expectedQuantity: item.quantity,
            receivedQuantity: item.quantity,
            reason: ''
        })));
        setIsDifferencesModalOpen(true);
    };

    const handleConfirmWithDifferences = async () => {
        if (!selectedSheet) return;
        
        try {
            setLoading(true);
            
            await InventoryService.confirmRestockWithDifferences(
                selectedSheet.id,
                receivedItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    expectedQuantity: item.expectedQuantity,
                    receivedQuantity: item.receivedQuantity,
                    reason: item.reason
                })),
                user.id
            );
            
            setIsDifferencesModalOpen(false);
            setIsDetailModalOpen(false);
            loadData();
            alert("Recepción confirmada. Las diferencias han sido registradas.");
        } catch (e: any) {
            console.error(e);
            alert("Error al confirmar recepción: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleCreateShipping = async () => {
        if (!selectedSheet || !shippingCarrier || !shippingTrackingNumber) {
            alert("Complete los datos de envío");
            return;
        }
        
        try {
            setLoading(true);
            
            const shippingId = await ShippingService.createShippingOrder({
                entityType: 'restock_sheet',
                entityId: selectedSheet.id,
                originBranchId: user.branchId || (branches.find(b => b.type === 'warehouse')?.id ?? ''),
                destinationBranchId: selectedSheet.branchId,
                createdBy: user.id,
                carrier: shippingCarrier,
                trackingNumber: shippingTrackingNumber
            });
            
            await ShippingService.updateShippingStatus({
                shippingId,
                newStatus: 'shipped',
                carrier: shippingCarrier,
                trackingNumber: shippingTrackingNumber,
                notes: 'Envío registrado desde resurtido'
            });
            
            setIsShippingModalOpen(false);
            setShippingCarrier('');
            setShippingTrackingNumber('');
            alert("Envío registrado correctamente");
        } catch (e: any) {
            console.error(e);
            alert("Error al crear envío: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const translateStatus = (status: string) => {
        const dict: Record<string, string> = {
            'pending': 'Pendiente',
            'in_transit': 'En Tránsito',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return dict[status] || status;
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    );

    const pagedSheets = sheets.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
    const totalPages = Math.ceil(sheets.length / PAGE_SIZE);

    const handleExport = () => {
        exportToCSV(
            `resurtidos-${new Date().toISOString().split('T')[0]}.csv`,
            sheets,
            [
                { key: 'folio', label: 'Folio' },
                { key: 'branchName', label: 'Sucursal' },
                { key: 'totalAmount', label: 'Monto Estimado' },
                { key: 'status', label: 'Estado' },
                { key: 'createdAt', label: 'Fecha Creación' },
                { key: 'departureTime', label: 'Salida' },
                { key: 'arrivalTime', label: 'Llegada' }
            ]
        );
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full">
                <header className="min-h-[4rem] flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-3 flex-wrap gap-2 shrink-0">
                    <div className="flex items-center gap-4 pl-10 lg:pl-0">
                        <h1 className="text-base md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">reorder</span>
                            Resurtidos
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nueva Solicitud', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key as 'new' | 'history')}
                                    className={`px-3 md:px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {activeTab === 'history' ? (
                    <>
                        {/* Filtros */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            {(isAdmin || isWarehouse) && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal</label>
                                    <select
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                                        value={selectedBranchId}
                                        onChange={(e) => setSelectedBranchId(e.target.value)}
                                    >
                                        <option value="all">Todas las Sucursales</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            )}
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
                                onClick={() => { setCurrentPage(0); loadData(startDate, endDate); }}
                                disabled={loading}
                                className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-1 disabled:opacity-50"
                                title="Aplicar Filtros"
                            >
                                <span className="material-symbols-outlined text-sm">filter_alt</span>
                                Filtrar
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={sheets.length === 0}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase shadow hover:scale-105 transition-all flex items-center gap-1.5 disabled:opacity-40"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                Exportar CSV
                            </button>
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{sheets.length} hoja{sheets.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-8 py-5">Folio</th>
                                                <th className="px-8 py-5">Sucursal</th>
                                                <th className="px-8 py-5">Fecha</th>
                                                <th className="px-6 py-5 text-center">Salida</th>
                                                <th className="px-6 py-5 text-center">Llegada</th>
                                                <th className="px-8 py-5 text-right">Monto Estimado</th>
                                                <th className="px-8 py-5 text-center">Estado</th>
                                                <th className="px-8 py-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {pagedSheets.map(s => (
                                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-8 py-5 font-black text-primary">#R-{s.folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{s.branchName}</td>
                                                    <td className="px-8 py-5 text-sm text-slate-500 font-medium">{new Date(s.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-500">
                                                        {s.departureTime ? new Date(s.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-500">
                                                        {s.arrivalTime ? new Date(s.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td className="px-8 py-5 text-right font-black text-slate-900 dark:text-white">${s.totalAmount.toLocaleString()}</td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${s.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                            s.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                                                'bg-amber-500/10 text-amber-500'
                                                            }`}>
                                                            {s.status === 'pending' ? 'Pendiente' : s.status === 'completed' ? 'Recibido' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <button onClick={() => handleViewDetail(s.id)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Ver Detalle">
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </button>
                                                        <button
                                                            onClick={() => window.open(`/restocks/${s.id}/print`, '_blank')}
                                                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                                            title="Imprimir Formato"
                                                        >
                                                            <span className="material-symbols-outlined">print</span>
                                                        </button>
                                                        {(isAdmin || isWarehouse) && !s.departureTime && s.status !== 'cancelled' && (
                                                            <button
                                                                onClick={() => handleUpdateRestockTime(s.id, 'departure')}
                                                                className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                                                title="Registrar Salida"
                                                            >
                                                                <span className="material-symbols-outlined">local_shipping</span>
                                                            </button>
                                                        )}
                                                        {((!isWarehouse && s.status === 'shipped') || (isAdmin && s.status === 'shipped')) && (
                                                            <button
                                                                onClick={() => handleUpdateRestockTime(s.id, 'arrival')}
                                                                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                                                title="Confirmar Llegada"
                                                            >
                                                                <span className="material-symbols-outlined">check_circle</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {sheets.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">reorder</span>
                                                            <p className="font-black text-base text-slate-400">Sin resurtidos</p>
                                                            <p className="text-xs text-slate-400">Filtra por fechas o crea una nueva hoja de resurtido.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                    {sheets.length > PAGE_SIZE && (
                                        <div className="flex items-center justify-between px-8 py-4 border-t dark:border-slate-700">
                                            <button
                                                disabled={currentPage === 0}
                                                onClick={() => setCurrentPage(p => p - 1)}
                                                className="px-4 py-2 text-xs font-black uppercase bg-slate-100 dark:bg-slate-800 rounded-xl disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                ← Anterior
                                            </button>
                                            <span className="text-xs font-bold text-slate-400">
                                                Página {currentPage + 1} de {totalPages} · {sheets.length} resurtidos
                                            </span>
                                            <button
                                                disabled={(currentPage + 1) * PAGE_SIZE >= sheets.length}
                                                onClick={() => setCurrentPage(p => p + 1)}
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
                ) : (

                    <div className="flex-1 flex overflow-hidden">
                        <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-slate-900 mx-8 my-4 rounded-3xl shadow-sm border dark:border-slate-800 overflow-hidden">
                            {/* Selector de Productos */}
                            <div className="flex-[3] flex flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="p-6">
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                        <input
                                            className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                            placeholder="Buscar por nombre o SKU..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 pt-0 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 custom-scrollbar">
                                    {filteredProducts.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => addToCart(p)}
                                            className="p-4 bg-white dark:bg-slate-800 rounded-3xl text-left border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group active:scale-95 flex flex-col h-[200px]"
                                        >
                                            <div className="size-16 w-full flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded-2xl p-2 mb-3 group-hover:scale-105 transition-transform duration-300 mx-auto">
                                                <img src={p.image} className="w-full h-full object-contain" alt={p.name} />
                                            </div>
                                            <div className="flex-1 flex flex-col w-full min-w-0">
                                                <p className="font-black text-slate-800 dark:text-white text-sm line-clamp-2 leading-tight mb-1">{p.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 mt-auto">{p.sku}</p>
                                                <div className="flex justify-between items-end shrink-0">
                                                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">${(p.costPrice || p.price).toLocaleString()}</span>
                                                    <span className="material-symbols-outlined text-primary">add_circle</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Carrito / Hoja */}
                            <div className="flex-[2] flex flex-col bg-white dark:bg-slate-800">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Materiales Solicitados</h4>
                                    </div>
                                    
                                    {(isAdmin || isWarehouse) && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal Destino</label>
                                            <select
                                                className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 outline-none focus:border-primary transition-colors"
                                                value={targetBranchId}
                                                onChange={(e) => setTargetBranchId(e.target.value)}
                                            >
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 group hover:border-primary/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">{item.sku}</p>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => item.quantity <= 1 ? removeFromCart(item.id) : updateQty(item.id, item.quantity - 1)} className="size-8 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                        <span className="material-symbols-outlined text-sm">remove</span>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className="w-12 text-center text-xs font-black bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none p-0 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        value={item.quantity === 0 ? '' : item.quantity}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value) || 0;
                                                            updateQty(item.id, val);
                                                        }}
                                                        onBlur={(e) => {
                                                            if (!e.target.value || parseInt(e.target.value) === 0) {
                                                                removeFromCart(item.id);
                                                            }
                                                        }}
                                                    />
                                                    <button onClick={() => updateQty(item.id, item.quantity + 1)} className="size-8 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center hover:scale-110 transition-transform">
                                                        <span className="material-symbols-outlined text-sm">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end justify-between">
                                                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                                <p className="font-black text-primary">${((item.costPrice || item.price) * item.quantity).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {cart.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                            <div className="size-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 opacity-50">
                                                <span className="material-symbols-outlined text-4xl text-slate-400">shopping_cart</span>
                                            </div>
                                            <p className="text-slate-400 font-bold text-sm">Agrega productos del catálogo para iniciar la solicitud</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-slate-400 font-black uppercase text-xs tracking-widest">Total Estimado</span>
                                        <span className="text-2xl font-black text-primary">
                                            ${cart.reduce((acc, item) => acc + ((item.costPrice || item.price) * item.quantity), 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={cart.length === 0 || loading}
                                        className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase text-sm tracking-wide hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                                    >
                                        Confirmar Solicitud
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Detalles de Hoja de Resurtido */}
                {isDetailModalOpen && selectedSheet && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-3xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in">
                            <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h3 className="text-2xl font-black">Detalles de la Solicitud</h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        <p className="text-primary font-black uppercase tracking-widest text-sm">Folio: #R-{selectedSheet.folio.toString().padStart(4, '0')}</p>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${selectedSheet.status === 'completed' ? 'bg-green-500/10 text-green-500' : selectedSheet.status === 'cancelled' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                            {translateStatus(selectedSheet.status)}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => { setIsDetailModalOpen(false); setSelectedSheet(null); }} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Sucursal Destino</p>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{selectedSheet.branchName}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Fecha Emisión</p>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{new Date(selectedSheet.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Hora Salida</p>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{selectedSheet.departureTime ? new Date(selectedSheet.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pendiente'}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Hora Llegada</p>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{selectedSheet.arrivalTime ? new Date(selectedSheet.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pendiente'}</p>
                                    </div>
                                </div>

                                <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4">Productos Solicitados ({selectedSheet.items?.length || 0})</h4>
                                <div className="space-y-3">
                                    {selectedSheet.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="size-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center font-black text-slate-400">
                                                    {item.quantity}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{item.product?.name || 'Producto Desconocido'}</p>
                                                    <p className="text-[10px] font-black text-slate-400 mt-0.5 uppercase tracking-widest">{item.product?.sku || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Costo Unit</p>
                                                <p className="font-black text-primary text-sm">${item.unitPrice?.toLocaleString() || '0'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-800">
                                <span className="text-slate-400 font-black uppercase text-xs tracking-widest">Total Estimado de la Orden</span>
                                <span className="text-2xl font-black text-primary">${selectedSheet.totalAmount.toLocaleString()}</span>
                            </div>

                            {/* Admin/StoreManager Actions - Confirm Reception */}
                            {(isAdmin || user.role === UserRole.STORE_MANAGER) && selectedSheet.status === 'shipped' && (
                                <div className="p-6 border-t dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10 flex gap-3">
                                    <button
                                        onClick={handleOpenDifferencesModal}
                                        className="flex-1 py-3 bg-primary text-white font-black rounded-2xl text-[10px] uppercase"
                                    >
                                        Confirmar Recepción
                                    </button>
                                </div>
                            )}

                            {/* Admin/Warehouse Actions - Register Shipping */}
                            {(isAdmin || isWarehouse) && selectedSheet.status === 'pending' && (
                                <div className="p-6 border-t dark:border-slate-700 bg-blue-50 dark:bg-blue-900/10">
                                    <button
                                        onClick={() => setIsShippingModalOpen(true)}
                                        className="w-full py-3 bg-blue-500 text-white font-black rounded-2xl text-[10px] uppercase"
                                    >
                                        Registrar Envío / Marcar como Enviado
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Differences Modal */}
                {isDifferencesModalOpen && selectedSheet && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
                                <h3 className="text-lg font-black text-amber-700 dark:text-amber-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined">fact_check</span>
                                    Confirmar Recepción - Ingresar Cantidades Recibidas
                                </h3>
                                <p className="text-xs text-amber-600 mt-1">
                                    Resurtido #R-{selectedSheet.folio.toString().padStart(4, '0')}
                                </p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                                <div className="text-[10px] font-black uppercase text-slate-400 mb-4">
                                    Modifica las cantidades recibidas si hay diferencias
                                </div>
                                {receivedItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700">
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">{item.productName}</p>
                                            <p className="text-[10px] text-slate-400">Esperado: {item.expectedQuantity}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-bold text-slate-400">Recibido:</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-20 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-sm font-bold border dark:border-slate-700 text-center"
                                                value={item.receivedQuantity}
                                                onChange={e => {
                                                    const newItems = [...receivedItems];
                                                    newItems[idx].receivedQuantity = parseInt(e.target.value) || 0;
                                                    setReceivedItems(newItems);
                                                }}
                                            />
                                        </div>
                                        {item.receivedQuantity !== item.expectedQuantity && (
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-black ${item.receivedQuantity < item.expectedQuantity ? 'text-red-500' : 'text-green-500'}`}>
                                                    {item.receivedQuantity < item.expectedQuantity ? '-' : '+'}{Math.abs(item.receivedQuantity - item.expectedQuantity)}
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder="Razón..."
                                                    className="w-32 px-2 py-1 text-xs bg-white dark:bg-slate-800 rounded border dark:border-slate-700"
                                                    value={item.reason}
                                                    onChange={e => {
                                                        const newItems = [...receivedItems];
                                                        newItems[idx].reason = e.target.value;
                                                        setReceivedItems(newItems);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={() => setIsDifferencesModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmWithDifferences}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-primary text-white font-black rounded-2xl uppercase text-xs shadow-lg disabled:opacity-50"
                                >
                                    {loading ? 'Guardando...' : 'Confirmar Recepción'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Shipping Modal */}
                {isShippingModalOpen && selectedSheet && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20">
                                <h3 className="text-lg font-black text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined">local_shipping</span>
                                    Registrar Envío
                                </h3>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Resurtido #R-{selectedSheet.folio.toString().padStart(4, '0')}
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Paquetería</label>
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
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Número de Guía</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                        value={shippingTrackingNumber}
                                        onChange={e => setShippingTrackingNumber(e.target.value)}
                                        placeholder="Ej: 1234567890"
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={() => { setIsShippingModalOpen(false); setShippingCarrier(''); setShippingTrackingNumber(''); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreateShipping}
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

export default Restocks;
