
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, RestockRequest, UserRole } from '../types';
import { MOCK_BRANCHES } from '../constants';
import { InventoryService } from '../services/inventoryService';

interface InventoryProps {
  user: User;
  onLogout: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ user, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('BR-MAIN');
  const [viewMode, setViewMode] = useState<'products' | 'requests'>('products');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const isAdmin = user.role === UserRole.ADMIN;

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', category: 'Interiores', price: 0, image: '', description: '',
    wholesalePrice: 0, wholesaleMinQty: 12
  });

  useEffect(() => {
    loadData();
  }, [selectedBranchId, viewMode, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const loadedProducts = await InventoryService.getProductsByBranch(selectedBranchId);
      const loadedBranches = await InventoryService.getBranches();
      setProducts(loadedProducts);
      setBranches(loadedBranches);

      if (viewMode === 'requests') {
        const loadedRequests = await InventoryService.getRestockRequests(
          selectedBranchId === 'all' ? undefined : selectedBranchId,
          statusFilter === 'all' ? undefined : statusFilter
        );
        setRequests(loadedRequests);
      }
    } catch (error) {
      console.error("Error loading inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', sku: '', category: 'Interiores', price: 0, image: '', description: '', wholesalePrice: 0, wholesaleMinQty: 12 });
    setSelectedProduct(null);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await InventoryService.createProduct(formData as any);
      await loadData();
      setIsAddModalOpen(false);
      resetForm();
    } catch (e: any) {
      alert("Error: " + (e.message || e));
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await (InventoryService as any).updateProduct(selectedProduct.id, formData);
      await loadData();
      setIsEditModalOpen(false);
      resetForm();
    } catch (e: any) {
      alert("Error: " + (e.message || e));
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("¿Eliminar producto?")) {
      alert("Pendiente...");
    }
  };

  const openEdit = (p: Product) => {
    setSelectedProduct(p);
    setFormData({
      name: p.name, sku: p.sku, category: p.category, price: p.price,
      image: p.image, description: p.description,
      wholesalePrice: p.wholesalePrice || 0,
      wholesaleMinQty: p.wholesaleMinQty || 12
    });
    setIsEditModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    const csv = "data:text/csv;charset=utf-8,Nombre,SKU,Categoria,Precio,Descripcion,ImagenURL\nPintura Azul,AZ-001,Interiores,150.50,Bote 4L,";
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "plantilla_productos.csv";
    link.click();
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const newProducts: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const [name, sku, category, price, description, image] = lines[i].split(',');
          if (!name || !sku) continue;
          newProducts.push({
            name: name.trim(), sku: sku.trim().toUpperCase(), category: category?.trim() || 'Interiores',
            price: parseFloat(price) || 0, description: description?.trim() || '', image: image?.trim() || '', status: 'available'
          });
        }
        if (newProducts.length > 0 && confirm(`¿Cargar ${newProducts.length} productos?`)) {
          await InventoryService.bulkCreateProducts(newProducts);
          loadData();
        }
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleRequestRestock = async () => {
    if (!selectedProduct || transferQty <= 0) return;
    try {
      await InventoryService.createRestockRequest(selectedBranchId, selectedProduct.id, transferQty);
      setIsRequestModalOpen(false);
      setTransferQty(0);
      loadData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleConfirmReceipt = async (req: RestockRequest) => {
    if (!confirm(`¿Confirmar recepción de ${req.quantity} unidades?`)) return;
    try {
      await InventoryService.confirmRestockArrival(req.id);
      loadData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 h-full">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 lg:hidden" />
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sucursal</p>
              <select
                className="bg-transparent border-none text-base md:text-lg font-black focus:ring-0 p-0 cursor-pointer text-primary outline-none"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCSVUpload} />
            <div className="hidden sm:flex gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm"><span className="material-symbols-outlined">upload_file</span><span className="text-xs uppercase">Subir</span></button>
              <button onClick={handleDownloadTemplate} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm"><span className="material-symbols-outlined">download</span><span className="text-xs uppercase">Plantilla</span></button>
            </div>
            <button onClick={() => setIsAddModalOpen(true)} className="h-10 px-4 bg-primary text-white rounded-xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"><span className="material-symbols-outlined">add</span><span className="text-xs uppercase">Nuevo</span></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-1">
              <div className="flex gap-4">
                <button onClick={() => setViewMode('products')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'products' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Existencias</button>
                <button onClick={() => setViewMode('requests')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'requests' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Peticiones</button>
              </div>
              {viewMode === 'requests' && (
                <select className="text-xs font-bold bg-white dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 shadow-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Filtro Estado</option>
                  <option value="pending_admin">Pendientes</option>
                  <option value="shipped">En Camino</option>
                  <option value="completed">Listos</option>
                </select>
              )}
            </div>

            {viewMode === 'products' ? (
              <div className="space-y-4">
                <div className="relative max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-primary/20" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[700px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-8 py-5">Producto</th>
                          <th className="px-6 py-5">Precio</th>
                          <th className="px-6 py-5 text-center">Stock</th>
                          <th className="px-8 py-5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-700">
                        {filtered.map(p => {
                          const stock = p.inventory[selectedBranchId] || 0;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                  <img src={p.image} className="size-12 rounded-xl object-contain bg-slate-100 p-1" />
                                  <div><p className="font-bold text-slate-900 dark:text-white">{p.name}</p><p className="text-[10px] font-mono text-slate-400">{p.sku}</p></div>
                                </div>
                              </td>
                              <td className="px-6 py-5 font-black text-primary">${p.price.toLocaleString()}</td>
                              <td className="px-6 py-5 text-center"><span className={`text-lg font-black ${stock < 10 ? 'text-red-500' : 'text-slate-800 dark:text-slate-200'}`}>{stock}</span></td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex justify-end gap-2">
                                  {selectedBranchId !== 'BR-MAIN' && <button onClick={() => { setSelectedProduct(p); setIsRequestModalOpen(true) }} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase">Resurtir</button>}
                                  <button onClick={() => openEdit(p)} className="p-2 text-slate-400 hover:text-blue-500"><span className="material-symbols-outlined">edit</span></button>
                                  <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-red-500"><span className="material-symbols-outlined">delete</span></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-5">Producto</th>
                        <th className="px-6 py-5 text-center">Cant.</th>
                        <th className="px-6 py-5 text-center">Estado</th>
                        <th className="px-8 py-5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {requests.map(req => (
                        <tr key={req.id}>
                          <td className="px-8 py-5 flex items-center gap-3">
                            <div className="size-8 bg-slate-100 rounded p-1"><img src={req.productImage} className="w-full h-full object-contain" /></div>
                            <span className="font-bold text-sm dark:text-white">{req.productName}</span>
                          </td>
                          <td className="px-6 py-5 text-center font-black">{req.quantity}</td>
                          <td className="px-6 py-5 text-center">
                            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                              {req.status}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right flex justify-end gap-2">
                            <Link to={`/shipping-note/${req.id}`} className="p-2 text-slate-400 hover:text-primary"><span className="material-symbols-outlined">description</span></Link>
                            {req.status === 'shipped' && <button onClick={() => handleConfirmReceipt(req)} className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black rounded-lg">Recibido</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODALS */}
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[40px] shadow-2xl p-10">
              <h3 className="text-2xl font-black mb-8">{isAddModalOpen ? 'Nuevo Producto' : 'Editar Producto'}</h3>
              <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProduct} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Nombre</label><input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">SKU</label><input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-mono" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Precio</label><input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                  <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Categoría</label><select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}><option>Interiores</option><option>Exteriores</option><option>Esmaltes</option><option>Accesorios</option></select></div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase text-xs tracking-widest">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isRequestModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[40px] shadow-2xl p-10 animate-in zoom-in-95">
              <h3 className="text-xl font-black mb-4 capitalize">Resurtir Stock</h3>
              <p className="text-slate-500 text-xs mb-8">{selectedProduct.name}</p>
              <div className="space-y-6">
                <input type="number" className="w-full p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl font-black text-4xl text-center focus:ring-4 focus:ring-primary/10 transition-all outline-none" value={transferQty} onChange={e => setTransferQty(parseInt(e.target.value) || 0)} />
                <div className="flex gap-4">
                  <button onClick={() => setIsRequestModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Cancelar</button>
                  <button onClick={handleRequestRestock} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl">Solicitar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Inventory;
