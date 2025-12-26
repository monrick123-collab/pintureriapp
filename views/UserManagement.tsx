
import React from 'react';
import Sidebar from '../components/Sidebar';
import { User } from '../types';

interface UserManagementProps {
  user: User;
  onLogout: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ user, onLogout }) => {
  const users = [
    { id: '1', name: 'Juan Pérez', email: 'juan.perez@pintamax.com', role: 'Administrador', branch: 'Matriz Central', status: 'Activo' },
    { id: '2', name: 'María García', email: 'm.garcia@pintamax.com', role: 'Vendedor', branch: 'Sucursal Norte', status: 'Activo' },
    { id: '3', name: 'Carlos Ruiz', email: 'carlos.r@pintamax.com', role: 'Bodeguero', branch: 'Bodega Principal', status: 'Activo' },
    { id: '4', name: 'Ana López', email: 'ana.lopez@pintamax.com', role: 'Contador', branch: 'Matriz Central', status: 'Inactivo' },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />
      
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
        <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>Inicio / Administración / Usuarios</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-slate-400">notifications</span>
            <span className="material-symbols-outlined text-slate-400">help</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Gestión de Usuarios</h2>
                <p className="text-slate-500 text-sm">Administra cuentas, roles y permisos de acceso.</p>
              </div>
              <button className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-medium shadow-md">
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>Nuevo Usuario</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="relative w-full md:max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" placeholder="Buscar por nombre, correo o ID..." />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase text-slate-500 font-semibold tracking-wide">
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4">Rol</th>
                    <th className="px-6 py-4">Sucursal</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{u.name}</span>
                            <span className="text-xs text-slate-500">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{u.branch}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-medium ${u.status === 'Activo' ? 'text-green-600' : 'text-red-600'}`}>{u.status}</span>
                      </td>
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

export default UserManagement;
