import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InventoryService } from '../services/inventoryService';
import { User, RestockSheet } from '../types';

interface RestockNoteProps {
    user: User;
    onLogout: () => void;
}

const RestockNote: React.FC<RestockNoteProps> = ({ user }) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [sheet, setSheet] = useState<RestockSheet | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadSheet(id);
        }
    }, [id]);

    const loadSheet = async (sheetId: string) => {
        try {
            setLoading(true);
            const data = await InventoryService.getRestockSheetDetail(sheetId);
            setSheet(data);
        } catch (error) {
            console.error("Error loading restock sheet:", error);
            alert("No se pudo cargar la hoja de resurtido.");
            navigate('/restocks');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            setTimeout(() => {
                window.print();
                html.classList.add('dark');
            }, 150);
        } else {
            window.print();
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="text-center flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-slate-500">Cargando formato de resurtido...</p>
                </div>
            </div>
        );
    }

    if (!sheet) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="text-center font-bold text-slate-500">
                    <p>Hoja de resurtido no encontrada.</p>
                    <button onClick={() => navigate('/restocks')} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg">Regresar</button>
                </div>
            </div>
        );
    }

    const folioStr = `#R-${sheet.folio.toString().padStart(4, '0')}`;
    const dateStr = new Date(sheet.createdAt).toLocaleString();
    const qtyTotal = sheet.items?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-8 px-4 font-sans">
            {/* Action Bar (Not printed) */}
            <div className="max-w-3xl mx-auto mb-6 flex justify-between items-center print:hidden bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <button
                    onClick={() => navigate('/restocks')}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-bold text-sm"
                >
                    <span className="material-symbols-outlined text-xl">arrow_back</span>
                    Volver a Resurtidos
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white hover:bg-primary/90 rounded-xl transition-colors font-black text-sm shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined text-xl">print</span>
                        Imprimir Formato
                    </button>
                </div>
            </div>

            {/* Print Container (Media Carta - Half Letter) */}
            <div className="print-format-container mx-auto bg-white format-half-letter shadow-2xl relative overflow-hidden" 
                 style={{ width: '140mm', minHeight: '216mm', padding: '12mm' }}>
                <div className="relative z-10 h-full flex flex-col">
                    {/* Header */}
                    <div className="border-b-2 border-slate-800 pb-4 flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-2xl">
                                P
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-1">Pintamax</h1>
                                <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Resurtido a Bodega</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-black text-slate-900">{folioStr}</h2>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">{dateStr}</p>
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Destino</p>
                            <p className="font-bold text-slate-900">{sheet.branchName}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Estado / Estimado</p>
                            <p className="font-bold text-slate-900">
                                {sheet.status === 'pending' ? 'Pendiente' : sheet.status === 'shipped' ? 'En Camino' : sheet.status === 'completed' ? 'Completado' : 'Cancelado'}
                                 {' - '}${sheet.totalAmount.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Products Table */}
                    <div className="flex-1">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b-2 border-slate-800">
                                    <th className="py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 w-12 text-center">Cant.</th>
                                    <th className="py-2 text-[10px] font-black uppercase tracking-widest text-slate-900">SKU / Producto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sheet.items?.map((item: any, idx: number) => (
                                    <tr key={idx}>
                                        <td className="py-2 text-center font-black text-slate-900">{item.quantity}</td>
                                        <td className="py-2">
                                            <p className="font-bold text-slate-900">{item.product?.name || 'Varios'}</p>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase">{item.product?.sku || 'N/A'}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-slate-800">
                                    <td className="py-2 text-center font-black text-slate-900">{qtyTotal}</td>
                                    <td className="py-2 text-[10px] font-black uppercase tracking-widest text-slate-900 text-right pr-2">Total Artículos</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Signatures */}
                    <div className="mt-8 pt-4 border-t border-slate-200">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className="border-b border-slate-400 h-10 mb-2"></div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Elaboró</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b border-slate-400 h-10 mb-2"></div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Entregó Bodega</p>
                            </div>
                            <div className="text-center">
                                <div className="border-b border-slate-400 h-10 mb-2"></div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Recibió Sucursal</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RestockNote;
