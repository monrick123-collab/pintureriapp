import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole, WholesalePromotion, PromotionRequest } from '../types';
import { PromotionService } from '../services/promotionService';

interface AdminPromotionRequestsProps {
    user: User;
    onLogout: () => void;
}

const AdminPromotionRequests: React.FC<AdminPromotionRequestsProps> = ({ user, onLogout }) => {
    const [requests, setRequests] = useState<PromotionRequest[]>([]);
    const [promotions, setPromotions] = useState<WholesalePromotion[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'promotions'>('pending');
    const [selectedRequest, setSelectedRequest] = useState<PromotionRequest | null>(null);
    const [detailRequest, setDetailRequest] = useState<PromotionRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
    const [editingPromotion, setEditingPromotion] = useState<WholesalePromotion | null>(null);
    const [promotionForm, setPromotionForm] = useState({
        name: '',
        description: '',
        minQuantity: 0,
        maxQuantity: 0,
        discountPercent: 0,
        autoApply: true
    });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'pending') {
                const data = await PromotionService.getPendingRequests();
                setRequests(data);
            } else if (activeTab === 'all') {
                const data = await PromotionService.getAllRequests();
                setRequests(data);
            } else if (activeTab === 'promotions') {
                const data = await PromotionService.getPromotions();
                setPromotions(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        if (!confirm('¿Aprobar esta solicitud de promoción?')) return;
        try {
            setLoading(true);
            await PromotionService.approveRequest(requestId, user.id);
            loadData();
            setSelectedRequest(null);
            alert('Promoción aprobada correctamente');
        } catch (e: any) {
            alert('Error al aprobar: ' + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (requestId: string) => {
        if (!rejectionReason.trim()) {
            alert('Ingrese la razón del rechazo');
            return;
        }
        try {
            setLoading(true);
            await PromotionService.rejectRequest(requestId, user.id, rejectionReason);
            loadData();
            setSelectedRequest(null);
            setRejectionReason('');
            alert('Promoción rechazada');
        } catch (e: any) {
            alert('Error al rechazar: ' + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePromotion = async () => {
        if (!promotionForm.name || promotionForm.minQuantity <= 0 || promotionForm.discountPercent <= 0) {
            alert('Complete todos los campos obligatorios');
            return;
        }
        try {
            setLoading(true);
            if (editingPromotion) {
                await PromotionService.updatePromotion(editingPromotion.id, promotionForm);
                alert('Promoción actualizada');
            } else {
                await PromotionService.createPromotion(promotionForm);
                alert('Promoción creada');
            }
            setIsPromotionModalOpen(false);
            setEditingPromotion(null);
            setPromotionForm({
                name: '',
                description: '',
                minQuantity: 0,
                maxQuantity: 0,
                discountPercent: 0,
                autoApply: true
            });
            loadData();
        } catch (e: any) {
            alert('Error: ' + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePromotion = async (promotionId: string) => {
        if (!confirm('¿Eliminar esta promoción?')) return;
        try {
            await PromotionService.deletePromotion(promotionId);
            loadData();
            alert('Promoción eliminada');
        } catch (e: any) {
            alert('Error al eliminar: ' + (e.message || e.toString()));
        }
    };

    const handleTogglePromotion = async (promotion: WholesalePromotion) => {
        try {
            await PromotionService.updatePromotion(promotion.id, { isActive: !promotion.isActive });
            loadData();
        } catch (e: any) {
            alert('Error al actualizar promoción');
        }
    };

    const openEditPromotion = (promotion: WholesalePromotion) => {
        setEditingPromotion(promotion);
        setPromotionForm({
            name: promotion.name,
            description: promotion.description || '',
            minQuantity: promotion.minQuantity,
            maxQuantity: promotion.maxQuantity || 0,
            discountPercent: promotion.discountPercent,
            autoApply: promotion.autoApply
        });
        setIsPromotionModalOpen(true);
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
                <header className="min-h-[4rem] flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-3 flex-wrap gap-2 shrink-0">
                    <h1 className="text-base md:text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3 pl-10 lg:pl-0">
                        <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">local_offer</span>
                        Gestión de Promociones
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'pending', label: 'Pendientes', icon: 'pending' },
                                { key: 'all', label: 'Historial', icon: 'history' },
                                { key: 'promotions', label: 'Promociones', icon: 'settings' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`px-2 md:px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1 md:gap-1.5 transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Pending Requests */}
                        {(activeTab === 'pending' || activeTab === 'all') && (
                            <>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-black text-slate-700 dark:text-slate-200">
                                        {activeTab === 'pending' ? 'Solicitudes Pendientes' : 'Historial de Solicitudes'}
                                    </h2>
                                    <span className="text-[10px] text-slate-400 font-bold">
                                        {requests.length} solicitud{requests.length !== 1 ? 'es' : ''}
                                    </span>
                                </div>

                                {requests.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border dark:border-slate-700">
                                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">inbox</span>
                                        <p className="text-slate-400 font-bold">No hay solicitudes {activeTab === 'pending' ? 'pendientes' : ''}</p>
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border dark:border-slate-700">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                    <th className="px-6 py-4">Cliente</th>
                                                    <th className="px-6 py-4">Productos</th>
                                                    <th className="px-6 py-4">Subtotal</th>
                                                    <th className="px-6 py-4">Descuento</th>
                                                    <th className="px-6 py-4">Fecha</th>
                                                    <th className="px-6 py-4">Estado</th>
                                                    <th className="px-6 py-4 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {requests.map(r => (
                                                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                                        <td className="px-6 py-4 font-bold text-sm">{r.clientName || 'N/A'}</td>
                                                        <td className="px-6 py-4 text-sm">
                                                            <button
                                                                onClick={() => setDetailRequest(r)}
                                                                className="flex items-center gap-1 text-primary hover:underline font-bold"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">list_alt</span>
                                                                {r.totalItems} productos
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm font-bold">${r.subtotal.toLocaleString()}</td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-600 rounded-lg text-xs font-black">
                                                                -{r.requestedDiscountPercent}%
                                                            </span>
                                                            <span className="block text-[10px] text-slate-400 mt-1">
                                                                ${r.requestedDiscountAmount.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs text-slate-500">
                                                            {new Date(r.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                                r.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                                                                r.status === 'approved' ? 'bg-green-100 text-green-600' :
                                                                'bg-red-100 text-red-600'
                                                            }`}>
                                                                {r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {r.status === 'pending' ? (
                                                                <div className="flex gap-2 justify-end">
                                                                    <button
                                                                        onClick={() => handleApprove(r.id)}
                                                                        disabled={loading}
                                                                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-green-600 disabled:opacity-50"
                                                                    >
                                                                        Aprobar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setSelectedRequest(r)}
                                                                        className="px-3 py-1.5 bg-red-100 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-200"
                                                                    >
                                                                        Rechazar
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400">
                                                                    {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : ''}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Promotions Configuration */}
                        {activeTab === 'promotions' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-black text-slate-700 dark:text-slate-200">
                                        Promociones Configuradas
                                    </h2>
                                    <button
                                        onClick={() => { setEditingPromotion(null); setPromotionForm({ name: '', description: '', minQuantity: 0, maxQuantity: 0, discountPercent: 0, autoApply: true }); setIsPromotionModalOpen(true); }}
                                        className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:scale-105 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Nueva Promoción
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {promotions.map(p => (
                                        <div key={p.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border ${p.isActive ? 'border-primary/20' : 'border-slate-200 dark:border-slate-700'} shadow-sm`}>
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-black text-slate-800 dark:text-white">{p.name}</h3>
                                                    <p className="text-[10px] text-slate-400 mt-1">{p.description || 'Sin descripción'}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${p.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {p.isActive ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </div>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Cantidad mín:</span>
                                                    <span className="font-bold">{p.minQuantity}</span>
                                                </div>
                                                {p.maxQuantity && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Cantidad máx:</span>
                                                        <span className="font-bold">{p.maxQuantity}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Descuento:</span>
                                                    <span className="font-black text-primary text-lg">{p.discountPercent}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Auto-aplicar:</span>
                                                    <span className={`font-bold ${p.autoApply ? 'text-green-500' : 'text-slate-400'}`}>
                                                        {p.autoApply ? 'Sí' : 'No'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t dark:border-slate-700 flex gap-2">
                                                <button
                                                    onClick={() => handleTogglePromotion(p)}
                                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${p.isActive ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}
                                                >
                                                    {p.isActive ? 'Desactivar' : 'Activar'}
                                                </button>
                                                <button
                                                    onClick={() => openEditPromotion(p)}
                                                    className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-black uppercase text-slate-600 dark:text-slate-300"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePromotion(p.id)}
                                                    className="px-3 py-2 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {promotions.length === 0 && (
                                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border dark:border-slate-700">
                                        <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">local_offer</span>
                                        <p className="text-slate-400 font-bold">No hay promociones configuradas</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Detail Modal */}
                {detailRequest && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-700 bg-primary/5">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">receipt_long</span>
                                        Detalle de Venta
                                    </h3>
                                    <button onClick={() => setDetailRequest(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Cliente: <span className="font-bold">{detailRequest.clientName || 'N/A'}</span></p>
                            </div>
                            <div className="p-6 space-y-4">
                                {detailRequest.items && detailRequest.items.length > 0 ? (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-slate-700">
                                                <th className="pb-2 text-left">Producto</th>
                                                <th className="pb-2 text-center">Cant.</th>
                                                <th className="pb-2 text-right">Precio Unit.</th>
                                                <th className="pb-2 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {detailRequest.items.map((item: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td className="py-2 font-bold">{item.productName || item.name || `Producto ${idx + 1}`}</td>
                                                    <td className="py-2 text-center">{item.quantity}</td>
                                                    <td className="py-2 text-right">${(item.price || item.unitPrice || 0).toLocaleString()}</td>
                                                    <td className="py-2 text-right font-black">${((item.quantity || 0) * (item.price || item.unitPrice || 0)).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <p className="text-slate-400 text-sm text-center py-4">No hay detalle de productos disponible.</p>
                                )}
                                <div className="border-t dark:border-slate-700 pt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Subtotal</span>
                                        <span className="font-bold">${detailRequest.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-purple-600 font-bold">Descuento solicitado ({detailRequest.requestedDiscountPercent}%)</span>
                                        <span className="font-black text-purple-600">-${detailRequest.requestedDiscountAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-base font-black border-t dark:border-slate-700 pt-2">
                                        <span>Total con descuento</span>
                                        <span className="text-green-600">${(detailRequest.subtotal - detailRequest.requestedDiscountAmount).toLocaleString()}</span>
                                    </div>
                                    {detailRequest.reason && (
                                        <p className="text-xs text-slate-400 mt-1">Motivo: {detailRequest.reason}</p>
                                    )}
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                {detailRequest.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => { handleApprove(detailRequest.id); setDetailRequest(null); }}
                                            className="flex-1 py-3 bg-green-500 text-white font-black rounded-2xl uppercase text-xs shadow-lg"
                                        >Aprobar</button>
                                        <button
                                            onClick={() => { setSelectedRequest(detailRequest); setDetailRequest(null); }}
                                            className="flex-1 py-3 bg-red-100 text-red-500 font-black rounded-2xl uppercase text-xs"
                                        >Rechazar</button>
                                    </>
                                )}
                                <button
                                    onClick={() => setDetailRequest(null)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rejection Modal */}
                {selectedRequest && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-700 bg-red-50 dark:bg-red-900/20">
                                <h3 className="text-lg font-black text-red-700 dark:text-red-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined">block</span>
                                    Rechazar Solicitud
                                </h3>
                                <p className="text-xs text-red-600 mt-1">
                                    Cliente: {selectedRequest.clientName}
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                        Razón del rechazo
                                    </label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border dark:border-slate-700 h-24 resize-none"
                                        value={rejectionReason}
                                        onChange={e => setRejectionReason(e.target.value)}
                                        placeholder="Explique el motivo del rechazo..."
                                    />
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={() => { setSelectedRequest(null); setRejectionReason(''); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => handleReject(selectedRequest.id)}
                                    disabled={loading || !rejectionReason.trim()}
                                    className="flex-1 py-3 bg-red-500 text-white font-black rounded-2xl uppercase text-xs shadow-lg disabled:opacity-50"
                                >
                                    Rechazar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Promotion Form Modal */}
                {isPromotionModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20">
                                <h3 className="text-lg font-black text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined">local_offer</span>
                                    {editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Nombre *</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                        value={promotionForm.name}
                                        onChange={e => setPromotionForm({ ...promotionForm, name: e.target.value })}
                                        placeholder="Ej: Promo Verano"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Descripción</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border dark:border-slate-700"
                                        value={promotionForm.description}
                                        onChange={e => setPromotionForm({ ...promotionForm, description: e.target.value })}
                                        placeholder="Descripción corta"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Cant. Mínima *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                            value={promotionForm.minQuantity}
                                            onChange={e => setPromotionForm({ ...promotionForm, minQuantity: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Cant. Máxima</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                            value={promotionForm.maxQuantity}
                                            onChange={e => setPromotionForm({ ...promotionForm, maxQuantity: parseInt(e.target.value) || 0 })}
                                            placeholder="Opcional"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">Descuento (%) *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                        value={promotionForm.discountPercent}
                                        onChange={e => setPromotionForm({ ...promotionForm, discountPercent: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="autoApply"
                                        checked={promotionForm.autoApply}
                                        onChange={e => setPromotionForm({ ...promotionForm, autoApply: e.target.checked })}
                                        className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="autoApply" className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                        Aplicar automáticamente
                                    </label>
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={() => { setIsPromotionModalOpen(false); setEditingPromotion(null); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleCreatePromotion}
                                    disabled={loading}
                                    className="flex-1 py-3 bg-primary text-white font-black rounded-2xl uppercase text-xs shadow-lg disabled:opacity-50"
                                >
                                    {loading ? 'Guardando...' : editingPromotion ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPromotionRequests;
