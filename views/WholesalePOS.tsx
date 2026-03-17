import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, CartItem, SaleItem, Client, Branch, Sale, UserRole, WholesalePromotion, PromotionRequest } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { ClientService } from '../services/clientService';
import { AiService } from '../services/aiService';
import { PromotionService } from '../services/promotionService';
import { translateStatus } from '../utils/formatters';
import { Link } from 'react-router-dom';

interface WholesalePOSProps {
    user: User;
    onLogout: () => void;
}

type TabType = 'pos' | 'history' | 'accounts';
type Period = 'today' | 'week' | 'fortnight' | 'month' | 'custom';

const WholesalePOS: React.FC<WholesalePOSProps> = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState<TabType>('pos');
    const currentBranchId = user.branchId || 'BR-MAIN';
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;

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
    const [isConfigExpanded, setIsConfigExpanded] = useState(true);

    // Promotion States
    const [promotions, setPromotions] = useState<WholesalePromotion[]>([]);
    const [applicablePromotion, setApplicablePromotion] = useState<WholesalePromotion | null>(null);
    const [showPromotionRequest, setShowPromotionRequest] = useState(false);
    const [promotionRequestReason, setPromotionRequestReason] = useState('');
    const [promotionRequestDiscount, setPromotionRequestDiscount] = useState(0);

    // New States for Validations
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [billingData, setBillingData] = useState({ bank: '', socialReason: '', invoiceNumber: '' });
    const [deliveryReceiver, setDeliveryReceiver] = useState('');
    const [clientFinancials, setClientFinancials] = useState<{ balance: number, oldestPendingDate: string | null } | null>(null);
    const [transferReference, setTransferReference] = useState(''); // Para aprobación de pagos

    
    // --- HISTORY STATES ---
    const [historySales, setHistorySales] = useState<Sale[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySubTab, setHistorySubTab] = useState<'sales' | 'promotions'>('sales');
    const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
    const [pendingPromotionRequestId, setPendingPromotionRequestId] = useState<string | null>(null);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedHistoryBranch, setSelectedHistoryBranch] = useState<string>(
        (user.role === UserRole.ADMIN || isWarehouse) ? 'ALL' : (user.branchId || 'BR-MAIN')
    );
    const [historyPeriod, setHistoryPeriod] = useState<Period>('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedHistorySale, setSelectedHistorySale] = useState<Sale | null>(null);

    // --- ACCOUNTS STATES ---
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentFormType, setPaymentFormType] = useState<'abono' | 'pago_completo'>('abono');
    const [blockReason, setBlockReason] = useState('');
    const [showBlockForm, setShowBlockForm] = useState(false);
    const [limitAmount, setLimitAmount] = useState('');

    // --- FILTER STATES ---
    const [clientFilter, setClientFilter] = useState({
        search: '',
        type: 'all' as 'all' | 'Individual' | 'Empresa',
        municipality: '',
        hasCredit: 'all' as 'all' | 'active' | 'inactive',
        isMunicipality: 'all' as 'all' | 'yes' | 'no'
    });

useEffect(() => {
        if (selectedClient) {
            ClientService.getClientFinancials(selectedClient.id).then(setClientFinancials);
        } else {
            setClientFinancials(null);
        }
    }, [selectedClient]);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [prodData, clientData, adminData, promoData] = await Promise.all([
                InventoryService.getProductsByBranch(currentBranchId),
                ClientService.getClients(),
                SalesService.getAdmins(),
                PromotionService.getActivePromotions().catch(() => [])
            ]);
            setProducts(prodData);
            setClients(clientData);
            setAdmins(adminData);
            setPromotions(promoData);

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

    // Check for applicable promotion when cart changes
    useEffect(() => {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (totalItems > 0 && promotions.length > 0) {
            const promo = promotions.find(p => 
                p.minQuantity <= totalItems && 
                (!p.maxQuantity || p.maxQuantity >= totalItems)
            );
            setApplicablePromotion(promo || null);
        } else {
            setApplicablePromotion(null);
        }
    }, [cart, promotions]);

    // --- HISTORY EFFECTS & METHODS ---
    useEffect(() => {
        if (activeTab === 'history') {
            loadBranches();
            fetchHistorySales();
            fetchPromotionRequests();
        }
    }, [activeTab, historyPeriod, customStart, customEnd, selectedHistoryBranch]);

    // --- ACCOUNTS EFFECTS & METHODS ---
    useEffect(() => {
        if (activeTab === 'accounts') {
            loadWholesaleAccounts();
        }
    }, [activeTab]);

    const loadWholesaleAccounts = async () => {
        try {
            const data = await SalesService.getWholesaleAccounts(
                user.role === UserRole.ADMIN ? undefined : currentBranchId
            );
            setAccounts(data);
        } catch (e) {
            console.error('Error loading wholesale accounts:', e);
            setAccounts([]);
        }
    };

    const handleAddWholesalePayment = async () => {
        if (!selectedAccount) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) { alert('Monto inválido'); return; }
        try {
            setLoading(true);
            await SalesService.addWholesalePayment(
                selectedAccount.id,
                paymentFormType,
                paymentFormType === 'pago_completo' ? selectedAccount.balance : amount,
                paymentNotes,
                user.id
            );
            setPaymentAmount('');
            setPaymentNotes('');
            await loadWholesaleAccounts();
            const updated = await SalesService.getWholesaleAccounts(user.role === UserRole.ADMIN ? undefined : currentBranchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) {
            alert('Error: ' + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleBlockWholesaleAccount = async () => {
        if (!selectedAccount || !blockReason.trim()) return;
        try {
            setLoading(true);
            await SalesService.blockWholesaleAccount(selectedAccount.id, blockReason);
            setShowBlockForm(false);
            setBlockReason('');
            await loadWholesaleAccounts();
            const updated = await SalesService.getWholesaleAccounts(user.role === UserRole.ADMIN ? undefined : currentBranchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) {
            alert('Error: ' + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleUnblockWholesaleAccount = async () => {
        if (!selectedAccount) return;
        try {
            setLoading(true);
            await SalesService.unblockWholesaleAccount(selectedAccount.id);
            await loadWholesaleAccounts();
            const updated = await SalesService.getWholesaleAccounts(user.role === UserRole.ADMIN ? undefined : currentBranchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) {
            alert('Error: ' + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleSetWholesaleLimit = async () => {
        if (!selectedAccount) return;
        const limit = parseFloat(limitAmount);
        if (isNaN(limit) || limit < 0) { alert('Límite inválido'); return; }
        try {
            await SalesService.setWholesaleCreditLimit(selectedAccount.id, limit);
            setLimitAmount('');
            await loadWholesaleAccounts();
            const updated = await SalesService.getWholesaleAccounts(user.role === UserRole.ADMIN ? undefined : currentBranchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) {
            alert('Error: ' + (e.message || e.toString()));
        }
    };

    const loadBranches = async () => {
        try {
            const data = await InventoryService.getBranches();
            setBranches(data);
        } catch (e) {
            console.error(e);
        }
    };

    const calculateDateRange = () => {
        const end = new Date();
        let start = new Date();
        end.setHours(23, 59, 59, 999);
        start.setHours(0, 0, 0, 0);

        switch (historyPeriod) {
            case 'today': break;
            case 'week':
                const day = start.getDay();
                start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
                break;
            case 'fortnight':
                start.setDate(start.getDate() - 15);
                break;
            case 'month':
                start.setDate(1);
                break;
            case 'custom':
                if (!customStart || !customEnd) return null;
                start = new Date(customStart);
                const endCustom = new Date(customEnd);
                endCustom.setHours(23, 59, 59, 999);
                return { start: start.toISOString(), end: endCustom.toISOString() };
        }
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const fetchHistorySales = async () => {
        const range = calculateDateRange();
        if (!range) return;

        setHistoryLoading(true);
        try {
            const data = await SalesService.getSalesWithFilters(range.start, range.end, selectedHistoryBranch);
            // Filtramos solo ventas de mayoreo (o nulas si son legadas)
            setHistorySales(data.filter(s => s.isWholesale !== false));
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchPromotionRequests = async () => {
        try {
            const data = await PromotionService.getAllRequests(
                user.role === UserRole.ADMIN ? undefined : currentBranchId
            );
            setPromotionRequests(data.filter(r => r.requestedBy === user.id));
        } catch (e) {
            console.error(e);
        }
    };

    const handleCompleteFromPromotion = (req: PromotionRequest) => {
        if (!req.items?.length) {
            alert('Esta solicitud no tiene productos guardados. Agrega los productos manualmente al carrito y aplica el descuento.');
            setAppliedDiscount(req.requestedDiscountPercent);
            setPendingPromotionRequestId(req.id);
            setActiveTab('pos');
            return;
        }
        setAppliedDiscount(req.requestedDiscountPercent);
        setPendingPromotionRequestId(req.id);
        setCart(req.items.map((i: any) => ({ ...i })));
        setActiveTab('pos');
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

    const subtotal = cart.reduce((acc, item) => {
        let price = (item.wholesalePrice || item.price);
        if (paymentType === 'credito') price = price * 1.05;
        return acc + (price * item.quantity);
    }, 0);
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

    const handleRequestPromotion = async () => {
        if (!selectedClient || cart.length === 0 || promotionRequestDiscount <= 0) {
            alert("Seleccione cliente y especifique el descuento solicitado");
            return;
        }

        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

        try {
            setLoading(true);
            await PromotionService.createRequest({
                branchId: currentBranchId,
                clientId: selectedClient.id,
                clientName: selectedClient.name,
                totalItems,
                subtotal,
                discountPercent: promotionRequestDiscount,
                discountAmount: subtotal * (promotionRequestDiscount / 100),
                reason: promotionRequestReason,
                requestedBy: user.id,
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    sku: item.sku,
                    price: item.price,
                    wholesalePrice: item.wholesalePrice,
                    quantity: item.quantity,
                    brand: item.brand,
                    image: item.image,
                    category: item.category
                }))
            });
            setShowPromotionRequest(false);
            setPromotionRequestReason('');
            setPromotionRequestDiscount(0);
            alert("Solicitud de promoción enviada al administrador para aprobación.");
        } catch (e: any) {
            alert("Error al enviar solicitud: " + (e.message || e.toString()));
        } finally {
            setLoading(false);
        }
    };

    const handleEditInvoice = async (sale: Sale) => {
        const invoiceNumber = prompt('Ingrese el número de factura:', sale.billingInvoiceNumber || '');
        if (invoiceNumber !== null) {
            try {
                setLoading(true);
                await SalesService.updateInvoiceNumber(sale.id, invoiceNumber);
                alert('Factura actualizada correctamente');
                // Recargar historial
                if (activeTab === 'history') {
                    await fetchHistorySales();
                }
                if (selectedHistorySale?.id === sale.id) {
                    setSelectedHistorySale({ ...selectedHistorySale, billingInvoiceNumber: invoiceNumber });
                }
            } catch (e) {
                console.error(e);
                alert('Error al actualizar factura');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleFinalizeSale = async () => {
        if (!selectedClient || !selectedAdminId) {
            alert("Seleccione cliente y administrador de salida");
            return;
        }

        // 1. Validation: Delivery Data
        if (!deliveryReceiver.trim()) {
            alert("Debe ingresar el nombre de quien recibe la mercancía.");
            return;
        }

        // 2. Validation: Billing Data (if Contado + Card/Transfer)
        if (paymentType === 'contado' && (paymentMethod === 'card' || paymentMethod === 'transfer')) {
            if (!billingData.bank || !billingData.socialReason) {
                alert("Para pagos con Tarjeta o Transferencia, los datos de facturación son obligatorios.");
                return;
            }
            // Para transferencias, solicitar referencia
            if (paymentMethod === 'transfer' && !transferReference.trim()) {
                alert("Para pagos con Transferencia, ingrese la referencia de transferencia.");
                return;
            }
        }

        // 3. Validation: Credit Check (if Credito)
        if (paymentType === 'credito') {
            if (clientFinancials) {
                const totalDebt = clientFinancials.balance + total;
                if (selectedClient.creditLimit && totalDebt > selectedClient.creditLimit) {
                    alert(`El cliente excede su límite de crédito. Límite: $${selectedClient.creditLimit}, Deuda Actual + Venta: $${totalDebt}`);
                    return;
                }

                // Oldest debt check > 15 days
                if (clientFinancials.oldestPendingDate) {
                    const daysOverdue = (new Date().getTime() - new Date(clientFinancials.oldestPendingDate).getTime()) / (1000 * 3600 * 24);
                    if (daysOverdue > 15) {
                        alert(`El cliente tiene adeudos con más de 15 días de antigüedad (${Math.floor(daysOverdue)} días). Venta a crédito bloqueada.`);
                        return;
                    }
                }
            }
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
                paymentType === 'contado' ? paymentMethod : 'cash', // If credit, underlying method defaults to cash/system equivalent
                selectedClient.id,
                {
                    isWholesale: true,
                    paymentType,
                    departureAdminId: selectedAdminId,
                    subtotal: subtotalAfterDiscount,
                    discountAmount,
                    iva,
                    creditDays: paymentType === 'credito' ? creditDays : 0,
                    billingBank: paymentMethod !== 'cash' ? billingData.bank : undefined,
                    billingSocialReason: paymentMethod !== 'cash' ? billingData.socialReason : undefined,
                    billingInvoiceNumber: undefined, // Se agregará manualmente después
                    deliveryReceiverName: deliveryReceiver,
                    transferReference: paymentMethod === 'transfer' ? transferReference : undefined,
                    paymentStatus: (paymentMethod === 'transfer' || paymentMethod === 'cash') ? 'pending' : 'approved',
                    promotionRequestId: pendingPromotionRequestId || undefined
                }
            );

            await loadInitialData(); // Reload inventory

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                setIsPaymentModalOpen(false);
                setCart([]);
                setSelectedClient(null);
                setSelectedAdminId('');
                setBillingData({ bank: '', socialReason: '', invoiceNumber: '' });
                setDeliveryReceiver('');
                setAppliedDiscount(0);
                setPendingPromotionRequestId(null);
            }, 2000);
        } catch (e) {
            console.error(e);
            alert("Error al procesar venta mayorista");
        } finally {
            setLoading(false);
        }
    };

    // Filtrar clientes según criterios
    const filteredClients = clients.filter(client => {
        // Filtro de búsqueda
        if (clientFilter.search && 
            !client.name.toLowerCase().includes(clientFilter.search.toLowerCase()) &&
            !client.taxId.toLowerCase().includes(clientFilter.search.toLowerCase()) &&
            !client.email.toLowerCase().includes(clientFilter.search.toLowerCase())) {
            return false;
        }
        
        // Filtro por tipo
        if (clientFilter.type !== 'all' && client.type !== clientFilter.type) {
            return false;
        }
        
        // Filtro por municipio
        if (clientFilter.municipality && 
            (!client.municipality || !client.municipality.toLowerCase().includes(clientFilter.municipality.toLowerCase()))) {
            return false;
        }
        
        // Filtro por crédito activo
        if (clientFilter.hasCredit === 'active' && !client.isActiveCredit) {
            return false;
        }
        if (clientFilter.hasCredit === 'inactive' && client.isActiveCredit) {
            return false;
        }
        
        // Filtro por municipio (cliente municipio)
        if (clientFilter.isMunicipality === 'yes' && !client.isMunicipality) {
            return false;
        }
        if (clientFilter.isMunicipality === 'no' && client.isMunicipality) {
            return false;
        }
        
        return true;
    });

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50 dark:bg-slate-950">
                <header className="h-16 lg:h-20 flex items-center justify-between px-6 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined font-black">groups</span>
                            <h2 className="text-lg font-black uppercase tracking-tight hidden sm:block">Ventas Mayoreo</h2>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl lg:rounded-2xl p-1 gap-1">
                        {([
                            { key: 'pos', label: 'Nueva Venta' },
                            { key: 'history', label: 'Historial' },
                            { key: 'accounts', label: 'Cuentas' }
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`px-3 lg:px-5 py-2 rounded-lg lg:rounded-xl font-black text-[10px] lg:text-xs uppercase tracking-widest transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {activeTab === 'pos' && (
                            <button
                                onClick={() => setIsCartOpen(true)}
                                className="lg:hidden relative p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"
                            >
                                <span className="material-symbols-outlined">shopping_cart</span>
                                {cart.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] size-5 rounded-full flex items-center justify-center font-black animate-in zoom-in">
                                        {cart.length}
                                    </span>
                                )}
                            </button>
                        )}
                        <div className="text-[10px] md:text-xs font-bold text-slate-400 hidden sm:block">
                            {user.name}
                        </div>
                    </div>
                </header>
                {activeTab === 'pos' && (
                    <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
                                        <div className="flex-1 flex flex-col overflow-hidden">
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
                                                </div>
                                            </div>
                    
                                            <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 transition-all">
                                                    {filteredProducts.map(p => (
                                                        <div key={p.id} className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-md" onClick={() => addToCart(p)}>
                                                            <div className="aspect-square bg-slate-50 dark:bg-slate-900/50 p-4 relative">
                                                                <img src={p.image || undefined} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
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
                    
                                        {/* Cart Overlay for Mobile */}
                                        {isCartOpen && (
                                            <div className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 transition-all" onClick={() => setIsCartOpen(false)} />
                                        )}
                    
                                        {/* Cart Sidebar */}
                                        <div className={`fixed lg:static top-0 right-0 h-full w-[320px] md:w-[400px] bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col z-[45] shadow-2xl lg:shadow-none transition-all duration-300 ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
                                            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setIsCartOpen(false)} className="lg:hidden text-slate-400 hover:text-primary transition-colors">
                                                        <span className="material-symbols-outlined">arrow_forward_ios</span>
                                                    </button>
                                                    <h3 className="font-black text-xs uppercase tracking-widest text-slate-400">Carrito de Venta</h3>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setCart([])} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><span className="material-symbols-outlined">delete</span></button>
                                                </div>
                                            </div>
                    
                                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                                {cart.map(item => (
                                                    <div key={item.id} className="flex gap-4 animate-in slide-in-from-right-2">
                                                        <div className="size-12 rounded-xl bg-slate-100 p-2 shrink-0"><img src={item.image || undefined} className="w-full h-full object-contain" /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-tighter">{item.sku}</p>
                                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</p>
                                                            <div className="flex justify-between items-center mt-2">
                                                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-lg border dark:border-slate-700">
                                                                    <button onClick={() => updateQuantity(item.id, -1)} className="size-6 flex items-center justify-center text-slate-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-sm">remove</span></button>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="w-12 text-center text-xs font-black bg-transparent border-b border-slate-200 dark:border-slate-700 outline-none p-0 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        value={item.quantity === 0 ? '' : item.quantity}
                                                                        onChange={(e) => {
                                                                            const val = parseInt(e.target.value) || 0;
                                                                            setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i));
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            if (!e.target.value || parseInt(e.target.value) === 0) {
                                                                                updateQuantity(item.id, -item.quantity);
                                                                            }
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
                    
                                            <div className="p-6 border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-950/50 flex flex-col shrink-0">
                                                <button
                                                    onClick={() => setIsConfigExpanded(!isConfigExpanded)}
                                                    className="flex justify-between items-center w-full mb-4 group"
                                                >
                                                    <div className="flex flex-col items-start text-left">
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Configuración de Venta</span>
                                                        {!isConfigExpanded && selectedClient && (
                                                            <span className="text-[10px] font-bold text-slate-400 mt-1 line-clamp-1">{selectedClient.name} • {paymentType === 'contado' ? 'Contado' : `Crédito (${creditDays}d)`}</span>
                                                        )}
                                                        {!isConfigExpanded && !selectedClient && (
                                                            <span className="text-[10px] font-bold text-red-500 mt-1">Falta seleccionar cliente</span>
                                                        )}
                                                    </div>
                                                    <span className={`material-symbols-outlined text-slate-400 group-hover:text-primary transition-transform duration-300 ${isConfigExpanded ? 'rotate-180' : ''}`}>
                                                        expand_more
                                                    </span>
                                                </button>
                    
                                                <div className={`overflow-y-auto custom-scrollbar transition-all duration-300 ${isConfigExpanded ? 'max-h-[50vh] opacity-100 mb-4' : 'max-h-0 opacity-0 overflow-hidden m-0'}`}>
                                                    <div className="space-y-4 pr-2 pb-2">
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
                    
                                                        {/* Payment Method Selector (Only for Contado) */}
                                                        {paymentType === 'contado' && (
                                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Método de Pago</label>
                                                                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                                                    {(['cash', 'card', 'transfer'] as const).map(m => (
                                                                        <button key={m} onClick={() => setPaymentMethod(m)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${paymentMethod === m ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-400'}`}>
                                                                            {{ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transf.' }[m]}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                    
                                                        {/* Billing Data (Conditional) */}
                                                        {paymentType === 'contado' && (paymentMethod === 'card' || paymentMethod === 'transfer') && (
                                                             <div className="space-y-2 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className="material-symbols-outlined text-blue-500 text-sm">receipt_long</span>
                                                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">Datos Facturación Obligatorios</span>
                                                                </div>
                                                                <input className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700" placeholder="Banco" value={billingData.bank} onChange={e => setBillingData({ ...billingData, bank: e.target.value })} />
                                                                <input className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700" placeholder="Razón Social" value={billingData.socialReason} onChange={e => setBillingData({ ...billingData, socialReason: e.target.value })} />
                                                                {paymentMethod === 'transfer' && (
                                                                    <input 
                                                                        className="w-full p-2 bg-white dark:bg-slate-900 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700" 
                                                                        placeholder="Referencia de Transferencia" 
                                                                        value={transferReference} 
                                                                        onChange={e => setTransferReference(e.target.value)} 
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                    
                                                        {/* Delivery Data (Always Required) */}
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Entrega (Recibido Por)</label>
                                                            <input
                                                                className="w-full p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl text-xs font-black"
                                                                placeholder="Nombre y Firma"
                                                                value={deliveryReceiver}
                                                                onChange={e => setDeliveryReceiver(e.target.value)}
                                                            />
                                                        </div>
                    
                                                    </div>
                    
                                                    {/* AI & Discount Section */}
                                                    <div className="py-2 border-t dark:border-slate-800 space-y-2">
                                                          {/* Promotion Display */}
                                                          {applicablePromotion && (
                                                             <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800">
                                                                 <div className="flex items-center justify-between">
                                                                     <div className="flex items-center gap-2">
                                                                         <span className="material-symbols-outlined text-green-600 text-sm">local_offer</span>
                                                                         <span className="text-xs font-black text-green-700 dark:text-green-300">{applicablePromotion.name}</span>
                                                                     </div>
                                                                     <span className="text-xs font-black text-green-600">-{applicablePromotion.discountPercent}%</span>
                                                                 </div>
                                                                 {applicablePromotion.autoApply && (
                                                                    <p className="text-[10px] text-green-600 mt-1">Se aplicará automáticamente</p>
                                                                 )}
                                                             </div>
                                                          )}

                                                          {/* Request Special Promotion Button - Only for non-Admin users */}
                                                          {user.role !== UserRole.ADMIN && (
                                                             <button
                                                                onClick={() => setShowPromotionRequest(true)}
                                                                className="w-full py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 text-[10px] font-black uppercase tracking-wider rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
                                                             >
                                                                <span className="material-symbols-outlined text-sm">add_circle</span>
                                                                Solicitar Promoción Especial
                                                             </button>
                                                          )}

                                                        {pendingPromotionRequestId && (
                                                            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                                                                <span className="material-symbols-outlined text-green-600 text-sm">verified</span>
                                                                <span className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-wide">Descuento aprobado: {appliedDiscount}%</span>
                                                            </div>
                                                        )}
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
                                                                                <p className="text-xs font-black text-indigo-700 dark:text-indigo-300">Sugerencia: {aiSuggestion?.discount}%</p>
                                                                                <p className="text-[10px] text-indigo-600/80 leading-tight mt-1">{aiSuggestion?.reasoning}</p>
                                                                            </div>
                                                                            <button onClick={() => setAiSuggestion(null)} className="text-indigo-400 hover:text-indigo-600"><span className="material-symbols-outlined text-sm">close</span></button>
                                                                        </div>
                                                                        <button onClick={applyAiDiscount} className="w-full py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700">Aplicar Descuento</button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                    
                                                </div>
                    
                                                <div className="space-y-4 shrink-0">
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>Subtotal</span><span>${subtotalAfterDiscount.toLocaleString()}</span></div>
                                                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>IVA (16%)</span><span>${iva.toLocaleString()}</span></div>
                                                        <div className="flex justify-between items-end pt-2 border-t dark:border-slate-200 dark:border-slate-800">
                                                            <span className="text-xs font-black uppercase text-slate-400">Total</span>
                                                            <span className="text-3xl font-black text-primary">${total.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                    
                                                    <button
                                                        disabled={cart.length === 0 || !selectedClient || !selectedAdminId || loading}
                                                        onClick={handleFinalizeSale}
                                                        className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
                                                    >
                                                        {loading ? 'Procesando...' : 'Finalizar Venta'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                    
                                        {showSuccess && (
                                            <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95">
                                                <div className="size-24 rounded-full bg-green-500 text-white flex items-center justify-center mb-6 shadow-2xl shadow-green-500/20"><span className="material-symbols-outlined text-6xl">check_circle</span></div>
                                                <h3 className="text-4xl font-black mb-2">¡Venta Registrada!</h3>
                                                <p className="text-slate-500 font-bold">La nota de venta mayorista ha sido procesada correctamente.</p>
                                            </div>
                                        )}
                                    </div>
                                
                )}
                {activeTab === 'history' && (
                    <>
                        <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Filter Bar matching Municipal Style */}
                        <div className="mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-6 py-4 shadow-sm shrink-0">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Periodo</label>
                                <select
                                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none min-w-[140px]"
                                    value={historyPeriod}
                                    onChange={e => setHistoryPeriod(e.target.value as Period)}
                                >
                                    <option value="today">Hoy</option>
                                    <option value="week">Esta Semana</option>
                                    <option value="fortnight">Quincena</option>
                                    <option value="month">Este Mes</option>
                                    <option value="custom">Personalizado</option>
                                </select>
                            </div>

                            {historyPeriod === 'custom' && (
                                <>
                                    <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-left-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                        <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                                    </div>
                                    <div className="flex flex-col gap-1 animate-in fade-in slide-in-from-left-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                        <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
                                    </div>
                                </>
                            )}

                            {(user.role === UserRole.ADMIN || isWarehouse) && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sucursal</label>
                                    <select
                                        className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none min-w-[150px]"
                                        value={selectedHistoryBranch}
                                        onChange={e => setSelectedHistoryBranch(e.target.value)}
                                    >
                                        <option value="ALL">Todas las sucursales</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {historySubTab === 'sales' && (
                                <button onClick={fetchHistorySales} className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">Filtrar</button>
                            )}

                            <div className="ml-auto flex items-center gap-4">
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                                    <button onClick={() => setHistorySubTab('sales')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${historySubTab === 'sales' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Ventas</button>
                                    <button onClick={() => setHistorySubTab('promotions')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${historySubTab === 'promotions' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                        Solicitudes
                                        {promotionRequests.filter(r => r.status === 'pending').length > 0 && (
                                            <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{promotionRequests.filter(r => r.status === 'pending').length}</span>
                                        )}
                                    </button>
                                </div>
                                {historySubTab === 'sales' && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas: {historySales.length}</p>
                                        <p className="text-xl font-black text-primary">${historySales.reduce((acc, s) => acc + s.total, 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table matching Municipal Style */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {historySubTab === 'promotions' ? (
                                <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase">
                                                <tr>
                                                    <th className="px-6 py-4">Fecha</th>
                                                    <th className="px-6 py-4">Cliente</th>
                                                    <th className="px-6 py-4">Artículos</th>
                                                    <th className="px-6 py-4">Descuento</th>
                                                    <th className="px-6 py-4">Estado</th>
                                                    <th className="px-6 py-4">Motivo rechazo</th>
                                                    <th className="px-6 py-4 text-right">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y dark:divide-slate-700">
                                                {promotionRequests.length === 0 ? (
                                                    <tr><td colSpan={7} className="px-8 py-12 text-center text-slate-400 italic">No hay solicitudes de promoción.</td></tr>
                                                ) : (
                                                    promotionRequests.map(req => (
                                                        <tr key={req.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors ${req.status === 'approved' && req.id === pendingPromotionRequestId ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                                                            <td className="px-6 py-4 text-sm text-slate-500">{new Date(req.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td className="px-6 py-4 font-bold text-sm">{req.clientName || '—'}</td>
                                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{req.totalItems} pzas</td>
                                                            <td className="px-6 py-4 font-black text-primary">{req.requestedDiscountPercent}%</td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                                                    req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                                    req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                    {req.status === 'approved' ? 'Aprobada' : req.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-xs text-slate-500 italic">{req.rejectionReason || '—'}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                {req.status === 'approved' && req.id !== pendingPromotionRequestId && (
                                                                    <button
                                                                        onClick={() => handleCompleteFromPromotion(req)}
                                                                        className="px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                                                    >
                                                                        Completar venta
                                                                    </button>
                                                                )}
                                                                {req.id === pendingPromotionRequestId && (
                                                                    <span className="text-[10px] font-black text-green-600 uppercase">En proceso</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                            <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase">
                                            <tr>
                                                <th className="px-6 py-4">Folio</th>
                                                <th className="px-6 py-4">Cliente</th>
                                                <th className="px-6 py-4">Pago</th>
                                                <th className="px-6 py-4">Total</th>
                                                <th className="px-6 py-4">Estado</th>
                                                <th className="px-6 py-4">Fecha</th>
                                                <th className="px-6 py-4 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {historyLoading ? (
                                                <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-bold">Cargando historial...</td></tr>
                                            ) : historySales.length === 0 ? (
                                                <tr><td colSpan={7} className="px-8 py-12 text-center text-slate-400 italic">No hay registros de ventas al mayoreo en este período.</td></tr>
                                            ) : (
                                                historySales.map(sale => (
                                                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                                        <td className="px-6 py-4 font-black text-primary">
                                                            {sale.folio ? `#W-${String(sale.folio).padStart(4, '0')}` : `#${sale.id.slice(0, 8).toUpperCase()}`}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold">{sale.clientName || 'Cliente General'}</span>
                                                                {sale.branchName && <span className="text-[10px] text-slate-400 font-black uppercase">{sale.branchName}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${sale.paymentType === 'credito' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                {sale.paymentType === 'credito' ? 'Crédito' : 'Contado'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-black text-slate-900 dark:text-white">
                                                            ${sale.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                                                sale.paymentStatus === 'approved' ? 'bg-green-100 text-green-600' : 
                                                                sale.paymentStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                                                                'bg-orange-100 text-orange-600' // pending
                                                            }`}>
                                                                {sale.paymentStatus === 'approved' ? 'Aprobado' : 
                                                                 sale.paymentStatus === 'rejected' ? 'Rechazado' :
                                                                 'Pendiente'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-slate-500">
                                                            {new Date(sale.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button
                                                                    onClick={() => setSelectedHistorySale(sale)}
                                                                    className="p-1 text-slate-400 hover:text-primary transition-colors"
                                                                    title="Ver Detalles"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">visibility</span>
                                                                </button>
                                                                <Link
                                                                    to={`/wholesale-note/${sale.id}`}
                                                                    className="p-1 text-slate-400 hover:text-primary transition-colors"
                                                                    title="Imprimir"
                                                                >
                                                                    <span className="material-symbols-outlined text-lg">print</span>
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            )}
                        </div>

                        {/* Details Modal */}
                        {selectedHistorySale && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedHistorySale(null)}>
                                                <div className="bg-white dark:bg-slate-950 w-full max-w-lg rounded-2xl shadow-2xl border dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                                    <div className="bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800 p-4 flex justify-between items-center">
                                                        <div>
                                                            <h3 className="font-black text-slate-900 dark:text-white text-lg">Detalle de Venta Mayoreo</h3>
                                                            <p className="text-xs text-slate-500 font-mono">ID: {selectedHistorySale?.id.slice(0, 8).toUpperCase()}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedHistorySale(null)}
                                                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined">close</span>
                                                        </button>
                                                    </div>
                        
                                                    <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                                                        {/* Products */}
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Productos</p>
                                                            <div className="space-y-2">
                                                                {selectedHistorySale?.items.map((item: any, idx: number) => (
                                                                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-800">
                                                                        <div>
                                                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{item.productName}</p>
                                                                            <p className="text-[10px] text-slate-500">Cantidad: {item.quantity}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-xs font-black text-slate-900 dark:text-white">${item.total.toLocaleString()}</p>
                                                                            <p className="text-[10px] text-slate-400">${item.price.toLocaleString()} c/u</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                        
                                                        {/* Delivery Info */}
                                                        {selectedHistorySale?.deliveryReceiverName && (
                                                            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl">
                                                                <p className="text-[9px] uppercase font-bold text-amber-500 mb-1">Entregado A</p>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="material-symbols-outlined text-amber-600 text-lg">local_shipping</span>
                                                                    <p className="text-sm font-black text-amber-900 dark:text-amber-100">{selectedHistorySale.deliveryReceiverName}</p>
                                                                </div>
                                                            </div>
                                                        )}
                        
                                                        {/* Billing Info */}
                                                        {(selectedHistorySale?.billingSocialReason || selectedHistorySale?.billingInvoiceNumber || selectedHistorySale?.billingBank) && (
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Datos Fiscales y Bancarios</p>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {selectedHistorySale?.billingSocialReason && (
                                                                        <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl">
                                                                            <p className="text-[9px] uppercase font-bold text-blue-400 mb-1">Razón Social</p>
                                                                            <p className="text-xs font-bold text-blue-900 dark:text-blue-100">{selectedHistorySale.billingSocialReason}</p>
                                                                        </div>
                                                                    )}
                                                                    {selectedHistorySale?.billingInvoiceNumber && (
                                                                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                                                                            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">No. Factura</p>
                                                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedHistorySale.billingInvoiceNumber}</p>
                                                                        </div>
                                                                    )}
                                                                    {selectedHistorySale?.billingBank && (
                                                                        <div className="p-3 bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 rounded-xl">
                                                                            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Banco</p>
                                                                            <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedHistorySale.billingBank}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                        
                                                        {/* Totals */}
                                                        <div className="border-t dark:border-slate-800 pt-4 space-y-2">
                                                            <div className="flex justify-between text-xs text-slate-500">
                                                                <span>Subtotal</span>
                                                                <span>${selectedHistorySale?.subtotal.toLocaleString()}</span>
                                                            </div>
                                                            {(selectedHistorySale?.discountAmount ?? 0) > 0 && (
                                                                <div className="flex justify-between text-xs text-amber-600 font-bold">
                                                                    <span>Descuento</span>
                                                                    <span>-${selectedHistorySale?.discountAmount.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white pt-2">
                                                                <span>Total Pagado</span>
                                                                <span>${selectedHistorySale?.total.toLocaleString()}</span>
                                                            </div>
                                                             <div className="flex justify-end pt-1 gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase
                                                                    ${selectedHistorySale?.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                                                                        selectedHistorySale?.paymentMethod === 'card' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}
                                                                    `}>
                                                                    Método: {selectedHistorySale?.paymentMethod === 'cash' ? 'Efectivo' : selectedHistorySale?.paymentMethod === 'card' ? 'Tarjeta' : 'Transferencia'}
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase
                                                                    ${selectedHistorySale?.paymentType === 'credito' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}
                                                                    `}>
                                                                    Tipo: {selectedHistorySale?.paymentType === 'credito' ? 'Crédito' : 'Contado'}
                                                                </span>
                                                            </div>
                                                            
                                                            {/* Botón para agregar/editar factura */}
                                                            {selectedHistorySale && (
                                                                <div className="pt-4 border-t dark:border-slate-800">
                                                                    <button 
                                                                        onClick={() => handleEditInvoice(selectedHistorySale)}
                                                                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">receipt_long</span>
                                                                        {selectedHistorySale.billingInvoiceNumber ? 'Editar Factura' : 'Agregar Factura'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                     
                        </div>
                    </>
                )}

                {/* ======================== ACCOUNTS TAB ======================== */}
                {activeTab === 'accounts' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-black">Cuentas de Crédito</h2>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Clientes con crédito autorizado</p>
                                </div>
                            </div>

                            {/* Accounts Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {accounts.length === 0 && (
                                    <div className="col-span-full py-12 text-center">
                                        <span className="material-symbols-outlined text-5xl text-slate-300">account_balance_wallet</span>
                                        <p className="text-slate-400 font-bold mt-4">No hay cuentas de crédito registradas</p>
                                        <p className="text-xs text-slate-500">Las cuentas se crean automáticamente cuando se vende a crédito</p>
                                    </div>
                                )}
                                {accounts.map((acc: any) => {
                                    const pctUsed = acc.credit_limit > 0 ? ((acc.balance || 0) / acc.credit_limit) * 100 : 0;
                                    return (
                                        <button
                                            key={acc.id}
                                            onClick={() => { setSelectedAccount(acc); setIsAccountModalOpen(true); }}
                                            className="bg-white dark:bg-slate-800 p-6 rounded-2xl border dark:border-slate-700 text-left hover:border-primary transition-all shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-black text-lg">{acc.client_name}</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{acc.branch?.name || 'Sucursal'}</p>
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                                                    acc.is_blocked ? 'bg-red-100 text-red-600' : 
                                                    acc.balance > 0 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                                }`}>
                                                    {acc.is_blocked ? 'Bloqueado' : acc.balance > 0 ? 'Pendiente' : 'Al día'}
                                                </span>
                                            </div>
                                            <div className="mb-3">
                                                <p className="text-2xl font-black text-primary">${(acc.balance || 0).toLocaleString()}</p>
                                                <p className="text-[10px] text-slate-400">de ${acc.credit_limit?.toLocaleString()}</p>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-2">
                                                <div 
                                                    className={`h-2 rounded-full ${pctUsed > 90 ? 'bg-red-500' : pctUsed > 70 ? 'bg-amber-500' : 'bg-primary'}`} 
                                                    style={{ width: `${Math.min(pctUsed, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold">{pctUsed.toFixed(0)}% usado</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================== ACCOUNT DETAIL MODAL ======================== */}
                {isAccountModalOpen && selectedAccount && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className={`p-8 flex items-center justify-between ${selectedAccount.is_blocked ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                                <div>
                                    <h3 className="text-xl font-black">{selectedAccount.client_name}</h3>
                                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${selectedAccount.is_blocked ? 'text-red-500' : selectedAccount.balance > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                                        {selectedAccount.is_blocked ? '⛔ Bloqueado' : selectedAccount.balance > 0 ? '⚠ Saldo Pendiente' : '✅ Al Día'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Saldo</p>
                                    <p className={`text-3xl font-black ${selectedAccount.balance > 0 ? 'text-amber-600' : 'text-green-500'}`}>${selectedAccount.balance?.toLocaleString() || 0}</p>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                                {/* Registrar abono */}
                                <div className="border dark:border-slate-700 rounded-3xl p-6 space-y-4">
                                    <h4 className="font-black text-sm uppercase text-slate-500 tracking-widest">Registrar Pago / Abono</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([{ key: 'abono', label: 'Abono Parcial' }, { key: 'pago_completo', label: 'Pago Completo' }] as const).map(t => (
                                            <button key={t.key} onClick={() => setPaymentFormType(t.key)} className={`py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${paymentFormType === t.key ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{t.label}</button>
                                        ))}
                                    </div>
                                    {paymentFormType === 'abono' && (
                                        <input type="number" min={1} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black outline-none focus:ring-2 focus:ring-primary/20" placeholder="Monto del abono" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                                    )}
                                    {paymentFormType === 'pago_completo' && (
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 text-center">
                                            <p className="text-sm font-bold text-slate-500">Se liquidará el total:</p>
                                            <p className="text-2xl font-black text-green-600">${selectedAccount.balance?.toLocaleString() || 0}</p>
                                        </div>
                                    )}
                                    <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" placeholder="Referencia / Notas (opcional)" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                                    <button onClick={handleAddWholesalePayment} disabled={loading || selectedAccount.balance === 0} className="w-full py-3 bg-primary text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                        {loading ? 'Guardando...' : paymentFormType === 'pago_completo' ? 'Liquidar Deuda' : 'Registrar Abono'}
                                    </button>
                                </div>

                                {/* Admin — configurar cuenta */}
                                {user.role === UserRole.ADMIN && (
                                    <div className="border dark:border-slate-700 rounded-3xl p-6 space-y-4">
                                        <h4 className="font-black text-sm uppercase text-slate-500 tracking-widest">Configuración de Cuenta (Admin)</h4>
                                        {/* Límite */}
                                        <div className="flex gap-2">
                                            <input type="number" min={0} className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black outline-none focus:ring-2 focus:ring-primary/20" placeholder={`Límite (actual: $${selectedAccount.credit_limit?.toLocaleString() || 0})`} value={limitAmount} onChange={e => setLimitAmount(e.target.value)} />
                                            <button onClick={handleSetWholesaleLimit} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Guardar</button>
                                        </div>
                                        {/* Bloquear / Desbloquear */}
                                        {selectedAccount.is_blocked ? (
                                            <button onClick={handleUnblockWholesaleAccount} disabled={loading} className="w-full py-3 bg-green-500 text-white font-black rounded-2xl uppercase text-xs tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50">
                                                ✅ Desbloquear Cuenta
                                            </button>
                                        ) : (
                                            showBlockForm ? (
                                                <div className="space-y-2">
                                                    <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-200" placeholder="Razón del bloqueo..." value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setShowBlockForm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-black rounded-2xl uppercase text-xs">Cancelar</button>
                                                        <button onClick={handleBlockWholesaleAccount} disabled={loading || !blockReason.trim()} className="flex-1 py-3 bg-red-500 text-white font-black rounded-2xl uppercase text-xs disabled:opacity-50">Confirmar Bloqueo</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={() => setShowBlockForm(true)} className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-500 font-black rounded-2xl uppercase text-xs tracking-widest border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors">
                                                    ⛔ Bloquear Cuenta
                                                </button>
                                            )
                                        )}
                                    </div>
                                )}

                                {/* Movimientos */}
                                <div className="border dark:border-slate-700 rounded-3xl overflow-hidden">
                                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                                        <h4 className="font-black text-sm uppercase text-slate-500 tracking-widest">Historial de Movimientos</h4>
                                    </div>
                                    <div className="divide-y dark:divide-slate-700 max-h-64 overflow-y-auto custom-scrollbar">
                                        {(selectedAccount.payments || []).length === 0 && (
                                            <p className="px-6 py-8 text-center text-slate-400 italic text-sm">Sin movimientos registrados.</p>
                                        )}
                                        {(selectedAccount.payments || []).map((p: any) => (
                                            <div key={p.id} className="px-6 py-4 flex items-center gap-4">
                                                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${p.payment_type === 'cargo' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                                                    <span className={`material-symbols-outlined text-lg ${p.payment_type === 'cargo' ? 'text-red-500' : 'text-green-500'}`}>{p.payment_type === 'cargo' ? 'arrow_upward' : 'arrow_downward'}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-black text-sm ${p.payment_type === 'cargo' ? 'text-red-600' : 'text-green-600'}`}>
                                                        {p.payment_type === 'cargo' ? '+ Cargo' : p.payment_type === 'pago_completo' ? '✓ Pago Completo' : '- Abono'} — ${p.amount?.toLocaleString()}
                                                    </p>
                                                    {p.notes && <p className="text-[11px] text-slate-400 font-medium truncate">{p.notes}</p>}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold shrink-0">{new Date(p.created_at).toLocaleDateString('es-MX')}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t dark:border-slate-800 flex justify-end">
                                <button onClick={() => { setIsAccountModalOpen(false); setSelectedAccount(null); setShowBlockForm(false); setPaymentAmount(''); setPaymentNotes(''); setLimitAmount(''); }}
                                    className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Promotion Request Modal */}
                {showPromotionRequest && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-700 bg-purple-50 dark:bg-purple-900/20">
                                <h3 className="text-lg font-black text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                    <span className="material-symbols-outlined">local_offer</span>
                                    Solicitar Promoción Especial
                                </h3>
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                    Enviar solicitud al administrador para aprobación
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                        Porcentaje de Descuento Solicitado (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm font-bold border dark:border-slate-700"
                                        value={promotionRequestDiscount}
                                        onChange={e => setPromotionRequestDiscount(parseFloat(e.target.value) || 0)}
                                        placeholder="Ej: 15"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-2">
                                        Justificación (opcional)
                                    </label>
                                    <textarea
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border dark:border-slate-700 h-24 resize-none"
                                        value={promotionRequestReason}
                                        onChange={e => setPromotionRequestReason(e.target.value)}
                                        placeholder="Explica el motivo de la solicitud..."
                                    />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-400">Subtotal:</span>
                                        <span className="font-bold">${subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-400">Descuento solicitado:</span>
                                        <span className="font-bold text-purple-600">-{promotionRequestDiscount}%</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black pt-2 border-t dark:border-slate-700">
                                        <span>Ahorro:</span>
                                        <span className="text-purple-600">${(subtotal * promotionRequestDiscount / 100).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t dark:border-slate-700 flex gap-3">
                                <button
                                    onClick={() => { setShowPromotionRequest(false); setPromotionRequestReason(''); setPromotionRequestDiscount(0); }}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl uppercase text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleRequestPromotion}
                                    disabled={loading || promotionRequestDiscount <= 0}
                                    className="flex-1 py-3 bg-purple-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg disabled:opacity-50"
                                >
                                    {loading ? 'Enviando...' : 'Enviar Solicitud'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default WholesalePOS;
