import React from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole } from '../types';
import { UserService } from '../services/userService';
import { InventoryService } from '../services/inventoryService';

interface UserManagementProps {
  user: User;
  onLogout: () => void;
}

const UserManagement: React.FC<UserManagementProps> = ({ user, onLogout }) => {
  const [users, setUsers] = React.useState<any[]>([]);
  const [branches, setBranches] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    id: '', name: '', email: '', role: 'SELLER', branchId: 'BR-MAIN'
  });

  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profiles, branchData] = await Promise.all([
        UserService.getProfiles(),
        InventoryService.getBranches()
      ]);
      setUsers(profiles);
      setBranches(branchData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await UserService.createProfile(formData);
      setIsModalOpen(false);
      setFormData({ id: '', name: '', email: '', role: 'SELLER', branchId: 'BR-MAIN' });
      loadData();
      alert("Usuario creado correctamente");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

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
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg font-medium shadow-md hover:scale-105 transition-all"
              >
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
                          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                            {u.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{u.full_name}</span>
                            <span className="text-xs text-slate-500">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{u.branch_id || '---'}</td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-green-600">Activo</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Nuevo Usuario */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col transform animate-in zoom-in-95">
              <div className="p-8 overflow-y-auto">
                <h3 className="text-xl font-bold mb-6">Crear Nuevo Usuario</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">ID de Usuario (Mock)</label>
                    <input required className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ej: WH-002" value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Nombre Completo</label>
                    <input required className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Correo Electrónico</label>
                    <input required type="email" className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg outline-none focus:ring-2 focus:ring-primary/20" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Rol</label>
                      <select className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                        <option value="ADMIN">Administrador</option>
                        <option value="SELLER">Vendedor</option>
                        <option value="WAREHOUSE">Bodeguero</option>
                        <option value="FINANCE">Contador</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Sucursal</label>
                      <select className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg" value={formData.branchId} onChange={e => setFormData({ ...formData, branchId: e.target.value })}>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 font-bold text-slate-400">Cancelar</button>
                    <button type="submit" className="flex-1 py-2.5 bg-primary text-white font-bold rounded-lg shadow-lg">Guardar</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default UserManagement;
