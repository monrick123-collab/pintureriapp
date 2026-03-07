
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, StockTransfer, UserRole, CartItem } from '../types';
import { InventoryService } from '../services/inventoryService';

interface TransfersProps {
    user: User;
    onLogout: () => void;
}

const Transfers: React.FC<TransfersProps> = ({ user, onLogout }) => {
    const [transfers, setTransfers] = useState<StockTransfer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [search, setSearch] = useState('');
    const [toBranchId, setToBranchId] = useState('');
    const [notes, setNotes] = useState('');

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
            const [t, p, b] = await Promise.all([
                InventoryService.getStockTransfers(
                    isAdmin ? undefined : branchId,
                    sd || undefined,
                    ed || undefined
                ),
                InventoryService.getProductsByBranch(branchId),
                InventoryService.getBranches()
            ]);
            setTransfers(t);
            setProducts(p);
            setBranches(b.filter(branch => branch.id !== branchId));
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
        if (qty <= 0) return removeFromCart(id);
        setCart(cart.map(item => item.id === id ? { ...item, quantity: qty } : item));
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

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full">
                <header className="flex h-20 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 shrink-0">
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
                        Traspasos
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nuevo Traspaso', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key as 'new' | 'history')}
                                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>{tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {activeTab === 'history' ? (
                    <>
                        {/* Filtro por fechas */}
                        <div className="mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm shrink-0">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <button onClick={() => loadData(startDate, endDate)} className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">Filtrar</button>
                            {(startDate || endDate) && (
                                <button onClick={() => { setStartDate(''); setEndDate(''); loadData('', ''); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Limpiar</button>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{transfers.length} traspaso{transfers.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="px-8 py-5">Folio</th>
                                                <th className="px-8 py-5">Origen</th>
                                                <th className="px-8 py-5">Destino</th>
                                                <th className="px-8 py-5">Fecha</th>
                                                <th className="px-8 py-5 text-center">Estado</th>
                                                <th className="px-8 py-5 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {transfers.map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                                    <td className="px-8 py-5 font-black text-primary">#T-{t.folio.toString().padStart(4, '0')}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{t.fromBranchName}</td>
                                                    <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{t.toBranchName}</td>
                                                    <td className="px-8 py-5 text-sm text-slate-500 font-medium">{new Date(t.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${t.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                                            t.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                                                'bg-amber-500/10 text-amber-500'
                                                            }`}>
                                                            {t.status === 'pending' ? 'Pendiente' : t.status === 'in_transit' ? 'En Tránsito' : t.status === 'completed' ? 'Completado' : 'Cancelado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <button
                                                            onClick={() => handleViewTransfer(t)}
                                                            className="p-2 text-slate-400 hover:text-primary transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined">visibility</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {transfers.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic font-medium">No hay traspasos registrados.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
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
                                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
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
                                                    <span className="text-xs font-black text-slate-400">Existencia: <span className="text-primary">{p.inventory[branchId] || 0}</span></span>
                                                    <span className="material-symbols-outlined text-primary">add_circle</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Carrito / Traspaso */}
                            <div className="w-full md:w-96 lg:w-[400px] flex flex-col bg-white dark:bg-slate-800 shrink-0">
                                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                                    <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Materiales a Traspasar</h4>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 group">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">{item.sku}</p>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => updateQty(item.id, item.quantity - 1)} className="size-8 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-600 shadow-sm flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                        <span className="material-symbols-outlined text-sm">remove</span>
                                                    </button>
                                                    <span className="w-10 text-center font-black text-lg">{item.quantity}</span>
                                                    <button onClick={() => updateQty(item.id, item.quantity + 1)} className="size-8 rounded-lg bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110">
                                                        <span className="material-symbols-outlined text-sm">add</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end justify-between">
                                                <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {cart.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                            <div className="size-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-300 opacity-50">
                                                <span className="material-symbols-outlined text-4xl">inventory_2</span>
                                            </div>
                                            <p className="text-slate-400 font-bold text-sm">Selecciona productos para traspasar</p>
                                        </div>
                                    )}
                                </div>
                                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Notas / Observaciones</label>
                                        <textarea
                                            className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-medium resize-none h-20"
                                            placeholder="Ej: Traspaso por falta de stock..."
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={cart.length === 0 || !toBranchId || loading}
                                        className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase text-sm tracking-wide hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        Confirmar Traspaso
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
            </main>
        </div>
    );
};

export default Transfers;
