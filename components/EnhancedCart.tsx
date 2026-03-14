import React from 'react';
import { CartItem } from '../types';

interface EnhancedCartProps {
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onApplyDiscount: () => void;
  onCheckout: () => void;
  subtotal: number;
  discountAmount: number;
  iva: number;
  total: number;
  currentBranchId: string;
}

const EnhancedCart: React.FC<EnhancedCartProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onApplyDiscount,
  onCheckout,
  subtotal,
  discountAmount,
  iva,
  total,
  currentBranchId
}) => {
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calcular si hay productos con stock bajo en el carrito
  const lowStockItems = items.filter(item => {
    const branchStock = item.inventory?.[currentBranchId] || 0;
    return item.quantity > branchStock;
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border dark:border-slate-700 h-full flex flex-col">
      {/* Header del carrito */}
      <div className="p-4 border-b dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined text-primary text-2xl">
                shopping_cart
              </span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold size-5 rounded-full flex items-center justify-center animate-bounce">
                  {totalItems}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">Carrito de Venta</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sucursal: {currentBranchId}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {totalItems > 0 && (
              <button
                onClick={() => items.forEach(item => onRemoveItem(item.id))}
                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Vaciar carrito"
              >
                <span className="material-symbols-outlined">delete_sweep</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alertas importantes */}
      {lowStockItems.length > 0 && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500">warning</span>
            <p className="text-sm font-bold text-red-700 dark:text-red-300">
              ¡Atención! {lowStockItems.length} producto{lowStockItems.length !== 1 ? 's' : ''} excede{lowStockItems.length !== 1 ? 'n' : ''} el stock disponible
            </p>
          </div>
        </div>
      )}

      {/* Lista de productos */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-50">shopping_cart</span>
            <p className="font-bold text-slate-500 dark:text-slate-400">Carrito vacío</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Agrega productos desde el catálogo
            </p>
          </div>
        ) : (
          items.map(item => {
            const branchStock = item.inventory?.[currentBranchId] || 0;
            const isLowStock = item.quantity > branchStock;
            const itemTotal = item.price * item.quantity;
            
            return (
              <div 
                key={`${item.id}-${item.selectedColor || ''}`} 
                className={`p-3 rounded-xl border dark:border-slate-700 transition-all ${
                  isLowStock 
                    ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' 
                    : 'hover:border-primary dark:hover:border-primary'
                }`}
              >
                <div className="flex gap-3">
                  {/* Imagen del producto */}
                  <div className="relative flex-shrink-0">
                    <img 
                      src={item.image} 
                      className="w-16 h-16 object-contain rounded-lg bg-slate-100 dark:bg-slate-900 p-1" 
                      alt={item.name} 
                    />
                    {item.selectedColor && (
                      <div 
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"
                        style={{ backgroundColor: item.selectedColor }}
                        title={`Color: ${item.selectedColor}`}
                      />
                    )}
                  </div>

                  {/* Detalles del producto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400">SKU: {item.sku}</span>
                          {item.wholesalePrice && item.quantity >= (item.wholesaleMinQty || 12) && (
                            <span className="text-xs font-bold bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded">
                              MAYOREO
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="flex-shrink-0 p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-3">
                      {/* Selector de cantidad mejorado */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-full border dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={item.quantity <= 1}
                        >
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              const delta = val - item.quantity;
                              onUpdateQuantity(item.id, delta);
                            }}
                            className="w-14 text-center font-bold border-b dark:border-slate-700 dark:bg-transparent focus:border-primary outline-none [appearance:textfield] py-1"
                          />
                          {isLowStock && (
                            <div className="absolute -bottom-5 left-0 right-0 text-[10px] text-red-500 font-bold text-center">
                              Stock: {branchStock}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-full border dark:border-slate-700 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>

                      {/* Precio y total */}
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          ${itemTotal.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>${item.price.toLocaleString()} c/u</span>
                          {item.wholesalePrice && item.quantity >= (item.wholesaleMinQty || 12) && (
                            <>
                              <span className="text-green-600 dark:text-green-400">•</span>
                              <span className="text-green-600 dark:text-green-400 font-bold">
                                ${item.wholesalePrice?.toLocaleString()} mayoreo
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Indicador de stock */}
                    {branchStock < 10 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1 text-xs">
                          <span className={`material-symbols-outlined text-sm ${
                            branchStock < 3 ? 'text-red-500' : 'text-amber-500'
                          }`}>
                            {branchStock < 3 ? 'error' : 'warning'}
                          </span>
                          <span className={`font-bold ${
                            branchStock < 3 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {branchStock < 3 ? 'Stock crítico' : 'Stock bajo'}: {branchStock} unidad{branchStock !== 1 ? 'es' : ''} disponible{branchStock !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resumen y acciones */}
      <div className="p-4 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-4">
        {/* Resumen rápido */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Subtotal ({totalItems} items)</span>
            <span className="font-bold">${subtotal.toLocaleString()}</span>
          </div>
          
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600 dark:text-green-400 font-bold">Descuento aplicado</span>
              <span className="font-bold text-green-600 dark:text-green-400">-${discountAmount.toLocaleString()}</span>
            </div>
          )}
          
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">IVA (16%)</span>
            <span className="font-bold">${iva.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between text-lg font-bold border-t dark:border-slate-700 pt-2">
            <span>Total a pagar</span>
            <span className="text-primary text-xl">${total.toLocaleString()}</span>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onApplyDiscount}
            disabled={items.length === 0}
            className="py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold rounded-xl hover:bg-amber-200 dark:hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined">percent</span>
            Descuento
          </button>
          <button
            onClick={onCheckout}
            disabled={items.length === 0 || lowStockItems.length > 0}
            className="py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined">payments</span>
            Proceder al pago
          </button>
        </div>

        {/* Métodos de pago rápidos */}
        <div className="pt-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Método de pago:</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { method: 'cash', label: 'Efectivo', icon: 'payments' },
              { method: 'card', label: 'Tarjeta', icon: 'credit_card' },
              { method: 'transfer', label: 'Transferencia', icon: 'account_balance' }
            ].map(({ method, label, icon }) => (
              <button
                key={method}
                onClick={() => {/* Seleccionar método - se implementará en el componente padre */}}
                className="py-2 text-xs font-bold border dark:border-slate-700 rounded-lg hover:border-primary hover:text-primary dark:hover:border-primary transition-colors flex flex-col items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Información adicional */}
        {items.length > 0 && (
          <div className="pt-2 border-t dark:border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                <span>Presiona Enter para agregar productos rápido</span>
              </div>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm">print</span>
                <span>Imprimir ticket</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedCart;