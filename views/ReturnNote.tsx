import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryService } from '../services/inventoryService';

const ReturnNote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [returnData, setReturnData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await InventoryService.getReturnRequestById(id!);
            setReturnData(data);
        } catch (e) {
            console.error("Error loading return note:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold">Cargando formato de devolución...</div>;
    if (!returnData) return <div className="p-20 text-center font-bold text-red-500">Error: No se encontró la devolución.</div>;

    const date = new Date(returnData.created_at).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const translateReason = (r: string) => {
        switch (r) {
            case 'uso_tienda': return 'Consumo Interno';
            case 'demostracion': return 'Demostraciones';
            case 'defecto': return 'Defecto de Material';
            case 'traspaso_matriz': return 'Retorno a Matriz';
            case 'devolucion_proveedor': return 'Devolución a Proveedor';
            default: return r.replace('_', ' ');
        }
    };

    const handlePrint = () => {
        const wasDark = document.documentElement.classList.contains('dark');
        if (wasDark) {
            document.documentElement.classList.remove('dark');
        }
        
        setTimeout(() => {
            window.print();
            if (wasDark) {
                document.documentElement.classList.add('dark');
            }
        }, 150);
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-10 print:p-0 print:bg-white flex flex-col items-center format-half-letter print-format-container">
            {/* Action Bar */}
            <div className="w-full max-w-[140mm] mb-6 flex justify-between items-center print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Regresar
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">print</span>
                    Imprimir Formato
                </button>
            </div>

            {/* Half-Letter Document Wrapper (5.5" x 8.5" approx 140mm x 216mm) */}
            <div className="w-full overflow-x-auto print:overflow-visible flex justify-center">
                <div className="w-[140mm] min-h-[216mm] bg-white shadow-2xl print:shadow-none p-[10mm] font-sans flex flex-col border border-slate-200 print:border-none shrink-0 relative print-exact">

                    {/* Header */}
                    <div className="flex justify-between items-center border-b-2 border-slate-800 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-800 text-3xl">keyboard_return</span>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 uppercase leading-none">Formato de Devolución</h1>
                                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Control de Inventarios • Bodega</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Folio</div>
                            <div className="text-lg font-black text-primary tracking-tighter">#{returnData.branch_id?.substring(0, 3)}-{(returnData.folio || 0).toString().padStart(4, '0')}</div>
                        </div>
                    </div>

                    {/* General Information */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-xs">
                            <p className="font-black text-slate-400 text-[9px] uppercase tracking-widest">Sucursal Origen</p>
                            <p className="font-bold text-slate-800 uppercase">{returnData.branches?.name || returnData.branch_id}</p>
                        </div>
                        <div className="text-xs text-right">
                            <p className="font-black text-slate-400 text-[9px] uppercase tracking-widest">Fecha</p>
                            <p className="font-bold text-slate-800 uppercase">{date}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="text-xs">
                            <p className="font-black text-slate-400 text-[9px] uppercase tracking-widest">Motivo de Devolución</p>
                            <div className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-700 uppercase">
                                {translateReason(returnData.reason)}
                            </div>
                        </div>
                        <div className="text-xs text-right">
                             <p className="font-black text-slate-400 text-[9px] uppercase tracking-widest">Estatus Sistema</p>
                             <p className="font-bold text-slate-800 uppercase">{returnData.status.replace(/_/g, ' ')}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 mb-6">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest print:bg-transparent print:text-slate-900 print:border-b-2 print:border-slate-800">
                                    <th className="p-2 text-left rounded-tl-md">SKU / Producto</th>
                                    <th className="p-2 text-center rounded-tr-md w-20">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100 text-xs">
                                <tr>
                                    <td className="p-2">
                                        <p className="font-black text-slate-900 print:text-black">{returnData.products?.sku || '---'}</p>
                                        <p className="text-[10px] font-bold text-slate-600 print:text-black mt-0.5">{returnData.products?.name}</p>
                                    </td>
                                    <td className="p-2 text-center font-black text-sm print:text-black">{returnData.quantity}</td>
                                </tr>
                                {/* Empty rows filler for visual height */}
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-none"><td colSpan={2} className="p-4">&nbsp;</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Logistics Space */}
                    <div className="grid grid-cols-2 gap-4 mb-16 text-xs">
                         <div className="bg-slate-50 p-2 rounded border border-slate-100">
                             <p className="font-black text-slate-400 text-[8px] uppercase tracking-widest mb-1">Transportista / Chofer</p>
                             <p className="font-bold text-slate-800 uppercase">{returnData.transported_by || '_________________'}</p>
                         </div>
                         <div className="bg-slate-50 p-2 rounded border border-slate-100">
                             <p className="font-black text-slate-400 text-[8px] uppercase tracking-widest mb-1">Responsable en Bodega</p>
                             <p className="font-bold text-slate-800 uppercase">{returnData.received_by || '_________________'}</p>
                         </div>
                    </div>

                    {/* Signatures Area */}
                    <div className="grid grid-cols-3 gap-4 pt-10 border-t border-slate-200 mt-auto">
                        <div className="text-center">
                            <div className="h-10 border-b border-slate-800 mb-1"></div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Autoriza (Admin)</p>
                        </div>
                        <div className="text-center">
                            <div className="h-10 border-b border-slate-800 mb-1"></div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Entrega (Transporte)</p>
                        </div>
                        <div className="text-center">
                            <div className="h-10 border-b border-slate-800 mb-1"></div>
                            <p className="text-[8px] font-black text-slate-600 uppercase">Recibe (Bodega)</p>
                        </div>
                    </div>

                    <div className="absolute bottom-2 left-0 right-0 text-center text-[7px] font-bold text-slate-400 uppercase tracking-widest">
                        Pintamax® Warehouse Management System • Generado: {new Date().toLocaleDateString('es-MX')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReturnNote;
