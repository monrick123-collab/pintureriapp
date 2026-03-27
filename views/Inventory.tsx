
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { User, Product, Branch, RestockRequest, UserRole, InternalConsumption } from '../types';
import { MOCK_BRANCHES, WAREHOUSE_BRANCH_ID } from '../constants';
import { InventoryService } from '../services/inventoryService';
import { translateStatus } from '../utils/formatters';
import AuthorizationModal from '../components/AuthorizationModal';

interface InventoryProps {
  user: User;
  onLogout: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ user, onLogout }) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
  const isSub = user.role === UserRole.WAREHOUSE_SUB;
  const isFinance = user.role === UserRole.FINANCE;
  const isStoreManager = user.role === UserRole.STORE_MANAGER;

  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [bulkInventory, setBulkInventory] = useState<any[]>([]);

  // Initialize branch: Store Manager and Warehouse restricted to their branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    (isWarehouse || isStoreManager)
      ? (user.branchId || WAREHOUSE_BRANCH_ID)
      : WAREHOUSE_BRANCH_ID
  );
  const [viewMode, setViewMode] = useState<'products' | 'requests' | 'consumption' | 'bulk'>('products');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [consumptionHistory, setConsumptionHistory] = useState<InternalConsumption[]>([]);
  const [loading, setLoading] = useState(false);

  const [showAuth, setShowAuth] = useState(false);
  const [authDescription, setAuthDescription] = useState('Esta acción requiere autorización.');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transferQty, setTransferQty] = useState(0);
  const [initialStock, setInitialStock] = useState(0);
  const [consumptionQty, setConsumptionQty] = useState(0);
  const [consumptionReason, setConsumptionReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', category: 'Interiores', brand: '', price: 0, image: '', description: '',
    wholesalePrice: 0, wholesaleMinQty: 12, packageType: 'litro'
  });

  const [brandFilter, setBrandFilter] = useState<string>('all');

  // --- Modal: Consultar producto en otras sucursales ---
  const [isBranchLookupOpen, setIsBranchLookupOpen] = useState(false);
  const [lookupSearch, setLookupSearch] = useState('');
  const [lookupProducts, setLookupProducts] = useState<Product[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleOpenBranchLookup = async () => {
    setIsBranchLookupOpen(true);
    if (lookupProducts.length === 0) {
      try {
        setLookupLoading(true);
        // Traemos todos los productos de todas las sucursales (usando 'BR-MAIN' que tiene el catálogo global)
        const all = await InventoryService.getProductsByBranch(WAREHOUSE_BRANCH_ID);
        setLookupProducts(all);
      } catch (e) {
        console.error(e);
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const lookupFiltered = lookupProducts.filter(p =>
    p.name.toLowerCase().includes(lookupSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(lookupSearch.toLowerCase())
  );

  useEffect(() => {
    loadData();
  }, [selectedBranchId, viewMode, statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const loadedProducts = await InventoryService.getProductsByBranch(selectedBranchId);

      // Sort by Low Stock Priority
      loadedProducts.sort((a, b) => {
        const stockA = a.inventory[selectedBranchId] || 0;
        const minA = a.min_stock || 10;
        const isLowA = stockA <= minA;

        const stockB = b.inventory[selectedBranchId] || 0;
        const minB = b.min_stock || 10;
        const isLowB = stockB <= minB;

        if (isLowA && !isLowB) return -1;
        if (!isLowA && isLowB) return 1;
        return 0;
      });

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

      if (viewMode === 'bulk') {
        const bulkData = await InventoryService.getBulkInventory(selectedBranchId);
        setBulkInventory(bulkData);
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

  const totalQty = filtered.reduce((acc, p) => acc + (p.inventory[selectedBranchId] || 0), 0);
  const totalValue = filtered.reduce((acc, p) => acc + ((p.inventory[selectedBranchId] || 0) * (p.price || 0)), 0);

  const handlePrintInventory = () => {
    const wasDark = document.documentElement.classList.contains('dark');
    if (wasDark) document.documentElement.classList.remove('dark');
    setTimeout(() => {
        window.print();
        if (wasDark) document.documentElement.classList.add('dark');
    }, 150);
  };

  const resetForm = () => {
    setFormData({ name: '', sku: '', category: 'Interiores', brand: '', price: 0, image: '', description: '', wholesalePrice: 0, wholesaleMinQty: 12, packageType: 'litro', min_stock: 10, max_stock: 100, costPrice: 0, location: '', unit_measure: 'pza' });
    setInitialStock(0);
    setSelectedProduct(null);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await InventoryService.createProduct(formData as Omit<Product, 'id' | 'inventory'>, initialStock, selectedBranchId);
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
      if (initialStock !== (selectedProduct.inventory?.[selectedBranchId] ?? 0)) {
        await InventoryService.updateStock(selectedProduct.id, selectedBranchId, initialStock);
      }
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
    setInitialStock(p.inventory?.[selectedBranchId] ?? 0);
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
        <header className="min-h-[4rem] flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-8 py-3 flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 lg:hidden" />
            <div className="flex flex-col">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sucursal</p>
              {isStoreManager ? (
                <p className="text-base md:text-lg font-black text-primary">
                  {loading
                    ? 'Cargando...'
                    : branches.find(b => b.id === user.branchId)?.name || user.branchId || 'Sin sucursal'}
                </p>
              ) : (
                <select
                  className="bg-transparent border-none text-base md:text-lg font-black focus:ring-0 p-0 cursor-pointer text-primary outline-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    setSelectedProduct(null);
                    setIsEditModalOpen(false);
                    setIsRequestModalOpen(false);
                    setIsConsumptionModalOpen(false);
                    setIsAddModalOpen(false);
                    setInitialStock(0);
                    setTransferQty(0);
                    setConsumptionQty(0);
                    setConsumptionReason('');
                  }}
                  disabled={isWarehouse}
                >
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleCSVUpload} />
            <div className="hidden sm:flex gap-2">
              {/* Botón consultar stock en sucursales */}
              <button
                onClick={handleOpenBranchLookup}
                className="h-10 px-4 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold flex items-center gap-2 border border-indigo-100 dark:border-indigo-800 shadow-sm hover:bg-indigo-100 transition-colors"
                title="Ver stock de un producto en todas las sucursales"
              >
                <span className="material-symbols-outlined text-lg">search_insights</span>
                <span className="text-xs uppercase">Consultar Sucursales</span>
              </button>
              <button onClick={() => {
                const action = handlePrintInventory;
                if (isWarehouse) {
                  setPendingAction(() => action);
                  setAuthDescription("Se requiere autorización para imprimir el inventario.");
                  setShowAuth(true);
                } else {
                  action();
                }
              }} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm hover:bg-slate-100"><span className="material-symbols-outlined">print</span><span className="text-xs uppercase">Imprimir</span></button>
              {isAdmin && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm"><span className="material-symbols-outlined">upload_file</span><span className="text-xs uppercase">Subir</span></button>
                  <button onClick={handleDownloadTemplate} className="h-10 px-4 bg-slate-50 dark:bg-slate-800 text-slate-600 rounded-xl font-bold flex items-center gap-2 border shadow-sm"><span className="material-symbols-outlined">download</span><span className="text-xs uppercase">Plantilla</span></button>
                </>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => setIsAddModalOpen(true)} className="h-10 px-4 bg-primary text-white rounded-xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"><span className="material-symbols-outlined">add</span><span className="text-xs uppercase">Nuevo</span></button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-slate-800 pb-1 print:hidden">
              <div className="flex gap-4">
                <button onClick={() => setViewMode('products')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'products' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Existencias</button>
                <button onClick={() => setViewMode('bulk')} className={`pb-3 text-sm font-bold transition-all ${viewMode === 'bulk' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-600'}`}>Materia Prima (Granel)</button>
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

            {viewMode === 'products' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest leading-none mb-1">Total de Productos</p>
                  <h4 className="text-2xl font-black text-primary">{totalQty.toLocaleString()} <span className="text-xs font-bold">piezas</span></h4>
                </div>
                {!isWarehouse && (
                  <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Valor Total Inventario</p>
                    <h4 className="text-2xl font-black text-slate-700 dark:text-slate-200">${totalValue.toLocaleString()}</h4>
                  </div>
                )}
              </div>
            )}

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
                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left min-w-[700px]">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                        <tr className="text-xs font-black text-slate-400 uppercase tracking-widest">
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
                                  <div><p className="font-bold text-slate-900 dark:text-white">{p.name}</p><p className="text-xs font-mono text-slate-400">{p.sku}</p></div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-[9px] font-bold uppercase text-slate-600 dark:text-slate-300 w-fit">
                                    {p.brand || 'Genérico'}
                                  </span>
                                  {p.location && <span className="text-xs font-bold text-slate-500 pl-1">📍 {p.location}</span>}
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
                                        setAuthDescription("El subencargado requiere autorización para registrar uso local.");
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
                                  {selectedBranchId !== WAREHOUSE_BRANCH_ID && <button onClick={() => { setSelectedProduct(p); setIsRequestModalOpen(true) }} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase">Resurtir</button>}
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
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <tr className="text-xs font-black text-slate-400 uppercase tracking-widest">
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
                            <div className="size-8 bg-slate-100 rounded p-1"><img src={req.productImage || ''} className="w-full h-full object-contain" /></div>
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
            ) : viewMode === 'bulk' ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <tr className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        <th className="px-8 py-5">Producto a Granel</th>
                        <th className="px-6 py-5 text-center">Volumen Disponible (Lts)</th>
                        <th className="px-8 py-5 text-right">Última Actualización</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {bulkInventory.length === 0 ? (
                        <tr><td colSpan={3} className="p-12 text-center text-slate-400 italic">No hay inventario a granel disponible.</td></tr>
                      ) : (
                        bulkInventory.map(item => (
                          <tr key={item.id}>
                            <td className="px-8 py-5 flex items-center gap-3">
                              <div className="size-10 bg-slate-100 rounded-xl p-1"><span className="material-symbols-outlined text-slate-400 w-full h-full flex items-center justify-center">water_drop</span></div>
                              <div>
                                <span className="font-bold text-sm dark:text-white block">{item.product?.name || 'Producto Desconocido'}</span>
                                <span className="text-xs text-slate-400 font-mono block">{item.product?.sku}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center font-black text-blue-600 text-lg">
                              {item.availableLiters?.toFixed(4)} <span className="text-xs font-bold text-slate-400">Lts</span>
                            </td>
                            <td className="px-8 py-5 text-right text-[10px] text-slate-400 font-bold uppercase">
                              {new Date(item.updatedAt).toLocaleDateString()} {new Date(item.updatedAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] overflow-hidden shadow-sm border dark:border-slate-700">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <tr className="text-xs font-black text-slate-400 uppercase tracking-widest">
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
          description={authDescription}
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
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Nombre</label><input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">SKU</label><input required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-mono" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Marca</label><input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Categoría</label><select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}><option>Interiores</option><option>Exteriores</option><option>Esmaltes</option><option>Accesorios</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Precio</label><input type="number" required className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Status</label><select className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}><option value="available">Disponible</option><option value="low">Bajo Stock</option><option value="out">Agotado</option></select></div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-500">Tipo de Envase (Orden de Resurtido)</label>
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
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Costo Compra</label><input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.costPrice || ''} onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Ubicación</label><input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" placeholder="Ej: Pasillo A-4" value={formData.location || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Min Stock</label><input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.min_stock || ''} onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Max Stock</label><input type="number" className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" value={formData.max_stock || ''} onChange={e => setFormData({ ...formData, max_stock: parseInt(e.target.value) })} /></div>
                    <div className="space-y-1"><label className="text-xs font-black uppercase text-slate-500">Unidad Medida</label><input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" placeholder="pza, lto, kg" value={formData.unit_measure || ''} onChange={e => setFormData({ ...formData, unit_measure: e.target.value })} /></div>
                  </div>

                  {isAddModalOpen && (
                    <div className="grid grid-cols-1 gap-3 md:gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                      <div className="col-span-1 text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Datos Adicionales</div>
                      <div className="space-y-1">
                        <label className="text-xs font-black uppercase text-slate-500">Descripción <span className="text-primary">(escribe "tambo" si es granel)</span></label>
                        <input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" placeholder='Ej: Pintura blanca tambo 200L' value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-black uppercase text-slate-500">Stock Inicial (sucursal actual)</label>
                        <input type="number" min={0} className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black" placeholder="0" value={initialStock || ''} onChange={e => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))} />
                      </div>
                    </div>
                  )}
                  {isEditModalOpen && selectedProduct && (
                    <div className="grid grid-cols-1 gap-3 md:gap-4 border-t border-slate-100 dark:border-slate-800 pt-4 mt-2">
                      <div className="col-span-1 text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Datos Adicionales</div>
                      <div className="space-y-1">
                        <label className="text-xs font-black uppercase text-slate-500">Descripción <span className="text-primary">(escribe "tambo" si es granel)</span></label>
                        <input className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20" placeholder='Ej: Pintura blanca tambo 200L' value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-black uppercase text-slate-500">Stock actual (sucursal actual)</label>
                        <input type="number" min={0} className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black" value={initialStock} onChange={e => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))} />
                      </div>
                    </div>
                  )}
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
                  <label className="text-xs font-black uppercase text-slate-400">Cantidad</label>
                  <input
                    type="number"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl font-black text-2xl outline-none focus:ring-2 focus:ring-amber-500/20"
                    value={consumptionQty}
                    onChange={e => setConsumptionQty(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-400">Motivo del uso</label>
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

      {/* MODAL: Consultar stock de producto en todas las sucursales */}
      {isBranchLookupOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-700 shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Consultar Stock por Sucursal</h3>
                <p className="text-xs text-slate-400 mt-1">Busca un producto para ver su existencia en todas las tiendas</p>
              </div>
              <button onClick={() => setIsBranchLookupOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Search */}
            <div className="px-8 pt-6 shrink-0">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  placeholder="Nombre o SKU del producto..."
                  value={lookupSearch}
                  onChange={e => setLookupSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
              {lookupLoading ? (
                <div className="py-16 text-center text-slate-400 font-bold">Cargando productos...</div>
              ) : lookupSearch.trim() === '' ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">manage_search</span>
                  <p className="text-sm text-slate-400 mt-3 font-medium">Escribe el nombre o SKU para buscar</p>
                </div>
              ) : lookupFiltered.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300">search_off</span>
                  <p className="text-sm text-slate-400 mt-3 font-medium">Sin resultados para "{lookupSearch}"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lookupFiltered.slice(0, 10).map(p => (
                    <div key={p.id} className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                      {/* Product header */}
                      <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
                        <img src={p.image} className="size-10 rounded-xl object-contain bg-white p-1 border border-slate-100" />
                        <div>
                          <p className="font-black text-sm text-slate-800 dark:text-white">{p.name}</p>
                          <p className="text-xs font-mono text-slate-400">{p.sku}</p>
                        </div>
                      </div>
                      {/* Stock per branch */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 divide-x divide-y divide-slate-100 dark:divide-slate-700">
                        {branches.map(branch => {
                          const stock = p.inventory?.[branch.id] ?? 0;
                          const isLow = stock <= (p.min_stock || 10);
                          return (
                            <div key={branch.id} className="p-3 flex flex-col gap-0.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate">{branch.name}</span>
                              <span className={`text-xl font-black ${stock === 0 ? 'text-red-400' :
                                  isLow ? 'text-amber-500 animate-pulse' :
                                    'text-slate-800 dark:text-white'
                                }`}>{stock}</span>
                              {isLow && stock > 0 && <span className="text-[8px] text-amber-500 font-black uppercase">Stock Bajo</span>}
                              {stock === 0 && <span className="text-[8px] text-red-400 font-black uppercase">Agotado</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {lookupFiltered.length > 10 && (
                    <p className="text-center text-xs text-slate-400 font-bold pt-2">Mostrando primeros 10 de {lookupFiltered.length} resultados. Afina tu búsqueda.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
