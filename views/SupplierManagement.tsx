import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Supplier } from '../types';
import { FinanceService } from '../services/financeService';

interface SupplierManagementProps {
    user: User;
    onLogout: () => void;
}

const SupplierManagement: React.FC<SupplierManagementProps> = ({ user, onLogout }) => {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Supplier>>({
        name: '',
        taxId: '',
        contactInfo: '',
        paymentTermsDays: 0
    });

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            setLoading(true);
            const data = await FinanceService.getSuppliers();
            setSuppliers(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (!formData.name) return;
            await FinanceService.createSupplier(formData as any);
            setIsModalOpen(false);
            setFormData({ name: '', taxId: '', contactInfo: '', paymentTermsDays: 0 });
            loadSuppliers();
        } catch (e) {
            console.error(e);
            alert('Error al guardar proveedor');
        }
    };

    return (
        <div className="h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-900">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 overflow-y-auto">
                <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Proveedores</h1>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nuevo Proveedor
                    </button>
                </header>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {suppliers.map(supplier => (
                                <div key={supplier.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl">
                                            <span className="material-symbols-outlined text-slate-500">store</span>
                                        </div>
                                        <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                            {supplier.paymentTermsDays} Días Crédito
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">{supplier.name}</h3>
                                    <p className="text-sm text-slate-500 font-bold mb-4">{supplier.taxId || 'Sin RFC'}</p>

                                    <div className="space-y-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                                        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                                            <span className="material-symbols-outlined text-sm">contact_phone</span>
                                            {supplier.contactInfo || 'Sin contacto'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Create Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                            <h2 className="text-xl font-black mb-6">Registrar Proveedor</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400">Razón Social</label>
                                    <input
                                        autoFocus
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ej. Distribuidora de Pinturas S.A."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-400">RFC</label>
                                        <input
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                            value={formData.taxId}
                                            onChange={e => setFormData({ ...formData, taxId: e.target.value })}
                                            placeholder="XAXX010101000"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-black uppercase text-slate-400">Días Crédito</label>
                                        <input
                                            type="number"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-bold"
                                            value={formData.paymentTermsDays}
                                            onChange={e => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400">Datos de Contacto</label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border-none focus:ring-2 focus:ring-primary font-medium text-sm"
                                        rows={3}
                                        value={formData.contactInfo}
                                        onChange={e => setFormData({ ...formData, contactInfo: e.target.value })}
                                        placeholder="Nombre, teléfono, correo..."
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 font-bold rounded-xl text-slate-500 hover:bg-slate-200">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90">Guardar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SupplierManagement;
