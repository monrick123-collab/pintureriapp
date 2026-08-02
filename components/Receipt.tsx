import React from 'react';

export interface ReceiptData {
    folio: number | string;
    date: string;
    cashierName: string;
    branchName: string;
    items: { quantity: number; productName: string; price: number; total: number }[];
    subtotal: number;
    discountAmount: number;
    iva: number;
    total: number;
    paymentMethod: string;
    cashReceived?: number;
    change?: number;
}

const Receipt: React.FC<{ sale: ReceiptData }> = ({ sale }) => {
    const paymentLabel = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia'
    }[sale.paymentMethod] || sale.paymentMethod;

    return (
        <div className="format-thermal hidden print:block bg-white text-black font-mono" style={{ width: '80mm', padding: '4mm' }}>
            {/* Header */}
            <div className="text-center mb-2">
                <h1 className="text-lg font-black uppercase tracking-tight">Pintamax</h1>
                <p className="text-[9px]">Pinturerías y Complementos</p>
                <p className="text-[9px]">RFC: PIN010101ABC</p>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Sale Info */}
            <div className="text-[10px] space-y-0.5 mb-2">
                <div className="flex justify-between">
                    <span>Folio:</span>
                    <span className="font-black">#{typeof sale.folio === 'number' ? `V-${String(sale.folio).padStart(4, '0')}` : sale.folio}</span>
                </div>
                <div className="flex justify-between">
                    <span>Fecha:</span>
                    <span>{sale.date}</span>
                </div>
                <div className="flex justify-between">
                    <span>Cajero:</span>
                    <span>{sale.cashierName}</span>
                </div>
                <div className="flex justify-between">
                    <span>Sucursal:</span>
                    <span>{sale.branchName}</span>
                </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Items Table Header */}
            <div className="flex text-[9px] font-black uppercase border-b border-black pb-0.5 mb-1">
                <span className="w-10 text-center">Cant.</span>
                <span className="flex-1">Producto</span>
                <span className="w-16 text-right">Importe</span>
            </div>

            {/* Items */}
            <div className="space-y-0.5">
                {sale.items.map((item, idx) => (
                    <div key={idx} className="flex text-[10px]">
                        <span className="w-10 text-center font-bold">{item.quantity}</span>
                        <span className="flex-1 truncate">{item.productName}</span>
                        <span className="w-16 text-right font-bold">${item.total.toLocaleString()}</span>
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-black my-2"></div>

            {/* Totals */}
            <div className="text-[10px] space-y-0.5">
                <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${sale.subtotal.toLocaleString()}</span>
                </div>
                {sale.discountAmount > 0 && (
                    <div className="flex justify-between">
                        <span>Descuento:</span>
                        <span>-${sale.discountAmount.toLocaleString()}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span>IVA (16%):</span>
                    <span>${sale.iva.toLocaleString()}</span>
                </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mt-2 pt-1 border-t-2 border-black">
                <span className="text-sm font-black uppercase">TOTAL:</span>
                <span className="text-lg font-black">${sale.total.toLocaleString()}</span>
            </div>

            {/* Payment Info */}
            <div className="border-t border-dashed border-black mt-2 pt-2 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                    <span>Pago:</span>
                    <span className="font-bold">{paymentLabel}</span>
                </div>
                {sale.cashReceived !== undefined && sale.cashReceived > 0 && (
                    <>
                        <div className="flex justify-between">
                            <span>Recibido:</span>
                            <span>${sale.cashReceived.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Cambio:</span>
                            <span className="font-black">${(sale.change || 0).toLocaleString()}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="text-center mt-4 pt-2 border-t border-dashed border-black">
                <p className="text-[10px] font-black">¡Gracias por su compra!</p>
                <p className="text-[8px] mt-1">www.pintamax.com</p>
            </div>
        </div>
    );
};

export default Receipt;