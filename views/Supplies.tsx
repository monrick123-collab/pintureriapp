import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, InternalSupply, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';

interface SuppliesProps {
    user: User;
    onLogout: () => void;
}

const Supplies: React.FC<SuppliesProps> = ({ user, onLogout }) => {
    const [supplies, setSupplies] = useState<InternalSupply[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(0);
    const [category, setCategory] = useState<'limpieza' | 'papeleria'>('limpieza');

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await InventoryService.getInternalSupplies(isAdmin ? undefined : user.branchId);
            setSupplies(data as unknown as InternalSupply[]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await InventoryService.createInternalSupply({
                branchId: user.branchId || 'BR-MAIN',
                description,
                amount,
                category
            });
            setIsModalOpen(false);
            setDescription('');
            setAmount(0);
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
                    <h1 className="text-xl font-black">Suministros (Limpieza y Papelería)</h1>
                    {isWarehouse && (
                        <button onClick={() => setIsModalOpen(true)} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20">Registrar Salida</button>
                    )}
                </header>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 uppercase text-[10px] font-black text-slate-400">
                                <tr>
                                    <th className="px-8 py-5">Descripción</th>
                                    <th className="px-6 py-5">Categoría</th>
                                    <th className="px-6 py-5">Sucursal Destino</th>
                                    <th className="px-6 py-5 text-right">Valor (Solo Control)</th>
                                    <th className="px-8 py-5 text-right">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-700">
                                {supplies.map((s: any) => (
                                    <tr key={s.id}>
                                        <td className="px-8 py-5 font-bold">{s.description}</td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${s.category === 'limpieza' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {s.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">{s.branches?.name}</td>
                                        <td className="px-6 py-5 text-right font-black text-slate-400">${s.amount.toLocaleString()}</td>
                                        <td className="px-8 py-5 text-right text-xs text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
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
                                <h3 className="text-2xl font-black mb-8">Registrar Suministros</h3>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Descripción del material</label>
                                        <input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Paquete de hojas, Jabón, etc." />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Categoría</label>
                                        <select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={category} onChange={e => setCategory(e.target.value as any)}>
                                            <option value="limpieza">Limpieza</option>
                                            <option value="papeleria">Papelería</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500">Precio (Valor para control de gastos)</label>
                                        <input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
                                    </div>
                                    <div className="flex gap-4 pt-4">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancelar</button>
                                        <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl">Registrar</button>
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

export default Supplies;
