
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SalesService } from '../services/salesService';

const MunicipalNote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [sale, setSale] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadData();
    }, [id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await SalesService.getMunicipalSaleById(id!);
            setSale(data);
        } catch (e) {
            console.error('Error loading municipal note:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-20 text-center font-bold">Cargando nota de venta municipal...</div>;
    if (!sale) return <div className="p-20 text-center font-bold text-red-500">Error: No se encontró la venta.</div>;

    const date = new Date(sale.created_at).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Mexico_City'
    });

    const folioStr = `#M-${String(sale.folio).padStart(4, '0')}`;

    const handlePrint = () => {
        const wasDark = document.documentElement.classList.contains('dark');
        if (wasDark) document.documentElement.classList.remove('dark');
        setTimeout(() => {
            window.print();
            if (wasDark) document.documentElement.classList.add('dark');
        }, 150);
    };

    const items: any[] = sale.municipal_sale_items || [];

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
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-black shadow-lg shadow-primary/20"
                >
                    <span className="material-symbols-outlined">print</span>
                    Imprimir Nota
                </button>
            </div>

            {/* A4 Document Wrapper */}
            <div className="w-full overflow-x-auto print:overflow-visible flex justify-center">
                <div className="w-[210mm] min-h-[297mm] bg-white shadow-2xl print:shadow-none p-[15mm] md:p-[20mm] font-sans flex flex-col border border-slate-200 print:border-none shrink-0">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-6">
                        <div className="flex items-center gap-4">
                            <div className="bg-primary p-4 rounded-2xl">
                                <span className="material-symbols-outlined text-white text-4xl">account_balance</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Nota de Venta Municipal</h1>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Pintamax S.A. de C.V. • Ventas Municipales</p>
                                {sale.branch?.name && (
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Sucursal: {sale.branch.name}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Folio</div>
                            <div className="text-2xl font-black text-primary tracking-tighter">{folioStr}</div>
                            <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase">{date}</div>
                        </div>
                    </div>

                    {/* Info Cards */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                        {/* Cliente / Municipio */}
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Datos del Cliente</h3>
                            <div>
                                <p className="text-[8px] text-slate-400 uppercase font-bold">Municipio</p>
                                <p className="text-sm font-black text-slate-900 uppercase">{sale.municipality}</p>
                            </div>
                            {sale.department && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">Dependencia</p>
                                    <p className="text-xs font-bold text-slate-700">{sale.department}</p>
                                </div>
                            )}
                            {sale.contact_name && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">Contacto</p>
                                    <p className="text-xs font-bold text-slate-700">{sale.contact_name}</p>
                                </div>
                            )}
                            {sale.social_reason && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">Razón Social</p>
                                    <p className="text-xs font-bold text-slate-700">{sale.social_reason}</p>
                                </div>
                            )}
                            {sale.rfc && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">RFC</p>
                                    <p className="text-xs font-mono font-bold text-slate-700 uppercase">{sale.rfc}</p>
                                </div>
                            )}
                        </div>

                        {/* Detalles de entrega */}
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-2">
                            <h3 className="text-[9px] font-black text-primary/60 uppercase tracking-widest mb-2">Detalles de Entrega</h3>
                            {sale.authorized_exit_by && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">Autorizado por</p>
                                    <p className="text-xs font-bold text-slate-700">{sale.authorized_exit_by}</p>
                                </div>
                            )}
                            {sale.delivery_receiver && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">Receptor</p>
                                    <p className="text-xs font-bold text-slate-700">{sale.delivery_receiver}</p>
                                </div>
                            )}
                            {sale.invoice_number && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">N° Factura</p>
                                    <p className="text-xs font-mono font-bold text-slate-700">{sale.invoice_number}</p>
                                </div>
                            )}
                            {sale.transfer_reference && (
                                <div>
                                    <p className="text-[8px] text-slate-400 uppercase font-bold">Referencia Transferencia</p>
                                    <p className="text-xs font-mono font-bold text-slate-700">{sale.transfer_reference}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-[8px] text-slate-400 uppercase font-bold">Condición de Pago</p>
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase mt-0.5 ${sale.payment_type === 'credito' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {sale.payment_type === 'credito' ? `Crédito ${sale.credit_days ? `(${sale.credit_days} días)` : ''}` : 'Contado'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 mb-8">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest print:bg-transparent print:text-slate-900 print:border-b-2 print:border-slate-800">
                                    <th className="p-3 text-left rounded-tl-lg">Producto / Descripción</th>
                                    <th className="p-3 text-right">Precio Unit.</th>
                                    <th className="p-3 text-center">Cant.</th>
                                    <th className="p-3 text-right rounded-tr-lg">Importe</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 border-x border-b border-slate-100">
                                {items.map((item: any, idx: number) => (
                                    <tr key={idx} className="text-[11px] print:text-black">
                                        <td className="p-3">
                                            <p className="font-bold text-slate-900 print:text-black">{item.product_name}</p>
                                        </td>
                                        <td className="p-3 text-right font-medium print:text-black">${(item.unit_price || 0).toLocaleString()}</td>
                                        <td className="p-3 text-center font-black text-sm print:text-black">{item.quantity}</td>
                                        <td className="p-3 text-right font-black print:text-black">${(item.total_price || item.unit_price * item.quantity || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => (
                                    <tr key={`empty-${i}`} className="border-none"><td colSpan={4} className="p-3">&nbsp;</td></tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 print:bg-slate-50">
                                    <td colSpan={3} className="p-4 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest print:text-slate-700">Subtotal:</td>
                                    <td className="p-4 text-right font-black text-slate-900 print:text-black">${(sale.subtotal || 0).toLocaleString()}</td>
                                </tr>
                                <tr className="bg-slate-50 print:bg-slate-50">
                                    <td colSpan={3} className="p-2 text-right font-black text-slate-500 uppercase text-[10px] tracking-widest print:text-slate-700">IVA (16%):</td>
                                    <td className="p-2 text-right font-black text-slate-900 print:text-black">${(sale.iva || 0).toLocaleString()}</td>
                                </tr>
                                <tr className="bg-slate-900 text-white print:bg-transparent print:text-slate-900 print:border-t-2 print:border-slate-800">
                                    <td colSpan={3} className="p-4 text-right font-black uppercase text-[12px] tracking-widest">Total a Pagar:</td>
                                    <td className="p-4 text-right font-black text-xl italic">${(sale.total || 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {sale.notes && (
                        <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Notas</p>
                            <p className="text-xs text-slate-600">{sale.notes}</p>
                        </div>
                    )}

                    {/* Authorization Area */}
                    <div className="grid grid-cols-2 gap-12 pt-10 border-t border-slate-200">
                        <div className="text-center">
                            <div className="h-20 border-b border-slate-300 mb-2 relative">
                                {sale.authorized_exit_by && (
                                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-black text-slate-300 opacity-50 uppercase tracking-widest">Sello Digital Pintamax</span>
                                )}
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Autorizado por (Admin)</p>
                            <p className="text-xs font-black text-slate-900 uppercase">{sale.authorized_exit_by || 'Firma Requerida'}</p>
                        </div>
                        <div className="text-center">
                            <div className="h-20 border-b border-slate-300 mb-2"></div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Recibido de Conformidad</p>
                            <p className="text-xs font-black text-slate-900 uppercase">{sale.delivery_receiver || 'Firma del Receptor'}</p>
                        </div>
                    </div>

                    <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        <p>Folio: <span className="text-slate-900">{folioStr}</span> — Municipio: <span className="text-slate-900">{sale.municipality}</span></p>
                        <p>Pintamax® Sistema Municipal • {new Date().getFullYear()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MunicipalNote;
