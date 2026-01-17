import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Return, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';

interface ReturnsProps {
    user: User;
    onLogout: () => void;
}

const Returns: React.FC<ReturnsProps> = ({ user, onLogout }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [returns, setReturns] = useState<Return[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('uso_tienda');

    const isAdmin = user.role === UserRole.ADMIN;

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProductId || quantity <= 0) return;
        try {
            await InventoryService.createReturnRequest(user.branchId || 'BR-MAIN', selectedProductId, quantity, reason);
            setIsModalOpen(false);
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
                        <button onClick={() => setIsModalOpen(true)} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20">Nueva Devolución</button>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 uppercase text-[10px] font-black text-slate-400">
                                <tr>
                                    <th className="px-8 py-5">Producto</th>
                                    <th className="px-6 py-5">Cantidad</th>
                                    <th className="px-6 py-5">Sucursal</th>
                                    <th className="px-6 py-5">Motivo</th>
                                    <th className="px-6 py-5">Estado</th>
                                    <th className="px-8 py-5 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {returns.map((r: any) => (
                                    <tr key={r.id}>
                                        <td className="px-8 py-5 font-bold">{r.products?.name}</td>
                                        <td className="px-6 py-5 font-black">{r.quantity}</td>
                                        <td className="px-6 py-5">{r.branches?.name}</td>
                                        <td className="px-6 py-5 capitalize">{r.reason.replace('_', ' ')}</td>
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
                            </tbody>
                        </table>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="p-10 overflow-y-auto">
                                <h3 className="text-2xl font-black mb-8">Solicitar Devolución</h3>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Producto</label>
                                        <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                                            <option value="">Selecciona...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock} dispon.)</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Cantidad</label>
                                        <input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Motivo</label>
                                        <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={reason} onChange={e => setReason(e.target.value)}>
                                            <option value="uso_tienda">Uso de Tienda</option>
                                            <option value="demostracion">Demostraciones</option>
                                            <option value="defecto">Defecto de Material</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancelar</button>
                                        <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl">Enviar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Returns;
