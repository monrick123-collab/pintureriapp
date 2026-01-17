import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, PackagingRequest, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';
import AuthorizationModal from '../components/AuthorizationModal';

interface PackagingProps {
    user: User;
    onLogout: () => void;
}

const Packaging: React.FC<PackagingProps> = ({ user, onLogout }) => {
    const [bulkProducts, setBulkProducts] = useState<Product[]>([]);
    const [requests, setRequests] = useState<PackagingRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [bulkId, setBulkId] = useState('');
    const [targetType, setTargetType] = useState<'litro' | 'galon'>('litro');
    const [drumQty, setDrumQty] = useState(1);
    const [branchId, setBranchId] = useState('');
    const [branches, setBranches] = useState<any[]>([]);

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const isSub = user.role === UserRole.WAREHOUSE_SUB;
    const [showAuth, setShowAuth] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [prods, requestsData, branchesData] = await Promise.all([
                InventoryService.getProducts(),
                InventoryService.getPackagingRequests(isAdmin ? undefined : user.branchId),
                InventoryService.getBranches()
            ]);
            setBulkProducts(prods.filter(p => (p.description || '').toLowerCase().includes('tambo') || p.sku.includes('200L')));
            setRequests(requestsData as unknown as PackagingRequest[]);
            setBranches(branchesData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await InventoryService.createPackagingRequest({
                bulkProductId: bulkId,
                targetPackageType: targetType,
                quantityDrum: drumQty,
                branchId: branchId || user.branchId
            });
            setIsModalOpen(false);
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await InventoryService.updatePackagingStatus(id, status);
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
                    <h1 className="text-xl font-black">Envasado (Litreados)</h1>
                    {isWarehouse && (
                        <button onClick={() => isSub ? setShowAuth(true) : setIsModalOpen(true)} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20">Solicitar Envasado</button>
                    )}
                </header>

                <AuthorizationModal
                    isOpen={showAuth}
                    onClose={() => setShowAuth(false)}
                    onAuthorized={() => setIsModalOpen(true)}
                    description="El subencargado requiere autorización para solicitar envasado."
                />

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 uppercase text-[10px] font-black text-slate-400">
                                    <tr>
                                        <th className="px-8 py-5">Producto Granel</th>
                                        <th className="px-6 py-5">Sucursal Responsable</th>
                                        <th className="px-6 py-5">Envase Destino</th>
                                        <th className="px-6 py-5 text-center">Cant. Tambos</th>
                                        <th className="px-6 py-5">Estado</th>
                                        <th className="px-8 py-5 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-slate-700">
                                    {requests.map((r: any) => (
                                        <tr key={r.id}>
                                            <td className="px-8 py-5 font-bold">{r.products?.name}</td>
                                            <td className="px-6 py-5">{r.branches?.name}</td>
                                            <td className="px-6 py-5 font-black uppercase text-xs">{r.target_package_type}</td>
                                            <td className="px-6 py-5 text-center font-black">{r.quantity_drum}</td>
                                            <td className="px-6 py-5">
                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${r.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                                    {translateStatus(r.status)}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                {isWarehouse && r.status === 'processing' && (
                                                    <button onClick={() => handleUpdateStatus(r.id, 'completed')} className="text-xs font-black text-primary uppercase hover:underline">Finalizar</button>
                                                )}
                                                {user.branchId === r.branch_id && r.status === 'sent_to_branch' && (
                                                    <button onClick={() => handleUpdateStatus(r.id, 'processing')} className="text-xs font-black text-blue-500 uppercase hover:underline">Iniciar Envasado</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="p-10 overflow-y-auto">
                                <h3 className="text-2xl font-black mb-8">Nueva Solicitud</h3>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Tambo (200L)</label>
                                        <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={bulkId} onChange={e => setBulkId(e.target.value)}>
                                            <option value="">Selecciona...</option>
                                            {bulkProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Envase Destino</label>
                                            <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={targetType} onChange={e => setTargetType(e.target.value as any)}>
                                                <option value="litro">LITRO</option>
                                                <option value="galon">GALÓN</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-500">Cantidad Tambos</label>
                                            <input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black" value={drumQty} onChange={e => setDrumQty(parseInt(e.target.value) || 0)} />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Sucursal que envasa</label>
                                        <select required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={branchId} onChange={e => setBranchId(e.target.value)}>
                                            <option value="">Selecciona sucursal...</option>
                                            {branches.filter(b => b.type === 'store').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancelar</button>
                                        <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl">Solicitar</button>
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

export default Packaging;
