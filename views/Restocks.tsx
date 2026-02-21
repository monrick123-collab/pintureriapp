
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, RestockSheet, UserRole, CartItem, Branch } from '../types';
import { InventoryService } from '../services/inventoryService';

interface RestocksProps {
    user: User;
    onLogout: () => void;
}

const Restocks: React.FC<RestocksProps> = ({ user, onLogout }) => {
    const [sheets, setSheets] = useState<RestockSheet[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedSheet, setSelectedSheet] = useState<RestockSheet | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const myBranchId = user.branchId || 'BR-MAIN';
    const [selectedBranchId, setSelectedBranchId] = useState<string>(myBranchId);

    useEffect(() => {
        loadData();
    }, [selectedBranchId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [s, p, b] = await Promise.all([
                InventoryService.getRestockSheets((isAdmin || isWarehouse) ? (selectedBranchId === 'all' ? undefined : selectedBranchId) : myBranchId),
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
        if (qty <= 0) return removeFromCart(id);
        setCart(cart.map(item => item.id === id ? { ...item, quantity: qty } : item));
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
        const targetBranch = (isAdmin || isWarehouse) ? (selectedBranchId === 'all' ? myBranchId : selectedBranchId) : myBranchId;

        try {
            setLoading(true);
            const items = cart.map(c => ({
                productId: c.id,
                quantity: c.quantity,
                unitPrice: c.costPrice || c.price
            }));
            await InventoryService.createRestockSheet(targetBranch, items);
            setIsModalOpen(false);
            setCart([]);
            loadData();
            alert("Hoja de resurtido creada correctamente.");
        } catch (e) {
            alert("Error al crear resurtido");
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
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-3xl">reorder</span>
                            Resurtidos
                        </h1>
                        {(isAdmin || isWarehouse) && (
                            <select
                                className="bg-transparent border-none text-lg font-black focus:ring-0 p-0 cursor-pointer text-slate-500 outline-none"
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                            >
                                <option value="all">Todas las Sucursales</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-12 px-6 bg-primary text-white rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nueva Solicitud
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
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
                                    {sheets.map(s => (
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
                                                <button onClick={() => { setSelectedSheet(s); setIsDetailModalOpen(true); }} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Ver Detalle">
                                                    <span className="material-symbols-outlined">visibility</span>
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
                                            <td colSpan={6} className="px-8 py-12 text-center text-slate-400 italic font-medium">No hay solicitudes de resurtido registradas.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Modal Nueva Hoja de Resurtido */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-6xl h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col scale-in-95 animate-in">
                            <div className="flex justify-between items-center p-8 border-b border-slate-100 dark:border-slate-800">
                                <div>
                                    <h3 className="text-2xl font-black">Nueva Solicitud de Resurtido</h3>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Generando folio automático por sucursal</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                                {/* Selector de Productos */}
                                <div className="flex-1 flex flex-col border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="p-6">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                            <input
                                                className="w-full pl-12 pr-6 py-4 bg-white dark:bg-slate-800 rounded-2xl border-none shadow-sm focus:ring-4 focus:ring-primary/10 transition-all font-medium"
                                                placeholder="Buscar por nombre o SKU..."
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                            />
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
                                                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">${(p.costPrice || p.price).toLocaleString()}</span>
                                                    <span className="material-symbols-outlined text-primary">add_circle</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Carrito / Hoja */}
                                <div className="w-full md:w-96 flex flex-col bg-white dark:bg-slate-800">
                                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                                        <h4 className="text-sm font-black uppercase text-slate-400 tracking-widest">Materiales Solicitados</h4>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                        {cart.map(item => (
                                            <div key={item.id} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700 group">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">{item.sku}</p>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="size-8 rounded-lg bg-white dark:bg-slate-800 border shadow-sm flex items-center justify-center hover:bg-slate-100 dark:text-white transition-colors">
                                                            <span className="material-symbols-outlined text-sm">remove</span>
                                                        </button>
                                                        <span className="w-10 text-center font-black text-lg">{item.quantity}</span>
                                                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="size-8 rounded-lg bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center hover:scale-110 transition-transform">
                                                            <span className="material-symbols-outlined text-sm">add</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end justify-between">
                                                    <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                        <span className="material-symbols-outlined text-sm">delete</span>
                                                    </button>
                                                    <p className="font-black text-primary">${((item.costPrice || item.price) * item.quantity).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {cart.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in">
                                                <div className="size-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                                                    <span className="material-symbols-outlined text-4xl text-slate-300">shopping_cart</span>
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
                                            className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 uppercase text-sm tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            Confirmar Solicitud
                                        </button>
                                    </div>
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

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
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
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{item.products?.name || 'Producto Desconocido'}</p>
                                                    <p className="text-[10px] font-black text-slate-400 mt-0.5 uppercase tracking-widest">{item.products?.sku || 'N/A'}</p>
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
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Restocks;
