import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Return, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';
import AuthorizationModal from '../components/AuthorizationModal';

interface ReturnsProps {
    user: User;
    onLogout: () => void;
}

interface ReturnItem {
    productId: string;
    productName: string;
    quantity: number;
    reason: string;
}

const Returns: React.FC<ReturnsProps> = ({ user, onLogout }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [returns, setReturns] = useState<Return[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form States
    const [cart, setCart] = useState<ReturnItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('uso_tienda');

    // Global Request States
    const [transportedBy, setTransportedBy] = useState('');
    const [receivedBy, setReceivedBy] = useState('');

    const isAdmin = user.role === UserRole.ADMIN;
    const isSub = user.role === UserRole.WAREHOUSE_SUB;
    const [showAuth, setShowAuth] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [prodData, retData] = await Promise.all([
                InventoryService.getProductsByBranch(user.branchId || 'BR-MAIN'),
                InventoryService.getReturnRequests(isAdmin ? undefined : user.branchId)
            ]);
            setProducts(prodData);
            setReturns(retData as unknown as Return[]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = () => {
        if (!selectedProductId || quantity <= 0) return;
        const product = products.find(p => p.id === selectedProductId);
        if (!product) return;

        setCart([...cart, {
            productId: selectedProductId,
            productName: product.name,
            quantity: quantity,
            reason: reason
        }]);

        // Reset Item Form
        setSelectedProductId('');
        setQuantity(1);
        setReason('uso_tienda');
    };

    const removeFromCart = (index: number) => {
        setCart(cart.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (cart.length === 0 || !transportedBy || !receivedBy) return;
        try {
            const items = cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                reason: item.reason
            }));

            await InventoryService.createReturnRequest(
                user.branchId || 'BR-MAIN',
                items,
                transportedBy,
                receivedBy
            );
            setIsModalOpen(false);
            setCart([]);
            setTransportedBy('');
            setReceivedBy('');
            loadData();
            alert("Solicitud de devolución enviada.");
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleAuthorize = async (id: string, approved: boolean) => {
        try {
            await InventoryService.authorizeReturn(id, user.id, approved);
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <h1 className="text-xl font-black">Devoluciones a Bodega</h1>
                    {!isAdmin && (
                        <button onClick={() => isSub ? setShowAuth(true) : setIsModalOpen(true)} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20">Nueva Devolución</button>
                    )}
                </header>

                <AuthorizationModal
                    isOpen={showAuth}
                    onClose={() => setShowAuth(false)}
                    onAuthorized={() => setIsModalOpen(true)}
                    description="El subencargado requiere autorización para generar devoluciones."
                />

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 uppercase text-[10px] font-black text-slate-400">
                                    <tr>
                                        <th className="px-8 py-5">Folio</th>
                                        <th className="px-8 py-5">Producto</th>
                                        <th className="px-6 py-5">Cantidad</th>
                                        <th className="px-6 py-5">Sucursal</th>
                                        <th className="px-6 py-5">Logística</th>
                                        <th className="px-6 py-5">Estado</th>
                                        <th className="px-8 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {returns.map((r: any) => (
                                        <tr key={r.id}>
                                            <td className="px-8 py-5 font-black text-primary">
                                                #{(user.branchId || 'SC').substring(0, 3)}-{(r.folio || 0).toString().padStart(4, '0')}
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{r.products?.name}</span>
                                                    <span className="text-[10px] text-slate-400 capitalize">{r.reason.replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 font-black">{r.quantity}</td>
                                            <td className="px-6 py-5 font-medium">{r.branches?.name}</td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col text-[10px] font-bold text-slate-500">
                                                    <span>🚚 {r.transported_by || 'N/A'}</span>
                                                    <span>👤 {r.received_by || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${r.status === 'approved' ? 'bg-green-100 text-green-600' : r.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    {translateStatus(r.status)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                {isAdmin && r.status === 'pending_authorization' && (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleAuthorize(r.id, true)} className="p-2 text-green-500 hover:bg-green-50 rounded-lg"><span className="material-symbols-outlined">check_circle</span></button>
                                                        <button onClick={() => handleAuthorize(r.id, false)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><span className="material-symbols-outlined">cancel</span></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {returns.length === 0 && (
                                        <tr><td colSpan={7} className="text-center py-10 text-slate-400 italic">No hay devoluciones registradas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col md:flex-row">
                            {/* Form Section */}
                            <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100 dark:border-slate-800">
                                <h3 className="text-2xl font-black mb-6">Nueva Devolución</h3>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Producto</label>
                                        <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                                            <option value="">Selecciona...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock} dispon.)</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Cantidad</label>
                                            <input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Motivo</label>
                                            <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={reason} onChange={e => setReason(e.target.value)}>
                                                <option value="uso_tienda">Uso de Tienda</option>
                                                <option value="demostracion">Demostraciones</option>
                                                <option value="defecto">Defecto de Material</option>
                                                <option value="traspaso_matriz">Retorno a Matriz</option>
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addToCart}
                                        disabled={!selectedProductId || quantity <= 0}
                                        className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase text-xs hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                                    >
                                        Agregar a Lista
                                    </button>

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Datos Logísticos</h4>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Transportista</label>
                                            <input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={transportedBy} onChange={e => setTransportedBy(e.target.value)} placeholder="Nombre Chofer" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Quien Recibe (Almacén)</label>
                                            <input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Nombre Almacén" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cart Section */}
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-8 flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Resumen de Devolución</h4>
                                    <span className="bg-primary/10 text-primary text-xs font-black px-2 py-1 rounded-lg">{cart.length} items</span>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar mb-6">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group">
                                            <div>
                                                <p className="font-bold text-sm">{item.productName}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-black">{item.reason.replace('_', ' ')} • Cant: {item.quantity}</p>
                                            </div>
                                            <button onClick={() => removeFromCart(idx)} className="text-slate-300 hover:text-red-500 transition-colors"><span className="material-symbols-outlined">delete</span></button>
                                        </div>
                                    ))}
                                    {cart.length === 0 && (
                                        <div className="h-40 flex items-center justify-center text-slate-400 italic text-sm">Lista vacía</div>
                                    )}
                                </div>

                                <div className="flex gap-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancelar</button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={cart.length === 0 || !transportedBy || !receivedBy}
                                        className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl disabled:opacity-50 disabled:shadow-none transition-all"
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Returns;
