
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, Branch } from '../types';
import { InventoryService } from '../services/inventoryService';

interface BranchesProps {
  user: User;
  onLogout: () => void;
}

const Branches: React.FC<BranchesProps> = ({ user, onLogout }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    manager: '',
    phone: '',
    type: 'store' as 'store' | 'warehouse'
  });

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const data = await InventoryService.getBranches();
      setBranches(data);
    } catch (e) {
      console.error(e);
      alert("Error cargando sucursales");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        address: branch.address,
        manager: branch.manager,
        phone: branch.phone,
        type: branch.type
      });
    } else {
      setEditingBranch(null);
      setFormData({ name: '', address: '', manager: '', phone: '', type: 'store' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      if (editingBranch) {
        // Update
        const updatedBranch: Branch = {
          ...editingBranch,
          ...formData
        };
        await InventoryService.updateBranch(updatedBranch);
        alert("Sucursal actualizada correctamente");
      } else {
        // Create
        const newId = `BR-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        const newBranch: Branch = {
          id: newId,
          status: 'active',
          ...formData
        };
        await InventoryService.createBranch(newBranch);
        alert("Sucursal creada correctamente");
      }

      setIsModalOpen(false);
      loadBranches();
    } catch (e) {
      console.error(e);
      alert("Error al guardar la sucursal. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-primary">
              <span className="material-symbols-outlined text-2xl">store</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Gestión de Sucursales</h1>
              <p className="text-xs font-bold text-slate-400">Administra tus puntos de venta y bodegas</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30 hover:scale-105 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add_location_alt</span>
            <span>Nueva Sucursal</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading && branches.length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold animate-pulse">Cargando sucursales...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {branches.map(branch => (
                <div key={branch.id} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all duration-300">
                  <div className={`h-1.5 w-full ${branch.type === 'warehouse' ? 'bg-orange-500' : 'bg-primary'}`} />
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">{branch.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 font-mono tracking-wider">{branch.id}</span>
                          <span className={`text-[10px] font-black uppercase tracking-wide ${branch.type === 'warehouse' ? 'text-orange-500' : 'text-primary'}`}>
                            {branch.type === 'warehouse' ? 'Bodega' : 'Tienda'}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${branch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {branch.status}
                      </span>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex items-start gap-3">
                        <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-slate-400 text-sm">location_on</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dirección</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-snug">{branch.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Encargado</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{branch.manager}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-slate-400 text-sm">phone</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Teléfono</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{branch.phone}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Link
                        to="/inventory"
                        state={{ branchFilter: branch.id }}
                        className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 text-center flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">inventory_2</span>
                        Inventario
                      </Link>
                      <button
                        onClick={() => handleOpenModal(branch)}
                        className="flex-1 py-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary dark:hover:border-primary hover:text-primary transition-all shadow-sm"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border dark:border-slate-800">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"><span className="material-symbols-outlined text-lg">close</span></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Nombre</label>
                  <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm" placeholder="Ej. Sucursal Norte" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Tipo</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button type="button" onClick={() => setFormData({ ...formData, type: 'store' })} className={`py-2 rounded-lg text-xs font-bold transition-all ${formData.type === 'store' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Punto de Venta</button>
                    <button type="button" onClick={() => setFormData({ ...formData, type: 'warehouse' })} className={`py-2 rounded-lg text-xs font-bold transition-all ${formData.type === 'warehouse' ? 'bg-white dark:bg-slate-800 text-orange-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Bodega</button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Dirección</label>
                  <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm" placeholder="Calle, Número, Col..." value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Encargado</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm" placeholder="Nombre" value={formData.manager} onChange={e => setFormData({ ...formData, manager: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Teléfono</label>
                    <input required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-sm" placeholder="10 dígitos" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>

                <button disabled={loading} type="submit" className="w-full py-3.5 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:pointer-events-none">
                  {loading ? 'Guardando...' : (editingBranch ? 'Guardar Cambios' : 'Crear Sucursal')}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Branches;
