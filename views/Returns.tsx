import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Return, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { translateStatus, getStatusColor } from '../utils/formatters';
import Badge from '../components/ui/Badge';
import AuthorizationModal from '../components/AuthorizationModal';
import SmartSearch from '../components/SmartSearch';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

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
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([]);
    const navigate = useNavigate();

    // Form States
    const [cart, setCart] = useState<ReturnItem[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedProductDisplay, setSelectedProductDisplay] = useState<{ name: string; sku: string } | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState('uso_tienda');

    // Global Request States
    const [transportedBy, setTransportedBy] = useState('');
    const [receivedBy, setReceivedBy] = useState('');
    const [selectedFormBranch, setSelectedFormBranch] = useState(user.branchId || '');

    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const isSub = user.role === UserRole.WAREHOUSE_SUB;
    const [showAuth, setShowAuth] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
    const [approvingReturnId, setApprovingReturnId] = useState<string | null>(null);
    const [approvalDestBranchId, setApprovalDestBranchId] = useState('');

    // Fechas
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const firstDay = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(localDate);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!(isAdmin || isWarehouse)) return;
        InventoryService.getBranches()
            .then(data => {
                if (data.length > 0) {
                    setBranches(data);
                    if (!selectedFormBranch) {
                        setSelectedFormBranch(data[0].id);
                        loadProductsForBranch(data[0].id);
                    }
                }
            })
            .catch(e => console.error('Error loading branches:', e));
    }, [isAdmin, isWarehouse]);

    const loadData = async (sd = startDate, ed = endDate, branchFilter = selectedBranchFilter) => {
        try {
            setLoading(true);
            const branchIdToFetch = (isAdmin || isWarehouse)
                ? (branchFilter || undefined)
                : user.branchId;

            // For admin/warehouse: only load products if a branch is explicitly selected
            // For other roles: load products from their own branch
            const productBranch = (isAdmin || isWarehouse)
                ? selectedFormBranch
                : user.branchId;

            const [prodData, retData] = await Promise.all([
                productBranch
                    ? InventoryService.getProductsByBranch(productBranch)
                    : Promise.resolve([]),
                InventoryService.getReturnRequests(
                    branchIdToFetch,
                    sd || undefined,
                    ed || undefined
                )
            ]);
            setProducts(prodData);
            setReturns(retData as unknown as Return[]);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadProductsForBranch = async (branchId: string) => {
        try {
            if (!branchId) return;
            const prodData = await InventoryService.getProductsByBranch(branchId);
            setProducts(prodData);
        } catch (e) {
            console.error(e);
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
        setSelectedProductDisplay(null);
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

            const submitBranch = (isAdmin || isWarehouse) ? selectedFormBranch : user.branchId;
            if (!submitBranch) {
                alert('Selecciona una sucursal antes de enviar.');
                return;
            }
            await InventoryService.createReturnRequest(
                submitBranch,
                items,
                transportedBy,
                receivedBy
            );
            setIsModalOpen(false);
            setActiveTab('history');
            setCart([]);
            setTransportedBy('');
            setReceivedBy('');
            loadData();
            alert("Solicitud de devolución enviada.");
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleAuthorize = async (id: string, approved: boolean, destinationBranchId?: string) => {
        try {
            await InventoryService.authorizeReturn(id, user.id, approved, destinationBranchId);
            setApprovingReturnId(null);
            setApprovalDestBranchId('');
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleCloseReturn = async (id: string) => {
        if (!confirm('¿Confirmar recepción física y cerrar esta devolución definitivamente?')) return;
        try {
            const { error } = await supabase
                .from('returns')
                .update({ status: 'closed', updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            loadData();
            alert('Devolución cerrada correctamente.');
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleConfirmReception = async (id: string) => {
        if (!confirm('¿Confirmas que el producto fue recibido físicamente en bodega?')) return;
        try {
            const { error } = await supabase
                .from('returns')
                .update({ status: 'received_at_warehouse', updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;
            loadData();
            alert('Recepción confirmada en bodega.');
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />
            <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
                <header className="min-h-[4rem] flex items-center justify-between px-4 md:px-8 py-3 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0 gap-3 flex-wrap">
                    <div className="flex items-center gap-3 pl-10 lg:pl-0">
                        <span className="material-symbols-outlined text-primary text-2xl md:text-3xl">keyboard_return</span>
                        <div>
                            <h1 className="text-base md:text-xl font-black">Devoluciones a Bodega</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">Gestión de devoluciones</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                            {([
                                { key: 'new', label: 'Nueva', icon: 'add_circle' },
                                { key: 'history', label: 'Historial', icon: 'list' }
                            ] as const).map(tab => (
                                <button key={tab.key} onClick={() => {
                                    if (tab.key === 'new' && isSub) {
                                        setShowAuth(true);
                                    } else {
                                        setActiveTab(tab.key);
                                    }
                                }}
                                    className={`px-3 md:px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                <AuthorizationModal
                    isOpen={showAuth}
                    onClose={() => setShowAuth(false)}
                    onAuthorized={() => setActiveTab('new')}
                    description="El subencargado requiere autorización para generar devoluciones."
                />

                {activeTab === 'history' ? (
                    <>
                        {/* Filtro por fechas */}
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            {(isAdmin || isWarehouse) && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Sucursal</label>
                                    <select 
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20"
                                        value={selectedBranchFilter} 
                                        onChange={e => setSelectedBranchFilter(e.target.value)}
                                    >
                                        <option value="">Todas las Sucursales</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                            <button onClick={() => loadData(startDate, endDate, selectedBranchFilter)} className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">Filtrar</button>
                            {(startDate || endDate || selectedBranchFilter) && (
                                <button onClick={() => { setStartDate(''); setEndDate(''); setSelectedBranchFilter(''); loadData('', '', ''); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Limpiar</button>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{returns.length} devolución{returns.length !== 1 ? 'es' : ''}</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
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
                                                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                                    <td className="px-8 py-5 font-black text-primary">
                                                        #{(user.branchId || 'SC').substring(0, 3)}-{(r.folio || 0).toString().padStart(4, '0')}
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{r.products?.name}</span>
                                                            <span className="text-[10px] text-slate-400 capitalize">{r.reason === 'uso_tienda' ? 'Consumo Interno' : r.reason.replace('_', ' ')}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 font-black">{r.quantity}</td>
                                                    <td className="px-6 py-5 font-medium">{r.branches?.name}</td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col text-[10px] font-bold text-slate-500 gap-1">
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-sm text-slate-400">local_shipping</span>
                                                                {r.transported_by || 'N/A'}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                                                                {r.received_by || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <Badge variant={getStatusColor(r.status)} size="sm">
                                                            {translateStatus(r.status)}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        {isAdmin && r.status === 'pending_authorization' && (
                                                            approvingReturnId === r.id ? (
                                                                <div className="flex flex-col items-end gap-2 min-w-[200px]">
                                                                    <label className="text-[10px] font-black uppercase text-slate-400">Sucursal/Bodega destino</label>
                                                                    <select
                                                                        autoFocus
                                                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
                                                                        value={approvalDestBranchId}
                                                                        onChange={e => setApprovalDestBranchId(e.target.value)}
                                                                    >
                                                                        <option value="">Selecciona destino...</option>
                                                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                                    </select>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            disabled={!approvalDestBranchId}
                                                                            onClick={() => handleAuthorize(r.id, true, approvalDestBranchId)}
                                                                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-lg text-[10px] font-black uppercase transition-colors"
                                                                        >Confirmar</button>
                                                                        <button
                                                                            onClick={() => { setApprovingReturnId(null); setApprovalDestBranchId(''); }}
                                                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-lg text-[10px] font-black uppercase transition-colors"
                                                                        >Cancelar</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => { setApprovingReturnId(r.id); setApprovalDestBranchId(''); }} className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Aprobar"><span className="material-symbols-outlined">check_circle</span></button>
                                                                    <button onClick={() => handleAuthorize(r.id, false)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Rechazar"><span className="material-symbols-outlined">cancel</span></button>
                                                                </div>
                                                            )
                                                        )}
                                                        {isWarehouse && r.status === 'approved' && (
                                                            <button
                                                                onClick={() => handleConfirmReception(r.id)}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-black transition-colors"
                                                                title="Confirmar Recepción en Bodega"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">inventory</span>
                                                                Recibido
                                                            </button>
                                                        )}
                                                        {isAdmin && r.status === 'received_at_warehouse' && (
                                                            <button
                                                                onClick={() => handleCloseReturn(r.id)}
                                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-black transition-colors"
                                                                title="Confirmar recepción física y cerrar devolución"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">lock</span>
                                                                Cerrar
                                                            </button>
                                                        )}
                                                        {r.status === 'closed' && (
                                                            <span className="text-[10px] font-black text-green-600 uppercase flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-sm">verified</span>
                                                                Cerrada
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => navigate(`/returns/${r.id}/print`)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-black transition-colors"
                                                            title="Imprimir Formato"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">print</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {returns.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3 text-slate-300 dark:text-slate-600">
                                                            <span className="material-symbols-outlined text-6xl">keyboard_return</span>
                                                            <p className="font-black text-base text-slate-400">Sin devoluciones</p>
                                                            <p className="text-xs text-slate-400">Selecciona un rango de fechas diferente o crea la primera devolución.</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (

                    <div className="flex-1 flex overflow-y-auto md:overflow-hidden">
                        <div className="flex-1 flex flex-col md:flex-row bg-white dark:bg-slate-900 mx-3 md:mx-8 my-3 md:my-4 rounded-2xl md:rounded-3xl shadow-sm border dark:border-slate-800 overflow-hidden">
                            {/* Form Section */}
                            <div className="flex-[3] p-4 md:p-8 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 custom-scrollbar">
                                <h3 className="text-xl md:text-2xl font-black mb-5">Nueva Devolución</h3>
                                <div className="space-y-5 max-w-2xl">
                                    {/* Branch selector for admin/warehouse */}
                                    {(isAdmin || isWarehouse) && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-black uppercase text-slate-500">Sucursal origen del inventario</label>
                                            <select
                                                className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-200 dark:border-slate-700 font-bold"
                                                value={selectedFormBranch}
                                                onChange={e => {
                                                    setSelectedFormBranch(e.target.value);
                                                    setCart([]);
                                                    setSelectedProductId('');
                                                    setSelectedProductDisplay(null);
                                                    setQuantity(1);
                                                    setReason('uso_tienda');
                                                    if (e.target.value) loadProductsForBranch(e.target.value);
                                                    else setProducts([]);
                                                }}
                                            >
                                                <option value="">Selecciona una sucursal...</option>
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <label className="text-xs font-black uppercase text-slate-500">Producto</label>
                                        {(!selectedFormBranch && !user.branchId) ? (
                                            <div className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-sm">
                                                Selecciona sucursal primero...
                                            </div>
                                        ) : (
                                            <>
                                                {selectedProductDisplay ? (
                                                    <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-2xl">
                                                        <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{selectedProductDisplay.name}</p>
                                                            <p className="text-xs text-slate-500">SKU: {selectedProductDisplay.sku}</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSelectedProductId(''); setSelectedProductDisplay(null); }}
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <SmartSearch
                                                        products={products}
                                                        currentBranchId={selectedFormBranch || user.branchId || ''}
                                                        includeZeroStock={true}
                                                        onSelectProduct={p => {
                                                            setSelectedProductId(p.id);
                                                            setSelectedProductDisplay({ name: p.name, sku: p.sku });
                                                        }}
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                        <div className="space-y-1">
                                            <label className="text-xs font-black uppercase text-slate-500">Cantidad</label>
                                            <input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none font-black border border-slate-200 dark:border-slate-700" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-black uppercase text-slate-500">Motivo</label>
                                            <select className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-200 dark:border-slate-700" value={reason} onChange={e => setReason(e.target.value)}>
                                                <option value="uso_tienda">Consumo Interno</option>
                                                <option value="demostracion">Demostraciones</option>
                                                <option value="defecto">Defecto de Material</option>
                                                <option value="traspaso_matriz">Retorno a Matriz</option>
                                                <option value="por_envasado">Por Envasado</option>
                                                {(isAdmin || isWarehouse) && (
                                                    <option value="devolucion_proveedor">Devolución a Proveedor</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addToCart}
                                        disabled={!selectedProductId || quantity <= 0}
                                        className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">add_circle</span>
                                        Agregar a Lista
                                    </button>

                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-5">
                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Datos Logísticos</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                            <div className="space-y-1">
                                                <label className="text-xs font-black uppercase text-slate-500">Transportista</label>
                                                <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-200 dark:border-slate-700" value={transportedBy} onChange={e => setTransportedBy(e.target.value)} placeholder="Nombre Chofer" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-black uppercase text-slate-500">Quien Recibe (Almacén)</label>
                                                <input className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none border border-slate-200 dark:border-slate-700" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Nombre Almacén" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cart Section */}
                            <div className="flex-[2] bg-slate-50 dark:bg-slate-900/50 p-4 md:p-8 flex flex-col min-h-[280px] md:min-h-0">
                                <div className="flex justify-between items-center mb-4 md:mb-6">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Resumen</h4>
                                    <span className="bg-primary/10 text-primary text-xs font-black px-3 py-1.5 rounded-xl">{cart.length} items</span>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar mb-5">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group shadow-sm hover:border-primary/30 transition-colors">
                                            <div>
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.productName}</p>
                                                <p className="text-xs text-slate-500 uppercase font-black mt-1">{item.reason.replace('_', ' ')} • Cant: {item.quantity}</p>
                                            </div>
                                            <button onClick={() => removeFromCart(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><span className="material-symbols-outlined">delete</span></button>
                                        </div>
                                    ))}
                                    {cart.length === 0 && (
                                        <div className="h-32 flex flex-col items-center justify-center text-slate-400 italic text-sm gap-2">
                                            <span className="material-symbols-outlined text-4xl opacity-50">shopping_cart</span>
                                            <span>Lista vacía</span>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={cart.length === 0 || !transportedBy || !receivedBy}
                                    className="w-full py-4 md:py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-50 disabled:shadow-none transition-all uppercase text-sm tracking-wide"
                                >
                                    Confirmar Devolución
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Returns;
