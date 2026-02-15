
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
    const [search, setSearch] = useState('');
    const [toBranchId, setToBranchId] = useState('');
    const [notes, setNotes] = useState('');

    const isAdmin = user.role === UserRole.ADMIN;
    const branchId = user.branchId || 'BR-MAIN';

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [t, p, b] = await Promise.all([
                InventoryService.getStockTransfers(isAdmin ? undefined : branchId),
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
            setCart([]);
            setToBranchId('');
            setNotes('');
            loadData();
            alert("Traspaso iniciado correctamente.");
        } catch (e) {
            alert("Error al crear traspaso");
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
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-12 px-6 bg-primary text-white rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nuevo Traspaso
                    </button>
                </header>

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
                                                <button className="p-2 text-slate-400 hover:text-primary transition-colors">
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

                {/* Modal Nuevo Traspaso */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in">
                            <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h3 className="text-2xl font-black">Nuevo Traspaso entre Sucursales</h3>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Saliendo de sucursal: {user.branchId || 'Matriz'}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                                {/* Selector de Productos */}
                                <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="p-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Sucursal Destino</label>
                                                <select
                                                    className="w-full p-4 bg-white dark:bg-slate-800 rounded-2xl border-none shadow-sm font-bold text-primary"
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
                                                        className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-800 rounded-2xl border-none shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                                        placeholder="Nombre o SKU..."
                                                        value={search}
                                                        onChange={e => setSearch(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 pt-0 grid grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
                                        {filteredProducts.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => addToCart(p)}
                                                className="p-4 bg-white dark:bg-slate-800 rounded-3xl text-left border border-transparent hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group active:scale-95"
                                            >
                                                <div className="size-20 bg-slate-100 dark:bg-slate-700 rounded-2xl p-2 mb-3 group-hover:scale-105 transition-transform duration-300 mx-auto">
                                                    <img src={p.image} className="w-full h-full object-contain" alt={p.name} />
                                                </div>
                                                <p className="font-black text-slate-800 dark:text-white text-sm line-clamp-2 min-h-[40px] leading-tight mb-1">{p.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{p.sku}</p>
                                                <div className="flex justify-between items-end mt-auto">
                                                    <span className="text-xs font-black text-slate-400">Existencia: <span className="text-primary">{p.inventory[branchId] || 0}</span></span>
                                                    <span className="material-symbols-outlined text-primary">add_circle</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Carrito / Traspaso */}
                                <div className="w-full md:w-96 flex flex-col bg-white dark:bg-slate-800">
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                                        <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Materiales a Traspasar</h4>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                        {cart.map(item => (
                                            <div key={item.id} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">{item.sku}</p>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="size-8 rounded-lg bg-white dark:bg-slate-800 border shadow-sm flex items-center justify-center hover:bg-slate-100 dark:text-white">
                                                            <span className="material-symbols-outlined text-sm">remove</span>
                                                        </button>
                                                        <span className="w-10 text-center font-black text-lg">{item.quantity}</span>
                                                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="size-8 rounded-lg bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110">
                                                            <span className="material-symbols-outlined text-sm">add</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-between">
                                                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500">
                                                        <span className="material-symbols-outlined text-sm">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {cart.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                <div className="size-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4 text-slate-300">
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
                                                className="w-full p-4 bg-white dark:bg-slate-800 rounded-xl border-none shadow-sm text-xs font-medium resize-none h-20"
                                                placeholder="Ej: Traspaso por falta de stock..."
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={cart.length === 0 || !toBranchId || loading}
                                            className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                        >
                                            Confirmar Traspaso
                                        </button>
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

export default Transfers;
