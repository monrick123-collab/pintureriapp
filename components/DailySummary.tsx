import React, { useState, useEffect } from 'react';
import { Sale, Product, UserRole } from '../types';

interface DailySummaryProps {
  sales: Sale[];
  products: Product[];
  userRole: UserRole;
  userName: string;
  branchName?: string;
}

const DailySummary: React.FC<DailySummaryProps> = ({ 
  sales, 
  products, 
  userRole, 
  userName,
  branchName = 'Sucursal Actual'
}) => {
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [currentTime, setCurrentTime] = useState<string>('');
  
  useEffect(() => {
    // Actualizar hora del día
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 12) setTimeOfDay('morning');
      else if (hour < 18) setTimeOfDay('afternoon');
      else setTimeOfDay('evening');
      
      // Formatear hora actual
      setCurrentTime(now.toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000); // Actualizar cada minuto
    
    return () => clearInterval(interval);
  }, []);

  // Calcular métricas del día
  const today = new Date().toDateString();
  const todaySales = sales.filter(s => {
    const saleDate = new Date(s.createdAt);
    return saleDate.toDateString() === today;
  });

  const totalToday = todaySales.reduce((sum, s) => sum + s.total, 0);
  const avgTicket = todaySales.length > 0 ? totalToday / todaySales.length : 0;
  
  // Ventas por método de pago
  const paymentMethods = todaySales.reduce((acc: Record<string, number>, sale) => {
    const method = sale.paymentMethod === 'cash' ? 'Efectivo' : 
                   sale.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia';
    acc[method] = (acc[method] || 0) + sale.total;
    return acc;
  }, {});

  // Productos más vendidos hoy
  const topProducts = todaySales
    .flatMap(s => s.items)
    .reduce((acc: Record<string, { quantity: number, revenue: number }>, item) => {
      if (!acc[item.productName]) {
        acc[item.productName] = { quantity: 0, revenue: 0 };
      }
      acc[item.productName].quantity += item.quantity;
      acc[item.productName].revenue += item.total;
      return acc;
    }, {});

  const top3 = Object.entries(topProducts)
    .sort(([,a], [,b]) => b.quantity - a.quantity)
    .slice(0, 3)
    .map(([name, data]) => ({ name, ...data }));

  // Alertas de stock bajo
  const lowStockAlerts = products
    .filter(p => {
      const totalStock = Object.values(p.inventory || {}).reduce((sum: number, stock: number) => sum + stock, 0);
      return totalStock < 5;
    })
    .slice(0, 3);

  // Ventas por hora (últimas 8 horas)
  const hourlySales = Array.from({ length: 8 }, (_, i) => {
    const hour = new Date().getHours() - i;
    const hourLabel = hour < 0 ? `${24 + hour}:00` : `${hour}:00`;
    const salesInHour = todaySales.filter(s => {
      const saleHour = new Date(s.createdAt).getHours();
      return saleHour === (hour < 0 ? 24 + hour : hour);
    }).reduce((sum, s) => sum + s.total, 0);
    
    return { hour: hourLabel, sales: salesInHour };
  }).reverse();

  // Saludo personalizado basado en rol
  const getRoleGreeting = () => {
    switch (userRole) {
      case UserRole.ADMIN:
        return `Administrador ${userName}`;
      case UserRole.SELLER:
        return `Vendedor ${userName}`;
      case UserRole.WAREHOUSE:
      case UserRole.WAREHOUSE_SUB:
        return `Encargado de Bodega ${userName}`;
      case UserRole.FINANCE:
        return `Contador ${userName}`;
      case UserRole.STORE_MANAGER:
        return `Encargado de Tienda ${userName}`;
      default:
        return userName;
    }
  };

  return (
    <div className="space-y-6">
      {/* Saludo personalizado */}
      <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black mb-1">
              ¡Buen{timeOfDay === 'morning' ? 'os días' : timeOfDay === 'afternoon' ? 'as tardes' : 'as noches'}, {getRoleGreeting()}!
            </h1>
            <p className="opacity-90">{branchName} • {currentTime}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black">{todaySales.length}</div>
            <div className="text-sm opacity-80">ventas hoy</div>
          </div>
        </div>
      </div>

      {/* Métricas principales en cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ventas hoy */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400">trending_up</span>
            </div>
            <span className="text-xs font-bold text-slate-400">HOY</span>
          </div>
          <h3 className="text-2xl font-black">${totalToday.toLocaleString()}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Ventas totales</p>
          <div className="mt-3 pt-3 border-t dark:border-slate-700">
            <div className="flex justify-between text-xs">
              <span className="text-green-600 dark:text-green-400 font-bold">
                +{todaySales.length} transacciones
              </span>
              <span className="text-slate-500">Ticket: ${avgTicket.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Métodos de pago */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">payments</span>
            </div>
            <span className="text-xs font-bold text-slate-400">PAGOS</span>
          </div>
          <div className="space-y-2">
            {Object.entries(paymentMethods).length > 0 ? (
              Object.entries(paymentMethods).map(([method, amount]) => (
                <div key={method} className="flex justify-between items-center">
                  <span className="text-sm">{method}</span>
                  <span className="font-bold text-primary">${amount.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm">Sin transacciones hoy</p>
            )}
          </div>
        </div>

        {/* Productos más vendidos */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">star</span>
            </div>
            <span className="text-xs font-bold text-slate-400">TOP 3</span>
          </div>
          <div className="space-y-3">
            {top3.length > 0 ? top3.map((product, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </div>
                  <span className="text-sm truncate max-w-[120px]">{product.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-primary">{product.quantity} uds</span>
                  <div className="text-[10px] text-slate-500">${product.revenue.toLocaleString()}</div>
                </div>
              </div>
            )) : (
              <p className="text-slate-400 text-sm">Sin ventas hoy</p>
            )}
          </div>
        </div>

        {/* Alertas importantes */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400">notifications</span>
            </div>
            <span className="text-xs font-bold text-slate-400">ALERTAS</span>
          </div>
          <div className="space-y-2">
            {lowStockAlerts.length > 0 ? lowStockAlerts.map(product => {
              const totalStock = Object.values(product.inventory || {}).reduce((sum: number, stock: number) => sum + stock, 0);
              return (
                <div key={product.id} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm truncate flex-1">{product.name}</span>
                  <span className="text-xs font-bold text-red-600">Stock: {totalStock}</span>
                </div>
              );
            }) : (
              <div className="text-center py-2">
                <span className="material-symbols-outlined text-green-500 text-2xl">check_circle</span>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sin alertas críticas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de ventas por hora (simplificado) */}
      {todaySales.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Ventas por hora (últimas 8 horas)</h3>
            <span className="text-xs font-bold text-slate-400">TENDENCIA</span>
          </div>
          
          <div className="flex items-end h-32 gap-1">
            {hourlySales.map((hourData, index) => {
              const maxSales = Math.max(...hourlySales.map(h => h.sales));
              const height = maxSales > 0 ? (hourData.sales / maxSales) * 80 : 0;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className={`w-full rounded-t-lg transition-all ${
                      hourData.sales > 0 
                        ? 'bg-gradient-to-t from-primary to-blue-400' 
                        : 'bg-slate-100 dark:bg-slate-700'
                    }`}
                    style={{ height: `${Math.max(height, 2)}px` }}
                    title={`${hourData.hour}: $${hourData.sales.toLocaleString()}`}
                  />
                  <span className="text-[10px] text-slate-500 mt-1">{hourData.hour}</span>
                  {hourData.sales > 0 && (
                    <span className="text-[9px] font-bold text-primary mt-1">
                      ${hourData.sales.toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Acciones rápidas basadas en rol */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5">
        <h3 className="font-bold mb-3">Acciones rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 hover:border-primary transition-colors flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_shopping_cart</span>
            <span className="text-sm font-bold">Nueva Venta</span>
          </button>
          
          <button className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 hover:border-primary transition-colors flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-green-500">inventory</span>
            <span className="text-sm font-bold">Ver Inventario</span>
          </button>
          
          <button className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 hover:border-primary transition-colors flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">receipt_long</span>
            <span className="text-sm font-bold">Reportes</span>
          </button>
          
          <button className="p-3 bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 hover:border-primary transition-colors flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-purple-500">group</span>
            <span className="text-sm font-bold">Clientes</span>
          </button>
        </div>
      </div>

      {/* Información del sistema */}
      <div className="text-center text-xs text-slate-500 dark:text-slate-400 pt-4">
        <p>Sistema Pintamax • Última actualización: {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="mt-1">
          {todaySales.length > 0 ? (
            <span className="text-green-600 dark:text-green-400 font-bold">
              ✓ Día productivo: ${totalToday.toLocaleString()} en ventas
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              ⚠️ Aún no hay ventas registradas hoy
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default DailySummary;