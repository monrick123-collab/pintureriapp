
import React from 'react';
import Sidebar from '../components/Sidebar';
import { User } from '../types';
import { MOCK_FINANCES } from '../constants';

interface FinanceProps {
  user: User;
  onLogout: () => void;
}

const Finance: React.FC<FinanceProps> = ({ user, onLogout }) => {
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />
      
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-background-light dark:bg-background-dark">
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm pt-6 px-6 lg:px-8 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-[1400px] mx-auto flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Inicio / Finanzas / Gestión de Cuentas</span>
            </div>
            <div className="flex flex-wrap justify-between items-end gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-slate-900 dark:text-white text-3xl font-black tracking-tight">Gestión Financiera</h1>
                <p className="text-slate-500">Cuentas por cobrar, pagar y conciliación fiscal.</p>
              </div>
              <div className="flex gap-3">
                <button className="flex items-center gap-2 h-10 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium rounded-lg">
                  <span className="material-symbols-outlined text-[20px]">file_download</span>
                  <span>Exportar Reporte</span>
                </button>
                <button className="flex items-center gap-2 h-10 px-4 bg-primary text-white text-sm font-bold rounded-lg shadow-lg">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  <span>Nueva Transacción</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 sm:px-8 pb-10 max-w-[1400px] mx-auto w-full flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {['Por Cobrar', 'Por Pagar', 'Balance Neto', 'Pendientes'].map((stat, i) => (
              <div key={i} className="rounded-xl p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <p className="text-slate-500 text-sm font-medium">{stat}</p>
                <h3 className="text-2xl font-bold tracking-tight mt-1">
                  {i === 3 ? '12' : `$${(Math.random() * 100000).toLocaleString()}`}
                </h3>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Factura #</th>
                    <th className="px-6 py-4 font-semibold">Contraparte</th>
                    <th className="px-6 py-4 font-semibold">Sucursal</th>
                    <th className="px-6 py-4 font-semibold">Vencimiento</th>
                    <th className="px-6 py-4 font-semibold">Estado</th>
                    <th className="px-6 py-4 font-semibold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {MOCK_FINANCES.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-primary">{inv.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {inv.colorCode}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">{inv.counterparty}</span>
                            <span className="text-xs text-slate-500">{inv.counterpartyId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{inv.branch}</td>
                      <td className={`px-6 py-4 font-medium ${inv.status === 'overdue' ? 'text-red-500' : ''}`}>{inv.dueDate}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          inv.status === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {inv.status === 'overdue' ? 'Vencido' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold">${inv.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Finance;
