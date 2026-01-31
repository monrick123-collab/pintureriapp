
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, RestockRequest, UserRole, InternalConsumption } from '../types';
import { MOCK_BRANCHES } from '../constants';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';
import AuthorizationModal from '../components/AuthorizationModal';

interface InventoryProps {
  user: User;
  onLogout: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ user, onLogout }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('BR-MAIN');
  const [viewMode, setViewMode] = useState<'products' | 'requests' | 'consumption'>('products');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [consumptionHistory, setConsumptionHistory] = useState<InternalConsumption[]>([]);
  const [loading, setLoading] = useState(false);
  const isAdmin = user.role === UserRole.ADMIN;
  const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
  const isSub = user.role === UserRole.WAREHOUSE_SUB;

  const [showAuth, setShowAuth] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const isFinance = user.role === UserRole.FINANCE;

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(0);
  const [consumptionQty, setConsumptionQty] = useState(0);
  const [consumptionReason, setConsumptionReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', category: 'Interiores', brand: '', price: 0, image: '', description: '',
    wholesalePrice: 0, wholesaleMinQty: 12, packageType: 'litro'
  });

  const [brandFilter, setBrandFilter] = useState<string>('all');

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

      if (viewMode === 'consumption') {
        const history = await InventoryService.getInternalConsumptionHistory(selectedBranchId);
        setConsumptionHistory(history);
      }
    } catch (error) {
      console.error("Error loading inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchesBrand = brandFilter === 'all' || p.brand === brandFilter;
    return matchesSearch && matchesBrand;
  });

  const allBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean)));

  const resetForm = () => {
    setFormData({ name: '', sku: '', category: 'Interiores', brand: '', price: 0, image: '', description: '', wholesalePrice: 0, wholesaleMinQty: 12, packageType: 'litro', min_stock: 10, max_stock: 100, costPrice: 0, location: '', unit_measure: 'pza' });
    setSelectedProduct(null);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await InventoryService.createProduct(formData as Omit<Product, 'id' | 'inventory'>);
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
      await InventoryService.updateProduct(selectedProduct.id, formData as Partial<Product>);
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
      brand: p.brand || '',
      wholesalePrice: p.wholesalePrice || 0,
      wholesaleMinQty: p.wholesaleMinQty || 12,
      packageType: p.packageType || 'litro',
      min_stock: p.min_stock || 10,
      max_stock: p.max_stock || 100,
      costPrice: p.costPrice || 0,
      location: p.location || '',
      unit_measure: p.unit_measure || 'pza'
    });
    setIsEditModalOpen(true);
  };

  const handleRequestPrice = async (productId: string) => {
    try {
      await InventoryService.createPriceRequest(productId, user.id);
      alert("Solicitud de precio enviada al Contador.");
    } catch (e: any) {
      alert("Error: " + e.message);
    }
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

  const handleRecordConsumption = async () => {
    if (!selectedProduct || consumptionQty <= 0 || !consumptionReason) return;
    try {
      await InventoryService.recordInternalConsumption(
        selectedProduct.id,
        selectedBranchId,
        user.id,
        consumptionQty,
        consumptionReason
      );
      setIsConsumptionModalOpen(false);
      setConsumptionQty(0);
      setConsumptionReason('');
      loadData();
      alert("Consumo interno registrado correctamente.");
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
                className="bg-transparent border-none text-base md:text-lg font-black focus:ring-0 p-0 cursor-pointer text-primary outline-none pr-8"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCSVUpload} />
            {isAdmin && (
              <div className="hidden sm:flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm"><span className="material-symbols-outlined">upload_file</span><span className="text-xs uppercase">Subir</span></button>
                <button onClick={handleDownloadTemplate} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm"><span className="material-symbols-outlined">download</span><span className="text-xs uppercase">Plantilla</span></button>
              </div>
            )}
            {isAdmin && (
              <button onClick={() => setIsAddModalOpen(true)} className="h-10 px-4 bg-primary text-white rounded-xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"><span className="material-symbols-outlined">add</span><span className="text-xs uppercase">Nuevo</span></button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-1">
              <div className="flex gap-4">
                <button onClick={() => setViewMode('products')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'products' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Existencias</button>
                <button onClick={() => setViewMode('requests')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'requests' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Peticiones</button>
                <button onClick={() => setViewMode('consumption')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'consumption' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Consumo Local</button>
              </div>
              {viewMode === 'requests' && (
                <select className="text-xs font-bold bg-white dark:bg-slate-800 border-none rounded-lg px-3 py-1.5 pr-8 shadow-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Filtro Estado</option>
                  <option value="pending_admin">Pendientes</option>
                  <option value="shipped">En Camino</option>
                  <option value="completed">Listos</option>
                </select>
              )}
            </div>

            {viewMode === 'products' ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative max-w-md flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-primary/20" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select
                    className="bg-white dark:bg-slate-800 px-4 py-3 pr-10 rounded-2xl border-none shadow-sm text-sm font-bold text-slate-600"
                    value={brandFilter}
                    onChange={e => setBrandFilter(e.target.value)}
                  >
                    <option value="all">Todas las Marcas</option>
                    {allBrands.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[700px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-8 py-5">Producto</th>
                          <th className="px-6 py-5">Marca/Ubic.</th>
                          {!isWarehouse && <th className="px-6 py-5">Precio</th>}
                          <th className="px-6 py-5 text-center">Stock (Min/Max)</th>
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
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[9px] font-bold uppercase text-slate-600 dark:text-slate-300 w-fit">
                                    {p.brand || 'Genérico'}
                                  </span>
                                  {p.location && <span className="text-[9px] font-mono text-slate-400 pl-1">📍 {p.location}</span>}
                                </div>
                              </td>
                              {(!isWarehouse) && (
                                <td className="px-6 py-5 font-black text-primary">${p.price.toLocaleString()}</td>
                              )}
                              <td className="px-6 py-5 text-center">
                                <div className="flex flex-col items-center">
                                  <span className={`text-lg font-black ${stock < (p.min_stock || 10) ? 'text-red-500 animate-pulse' : 'text-slate-800 dark:text-slate-200'}`}>{stock}</span>
                                  {p.min_stock && <span className="text-[9px] text-slate-400 font-bold">Min: {p.min_stock}</span>}
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      const action = () => { setSelectedProduct(p); setIsConsumptionModalOpen(true) };
                                      if (isSub) {
                                        setPendingAction(() => action);
                                        setShowAuth(true);
                                      } else {
                                        action();
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-[10px] font-black uppercase hover:bg-amber-500 hover:text-white transition-all"
                                    title="Registrar uso local"
                                  >
                                    Uso Local
                                  </button>
                                  {(isWarehouse || p.price === 0) && (
                                    <button
                                      onClick={() => handleRequestPrice(p.id)}
                                      className="px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-500 hover:text-white transition-all"
                                      title="Solicitar actualización de precio"
                                    >
                                      Solicitar Precio
                                    </button>
                                  )}
                                  {selectedBranchId !== 'BR-MAIN' && <button onClick={() => { setSelectedProduct(p); setIsRequestModalOpen(true) }} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase">Resurtir</button>}
                                  {isAdmin && (
                                    <>
                                      <button onClick={() => openEdit(p)} className="p-2 text-slate-400 hover:text-blue-500"><span className="material-symbols-outlined">edit</span></button>
                                      <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-red-500"><span className="material-symbols-outlined">delete</span></button>
                                    </>
                                  )}
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
            ) : viewMode === 'requests' ? (
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
                            <div className="size-8 bg-slate-100 rounded p-1"><img src={req.product?.image} className="w-full h-full object-contain" /></div>
                            <span className="font-bold text-sm dark:text-white">{req.productName}</span>
                          </td>
                          <td className="px-6 py-5 text-center font-black">{req.quantity}</td>
                          <td className="px-6 py-5 text-center">
                            <span className="px-2 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                              {translateStatus(req.status)}
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
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-5">Producto</th>
                        <th className="px-6 py-5 text-center">Cant.</th>
                        <th className="px-6 py-5">Motivo</th>
                        <th className="px-8 py-5 text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {consumptionHistory.map(item => (
                        <tr key={item.id}>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="size-8 bg-slate-100 rounded p-1"><img src={item.productImage} className="w-full h-full object-contain" /></div>
                              <span className="font-bold text-sm dark:text-white">{item.productName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center font-black text-amber-600">-{item.quantity}</td>
                          <td className="px-6 py-5 text-xs text-slate-500 font-medium">{item.reason}</td>
                          <td className="px-8 py-5 text-right text-[10px] text-slate-400 font-bold uppercase">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {consumptionHistory.length === 0 && (
                    <div className="p-12 text-center text-slate-400 italic">No hay registros de consumo interno.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <AuthorizationModal
          isOpen={showAuth}
          onClose={() => { setShowAuth(false); setPendingAction(null); }}
          onAuthorized={() => { if (pendingAction) pendingAction(); }}
          description="El subencargado requiere autorización para registrar uso local."
        />

        {/* MODALS */}
        {(isAddModalOpen || isEditModalOpen) && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-xl rounded-t-[32px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-800 z-10">
                <h3 className="text-xl md:text-2xl font-black">{isAddModalOpen ? 'Nuevo Producto' : 'Editar Producto'}</h3>
                <button onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="md:hidden p-2 text-slate-400"><span className="material-symbols-outlined">close</span></button>
              </div>

              <form onSubmit={isAddModalOpen ? handleAddProduct : handleEditProduct} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 md:space-y-6 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Nombre</label><input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">SKU</label><input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-mono" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Marca</label><input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Categoría</label><select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}><option>Interiores</option><option>Exteriores</option><option>Esmaltes</option><option>Accesorios</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Precio</label><input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Status</label><select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}><option value="available">Disponible</option><option value="low">Bajo Stock</option><option value="out">Agotado</option></select></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-500">Tipo de Envase (Orden de Resurtido)</label>
                    <select
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.packageType}
                      onChange={e => setFormData({ ...formData, packageType: e.target.value as any })}
                    >
                      <option value="cubeta">Cubeta (19 lts)</option>
                      <option value="galon">Galón (4 lts)</option>
                      <option value="litro">Litro (1 lto)</option>
                      <option value="medio">Medio (1/2 lto)</option>
                      <option value="cuarto">Cuarto (1/4 lto)</option>
                      <option value="aerosol">Aerosol</option>
                      <option value="complemento">Complemento</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
                    <div className="col-span-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Logística y Costos</div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Costo Compra</label><input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.costPrice || ''} onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Ubicación</label><input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ej: Pasillo A-4" value={formData.location || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Min Stock</label><input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.min_stock || ''} onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Max Stock</label><input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.max_stock || ''} onChange={e => setFormData({ ...formData, max_stock: parseInt(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-500">Unidad Medida</label><input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" placeholder="pza, lto, kg" value={formData.unit_measure || ''} onChange={e => setFormData({ ...formData, unit_measure: e.target.value })} /></div>
                  </div>
                </div>

                <div className="p-6 md:p-8 pt-4 shrink-0 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-4">
                  <button type="button" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest hidden md:block">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isRequestModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full md:w-[400px] rounded-t-[32px] md:rounded-[40px] shadow-2xl p-8 md:p-10 animate-in slide-in-from-bottom-5 md:zoom-in-95">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-black capitalize">Resurtir Stock</h3>
                <button onClick={() => setIsRequestModalOpen(false)} className="md:hidden"><span className="material-symbols-outlined text-slate-400">close</span></button>
              </div>
              <p className="text-slate-500 text-xs mb-8">{selectedProduct.name}</p>
              <div className="space-y-6">
                <input type="number" className="w-full p-6 bg-slate-50 dark:bg-slate-900 rounded-3xl font-black text-4xl text-center focus:ring-4 focus:ring-primary/10 transition-all outline-none" value={transferQty} onChange={e => setTransferQty(parseInt(e.target.value) || 0)} />
                <div className="flex gap-4">
                  <button onClick={() => setIsRequestModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs hidden md:block">Cancelar</button>
                  <button onClick={handleRequestRestock} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl">Solicitar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isConsumptionModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full md:w-[400px] rounded-t-[32px] md:rounded-[40px] shadow-2xl p-8 md:p-10 animate-in slide-in-from-bottom-5 md:zoom-in-95">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-xl font-black">Uso Local</h3>
                <button onClick={() => setIsConsumptionModalOpen(false)} className="md:hidden"><span className="material-symbols-outlined text-slate-400">close</span></button>
              </div>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-6">{selectedProduct.name}</p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Cantidad</label>
                  <input
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-2xl outline-none focus:ring-2 focus:ring-amber-500/20"
                    value={consumptionQty}
                    onChange={e => setConsumptionQty(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Motivo del uso</label>
                  <select
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-bold text-sm outline-none"
                    value={consumptionReason}
                    onChange={e => setConsumptionReason(e.target.value)}
                  >
                    <option value="">Selecciona motivo...</option>
                    <option value="Mantenimiento de sucursal">Mantenimiento de sucursal</option>
                    <option value="Muestra para cliente">Muestra para cliente</option>
                    <option value="Uso administrativo">Uso administrativo</option>
                    <option value="Exhibición/Showroom">Exhibición/Showroom</option>
                    <option value="Donación/Promoción">Donación/Promoción</option>
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => { setIsConsumptionModalOpen(false); setConsumptionReason(''); setConsumptionQty(0); }} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs hidden md:block">Cancelar</button>
                  <button
                    onClick={handleRecordConsumption}
                    disabled={!consumptionReason || consumptionQty <= 0}
                    className="flex-1 py-4 bg-amber-500 text-white font-black rounded-2xl shadow-xl shadow-amber-500/20 disabled:opacity-50 uppercase text-xs"
                  >
                    Registrar
                  </button>
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
