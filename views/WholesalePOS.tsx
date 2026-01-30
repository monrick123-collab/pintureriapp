
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, CartItem, SaleItem, Client } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { ClientService } from '../services/clientService';
import { AiService } from '../services/aiService';
import { Branch } from '../types';

interface WholesalePOSProps {
    user: User;
    onLogout: () => void;
}

const WholesalePOS: React.FC<WholesalePOSProps> = ({ user, onLogout }) => {
    const currentBranchId = 'BR-MAIN'; // Wholesale usually from Warehouse/Main
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [admins, setAdmins] = useState<{ id: string, name: string }[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('Todos');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [selectedAdminId, setSelectedAdminId] = useState<string>('');
    const [paymentType, setPaymentType] = useState<'contado' | 'credito'>('contado');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [creditDays, setCreditDays] = useState(0);
    const [branchConfig, setBranchConfig] = useState<Branch['config']>();
    const [aiSuggestion, setAiSuggestion] = useState<{ discount: number, reasoning: string } | null>(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [appliedDiscount, setAppliedDiscount] = useState(0); // Extra discount percentage

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [prodData, clientData, adminData] = await Promise.all([
                InventoryService.getProductsByBranch(currentBranchId),
                ClientService.getClients(),
                SalesService.getAdmins()
            ]);
            setProducts(prodData);
            setClients(clientData);
            setAdmins(adminData);

            // Load Branch Config
            const branches = await InventoryService.getBranches();
            const myBranch = branches.find(b => b.id === currentBranchId);
            if (myBranch) setBranchConfig(myBranch.config);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) return { ...item, quantity: Math.max(0, item.quantity + delta) };
            return item;
        }).filter(item => item.quantity > 0));
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === 'Todos' || p.category === category;
        return matchesSearch && matchesCategory;
    });

    const subtotal = cart.reduce((acc, item) => acc + ((item.wholesalePrice || item.price) * item.quantity), 0);
    const discountAmount = subtotal * (appliedDiscount / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const iva = subtotalAfterDiscount * 0.16;
    const total = subtotalAfterDiscount + iva;

    const handleConsultAI = async () => {
        if (!selectedClient || cart.length === 0) return;
        setLoadingAi(true);
        try {
            const suggestion = await AiService.getDynamicPricingSuggestion(selectedClient, cart);
            setAiSuggestion(suggestion);
        } catch (e) {
            console.error(e);
            alert("No se pudo conectar con la IA");
        } finally {
            setLoadingAi(false);
        }
    };

    const applyAiDiscount = () => {
        if (aiSuggestion) {
            setAppliedDiscount(aiSuggestion.discount);
            setAiSuggestion(null); // Close suggestion
        }
    };

    const handleFinalizeSale = async () => {
        if (!selectedClient || !selectedAdminId) {
            alert("Seleccione cliente y administrador de salida");
            return;
        }

        try {
            setLoading(true);
            const saleItems: SaleItem[] = cart.map(item => ({
                productId: item.id,
                productName: item.name,
                quantity: item.quantity,
                price: item.wholesalePrice || item.price,
                total: (item.wholesalePrice || item.price) * item.quantity
            }));

            await SalesService.processSale(
                currentBranchId,
                saleItems,
                total,
                'cash', // paymentMethod used in DB for compatibility, but we use paymentType extra
                selectedClient.id,
                {
                    isWholesale: true,
                    paymentType,
                    departureAdminId: selectedAdminId,
                    departureAdminId: selectedAdminId,
                    subtotal: subtotalAfterDiscount,
                    discountAmount,
                    iva,
                    creditDays
                }
            );

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                setIsPaymentModalOpen(false);
                setCart([]);
                setSelectedClient(null);
                setSelectedAdminId('');
            }, 2000);
        } catch (e) {
            console.error(e);
            alert("Error al procesar venta mayorista");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col min-w-0 h-full relative">
                <header className="h-16 flex items-center justify-between px-6 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined font-black">groups</span>
                            <h2 className="text-lg font-black uppercase tracking-tight">Ventas Mayoreo</h2>
                        </div>
                    </div>
                    <button onClick={() => setIsCartOpen(true)} className="lg:hidden p-2 bg-slate-100 rounded-xl relative">
                        <span className="material-symbols-outlined">shopping_cart</span>
                        {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] size-5 rounded-full flex items-center justify-center font-black">{cart.length}</span>}
                    </button>
                </header>

                <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
                    <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isCartOpen ? 'lg:mr-[400px]' : ''}`}>
                        <div className="p-6 pb-2 space-y-4">
                            <div className="flex bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-14 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary">
                                <div className="flex items-center justify-center px-4 text-slate-400"><span className="material-symbols-outlined">search</span></div>
                                <input className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold" placeholder="Buscar producto por SKU o nombre..." value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {['Todos', 'Interiores', 'Exteriores', 'Esmaltes', 'Accesorios'].map(cat => (
                                        <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${category === cat ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-400'}`}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setIsCartOpen(!isCartOpen)}
                                    className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${isCartOpen ? 'bg-slate-200 text-slate-600' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}
                                >
                                    <span className="material-symbols-outlined text-base">{isCartOpen ? 'last_page' : 'shopping_cart'}</span>
                                    {isCartOpen ? 'Ocultar Carrito' : 'Ver Carrito'}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${isCartOpen ? 'xl:grid-cols-3' : 'xl:grid-cols-4 2xl:grid-cols-5'} gap-4 transition-all`}>
                                {filteredProducts.map(p => (
                                    <div key={p.id} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-md" onClick={() => addToCart(p)}>
                                        <div className="aspect-square bg-slate-50 dark:bg-slate-900/50 p-4 relative">
                                            <img src={p.image} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                            <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded text-[9px] font-black text-slate-500 uppercase">{p.brand}</div>
                                        </div>
                                        <div className="p-4">
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest truncate">{p.sku}</p>
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate mb-2">{p.name}</p>
                                            <div className="flex justify-between items-end">
                                                <p className="text-lg font-black text-primary">${(p.wholesalePrice || p.price).toLocaleString()}</p>
                                                <span className="text-[9px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">Mayoreo</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cart Sidebar */}
                    <div className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col z-50 transition-transform duration-300 shadow-2xl lg:shadow-none ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Carrito de Venta</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setCart([])} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined">delete</span></button>
                                <button onClick={() => setIsCartOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {cart.map(item => (
                                <div key={item.id} className="flex gap-4 animate-in slide-in-from-right-2">
                                    <div className="size-12 rounded-xl bg-slate-100 p-2 shrink-0"><img src={item.image} className="w-full h-full object-contain" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">{item.sku}</p>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                                        <div className="flex justify-between items-center mt-2">
                                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border dark:border-slate-700">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="size-6 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">remove</span></button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="w-12 text-center text-xs font-black bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none p-0 focus:border-primary"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value) || 0;
                                                        setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i));
                                                    }}
                                                />
                                                <button onClick={() => updateQuantity(item.id, 1)} className="size-6 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">add</span></button>
                                            </div>
                                            <p className="text-xs font-black text-primary">${((item.wholesalePrice || item.price) * item.quantity).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 pt-20">
                                    <span className="material-symbols-outlined text-5xl mb-4">shopping_cart</span>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-center">Seleccione productos para<br />comenzar la venta</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cliente</label>
                                    <select
                                        className="w-full p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl text-xs font-bold"
                                        value={selectedClient?.id || ''}
                                        onChange={e => {
                                            const client = clients.find(c => c.id === e.target.value) || null;
                                            setSelectedClient(client);
                                            if (client) setCreditDays(client.creditDays || 0);
                                        }}
                                    >
                                        <option value="">Seleccionar Cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Salida Autorizada por</label>
                                    <select className="w-full p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl text-xs font-bold" value={selectedAdminId} onChange={e => setSelectedAdminId(e.target.value)}>
                                        <option value="">Seleccionar Admin...</option>
                                        {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo de Pago</label>
                                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                        <button onClick={() => setPaymentType('contado')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentType === 'contado' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}>Contado</button>
                                        <button onClick={() => setPaymentType('credito')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentType === 'credito' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}>Crédito</button>
                                    </div>
                                </div>

                                {paymentType === 'credito' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Plazo de Crédito (Días)</label>
                                        <input
                                            type="number"
                                            className="w-full p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl text-xs font-black"
                                            value={creditDays}
                                            onChange={e => setCreditDays(parseInt(e.target.value) || 0)}
                                            placeholder="Días"
                                        />
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* AI & Discount Section */}
                        <div className="py-2 border-t dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Descuento Extra (%)</span>
                                <input
                                    type="number"
                                    min="0" max="100"
                                    className="w-16 text-right text-xs font-bold bg-transparent border-b border-slate-200 focus:border-primary outline-none"
                                    value={appliedDiscount}
                                    onChange={e => setAppliedDiscount(parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            {branchConfig?.enable_ai_dynamic_pricing && cart.length > 0 && selectedClient && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    {!aiSuggestion ? (
                                        <button
                                            onClick={handleConsultAI}
                                            disabled={loadingAi}
                                            className="w-full py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                                        >
                                            {loadingAi ? <span className="animate-spin material-symbols-outlined text-sm">sync</span> : <span className="material-symbols-outlined text-sm">smart_toy</span>}
                                            {loadingAi ? 'Analizando...' : 'Consultar descuento IA'}
                                        </button>
                                    ) : (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">Sugerencia: {aiSuggestion.discount}%</p>
                                                    <p className="text-[10px] text-indigo-600/80 leading-tight mt-1">{aiSuggestion.reasoning}</p>
                                                </div>
                                                <button onClick={() => setAiSuggestion(null)} className="text-indigo-400 hover:text-indigo-600"><span className="material-symbols-outlined text-sm">close</span></button>
                                            </div>
                                            <button onClick={applyAiDiscount} className="w-full py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700">Aplicar Descuento</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t dark:border-slate-800 space-y-2">
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Subtotal</span><span>${subtotalAfterDiscount.toLocaleString()}</span></div>
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>IVA (16%)</span><span>${iva.toLocaleString()}</span></div>
                            <div className="flex justify-between items-end pt-2">
                                <span className="text-xs font-black uppercase text-slate-400">Total</span>
                                <span className="text-3xl font-black text-primary">${total.toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            disabled={cart.length === 0 || !selectedClient || !selectedAdminId || loading}
                            onClick={handleFinalizeSale}
                            className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                        >
                            {loading ? 'Procesando...' : 'Finalizar Venta'}
                        </button>
                    </div>
                </div>

                {showSuccess && (
                    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95">
                        <div className="size-24 rounded-full bg-green-500 text-white flex items-center justify-center mb-6 shadow-2xl shadow-green-500/20"><span className="material-symbols-outlined text-6xl">check_circle</span></div>
                        <h3 className="text-4xl font-black mb-2">¡Venta Registrada!</h3>
                        <p className="text-slate-500 font-bold">La nota de venta mayorista ha sido procesada correctamente.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WholesalePOS;
