
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, UserRole } from '../types';

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const [isOpen, setIsOpen] = React.useState(false);
  const location = useLocation();
  const isAdmin = user.role === UserRole.ADMIN;
  const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
  const isStoreManager = user.role === UserRole.STORE_MANAGER;
  const isFinance = user.role === UserRole.FINANCE;

  type NavItem = { label: string; path: string; icon: string };
  type Section = { title: string; items: NavItem[] };

  const sections: Section[] = [
    // ── PRINCIPAL ──────────────────────────────────────
    {
      title: '⚡ Principal',
      items: [
        {
          label: isAdmin ? 'Panel de Control' : isWarehouse ? 'Panel Bodega' : isFinance ? 'Contabilidad' : 'Punto de Venta',
          path: '/',
          icon: isAdmin ? 'dashboard' : isWarehouse ? 'warehouse' : isFinance ? 'payments' : 'point_of_sale',
        },
        ...(user.role !== UserRole.SELLER && !isFinance && !isWarehouse && !isStoreManager
          ? [{ label: 'Punto de Venta', path: '/pos', icon: 'point_of_sale' }]
          : []),
        { label: 'Inventario', path: '/inventory', icon: 'inventory_2' },
      ],
    },

    // ── VENTAS ─────────────────────────────────────────
    ...((!isWarehouse && !isFinance) ? [{
      title: '🛒 Ventas',
      items: [
        ...(isAdmin || isStoreManager ? [{ label: 'Cotizador', path: '/quotations', icon: 'request_quote' }] : []),
        ...(isAdmin || isWarehouse || isStoreManager ? [{ label: 'Ventas Mayoreo', path: '/wholesale-pos', icon: 'groups' }] : []),
        ...(isAdmin || isStoreManager ? [{ label: 'Venta Municipio', path: '/municipal-pos', icon: 'account_balance' }] : []),
        { label: 'Historial Ventas', path: '/sales-history', icon: 'receipt_long' },
        ...(isAdmin || isWarehouse ? [{ label: 'Historial Mayoreo', path: '/wholesale-history', icon: 'history_edu' }] : []),
        { label: 'Clientes', path: '/clients', icon: 'group' },
      ].filter(Boolean) as NavItem[],
    }] : []),

    // ── BODEGA / LOGÍSTICA ─────────────────────────────
    ...(isAdmin || isWarehouse || isStoreManager ? [{
      title: '📦 Bodega',
      items: [
        ...(isAdmin || isWarehouse || isStoreManager ? [
          { label: 'Devoluciones', path: '/returns', icon: 'keyboard_return' },
          { label: 'Resurtidos', path: '/restocks', icon: 'reorder' },
          { label: 'Traspasos', path: '/transfers', icon: 'local_shipping' },
          { label: 'Envasado', path: '/packaging', icon: 'colors' },
          { label: 'Suministros', path: '/supplies', icon: 'dry_cleaning' },
        ] : []),
        ...(isWarehouse ? [
          { label: 'Ventas Mayoreo', path: '/wholesale-pos', icon: 'groups' },
          { label: 'Venta Municipio', path: '/municipal-pos', icon: 'account_balance' },
          { label: 'Historial Mayoreo', path: '/wholesale-history', icon: 'history_edu' },
        ] : []),
      ] as NavItem[],
    }] : []),

    // ── ADMINISTRACIÓN ─────────────────────────────────
    ...(isAdmin || isStoreManager ? [{
      title: '⚙️ Admin',
      items: [
        ...(isAdmin || isStoreManager ? [
          { label: 'Cambio Moneda', path: '/coin-change', icon: 'currency_exchange' },
          { label: 'Corte de Caja', path: '/cash-cut', icon: 'point_of_sale' },
        ] : []),
        ...(isAdmin ? [
          { label: 'Aprobación Cortes', path: '/admin-cash-cuts', icon: 'price_check' },
          { label: 'Sucursales', path: '/branches', icon: 'location_on' },
          { label: 'Usuarios y Roles', path: '/users', icon: 'manage_accounts' },
          { label: 'Contabilidad', path: '/finance', icon: 'payments' },
        ] : []),
      ] as NavItem[],
    }] : []),

    // Corte de caja para bodega/warehouse
    ...(isWarehouse ? [{
      title: '⚙️ Admin',
      items: [
        ...(user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB
          ? [{ label: 'Corte de Caja', path: '/cash-cut', icon: 'point_of_sale' }]
          : []),
      ] as NavItem[],
    }] : []),

    // ── FINANZAS ───────────────────────────────────────
    ...(isAdmin || isFinance ? [{
      title: '📈 Finanzas',
      items: [
        { label: 'Finanzas', path: '/finance-dashboard', icon: 'account_balance' },
        { label: 'Proveedores', path: '/suppliers', icon: 'local_shipping' },
        { label: 'Cuentas por Pagar', path: '/accounts-payable', icon: 'request_quote' },
        { label: 'Arrendamientos', path: '/leases', icon: 'apartment' },
      ] as NavItem[],
    }] : []),
  ].filter(s => s.items.length > 0);

  return (
    <>
      {/* Mobile Burger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-5 left-6 z-[60] bg-white dark:bg-slate-800 p-2.5 rounded-xl shadow-lg border dark:border-slate-700 text-primary"
      >
        <span className="material-symbols-outlined text-2xl">{isOpen ? 'close' : 'menu'}</span>
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45]" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`
        fixed lg:static top-0 left-0 h-screen w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800
        flex flex-col flex-shrink-0 transition-all duration-300 z-50 print:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="bg-primary/10 p-2.5 rounded-xl">
            <span className="material-symbols-outlined text-primary text-2xl">format_paint</span>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter leading-none">Pintamax</h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
              {isAdmin ? 'Administrador' : isWarehouse ? 'Logística / Bodega' : isFinance ? 'Contabilidad' : isStoreManager ? 'Encargado' : 'Comercial'}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {sections.map((section, si) => (
            <div key={si} className="mb-1">
              {/* Section separator (except first) */}
              {si > 0 && (
                <div className="mx-4 my-2 h-px bg-slate-100 dark:bg-slate-800" />
              )}
              {/* Section label */}
              <p className="px-5 pt-2 pb-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
                {section.title}
              </p>
              {section.items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`mx-2 flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${location.pathname === item.path
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-primary dark:hover:text-primary'
                    }`}
                >
                  <span className={`material-symbols-outlined text-[20px] shrink-0 transition-transform ${location.pathname === item.path ? '' : 'group-hover:scale-110'
                    }`}>{item.icon}</span>
                  <span className={`text-sm tracking-tight leading-none ${location.pathname === item.path ? 'font-black' : 'font-semibold'}`}>
                    {item.label}
                  </span>
                  {location.pathname === item.path && (
                    <span className="ml-auto size-1.5 rounded-full bg-white/60"></span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="size-9 rounded-xl bg-slate-200 dark:bg-slate-700 bg-center bg-cover border-2 border-white dark:border-slate-800 shadow-sm shrink-0"
              style={{ backgroundImage: `url(${user.avatar})` }}
            />
            <div className="flex flex-col overflow-hidden mr-auto">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate leading-none">{user.name}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">{user.role}</p>
            </div>
            <button
              onClick={() => setIsDark(!isDark)}
              className="text-slate-400 hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title={isDark ? 'Modo Claro' : 'Modo Oscuro'}
            >
              <span className="material-symbols-outlined text-xl">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button
              onClick={onLogout}
              className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Cerrar Sesión"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
