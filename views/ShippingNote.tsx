
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryService } from '../services/inventoryService';
import { RestockRequest } from '../types';

const ShippingNote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [request, setRequest] = useState<RestockRequest | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadRequest();
    }, [id]);

    const loadRequest = async () => {
        try {
            setLoading(true);
            const data = await InventoryService.getRestockRequestById(id!);
            setRequest(data);
        } catch (e) {
            console.error("Error loading shipping note:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold">Cargando formato...</div>;
    if (!request) return <div className="p-20 text-center font-bold text-red-500">Error: No se encontró el folio del pedido.</div>;

    const date = new Date(request.createdAt).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-10 print:p-0 print:bg-white flex flex-col items-center">
            {/* Action Bar (Hidden on print) */}
            <div className="w-full max-w-[210mm] mb-6 flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Regresar
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                    <span className="material-symbols-outlined">print</span>
                    Imprimir Vale
                </button>
            </div>

            {/* A4 Document */}
            <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[20mm] font-sans flex flex-col border border-slate-200 print:border-none">

                {/* Header */}
                <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-4xl">local_shipping</span>
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Vale de Salida</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Pintamax S.A. de C.V. • Logística Interna</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Folio de Resurtido</div>
                        <div className="text-xl font-black text-primary tracking-tighter">#{request.id.substring(0, 8).toUpperCase()}</div>
                        <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase">{date}</div>
                    </div>
                </div>

                {/* Transfer Info */}
                <div className="grid grid-cols-2 gap-10 mb-12">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Origen</h3>
                        <p className="font-black text-slate-900">Bodega Principal (Hub)</p>
                        <p className="text-xs text-slate-500 mt-1">Zona Industrial Vallejo, CDMX</p>
                        <p className="text-xs text-slate-500 font-bold mt-2">ID: BR-MAIN</p>
                    </div>
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10">
                        <h3 className="text-[10px] font-black text-primary/60 uppercase tracking-widest mb-4">Destino</h3>
                        <p className="font-black text-slate-900">{request.branchName || 'Sucursal Destino'}</p>
                        <p className="text-xs text-slate-500 mt-1">Entrega de Mercancía para Stock</p>
                        <p className="text-xs text-primary font-bold mt-2">ID: {request.branchId}</p>
                    </div>
                </div>

                {/* Content Table */}
                <div className="flex-1 mb-12">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                                <th className="p-4 text-left rounded-tl-xl">Producto / SKU</th>
                                <th className="p-4 text-center">Descripción</th>
                                <th className="p-4 text-right rounded-tr-xl">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            <tr className="text-sm">
                                <td className="p-6 font-black text-slate-900">
                                    {request.productName}
                                    <div className="text-[10px] font-bold text-slate-400 mt-1">ID: {request.productId.substring(0, 8)}</div>
                                </td>
                                <td className="p-6 text-slate-600 text-center">Pintura e Insumos para Pinturería</td>
                                <td className="p-6 text-right font-black text-lg">{request.quantity} Pzas</td>
                            </tr>
                            {/* Padding rows to fill space */}
                            {[1, 2, 3, 4, 5].map(i => (
                                <tr key={i} className="opacity-0 border-none"><td className="p-6" colSpan={3}>&nbsp;</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Signature Area */}
                <div className="grid grid-cols-2 gap-20 mt-auto pt-10 border-t-2 border-slate-100">
                    <div className="text-center">
                        <div className="h-24 border-b border-slate-400 mb-4 mx-10"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Despachado por (Bodega)</p>
                        <p className="text-xs font-bold text-slate-900">Firma y Sello</p>
                    </div>
                    <div className="text-center">
                        <div className="h-24 border-b border-slate-400 mb-4 mx-10"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Recibido por (Sucursal)</p>
                        <p className="text-xs font-bold text-slate-900">Firma y Sello de Conformidad</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 pt-8 border-t border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                        Este documento es un comprobante interno de movimiento de inventario.
                    </p>
                    <p className="text-[8px] text-slate-300 mt-1">
                        Generado por Sistema Pintamax® • {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ShippingNote;
