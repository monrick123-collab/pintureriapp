import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

const DENOMINATIONS = [
    { value: 500, label: '$500', type: 'billete' },
    { value: 200, label: '$200', type: 'billete' },
    { value: 100, label: '$100', type: 'billete' },
    { value: 50, label: '$50', type: 'billete' },
    { value: 20, label: '$20', type: 'billete' },
    { value: 10, label: '$10', type: 'moneda' },
    { value: 5, label: '$5', type: 'moneda' },
    { value: 2, label: '$2', type: 'moneda' },
    { value: 1, label: '$1', type: 'moneda' },
    { value: 0.5, label: '50¢', type: 'moneda' },
];

const CoinChangeNote: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data: r, error } = await supabase
                    .from('coin_change_requests')
                    .select('*, branches(name)')
                    .eq('id', id)
                    .single();
                if (error) throw error;
                setData(r);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>;
    if (!data) return <div className="flex items-center justify-center h-screen text-red-500">No se encontró la solicitud.</div>;

    const breakdown: Record<string, number> = data.breakdown_details || {};
    const date = new Date(data.created_at).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const folio = `#C-${(data.folio || 0).toString().padStart(4, '0')}`;

    return (
        <div className="bg-slate-100 min-h-screen flex flex-col items-center py-8 print:bg-white print:py-0">
            {/* Print button — hidden when printing */}
            <div className="mb-6 flex gap-4 print:hidden">
                <button
                    onClick={() => window.print()}
                    className="px-8 py-3 bg-amber-500 text-white font-black rounded-2xl shadow-lg uppercase tracking-widest text-sm hover:scale-105 transition-all flex items-center gap-2"
                >
                    <span className="material-symbols-outlined">print</span>
                    Imprimir
                </button>
                <button
                    onClick={() => window.history.back()}
                    className="px-6 py-3 bg-white text-slate-600 font-black rounded-2xl border text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Regresar
                </button>
            </div>

            {/*
              Media carta = 5.5" x 8.5" = 139.7mm x 215.9mm
              We use approx 140mm x 216mm
            */}
            <style>{`
                @media print {
                    @page {
                        size: 139.7mm 215.9mm;
                        margin: 8mm;
                    }
                    body { margin: 0; background: white; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>

            <div
                className="bg-white shadow-2xl"
                style={{ width: '139.7mm', minHeight: '215.9mm', padding: '8mm', fontFamily: 'sans-serif', fontSize: '9pt', boxSizing: 'border-box' }}
            >
                {/* Header */}
                <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: '4mm', marginBottom: '4mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontWeight: 900, fontSize: '14pt', letterSpacing: '-0.5px', lineHeight: 1 }}>Pintamax<span style={{ color: '#6366f1', fontSize: '10pt' }}>®</span></div>
                        <div style={{ fontSize: '7pt', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2mm' }}>
                            Comprobante de Cambio de Moneda
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontSize: '12pt', color: '#f59e0b' }}>{folio}</div>
                        <div style={{ fontSize: '7pt', color: '#94a3b8', marginTop: '1mm' }}>{date}</div>
                    </div>
                </div>

                {/* Branch and status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '4mm' }}>
                    <div style={{ background: '#f8fafc', borderRadius: '4mm', padding: '3mm' }}>
                        <div style={{ fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px', marginBottom: '1mm' }}>Sucursal</div>
                        <div style={{ fontWeight: 700, fontSize: '9pt' }}>{data.branches?.name || data.branch_id}</div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: '4mm', padding: '3mm' }}>
                        <div style={{ fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px', marginBottom: '1mm' }}>Estado</div>
                        <div style={{ fontWeight: 700, fontSize: '9pt', color: data.status === 'completed' ? '#16a34a' : '#f59e0b' }}>
                            {data.status === 'completed' ? 'Completado' : data.status === 'coins_sent' ? 'Monedas Enviadas' : 'Pendiente'}
                        </div>
                    </div>
                </div>

                {/* Messenger */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '3mm', padding: '3mm', marginBottom: '4mm' }}>
                    <div style={{ fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', color: '#92400e', letterSpacing: '1px', marginBottom: '1mm' }}>
                        Mensajero / Quien lleva las monedas
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '9pt' }}>{data.collected_by || '—'}</div>
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'center', margin: '4mm 0', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', padding: '3mm 0' }}>
                    <div style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px' }}>Monto Total</div>
                    <div style={{ fontSize: '20pt', fontWeight: 900, color: '#f59e0b', lineHeight: 1.2 }}>${(data.amount || 0).toLocaleString()}</div>
                </div>

                {/* Breakdown */}
                <div style={{ marginBottom: '4mm' }}>
                    <div style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', color: '#475569', letterSpacing: '1px', marginBottom: '2mm' }}>
                        Desglose de Denominaciones
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase' }}>
                                <th style={{ textAlign: 'left', padding: '1mm 2mm' }}>Denominación</th>
                                <th style={{ textAlign: 'center', padding: '1mm 2mm' }}>Tipo</th>
                                <th style={{ textAlign: 'center', padding: '1mm 2mm' }}>Cantidad</th>
                                <th style={{ textAlign: 'right', padding: '1mm 2mm' }}>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {DENOMINATIONS.filter(d => (breakdown[d.value.toString()] || 0) > 0).map(d => {
                                const qty = breakdown[d.value.toString()] || 0;
                                return (
                                    <tr key={d.value} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1mm 2mm', fontWeight: 700 }}>{d.label}</td>
                                        <td style={{ padding: '1mm 2mm', textAlign: 'center', color: d.type === 'billete' ? '#16a34a' : '#d97706', fontWeight: 700, textTransform: 'uppercase', fontSize: '7pt' }}>{d.type}</td>
                                        <td style={{ padding: '1mm 2mm', textAlign: 'center', fontWeight: 900 }}>{qty}</td>
                                        <td style={{ padding: '1mm 2mm', textAlign: 'right', fontWeight: 700 }}>${(d.value * qty).toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                            {Object.keys(breakdown).length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2mm', color: '#94a3b8' }}>Sin desglose registrado</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Signatures */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '4mm', marginTop: 'auto' }}>
                    <div style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '1px', marginBottom: '4mm', textAlign: 'center' }}>
                        Firmas de Conformidad
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4mm' }}>
                        {[
                            { label: 'Mensajero', sublabel: data.collected_by || '_______________' },
                            { label: 'Encargado', sublabel: '_______________' },
                            { label: 'Administrador', sublabel: '_______________' }
                        ].map((sig, i) => (
                            <div key={i} style={{ textAlign: 'center' }}>
                                <div style={{ height: '12mm', borderBottom: '1px solid #94a3b8', marginBottom: '2mm' }}></div>
                                <div style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', color: '#475569' }}>{sig.label}</div>
                                <div style={{ fontSize: '6pt', color: '#94a3b8', marginTop: '0.5mm' }}>{sig.sublabel}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{ marginTop: '4mm', textAlign: 'center', fontSize: '6pt', color: '#cbd5e1', borderTop: '1px solid #f1f5f9', paddingTop: '2mm' }}>
                    Pintamax S.A. de C.V. • Sistema de Gestión Interno • {folio}
                </div>
            </div>
        </div>
    );
};

export default CoinChangeNote;
