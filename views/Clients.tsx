
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Client, UserRole } from '../types';
import { ClientService } from '../services/clientService';
import AuthorizationModal from '../components/AuthorizationModal';

interface ClientsProps {
  user: User;
  onLogout: () => void;
}

const Clients: React.FC<ClientsProps> = ({ user, onLogout }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const isSub = user.role === UserRole.WAREHOUSE_SUB;
  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    address: '',
    type: 'Individual' as 'Individual' | 'Empresa',
    municipality: '',
    locality: '',
    creditLimit: 0,
    creditDays: 0,
    isActiveCredit: false
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await ClientService.getClients();
      setClients(data);
    } catch (e) {
      console.error("Error loading clients:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode && selectedClientId) {
        await ClientService.updateClient(selectedClientId, newClient);
        alert("Cliente actualizado correctamente");
      } else {
        await ClientService.createClient(newClient as any);
        alert("Cliente registrado correctamente");
      }
      closeModal();
      loadClients();
    } catch (e) {
      console.error(e);
      alert("Error al guardar cliente");
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    // Handle potential null/undefined for new clients before full save, or data issues
    (c.taxId || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleDeleteClient = async (id: string) => {
    if (confirm("¿Eliminar este cliente permanentemente?")) {
      try {
        await ClientService.deleteClient(id);
        loadClients();
      } catch (e) {
        console.error(e);
        alert("Error al eliminar cliente");
      }
    }
  };

  const openEdit = (c: Client) => {
    setIsEditMode(true);
    setSelectedClientId(c.id);
    setNewClient({
      name: c.name,
      email: c.email,
      phone: c.phone,
      taxId: c.taxId,
      address: c.address,
      type: c.type,
      municipality: c.municipality || '',
      locality: c.locality || '',
      creditLimit: c.creditLimit || 0,
      creditDays: c.creditDays || 0,
      isActiveCredit: c.isActiveCredit || false
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditMode(false);
    setSelectedClientId(null);
    setNewClient({
      name: '', email: '', phone: '', taxId: '', address: '', type: 'Individual',
      municipality: '', locality: '', creditLimit: 0, creditDays: 0, isActiveCredit: false
    });
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
        <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>Inicio / Directorio / Clientes</span>
          </div>
          <button
            onClick={() => {
              const action = () => setIsModalOpen(true);
              if (isSub) {
                setPendingAction(() => action);
                setShowAuth(true);
              } else {
                action();
              }
            }}
            className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="material-symbols-outlined">person_add</span>
            <span>Nuevo Cliente</span>
          </button>
        </header>

        <AuthorizationModal
          isOpen={showAuth}
          onClose={() => { setShowAuth(false); setPendingAction(null); }}
          onAuthorized={() => { if (pendingAction) pendingAction(); }}
          description="El subencargado requiere autorización para gestionar clientes."
        />

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Cartera de Clientes</h2>
              <p className="text-slate-500 text-sm">Gestiona la base de datos de compradores frecuentes y empresas.</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Buscar por nombre, RFC o correo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                      <th className="px-6 py-4">Información del Cliente</th>
                      <th className="px-6 py-4">RFC / Contacto</th>
                      <th className="px-6 py-4">Ubicación</th>
                      <th className="px-6 py-4">Crédito</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredClients.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`size-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${c.type === 'Empresa' ? 'bg-indigo-500' : 'bg-orange-500'}`}>
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">{c.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{c.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-600 dark:text-slate-300 font-mono uppercase">{c.taxId}</span>
                            <span className="text-[10px] text-slate-400">{c.email} • {c.phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.municipality || 'N/A'}</span>
                            <span className="text-[10px] text-slate-400">{c.locality || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className={`text-xs font-black ${c.isActiveCredit ? 'text-green-600' : 'text-slate-400'}`}>
                              {c.isActiveCredit ? `$${(c.creditLimit || 0).toLocaleString()}` : 'Sin Crédito'}
                            </span>
                            {c.isActiveCredit && <span className="text-[10px] text-slate-400">{c.creditDays} días</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.type === 'Empresa' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                            {c.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => {
                              const action = () => openEdit(c);
                              if (isSub) {
                                setPendingAction(() => action);
                                setShowAuth(true);
                              } else {
                                action();
                              }
                            }} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button onClick={() => {
                              const action = () => handleDeleteClient(c.id);
                              if (isSub) {
                                setPendingAction(() => action);
                                setShowAuth(true);
                              } else {
                                action();
                              }
                            }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredClients.length === 0 && (
                <div className="px-6 py-12 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-5xl text-slate-200">person_search</span>
                  <p className="text-slate-400 font-medium italic text-sm">No hay resultados para esta búsqueda.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL: ADD/EDIT CLIENT */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <h3 className="font-black text-xl text-slate-900 dark:text-white">{isEditMode ? 'Editar Perfil' : 'Registro de Cliente'}</h3>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-6 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Completo</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Cuenta</label>
                    <select className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold" value={newClient.type} onChange={e => setNewClient({ ...newClient, type: e.target.value as any })}>
                      <option value="Individual">Individual</option>
                      <option value="Empresa">Empresa / RFC</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Correo Electrónico</label>
                    <input type="email" required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RFC / Identificación Fiscal</label>
                  <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold uppercase" value={newClient.taxId} onChange={e => setNewClient({ ...newClient, taxId: e.target.value.toUpperCase() })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Municipio</label>
                    <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold" value={newClient.municipality} onChange={e => setNewClient({ ...newClient, municipality: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Localidad</label>
                    <input className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold" value={newClient.locality} onChange={e => setNewClient({ ...newClient, locality: e.target.value })} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">¿Habilitar Crédito?</label>
                    <input type="checkbox" className="size-5 rounded border-slate-300 text-primary focus:ring-primary" checked={newClient.isActiveCredit} onChange={e => setNewClient({ ...newClient, isActiveCredit: e.target.checked })} />
                  </div>
                  {newClient.isActiveCredit && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Límite ($)</label>
                        <input type="number" className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black" value={newClient.creditLimit} onChange={e => setNewClient({ ...newClient, creditLimit: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Días Plazo</label>
                        <input type="number" className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-black" value={newClient.creditDays} onChange={e => setNewClient({ ...newClient, creditDays: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Domicilio Fiscal / Envío</label>
                  <textarea className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm h-24 resize-none" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} />
                </div>

                <div className="flex gap-4 mt-2">
                  <button type="button" onClick={closeModal} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600 transition-colors">Descartar</button>
                  <button type="submit" className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl hover:shadow-primary/30 active:scale-95 transition-all">
                    {isEditMode ? 'Guardar Cambios' : 'Registrar Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Clients;
