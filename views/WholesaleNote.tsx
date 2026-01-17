
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SalesService } from '../services/salesService';
import { Sale } from '../types';

const WholesaleNote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await SalesService.getSaleDetail(id!);
            setSale(data);
        } catch (e) {
            console.error("Error loading wholesale note:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold">Cargando nota de venta...</div>;
    if (!sale) return <div className="p-20 text-center font-bold text-red-500">Error: No se encontró la venta.</div>;

    const date = new Date(sale.createdAt).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-10 print:p-0 print:bg-white flex flex-col items-center">
            {/* Action Bar */}
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
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">print</span>
                    Imprimir Ticket
                </button>
            </div>

            {/* A4 Document Wrapper */}
            <div className="w-full overflow-x-auto print:overflow-visible flex justify-center">
                {/* A4 Document */}
                <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[15mm] md:p-[20mm] font-sans flex flex-col border border-slate-200 print:border-none shrink-0">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary p-4 rounded-2xl">
                                <span className="material-symbols-outlined text-white text-4xl">groups</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nota de Venta Mayoreo</h1>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Pintamax S.A. de C.V. • Distribución Mayorista</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Folio</div>
                            <div className="text-2xl font-black text-primary tracking-tighter">#{sale.id.slice(0, 8).toUpperCase()}</div>
                            <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">{date}</div>
                        </div>
                    </div>

                    {/* Info Cards */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente</h3>
                            <p className="text-sm font-black text-slate-900 uppercase">{sale.clientName || 'Cliente General'}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Estatus: <span className="text-primary font-bold">{sale.paymentType === 'credito' ? 'CRÉDITO' : 'LIQUIDADO'}</span></p>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <h3 className="text-[9px] font-black text-primary/60 uppercase tracking-widest mb-2">Detalles de Salida</h3>
                            <p className="text-sm font-black text-slate-900">Despachado por: {sale.departureAdminName || '---'}</p>
                            <p className="text-[10px] text-primary font-bold mt-1 uppercase">Sucursal: {sale.branchId}</p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 mb-8">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                                    <th className="p-3 text-left rounded-tl-lg">Producto / Descripción</th>
                                    <th className="p-3 text-right">Precio Unit.</th>
                                    <th className="p-3 text-center">Cant.</th>
                                    <th className="p-3 text-right rounded-tr-lg">Importe</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100">
                                {sale.items.map((item, idx) => (
                                    <tr key={idx} className="text-[11px]">
                                        <td className="p-3">
                                            <p className="font-bold text-slate-900">{item.productName}</p>
                                            <p className="text-[8px] font-mono text-slate-400">MAYOREO PROTECTED</p>
                                        </td>
                                        <td className="p-3 text-right font-medium">${item.price.toLocaleString()}</td>
                                        <td className="p-3 text-center font-black text-sm">{item.quantity}</td>
                                        <td className="p-3 text-right font-black">${item.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {sale.items.length < 10 && Array.from({ length: 10 - sale.items.length }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-none"><td colSpan={4} className="p-3">&nbsp;</td></tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50">
                                    <td colSpan={3} className="p-4 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest">Subtotal:</td>
                                    <td className="p-4 text-right font-black text-slate-900">${sale.subtotal?.toLocaleString()}</td>
                                </tr>
                                <tr className="bg-slate-50">
                                    <td colSpan={3} className="p-2 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest">IVA (16%):</td>
                                    <td className="p-2 text-right font-black text-slate-900">${sale.iva?.toLocaleString()}</td>
                                </tr>
                                <tr className="bg-slate-900 text-white">
                                    <td colSpan={3} className="p-4 text-right font-black uppercase text-[12px] tracking-widest">Total a Pagar:</td>
                                    <td className="p-4 text-right font-black text-xl italic">${sale.total.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Authorization Area */}
                    <div className="grid grid-cols-2 gap-12 pt-10 border-t border-slate-200">
                        <div className="text-center">
                            <div className="h-20 border-b border-slate-300 mb-2 relative">
                                {sale.departureAdminName && (
                                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-300 opacity-50 uppercase tracking-widest">Sello Digital Pintamax</span>
                                )}
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Autorizado por (Admin)</p>
                            <p className="text-xs font-black text-slate-900 uppercase">{sale.departureAdminName || 'Firma Requerida'}</p>
                        </div>
                        <div className="text-center">
                            <div className="h-20 border-b border-slate-300 mb-2"></div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Recibido en Sucursal / Cliente</p>
                            <p className="text-xs font-black text-slate-900 uppercase">{sale.clientName || 'Firma de Conformidad'}</p>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        <p>Condición de Pago: <span className="text-slate-900">{sale.paymentType === 'credito' ? 'CRÉDITO 15 DÍAS' : 'CONTADO / EFECTIVO'}</span></p>
                        <p>Pintamax® Wholesale System • {new Date().getFullYear()}</p>
                    </div>
                </div>
            </div>

            <style>
                {`
                    @media print {
                        @page { margin: 0; }
                        body { margin: 1.6cm; }
                        .print\\:hidden { display: none !important; }
                    }
                `}
            </style>
        </div>
    );
};

export default WholesaleNote;
