
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, RestockSheet, Branch, Product } from '../types';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';

interface WarehouseDashboardProps {
    user: User;
    onLogout: () => void;
}

const WarehouseDashboard: React.FC<WarehouseDashboardProps> = ({ user, onLogout }) => {
    const [sheets, setSheets] = useState<RestockSheet[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [supplyOrders, setSupplyOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentTab, setCurrentTab] = useState<'branches' | 'sheets' | 'supply'>('branches');
    const [isResurtirModalOpen, setIsResurtirModalOpen] = useState(false);
    const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

    // Form state for new restock
    const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [loadedBranches, loadedSheets, allProducts, loadedSupply] = await Promise.all([
                InventoryService.getBranches(),
                InventoryService.getRestockSheets(),
                InventoryService.getProducts(),
                InventoryService.getSupplyOrders()
            ]);
            setBranches(loadedBranches.filter(b => b.type === 'store'));
            setSheets(loadedSheets);
            setProducts(allProducts);
            setSupplyOrders(loadedSupply);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenResurtir = (branch: Branch) => {
        setSelectedBranch(branch);
        setCart([]);
        setIsResurtirModalOpen(true);
    };

    const addToCart = (product: Product) => {
        const exists = cart.find(c => c.product.id === product.id);
        if (exists) {
            setCart(cart.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setCart([...cart, { product, quantity: 1 }]);
        }
    };

    const updateCartQty = (productId: string, qty: number) => {
        if (qty <= 0) {
            setCart(cart.filter(c => c.product.id !== productId));
        } else {
            setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: qty } : c));
        }
    };

    const handleSubmitRestock = async () => {
        if (!selectedBranch || cart.length === 0) return;
        try {
            setLoading(true);
            const items = cart.map(c => ({
                productId: c.product.id,
                quantity: c.quantity,
                unitPrice: c.product.price
            }));
            const sheetId = await InventoryService.createRestockSheet(selectedBranch.id, items);
            setIsResurtirModalOpen(false);
            loadInitialData();
            navigate(`/shipping-note/${sheetId}`);
        } catch (e) {
            console.error(e);
            alert("Error al crear hoja de resurtido");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitSupplyOrder = async () => {
        if (cart.length === 0) return;
        try {
            setLoading(true);
            const items = cart.map(c => ({
                productId: c.product.id,
                quantity: c.quantity,
                unitPrice: c.product.price
            }));
            // Assume the warehouse branch ID or similar. 
            // For now, we'll use 'MAIN' or similar if needed, or if the user is linked to a branch.
            await InventoryService.createSupplyOrder('BR-MAIN', user.id, items);
            setIsSupplyModalOpen(false);
            loadInitialData();
            alert("Pedido a administración creado correctamente.");
        } catch (e) {
            console.error(e);
            alert("Error al crear pedido");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5);

    const totalCart = cart.reduce((acc, curr) => acc + (curr.product.price * curr.quantity), 0);

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-6 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <div className="p-2 bg-primary/10 rounded-lg text-primary hidden sm:block">
                            <span className="material-symbols-outlined text-2xl">warehouse</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Bodega</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden xs:block">Gestión de Resurtidos</p>
                        </div>
                    </div>
                </header>

                <div className="px-6 md:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex gap-8">
                    <button
                        onClick={() => setCurrentTab('branches')}
                        className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${currentTab === 'branches' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
                    >
                        Sucursales
                    </button>
                    <button
                        onClick={() => setCurrentTab('sheets')}
                        className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${currentTab === 'sheets' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
                    >
                        Historial de Notas
                    </button>
                    <button
                        onClick={() => setCurrentTab('supply')}
                        className={`py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${currentTab === 'supply' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
                    >
                        Pedidos a Admin
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {currentTab === 'branches' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {branches.map(branch => (
                                <div key={branch.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="size-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined text-2xl">location_on</span>
                                        </div>
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-wide">
                                            {translateStatus(branch.status)}
                                        </span>
                                    </div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{branch.name}</h3>
                                    <p className="text-xs text-slate-500 font-bold mb-6 line-clamp-1">{branch.address}</p>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenResurtir(branch)}
                                            className="flex-1 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                                        >
                                            Resurtir
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : currentTab === 'sheets' ? (
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-8 py-5">Folio</th>
                                        <th className="px-6 py-5">Sucursal</th>
                                        <th className="px-6 py-5">Fecha</th>
                                        <th className="px-6 py-5 text-right">Total</th>
                                        <th className="px-8 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {sheets.map(sheet => (
                                        <tr key={sheet.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-8 py-5 font-black text-primary">#{sheet.folio}</td>
                                            <td className="px-6 py-5">
                                                <p className="font-bold text-slate-900 dark:text-white">{(sheet as any).branchName}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{sheet.branchId}</p>
                                            </td>
                                            <td className="px-6 py-5 text-xs font-bold text-slate-500">
                                                {new Date(sheet.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-5 text-right font-black text-slate-900 dark:text-white">
                                                ${sheet.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <Link
                                                    to={`/shipping-note/${sheet.id}`}
                                                    className="p-2 text-slate-400 hover:text-primary transition-colors inline-block"
                                                >
                                                    <span className="material-symbols-outlined">print</span>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {sheets.length === 0 && (
                                <div className="p-20 text-center text-slate-400 font-bold">No hay notas de resurtido registradas.</div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => { setCart([]); setIsSupplyModalOpen(true); }}
                                    className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Nuevo Pedido a Admin
                                </button>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-800">
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="px-8 py-5">Folio</th>
                                            <th className="px-6 py-5">Estado</th>
                                            <th className="px-6 py-5">Atiende</th>
                                            <th className="px-6 py-5">Arribo Est.</th>
                                            <th className="px-6 py-5 text-right">Total</th>
                                            <th className="px-8 py-5 text-right">Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {supplyOrders.map(order => (
                                            <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-8 py-5 font-black text-blue-600">S-{order.folio}</td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {translateStatus(order.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {order.assignedAdminName ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-[10px] font-black">{order.assignedAdminName[0]}</div>
                                                            <span className="text-xs font-bold text-slate-600">{order.assignedAdminName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No asignado</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 text-xs font-bold text-slate-500">
                                                    {order.estimatedArrival ? new Date(order.estimatedArrival).toLocaleDateString() : 'Pendiente'}
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-slate-900 dark:text-white">
                                                    ${order.totalAmount.toLocaleString()}
                                                </td>
                                                <td className="px-8 py-5 text-right text-[10px] font-bold text-slate-400 uppercase">
                                                    {new Date(order.createdAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {supplyOrders.length === 0 && (
                                    <div className="p-20 text-center text-slate-400 font-bold">No hay pedidos a administración registrados.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal de Resurtido */}
            {isResurtirModalOpen && selectedBranch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
                        {/* Left Side: Product Selection */}
                        <div className="flex-1 p-8 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar">
                            <h3 className="text-2xl font-black mb-1">Resurtir Tienda</h3>
                            <p className="text-primary font-black uppercase text-[10px] tracking-widest mb-8">{selectedBranch.name}</p>

                            <div className="relative mb-6">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                <input
                                    autoFocus
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Buscar por nombre o SKU..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                {searchQuery && filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="w-full p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl flex items-center gap-4 hover:border-primary transition-all text-left shadow-sm hover:shadow-md"
                                    >
                                        <div className="size-10 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 shrink-0">
                                            <img src={p.image} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{p.sku} • <span className="text-primary font-bold">${p.price}</span></p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-300">add_circle</span>
                                    </button>
                                ))}
                                {!searchQuery && (
                                    <div className="text-center py-20 text-slate-300">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_check</span>
                                        <p className="text-xs font-bold uppercase tracking-widest">Busca productos para agregar</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Cart Summary */}
                        <div className="w-full md:w-[350px] bg-slate-50 dark:bg-[#0f172a] p-8 flex flex-col shrink-0">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Lista de Material</h4>

                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {cart.map(item => (
                                    <div key={item.product.id} className="flex items-center gap-3 animate-in slide-in-from-right-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.product.name}</p>
                                            <p className="text-[9px] font-black text-primary">${(item.product.price * item.quantity).toLocaleString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border dark:border-slate-700">
                                            <button onClick={() => updateCartQty(item.product.id, item.quantity - 1)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-sm">remove</span>
                                            </button>
                                            <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                                            <button onClick={() => updateCartQty(item.product.id, item.quantity + 1)} className="text-slate-400 hover:text-primary transition-colors">
                                                <span className="material-symbols-outlined text-sm">add</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {cart.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 pt-20">
                                        <span className="material-symbols-outlined text-4xl mb-2">production_quantity_limits</span>
                                        <p className="text-[10px] font-black uppercase">Vacío</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-6 border-t dark:border-slate-800 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                                    <span className="text-2xl font-black text-slate-900 dark:text-white">${totalCart.toLocaleString()}</span>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsResurtirModalOpen(false)}
                                        className="flex-1 py-4 text-xs font-black uppercase text-slate-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSubmitRestock}
                                        disabled={cart.length === 0 || loading}
                                        className="flex-[2] py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase disabled:opacity-50"
                                    >
                                        Finalizar Nota
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Pedido a Admin (Punto 2) */}
            {isSupplyModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
                        {/* Left Side: Product Selection */}
                        <div className="flex-1 p-8 border-r border-slate-100 dark:border-slate-800 overflow-y-auto custom-scrollbar">
                            <h3 className="text-2xl font-black mb-1">Nuevo Pedido a Admin</h3>
                            <p className="text-blue-600 font-black uppercase text-[10px] tracking-widest mb-8">Solicitud de Suministros para Bodega</p>

                            <div className="relative mb-6">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                <input
                                    autoFocus
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-bold text-sm focus:ring-2 focus:ring-primary/20"
                                    placeholder="Buscar por nombre o SKU..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                {searchQuery && filteredProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addToCart(p)}
                                        className="w-full p-4 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl flex items-center gap-4 hover:border-blue-600 transition-all text-left shadow-sm hover:shadow-md"
                                    >
                                        <div className="size-10 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 shrink-0">
                                            <img src={p.image} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{p.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{p.sku} • <span className="text-primary font-bold">${p.price}</span></p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-300">add_circle</span>
                                    </button>
                                ))}
                                {!searchQuery && (
                                    <div className="text-center py-20 text-slate-300">
                                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">shopping_bag</span>
                                        <p className="text-xs font-bold uppercase tracking-widest">Busca productos para agregar al pedido</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Cart Summary */}
                        <div className="w-full md:w-[350px] bg-slate-50 dark:bg-[#0f172a] p-8 flex flex-col shrink-0">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Resumen del Pedido</h4>

                            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                                {cart.map(item => (
                                    <div key={item.product.id} className="flex items-center gap-3 animate-in slide-in-from-right-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.product.name}</p>
                                            <p className="text-[9px] font-black text-blue-600">Qty: {item.quantity}</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border dark:border-slate-700">
                                            <button onClick={() => updateCartQty(item.product.id, item.quantity - 1)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-sm">remove</span>
                                            </button>
                                            <span className="text-xs font-black min-w-[20px] text-center">{item.quantity}</span>
                                            <button onClick={() => updateCartQty(item.product.id, item.quantity + 1)} className="text-slate-400 hover:text-blue-600 transition-colors">
                                                <span className="material-symbols-outlined text-sm">add</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 pt-6 border-t dark:border-slate-800 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Estimado</span>
                                    <span className="text-2xl font-black text-slate-900 dark:text-white">${totalCart.toLocaleString()}</span>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setIsSupplyModalOpen(false)}
                                        className="flex-1 py-4 text-xs font-black uppercase text-slate-400"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSubmitSupplyOrder}
                                        disabled={cart.length === 0 || loading}
                                        className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase disabled:opacity-50"
                                    >
                                        Enviar Pedido
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehouseDashboard;
