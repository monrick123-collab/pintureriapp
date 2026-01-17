
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryService } from '../services/inventoryService';

const PACKAGE_PRIORITY: Record<string, number> = {
    'cubeta': 1,
    'galon': 2,
    'litro': 3,
    'medio': 4,
    'cuarto': 5,
    'aerosol': 6,
    'complemento': 7
};

const ShippingNote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [sheet, setSheet] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await InventoryService.getRestockSheetDetail(id!);

            // Ordenar items por prioridad de envase
            if (data.items) {
                data.items.sort((a: any, b: any) => {
                    const prioA = PACKAGE_PRIORITY[a.product?.packageType || ''] || 99;
                    const prioB = PACKAGE_PRIORITY[b.product?.packageType || ''] || 99;
                    return prioA - prioB;
                });
            }

            setSheet(data);
        } catch (e) {
            console.error("Error loading shipping note:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold">Cargando formato...</div>;
    if (!sheet) return <div className="p-20 text-center font-bold text-red-500">Error: No se encontró la nota de resurtido.</div>;

    const date = new Date(sheet.created_at).toLocaleDateString('es-MX', {
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
                    Imprimir Nota
                </button>
            </div>

            {/* A4 Document Wrapper */}
            <div className="w-full overflow-x-auto print:overflow-visible flex justify-center">
                {/* A4 Document */}
                <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[15mm] md:p-[20mm] font-sans flex flex-col border border-slate-200 print:border-none shrink-0">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-slate-900 p-4 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-white text-4xl">inventory</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nota de Resurtido</h1>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Pintamax S.A. de C.V. • Control de Bodega</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Folio Sucursal</div>
                            <div className="text-2xl font-black text-primary tracking-tighter">#{sheet.folio}</div>
                            <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">{date}</div>
                        </div>
                    </div>

                    {/* Logistics Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Origen (Bodega)</h3>
                            <p className="text-sm font-black text-slate-900">Bodega Principal (Hub)</p>
                            <p className="text-[10px] text-slate-500">ID: BR-MAIN</p>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <h3 className="text-[9px] font-black text-primary/60 uppercase tracking-widest mb-2">Destino (Sucursal)</h3>
                            <p className="text-sm font-black text-slate-900">{sheet.branchName}</p>
                            <p className="text-[10px] text-primary font-bold">ID: {sheet.branch_id}</p>
                        </div>
                    </div>

                    {/* Content Table */}
                    <div className="flex-1 mb-8 overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                    <th className="p-3 text-left rounded-tl-lg">SKU / Producto</th>
                                    <th className="p-3 text-center">Tipo</th>
                                    <th className="p-3 text-right">Unitario</th>
                                    <th className="p-3 text-center">Cant.</th>
                                    <th className="p-3 text-right rounded-tr-lg">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100">
                                {sheet.items.map((item: any) => (
                                    <tr key={item.id} className="text-[11px]">
                                        <td className="p-3">
                                            <p className="font-bold text-slate-900">{item.product?.name}</p>
                                            <p className="text-[8px] font-mono text-slate-400">{item.product?.sku}</p>
                                        </td>
                                        <td className="p-3 text-center capitalize text-slate-500">
                                            {item.product?.packageType || '---'}
                                        </td>
                                        <td className="p-3 text-right font-medium">
                                            ${item.unit_price?.toLocaleString() || '0'}
                                        </td>
                                        <td className="p-3 text-center font-black text-sm">
                                            {item.quantity}
                                        </td>
                                        <td className="p-3 text-right font-black">
                                            ${item.total_price?.toLocaleString() || '0'}
                                        </td>
                                    </tr>
                                ))}
                                {/* Filling empty rows if needed for A4 */}
                                {sheet.items.length < 15 && Array.from({ length: 15 - sheet.items.length }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-none"><td colSpan={5} className="p-3">&nbsp;</td></tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50">
                                    <td colSpan={4} className="p-4 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest">Total Material Resurtido:</td>
                                    <td className="p-4 text-right font-black text-lg text-slate-900">
                                        ${sheet.total_amount?.toLocaleString() || '0'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Signatures Area */}
                    <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-200">
                        <div className="text-center">
                            <div className="h-16 border-b border-slate-300 mb-2"></div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Salida de Almacén</p>
                            <p className="text-[9px] font-bold text-slate-700">Firma Autorizada</p>
                        </div>
                        <div className="text-center">
                            <div className="h-16 border-b border-slate-300 mb-2"></div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Chofer / Repartidor</p>
                            <p className="text-[9px] font-bold text-slate-700">Nombre y Firma</p>
                        </div>
                        <div className="text-center">
                            <div className="h-16 border-b border-slate-300 mb-2"></div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Recibido en Sucursal</p>
                            <p className="text-[9px] font-bold text-slate-700">Nombre y Firma</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        <p>Surtido por: ____________________________</p>
                        <p>Pintamax® Logistics System • {new Date().getFullYear()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingNote;
