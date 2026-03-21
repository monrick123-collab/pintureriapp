
import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, CartItem, UserRole, Client } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { ClientService } from '../services/clientService';

interface MunicipalPOSProps {
    user: User;
    onLogout: () => void;
}

const MunicipalPOS: React.FC<MunicipalPOSProps> = ({ user, onLogout }) => {
    const isAdmin = user.role === UserRole.ADMIN;
    const isWarehouse = user.role === UserRole.WAREHOUSE || user.role === UserRole.WAREHOUSE_SUB;
    const [adminPosBranchId, setAdminPosBranchId] = useState<string>('');
    const branchId = isAdmin ? adminPosBranchId : (user.branchId || '');

    // Products & admins
    const [products, setProducts] = useState<Product[]>([]);
    const [admins, setAdmins] = useState<{ id: string; name: string }[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    
    // Client filters
    const [clientFilter, setClientFilter] = useState({
        search: '',
        type: 'all' as 'all' | 'Individual' | 'Empresa',
        municipality: 'all' as 'all' | string,
        activeCredit: 'all' as 'all' | 'active' | 'inactive',
        isMunicipality: 'all' as 'all' | 'yes' | 'no'
    });

    // Tabs: pos | history | accounts
    const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'accounts'>('pos');

    // Sale config
    const [municipality, setMunicipality] = useState('');
    const [department, setDepartment] = useState('');
    const [contactName, setContactName] = useState('');
    const [socialReason, setSocialReason] = useState('');
    const [rfc, setRfc] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [authorizedExitBy, setAuthorizedExitBy] = useState('');
    const [deliveryReceiver, setDeliveryReceiver] = useState('');
    const [paymentType, setPaymentType] = useState<'contado' | 'credito'>('contado');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'check'>('cash');
    const [creditDays, setCreditDays] = useState(30);
    const [notes, setNotes] = useState('');
    const [blockedWarning, setBlockedWarning] = useState<string | null>(null);
    const [transferReference, setTransferReference] = useState(''); // Para aprobación de pagos

    // History
    const [history, setHistory] = useState<any[]>([]);
    const today = new Date();
    const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    const firstDay = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(localDate);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedHistoryBranch, setSelectedHistoryBranch] = useState<string>(
        (isAdmin || isWarehouse) ? 'ALL' : branchId
    );

    // Accounts / credit
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentFormType, setPaymentFormType] = useState<'abono' | 'pago_completo'>('abono');
    const [blockReason, setBlockReason] = useState('');
    const [showBlockForm, setShowBlockForm] = useState(false);
    const [limitAmount, setLimitAmount] = useState('');

    useEffect(() => {
        loadData();
        if (isAdmin || isWarehouse) {
            loadBranches();
        }
    }, []);

    useEffect(() => {
        if (isAdmin && adminPosBranchId) {
            loadData();
        }
    }, [adminPosBranchId]);

    const loadBranches = async () => {
        try {
            const data = await InventoryService.getBranches();
            setBranches(data);
        } catch (e) {
            console.error('Error al cargar sucursales:', e);
        }
    };

    const loadData = async (sd = startDate, ed = endDate) => {
        try {
            setLoading(true);
            // Fetch independently so a missing table doesn't block everything
            const [prodData, clientsData] = await Promise.all([
                InventoryService.getProductsByBranch(branchId).catch(() => []),
                ClientService.getClients().catch(() => []),
            ]);
            setProducts(prodData);
            setClients(clientsData);
            
            // Cargar datos adicionales por separado para evitar errores
            try {
                // 1. Cargar admins
                const admins = await SalesService.getAdmins().catch(() => []);
                setAdmins(admins);
                
                // 2. Cargar historial de ventas municipales
                const hBranch = (isAdmin || isWarehouse) ? selectedHistoryBranch : branchId;
                const historyData = await SalesService.getMunicipalSales(hBranch, sd, ed).catch(() => []);
                setHistory(historyData);
                
                // 3. Cargar cuentas municipales  
                const accountsData = await SalesService.getMunicipalAccounts(isAdmin ? undefined : branchId).catch(() => []);
                setAccounts(accountsData);
            } catch (e) {
                console.log('Algunos datos no pudieron cargarse:', e);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleEditInvoice = async (sale: any) => {
        const newInvoice = window.prompt('Ingrese el número de factura:', sale.invoice_number || '');
        if (newInvoice !== null) {
            try {
                await SalesService.updateMunicipalInvoiceNumber(sale.id, newInvoice);
                alert('Factura actualizada correctamente');
                loadData(); // Recargar el historial
            } catch (e) {
                console.error(e);
                alert('Error al actualizar la factura');
            }
        }
    };

    // Check block when municipality changes and paymentType is credito
    useEffect(() => {
        if (!municipality || paymentType !== 'credito') { 
            setBlockedWarning(null); 
            return; 
        }
        // Buscar si la cuenta municipal está bloqueada
        const account = accounts.find(acc => acc.municipality === municipality);
        if (account?.is_blocked) {
            setBlockedWarning(`La cuenta de ${municipality} está bloqueada. Razón: ${account.block_reason || 'No especificada'}`);
        } else {
            setBlockedWarning(null);
        }
    }, [municipality, paymentType, accounts]);

    const addToCart = (p: Product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === p.id);
            if (ex) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...p, quantity: 1 }];
        });
    };
    const updateQty = (id: string, delta: number) => {
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
    };

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    // Filter clients based on filters
    const filteredClients = clients.filter(client => {
        // Search filter
        if (clientFilter.search && !client.name.toLowerCase().includes(clientFilter.search.toLowerCase()) && 
            !(client.taxId || '').toLowerCase().includes(clientFilter.search.toLowerCase()) &&
            !client.email.toLowerCase().includes(clientFilter.search.toLowerCase())) {
            return false;
        }
        
        // Type filter
        if (clientFilter.type !== 'all' && client.type !== clientFilter.type) {
            return false;
        }
        
        // Municipality filter
        if (clientFilter.municipality !== 'all' && client.municipality !== clientFilter.municipality) {
            return false;
        }
        
        // Active credit filter
        if (clientFilter.activeCredit !== 'all') {
            if (clientFilter.activeCredit === 'active' && !client.isActiveCredit) return false;
            if (clientFilter.activeCredit === 'inactive' && client.isActiveCredit) return false;
        }
        
        // Is municipality filter
        if (clientFilter.isMunicipality !== 'all') {
            if (clientFilter.isMunicipality === 'yes' && !client.isMunicipality) return false;
            if (clientFilter.isMunicipality === 'no' && client.isMunicipality) return false;
        }
        
        return true;
    });

    const handleFinalizeSale = async () => {
        if (!municipality.trim()) { alert('Ingrese el nombre del municipio.'); return; }
        if (!deliveryReceiver.trim()) { alert('Ingrese quién recibe la mercancía.'); return; }
        if (!authorizedExitBy) { alert('Seleccione el administrador que autoriza la salida.'); return; }
        if (cart.length === 0) { alert('Agregue al menos un producto.'); return; }
        if (blockedWarning) { alert('La cuenta de este municipio está bloqueada. No se puede procesar la venta.'); return; }
        // Validación para transferencias
        if (paymentMethod === 'transfer' && !transferReference.trim()) {
            alert('Para pagos con Transferencia, ingrese la referencia de transferencia.');
            return;
        }
        try {
            setLoading(true);
            await SalesService.createMunicipalSale(
                branchId,
                cart.map(i => ({ productId: i.id, productName: i.name, quantity: i.quantity, price: i.price })),
                { municipality, department, contactName, socialReason, rfc, invoiceNumber, authorizedExitBy, deliveryReceiver, paymentType, paymentMethod, creditDays: paymentType === 'credito' ? creditDays : 0, subtotal, iva, total, notes, transferReference }
            );
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false); setIsPaymentModalOpen(false); setCart([]);
                setMunicipality(''); setDepartment(''); setContactName('');
                setSocialReason(''); setRfc(''); setInvoiceNumber('');
                setDeliveryReceiver(''); setAuthorizedExitBy(''); setNotes('');
                setTransferReference('');
                loadData();
            }, 2000);
        } catch (e: any) {
            console.error(e);
            alert('Error al procesar la venta: ' + (e.message || e.toString()));
        } finally { setLoading(false); }
    };

    const handleAddPayment = async () => {
        if (!selectedAccount) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) { alert('Monto inválido.'); return; }
        try {
            setLoading(true);
            await SalesService.addMunicipalPayment(selectedAccount.id, selectedAccount.balance, paymentFormType, amount, paymentNotes, user.id);
            setPaymentAmount(''); setPaymentNotes('');
            await loadData();
            // Refresh selected account
            const updated = await SalesService.getMunicipalAccounts(isAdmin ? undefined : branchId);
            setAccounts(updated);
            const refreshed = updated.find((a: any) => a.id === selectedAccount.id);
            setSelectedAccount(refreshed || null);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setLoading(false); }
    };

    const handleBlock = async () => {
        if (!selectedAccount) return;
        try {
            setLoading(true);
            await SalesService.blockMunicipalAccount(selectedAccount.id, blockReason);
            setShowBlockForm(false); setBlockReason('');
            await loadData();
            const updated = await SalesService.getMunicipalAccounts(isAdmin ? undefined : branchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setLoading(false); }
    };

    const handleUnblock = async () => {
        if (!selectedAccount) return;
        try {
            setLoading(true);
            await SalesService.unblockMunicipalAccount(selectedAccount.id);
            await loadData();
            const updated = await SalesService.getMunicipalAccounts(isAdmin ? undefined : branchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setLoading(false); }
    };

    const handleSetLimit = async () => {
        if (!selectedAccount) return;
        const limit = parseFloat(limitAmount);
        if (isNaN(limit) || limit < 0) { alert('Límite inválido.'); return; }
        try {
            await SalesService.setCreditLimit(selectedAccount.id, limit);
            setLimitAmount('');
            const updated = await SalesService.getMunicipalAccounts(isAdmin ? undefined : branchId);
            setAccounts(updated);
            setSelectedAccount(updated.find((a: any) => a.id === selectedAccount.id) || null);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    // Select a client and auto-fill municipality fields
    const handleSelectClient = (client: Client) => {
        setMunicipality(client.name);
        setContactName(client.name);
        setSocialReason(client.name);
        setRfc(client.taxId || '');
        // Clear client search after selection
        setClientFilter(prev => ({ ...prev, search: '' }));
    };

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    );

    const fmtMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
                {/* Header */}
                <header className="min-h-[4rem] flex items-center justify-between px-4 md:px-8 py-3 flex-wrap gap-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-3xl">account_balance</span>
                        <div>
                            <h1 className="text-xl font-black">Venta a Municipio</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gobierno / Institucional</p>
                        </div>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                        {([
                            { key: 'pos', label: 'Nueva Venta' },
                            { key: 'history', label: 'Historial' },
                            { key: 'accounts', label: 'Cuentas de Crédito' },
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </header>

                {/* ======================== POS ======================== */}
                {activeTab === 'pos' && (
                    <div className="flex-1 overflow-hidden flex">
                        {/* LEFT — Config */}
                        <div className="w-[380px] flex flex-col bg-white dark:bg-slate-900 border-r dark:border-slate-800 overflow-y-auto custom-scrollbar p-6 gap-4 shrink-0">
                            {isAdmin && (
                                <select
                                    value={adminPosBranchId}
                                    onChange={e => { setAdminPosBranchId(e.target.value); setCart([]); }}
                                    className="w-full h-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 text-sm font-medium text-slate-700 dark:text-white focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">— Selecciona sucursal para vender —</option>
                                    {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            )}
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Datos del Municipio</h2>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Municipio *</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" placeholder="Ej: Monterrey" value={municipality} onChange={e => setMunicipality(e.target.value)} />
                            </div>
                            
                            {/* Client search and selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Buscar Cliente Registrado</label>
                                    <button type="button" onClick={() => setClientFilter(prev => ({ ...prev, search: '' }))} className="text-[10px] text-slate-400 hover:text-slate-600">Limpiar</button>
                                </div>
                                <div className="relative">
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                                    <input
                                        className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Buscar cliente por nombre, RFC..."
                                        value={clientFilter.search}
                                        onChange={e => setClientFilter(prev => ({ ...prev, search: e.target.value }))}
                                    />
                                </div>
                                
                                {/* Client filters */}
                                {clientFilter.search && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <select className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg" value={clientFilter.type} onChange={e => setClientFilter(prev => ({ ...prev, type: e.target.value as any }))}>
                                            <option value="all">Todos los tipos</option>
                                            <option value="Individual">Individual</option>
                                            <option value="Empresa">Empresa</option>
                                        </select>
                                        <select className="text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg" value={clientFilter.isMunicipality} onChange={e => setClientFilter(prev => ({ ...prev, isMunicipality: e.target.value as any }))}>
                                            <option value="all">Todos</option>
                                            <option value="yes">Solo municipios</option>
                                            <option value="no">No municipios</option>
                                        </select>
                                    </div>
                                )}
                                
                                {/* Client results */}
                                {clientFilter.search && filteredClients.length > 0 && (
                                    <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                                        {filteredClients.slice(0, 10).map(client => (
                                            <button
                                                key={client.id}
                                                type="button"
                                                onClick={() => handleSelectClient(client)}
                                                className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</span>
                                                    <span className="text-[10px] text-slate-500">{client.taxId} • {client.municipality || 'Sin municipio'}</span>
                                                </div>
                                                {client.isMunicipality && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Municipio</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {clientFilter.search && filteredClients.length === 0 && (
                                    <div className="p-4 text-center text-slate-400 text-sm">
                                        No se encontraron clientes
                                    </div>
                                )}
                            </div>
                            {/* Blocked warning */}
                            {blockedWarning && (
                                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold">{blockedWarning}</div>
                            )}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Dependencia / Área</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" placeholder="Ej: Obras Públicas" value={department} onChange={e => setDepartment(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nombre del Contacto</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" placeholder="Nombre completo" value={contactName} onChange={e => setContactName(e.target.value)} />
                            </div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Datos Fiscales</h2>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Razón Social</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" placeholder="Razón social del municipio" value={socialReason} onChange={e => setSocialReason(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">RFC</label>
                                    <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold uppercase focus:ring-2 focus:ring-primary/20" placeholder="RFC" value={rfc} onChange={e => setRfc(e.target.value.toUpperCase())} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">No. Factura</label>
                                    <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" placeholder="F-0001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                                </div>
                            </div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Logística</h2>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Admin que Autoriza *</label>
                                <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" value={authorizedExitBy} onChange={e => setAuthorizedExitBy(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Quien Recibe *</label>
                                <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-primary/20" placeholder="Nombre de quien recibe" value={deliveryReceiver} onChange={e => setDeliveryReceiver(e.target.value)} />
                            </div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <h2 className="text-xs font-black uppercase text-slate-400 tracking-widest">Pago</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {(['contado', 'credito'] as const).map(t => (
                                    <button key={t} onClick={() => setPaymentType(t)} className={`py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${paymentType === t ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        {t === 'contado' ? 'Contado' : 'Crédito'}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { key: 'cash', label: 'Efectivo', icon: 'payments' },
                                    { key: 'card', label: 'Tarjeta', icon: 'credit_card' },
                                    { key: 'transfer', label: 'Transferencia', icon: 'account_balance' },
                                    { key: 'check', label: 'Cheque', icon: 'edit_note' },
                                ] as const).map(m => (
                                    <button key={m.key} onClick={() => setPaymentMethod(m.key)} className={`py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${paymentMethod === m.key ? 'bg-primary/10 text-primary ring-2 ring-primary/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <span className="material-symbols-outlined text-sm">{m.icon}</span>{m.label}
                                    </button>
                                 ))}
                             </div>
                             
                             {/* Campo para referencia de transferencia */}
                             {paymentMethod === 'transfer' && (
                                 <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                     <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Referencia de Transferencia</label>
                                     <input 
                                         className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-black focus:ring-2 focus:ring-primary/20" 
                                         placeholder="Ej: TRF-123456" 
                                         value={transferReference} 
                                         onChange={e => setTransferReference(e.target.value)} 
                                     />
                                 </div>
                             )}
                             
                             {paymentType === 'credito' && (
                                 <div className="space-y-1">
                                     <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Días de Crédito</label>
                                     <input type="number" min={1} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none font-black focus:ring-2 focus:ring-primary/20" value={creditDays} onChange={e => setCreditDays(parseInt(e.target.value) || 30)} />
                                 </div>
                             )}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Observaciones</label>
                                <textarea className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none text-sm font-medium resize-none h-20 focus:ring-2 focus:ring-primary/20" placeholder="Notas adicionales..." value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>

                        {/* CENTER — Products */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-6 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                                <div className="relative max-w-lg">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input className="w-full pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border-none font-medium text-sm focus:ring-2 focus:ring-primary/10 outline-none" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 xl:grid-cols-3 gap-4 custom-scrollbar">
                                {filtered.map(p => (
                                    <button key={p.id} onClick={() => addToCart(p)} className="p-4 bg-white dark:bg-slate-800 rounded-3xl text-left border border-transparent hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group active:scale-95">
                                        <div className="size-20 bg-slate-100 dark:bg-slate-700 rounded-2xl p-2 mb-3 group-hover:scale-105 transition-transform mx-auto flex items-center justify-center overflow-hidden">
                                            {p.image ? (
                                                <img src={p.image} className="w-full h-full object-contain" alt={p.name} />
                                            ) : (
                                                <span className="material-symbols-outlined text-slate-300 text-4xl">image</span>
                                            )}
                                        </div>
                                        <p className="font-black text-slate-800 dark:text-white text-sm line-clamp-2 leading-tight mb-1">{p.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{p.sku}</p>
                                        <p className="font-black text-primary">${p.price.toLocaleString()}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT — Cart */}
                        <div className="w-80 flex flex-col bg-white dark:bg-slate-900 border-l dark:border-slate-800 shrink-0">
                            <div className="p-6 border-b dark:border-slate-800">
                                <h3 className="font-black uppercase text-xs text-slate-400 tracking-widest">Carrito — {cart.length} producto{cart.length !== 1 ? 's' : ''}</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {cart.length === 0 && (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 gap-2">
                                        <span className="material-symbols-outlined text-5xl">shopping_cart</span>
                                        <p className="text-xs font-bold">Sin productos</p>
                                    </div>
                                )}
                                {cart.map(item => (
                                    <div key={item.id} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate">{item.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{fmtMoney(item.price * item.quantity)}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => updateQty(item.id, -1)} className="size-7 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                                                <span className="material-symbols-outlined text-sm">remove</span>
                                            </button>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-10 bg-transparent text-center font-black text-sm border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                                                value={item.quantity === 0 ? '' : item.quantity}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, val) } : i));
                                                }}
                                                onBlur={(e) => {
                                                    if (!e.target.value || parseInt(e.target.value) === 0) {
                                                        setCart(prev => prev.filter(i => i.id !== item.id));
                                                    }
                                                }}
                                            />
                                            <button onClick={() => updateQty(item.id, 1)} className="size-7 rounded-lg bg-primary text-white shadow-sm flex items-center justify-center hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-sm">add</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-6 border-t dark:border-slate-800 space-y-3">
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between text-slate-500 font-bold"><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
                                    <div className="flex justify-between text-slate-500 font-bold"><span>IVA 16%</span><span>{fmtMoney(iva)}</span></div>
                                    <div className="flex justify-between font-black text-lg pt-1 border-t dark:border-slate-700"><span>Total</span><span className="text-primary">{fmtMoney(total)}</span></div>
                                </div>
                                <button onClick={() => setIsPaymentModalOpen(true)} disabled={cart.length === 0 || loading || !!blockedWarning}
                                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-2xl shadow-primary/20 uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                    Confirmar Venta
                                </button>
                                {blockedWarning && <p className="text-xs text-red-500 font-bold text-center">Cuenta bloqueada — venta deshabilitada</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================== HISTORY ======================== */}
                {activeTab === 'history' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="mx-3 md:mx-8 mt-4 flex flex-wrap items-end gap-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl px-4 md:px-6 py-4 shadow-sm shrink-0">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            </div>
                             <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</label>
                                <input type="date" className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold border-none outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>

                            {(isAdmin || isWarehouse) && (
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

                            <button onClick={() => loadData(startDate, endDate)} className="px-5 py-2 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">Filtrar</button>
                            {(startDate || endDate) && <button onClick={() => { setStartDate(''); setEndDate(''); loadData('', ''); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Limpiar</button>}
                            <span className="text-[10px] text-slate-400 font-bold ml-auto">{history.length} venta{history.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-6xl mx-auto bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] shadow-sm border dark:border-slate-700 overflow-hidden">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700 text-[10px] font-black text-slate-400 uppercase">
                                            <tr>
                                                <th className="px-6 py-4">Folio</th>
                                                <th className="px-6 py-4">Municipio</th>
                                                <th className="px-6 py-4">Dependencia</th>
                                                <th className="px-6 py-4">Pago</th>
                                                <th className="px-6 py-4">Total</th>
                                                <th className="px-6 py-4">Estado</th>
                                                <th className="px-6 py-4">Fecha</th>
                                                <th className="px-6 py-4 text-center">Factura</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y dark:divide-slate-700">
                                            {history.map(s => (
                                                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                                    <td className="px-6 py-4 font-black text-primary">#M-{String(s.folio).padStart(4, '0')}</td>
                                                    <td className="px-6 py-4 font-bold">{s.municipality}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{s.department || '—'}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${s.payment_type === 'credito' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{s.payment_type}</span>
                                                    </td>
                                                    <td className="px-6 py-4 font-black">{fmtMoney(s.total)}</td>
                                                     <td className="px-6 py-4">
                                                         <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                                             s.payment_status === 'approved' ? 'bg-green-100 text-green-600' : 
                                                             s.payment_status === 'rejected' ? 'bg-red-100 text-red-600' :
                                                             s.payment_status === 'expired' ? 'bg-gray-100 text-gray-600' :
                                                             'bg-orange-100 text-orange-600' // pending
                                                         }`}>
                                                             {s.payment_status === 'approved' ? 'Aprobado' : 
                                                              s.payment_status === 'rejected' ? 'Rechazado' :
                                                              s.payment_status === 'expired' ? 'Expirado' :
                                                              'Pendiente'}
                                                         </span>
                                                     </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{fmtDate(s.created_at)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button 
                                                            onClick={() => handleEditInvoice(s)}
                                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 mx-auto transition-colors focus:ring-2 focus:ring-primary/20"
                                                        >
                                                            {s.invoice_number ? s.invoice_number : 'Agregar'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {history.length === 0 && <tr><td colSpan={8} className="px-8 py-12 text-center text-slate-400 italic">Sin ventas en este período.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================== ACCOUNTS ======================== */}
                {activeTab === 'accounts' && (
                    <div className="flex-1 flex overflow-hidden">
                        {/* Account list */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
                            <div className="max-w-5xl mx-auto space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-lg font-black">Cuentas de Crédito Municipal</h2>
                                    <span className="text-xs text-slate-400 font-bold">{accounts.length} municipio{accounts.length !== 1 ? 's' : ''}</span>
                                </div>
                                {accounts.length === 0 && (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] p-12 text-center text-slate-400">
                                        <span className="material-symbols-outlined text-5xl mb-2 block">account_balance</span>
                                        <p className="font-bold italic text-sm">Sin cuentas registradas aún.<br />Aparecerán automáticamente al crear ventas a crédito.</p>
                                    </div>
                                )}
                                {accounts.map(acc => {
                                    const pctUsed = acc.credit_limit > 0 ? Math.min(100, (acc.balance / acc.credit_limit) * 100) : 0;
                                    return (
                                        <button key={acc.id} onClick={() => { setSelectedAccount(acc); setIsAccountModalOpen(true); }}
                                            className={`w-full p-6 bg-white dark:bg-slate-800 rounded-[24px] border-2 transition-all text-left hover:shadow-xl ${acc.is_blocked ? 'border-red-300 dark:border-red-700 shadow-red-50' : acc.balance > 0 ? 'border-amber-200 dark:border-amber-700' : 'border-transparent dark:border-slate-700'}`}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`size-12 rounded-2xl flex items-center justify-center ${acc.is_blocked ? 'bg-red-100 dark:bg-red-900/30' : acc.balance > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                                                        <span className={`material-symbols-outlined text-2xl ${acc.is_blocked ? 'text-red-500' : acc.balance > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                                                            {acc.is_blocked ? 'block' : acc.balance > 0 ? 'account_balance_wallet' : 'check_circle'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-lg">{acc.municipality}</p>
                                                        {acc.is_blocked && <p className="text-xs text-red-500 font-bold">⛔ Bloqueado — {acc.block_reason || 'sin razón'}</p>}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo Pendiente</p>
                                                    <p className={`text-2xl font-black ${acc.balance > 0 ? 'text-amber-600' : 'text-green-500'}`}>{fmtMoney(acc.balance)}</p>
                                                    {acc.credit_limit > 0 && <p className="text-[10px] text-slate-400 font-bold">Límite: {fmtMoney(acc.credit_limit)}</p>}
                                                </div>
                                            </div>
                                            {acc.credit_limit > 0 && (
                                                <div className="mt-4">
                                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${pctUsed >= 90 ? 'bg-red-500' : pctUsed >= 60 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${pctUsed}%` }} />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-1">Uso de crédito: {pctUsed.toFixed(0)}%</p>
                                                </div>
                                            )}
                                            <div className="mt-3 flex gap-3 text-[10px] text-slate-400 font-bold">
                                                <span>{acc.payments?.length || 0} movimiento{acc.payments?.length !== 1 ? 's' : ''}</span>
                                                {acc.payments?.[0] && <span>· Último: {fmtDate(acc.payments[0].created_at)}</span>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================== PAY MODAL ======================== */}
                {isPaymentModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        {showSuccess ? (
                            <div className="bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl p-12 flex flex-col items-center gap-4">
                                <div className="size-24 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="material-symbols-outlined text-green-500 text-5xl">check_circle</span>
                                </div>
                                <h3 className="text-2xl font-black text-green-600">¡Venta Registrada!</h3>
                                <p className="text-slate-400 font-bold text-sm">Municipio: {municipality}</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[40px] shadow-2xl p-8">
                                <h3 className="text-2xl font-black mb-6">Confirmar Venta</h3>
                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">Municipio</span><span>{municipality}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">Productos</span><span>{cart.length} artículo{cart.length !== 1 ? 's' : ''}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
                                    <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">IVA 16%</span><span>{fmtMoney(iva)}</span></div>
                                    <div className="flex justify-between text-xl font-black border-t dark:border-slate-700 pt-3"><span>Total</span><span className="text-primary">{fmtMoney(total)}</span></div>
                                    <div className="flex justify-between text-sm font-bold">
                                        <span className="text-slate-500">Tipo de Pago</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black ${paymentType === 'credito' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>{paymentType}</span>
                                    </div>
                                    {paymentType === 'credito' && <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">Días de Crédito</span><span>{creditDays} días</span></div>}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs tracking-widest hover:text-slate-600">Cancelar</button>
                                    <button onClick={handleFinalizeSale} disabled={loading} className="flex-1 py-4 bg-primary text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                        {loading ? 'Procesando...' : 'Confirmar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ======================== ACCOUNT DETAIL MODAL ======================== */}
                {isAccountModalOpen && selectedAccount && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                            {/* Header */}
                            <div className={`p-8 flex items-center justify-between ${selectedAccount.is_blocked ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                                <div>
                                    <h3 className="text-xl font-black">{selectedAccount.municipality}</h3>
                                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${selectedAccount.is_blocked ? 'text-red-500' : selectedAccount.balance > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                                        {selectedAccount.is_blocked ? '⛔ Bloqueado' : selectedAccount.balance > 0 ? '⚠ Saldo Pendiente' : '✅ Al Día'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase text-slate-400">Saldo</p>
                                    <p className={`text-3xl font-black ${selectedAccount.balance > 0 ? 'text-amber-600' : 'text-green-500'}`}>{fmtMoney(selectedAccount.balance)}</p>
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
                                            <p className="text-2xl font-black text-green-600">{fmtMoney(selectedAccount.balance)}</p>
                                        </div>
                                    )}
                                    <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" placeholder="Referencia / Notas (opcional)" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} />
                                    <button onClick={handleAddPayment} disabled={loading || selectedAccount.balance === 0} className="w-full py-3 bg-primary text-white font-black rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                        {loading ? 'Guardando...' : paymentFormType === 'pago_completo' ? 'Liquidar Deuda' : 'Registrar Abono'}
                                    </button>
                                </div>

                                {/* Admin — configurar cuenta */}
                                {isAdmin && (
                                    <div className="border dark:border-slate-700 rounded-3xl p-6 space-y-4">
                                        <h4 className="font-black text-sm uppercase text-slate-500 tracking-widest">Configuración de Cuenta (Admin)</h4>
                                        {/* Límite */}
                                        <div className="flex gap-2">
                                            <input type="number" min={0} className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black outline-none focus:ring-2 focus:ring-primary/20" placeholder={`Límite de crédito (actual: ${fmtMoney(selectedAccount.credit_limit)})`} value={limitAmount} onChange={e => setLimitAmount(e.target.value)} />
                                            <button onClick={handleSetLimit} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Guardar</button>
                                        </div>
                                        {/* Bloquear / Desbloquear */}
                                        {selectedAccount.is_blocked ? (
                                            <button onClick={handleUnblock} disabled={loading} className="w-full py-3 bg-green-500 text-white font-black rounded-2xl uppercase text-xs tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50">
                                                ✅ Desbloquear Cuenta
                                            </button>
                                        ) : (
                                            showBlockForm ? (
                                                <div className="space-y-2">
                                                    <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-200" placeholder="Razón del bloqueo..." value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setShowBlockForm(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 font-black rounded-2xl uppercase text-xs">Cancelar</button>
                                                        <button onClick={handleBlock} disabled={loading || !blockReason.trim()} className="flex-1 py-3 bg-red-500 text-white font-black rounded-2xl uppercase text-xs disabled:opacity-50">Confirmar Bloqueo</button>
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
                                                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${p.type === 'cargo' ? 'bg-red-100 dark:bg-red-900/20' : 'bg-green-100 dark:bg-green-900/20'}`}>
                                                    <span className={`material-symbols-outlined text-lg ${p.type === 'cargo' ? 'text-red-500' : 'text-green-500'}`}>{p.type === 'cargo' ? 'arrow_upward' : 'arrow_downward'}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`font-black text-sm ${p.type === 'cargo' ? 'text-red-600' : 'text-green-600'}`}>
                                                        {p.type === 'cargo' ? '+ Cargo' : p.type === 'pago_completo' ? '✓ Pago Completo' : '- Abono'} — {fmtMoney(p.amount)}
                                                    </p>
                                                    {p.notes && <p className="text-[11px] text-slate-400 font-medium truncate">{p.notes}</p>}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold shrink-0">{fmtDate(p.created_at)}</p>
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
            </main>
        </div>
    );
};

export default MunicipalPOS;
