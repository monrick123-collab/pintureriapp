
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, RestockRequest } from '../types';
import { MOCK_BRANCHES } from '../constants';
import { InventoryService } from '../services/inventoryService';

interface InventoryProps {
  user: User;
  onLogout: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ user, onLogout }) => {
  // --- STATE ---
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('BR-MAIN');
  const [viewMode, setViewMode] = useState<'products' | 'requests'>('products');
  const [search, setSearch] = useState('');

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Selection & Forms
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', category: 'Interiores', price: 0, image: '', description: '',
    wholesalePrice: 0, wholesaleMinQty: 12
  });

  // --- EFFECT ---
  useEffect(() => {
    loadData();
  }, [selectedBranchId, viewMode]);

  const loadData = async () => {
    try {
      const [loadedProducts, loadedBranches] = await Promise.all([
        InventoryService.getProducts(),
        InventoryService.getBranches()
      ]);
      setProducts(loadedProducts);
      setBranches(loadedBranches);

      if (viewMode === 'requests') {
        const loadedRequests = await InventoryService.getRestockRequests(selectedBranchId);
        setRequests(loadedRequests);
      }
    } catch (error) {
      console.error("Error loading inventory:", error);
    }
  };

  // --- HELPERS ---
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', sku: '', category: 'Interiores', price: 0, image: '', description: '', wholesalePrice: 0, wholesaleMinQty: 12 });
    setSelectedProduct(null);
  };

  // --- HANDLERS: PRODUCTS ---
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await InventoryService.createProduct(formData as any);
      await loadData();
      setIsAddModalOpen(false);
      resetForm();
    } catch (e: any) {
      alert("Error al crear producto: " + (e.message || e));
    }
  };

  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      // Logic for editing in DB (reusing create pattern or specific update product)
      // Since InventoryService doesn't have updateProduct yet, I'll assume I can add it or use upsert if sku is constraint
      // But let's add updateProduct to InventoryService for clarity in the next call if I didn't see it.
      // Wait, let me check if I can just add it to InventoryService now or if I should assume it's there.
      // I'll add it to InventoryService.ts afterwards.
      await (InventoryService as any).updateProduct(selectedProduct.id, formData);
      await loadData();
      setIsEditModalOpen(false);
      resetForm();
      alert("Producto actualizado correctamente.");
    } catch (e: any) {
      alert("Error al actualizar producto: " + (e.message || e));
    }
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto? Esta acción no se puede deshacer.")) {
      alert("Eliminar en DB pendiente de implementar");
    }
  };

  const openEdit = (p: Product) => {
    setSelectedProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: p.price,
      image: p.image,
      description: p.description,
      wholesalePrice: p.wholesalePrice || 0,
      wholesaleMinQty: p.wholesaleMinQty || 12
    });
    setIsEditModalOpen(true);
  };

  // --- HANDLERS: CSV ---
  const handleDownloadTemplate = () => {
    const headers = ['Nombre,SKU,Categoria,Precio,Descripcion,ImagenURL'];
    const example = ['Pintura Azul,AZ-001,Interiores,150.50,Bote 4L,https://ejemplo.com/img.jpg'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(example).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "plantilla_productos_pintamax.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          const line = lines[i].trim();
          if (!line) continue;
          const [name, sku, category, price, description, image] = line.split(',');

          if (!name || !sku) continue;

          newProducts.push({
            name: name.trim(),
            sku: sku.trim().toUpperCase(),
            category: category?.trim() || 'Interiores',
            price: parseFloat(price) || 0,
            description: description?.trim() || '',
            image: image?.trim() || '',
            status: 'available'
          });
        }

        if (newProducts.length > 0) {
          if (confirm(`Se encontraron ${newProducts.length} productos. ¿Deseas cargarlos a la base de datos?`)) {
            await InventoryService.bulkCreateProducts(newProducts);
            alert("Carga masiva completada exitosamente.");
            loadData();
          }
        }
      } catch (err: any) {
        console.error(err);
        alert("Error al procesar el archivo CSV: " + (err.message || err));
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- HANDLERS: RESTOCK ---
  const handleRequestRestock = async () => {
    if (!selectedProduct || transferQty <= 0) return;
    try {
      await InventoryService.createRestockRequest(selectedBranchId, selectedProduct.id, transferQty);
      alert("Solicitud enviada a Bodega correctamente.");
      setIsRequestModalOpen(false);
      setTransferQty(0);
      if (viewMode === 'requests') loadData();
    } catch (e: any) {
      console.error(e);
      alert("Error al solicitar stock: " + (e.message || e));
    }
  };

  const handleConfirmReceipt = async (req: RestockRequest) => {
    if (!confirm(`¿Confirmar que recibiste ${req.quantity} unidades de ${req.productName}?`)) return;
    try {
      await InventoryService.confirmRestockArrival(req.id);
      alert("Inventario actualizado exitosamente.");
      loadData();
    } catch (e: any) {
      console.error(e);
      alert("Error al confirmar recepción: " + (e.message || e));
    }
  };

  // --- RENDER ---
  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col overflow-hidden bg-background-light dark:bg-background-dark h-full">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-8 shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sucursal Visualizada</p>
              <select
                className="bg-transparent border-none text-lg font-black focus:ring-0 p-0 cursor-pointer text-primary"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.length > 0 ? branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                )) : MOCK_BRANCHES.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCSVUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all"
            >
              <span className="material-symbols-outlined">upload_file</span>
              <span>Subir CSV</span>
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all"
            >
              <span className="material-symbols-outlined">download</span>
              <span className="hidden xl:inline">Plantilla</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              <span className="material-symbols-outlined">add_box</span>
              <span>Nuevo Producto</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* View Switcher */}
            <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-1">
              <button
                onClick={() => setViewMode('products')}
                className={`pb-3 text-sm font-bold transition-all ${viewMode === 'products' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Existencias
              </button>
              <button
                onClick={() => setViewMode('requests')}
                className={`pb-3 text-sm font-bold transition-all ${viewMode === 'requests' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Mis Solicitudes
              </button>
            </div>

            {viewMode === 'products' ? (
              <>
                <div className="relative max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl outline-none shadow-sm focus:border-primary transition-all" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <tr className="text-[10px] font-black text-slate-400 uppercase">
                        <th className="px-6 py-4">Producto</th>
                        <th className="px-6 py-4 text-center">Precio</th>
                        <th className="px-6 py-4 text-center">Stock Sucursal</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {filtered.map(p => {
                        const localStock = p.inventory[selectedBranchId] || 0;
                        const isLow = localStock < 10;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <img src={p.image} className="size-10 rounded-lg object-contain border bg-white" />
                                <div>
                                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{p.name}</p>
                                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{p.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-sm text-primary">
                              ${p.price.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-lg font-black ${isLow ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{localStock}</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {selectedBranchId !== 'BR-MAIN' && (
                                  <button
                                    onClick={() => { setSelectedProduct(p); setIsRequestModalOpen(true) }}
                                    className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary hover:text-white transition-all flex items-center gap-1"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">hail</span>
                                    Resurtir
                                  </button>
                                )}
                                <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                                  <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                                  <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div className="p-20 flex flex-col items-center opacity-40">
                      <span className="material-symbols-outlined text-6xl mb-4">inventory_2</span>
                      <p className="font-bold uppercase tracking-widest text-xs">Sin coincidencias</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                    <tr className="text-[10px] font-black text-slate-400 uppercase">
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4 text-center">Cantidad</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-center">Fecha</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {requests.map((req: any) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded bg-slate-100 p-1"><img src={req.productImage} className="w-full h-full object-contain mix-blend-multiply" /></div>
                            <span className="font-bold text-sm dark:text-white">{req.productName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold">{req.quantity}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wide 
                                            ${req.status === 'completed' ? 'bg-green-100 text-green-700' :
                              req.status === 'shipped' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                req.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                            {{
                              pending_admin: 'Pendiente Admin',
                              approved_warehouse: 'En Bodega',
                              shipped: 'En Camino',
                              completed: 'Recibido',
                              rejected: 'Rechazado'
                            }[req.status as string]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-xs text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          {req.status === 'shipped' && (
                            <button
                              onClick={() => handleConfirmReceipt(req)}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-green-500/30 hover:bg-green-500 transition-all"
                            >
                              Confirmar Recepción
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {requests.length === 0 && <div className="p-12 text-center text-slate-400">No hay solicitudes en el historial.</div>}
              </div>
            )}
          </div>
        </div>

        {/* MODAL: ADD/EDIT FORM */}
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden p-8 animate-in zoom-in-95">
              <h3 className="text-xl font-black mb-6 text-slate-900 dark:text-white">{isAddModalOpen ? 'Nuevo Producto' : 'Editar Producto'}</h3>
              <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProduct} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre del Producto</label>
                    <input required className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-primary" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SKU / Código</label>
                    <input required className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-sm font-mono outline-none focus:border-primary" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Categoría</label>
                    <select className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-primary" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                      <option>Interiores</option>
                      <option>Exteriores</option>
                      <option>Esmaltes</option>
                      <option>Accesorios</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Precio Unitario ($)</label>
                    <input type="number" required className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-primary" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Precio Mayoreo ($)</label>
                    <input type="number" className="w-full p-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm font-bold outline-none focus:border-primary" value={formData.wholesalePrice} onChange={e => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Mínimo Mayoreo</label>
                    <input type="number" className="w-full p-2.5 bg-primary/5 border border-primary/20 rounded-xl text-sm font-bold outline-none focus:border-primary" value={formData.wholesaleMinQty} onChange={e => setFormData({ ...formData, wholesaleMinQty: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">URL de Imagen</label>
                  <input className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl text-sm outline-none focus:border-primary" placeholder="https://..." value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:shadow-primary/30 active:scale-95 transition-all">Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: RESTOCK REQUEST */}
        {isRequestModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-8 animate-in zoom-in-95">
              <h3 className="text-xl font-black mb-2 text-slate-900 dark:text-white">Solicitar Resurtido</h3>
              <p className="text-slate-500 text-sm mb-6">Solicitando <strong>{selectedProduct.name}</strong> para sucursal.</p>
              <div className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Cantidad Solicitada</label>
                  <input type="number" className="w-full p-4 bg-slate-50 dark:bg-slate-900 border rounded-xl font-black text-2xl outline-none focus:border-primary" value={transferQty} onChange={e => setTransferQty(parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex gap-4 pt-6">
                  <button onClick={() => setIsRequestModalOpen(false)} className="flex-1 py-3 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                  <button onClick={handleRequestRestock} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all">Enviar Solicitud</button>
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
