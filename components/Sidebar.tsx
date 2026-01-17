
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();
  const isAdmin = user.role === UserRole.ADMIN;
  const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
  const isFinance = user.role === UserRole.FINANCE;

  const navItems = [
    {
      label: isAdmin ? 'Panel de Control' : isWarehouse ? 'Panel Bodega' : isFinance ? 'Contabilidad' : 'Punto de Venta',
      path: '/',
      icon: isAdmin ? 'dashboard' : isWarehouse ? 'warehouse' : isFinance ? 'payments' : 'point_of_sale'
    },
    ...(user.role !== UserRole.SELLER && !isFinance ? [
      { label: isWarehouse ? 'Ventas / TPV' : 'Punto de Venta', path: '/pos', icon: 'point_of_sale' }
    ] : []),
    { label: 'Cotizador', path: '/quotations', icon: 'request_quote' },
    { label: 'Inventario', path: '/inventory', icon: 'inventory_2' },
    { label: 'Devoluciones', path: '/returns', icon: 'keyboard_return' },
    ...(isAdmin || isWarehouse ? [
      { label: 'Suministros', path: '/supplies', icon: 'dry_cleaning' },
      { label: 'Envasado', path: '/packaging', icon: 'colors' },
    ] : []),
    { label: 'Historial Ventas', path: '/sales-history', icon: 'receipt_long' },
    { label: 'Clientes', path: '/clients', icon: 'group' },
    ...(isAdmin ? [
      { label: 'Contabilidad', path: '/finance', icon: 'payments' },
    ] : []),
    ...(isAdmin ? [
      { label: 'Sucursales', path: '/branches', icon: 'location_on' },
      { label: 'Usuarios y Roles', path: '/users', icon: 'manage_accounts' },
    ] : []),
    ...(isAdmin || isWarehouse ? [
      { label: 'Ventas Mayoreo', path: '/wholesale-pos', icon: 'groups' },
      { label: 'Historial Mayoreo', path: '/wholesale-history', icon: 'history_edu' },
    ] : []),
  ];

  return (
    <>
      {/* Mobile Burger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-5 left-6 z-[60] bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-lg border dark:border-slate-700 text-primary"
      >
        <span className="material-symbols-outlined text-2xl">
          {isOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Overlay for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45]"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static top-0 left-0 h-screen w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 
        flex flex-col flex-shrink-0 transition-all duration-300 z-50 print:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <span className="material-symbols-outlined text-primary text-2xl">format_paint</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter">Pintamax</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">
              {isAdmin ? 'ADMINISTRADOR' : 'COMERCIAL'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-1 custom-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${location.pathname === item.path
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-primary'
                }`}
            >
              <span className="material-symbols-outlined">
                {item.icon}
              </span>
              <span className={`text-sm tracking-tight ${location.pathname === item.path ? 'font-black' : 'font-bold'}`}>
                {item.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
          <div className="flex items-center gap-4">
            <div
              className="size-10 rounded-xl bg-slate-200 dark:bg-slate-700 bg-center bg-cover border-2 border-white dark:border-slate-800 shadow-sm"
              style={{ backgroundImage: `url(${user.avatar})` }}
            />
            <div className="flex flex-col overflow-hidden">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate pr-2 leading-none">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{user.role}</p>
            </div>
            <button
              onClick={onLogout}
              className="ml-auto text-slate-300 hover:text-red-500 transition-colors p-2"
              title="Cerrar Sesión"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
