const fs = require('fs');

try {
    const posCode = fs.readFileSync('views/WholesalePOS.tsx', 'utf8');
    const historyCode = fs.readFileSync('views/WholesaleHistory.tsx', 'utf8');

    let newCode = `import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, Product, CartItem, SaleItem, Client, Branch, Sale, UserRole } from '../types';
import { InventoryService } from '../services/inventoryService';
import { SalesService } from '../services/salesService';
import { ClientService } from '../services/clientService';
import { AiService } from '../services/aiService';
import { translateStatus } from '../utils/formatters';
import { Link } from 'react-router-dom';

interface WholesalePOSProps {
    user: User;
    onLogout: () => void;
}

type TabType = 'pos' | 'history';
type Period = 'today' | 'week' | 'fortnight' | 'month' | 'custom';

const WholesalePOS: React.FC<WholesalePOSProps> = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState<TabType>('pos');
    const currentBranchId = user.branchId || 'BR-MAIN';

    // --- POS STATES ---
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
    const [appliedDiscount, setAppliedDiscount] = useState(0);
    const [isConfigExpanded, setIsConfigExpanded] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
    const [billingData, setBillingData] = useState({ bank: '', socialReason: '', invoiceNumber: '' });
    const [deliveryReceiver, setDeliveryReceiver] = useState('');
    const [clientFinancials, setClientFinancials] = useState<{ balance: number, oldestPendingDate: string | null } | null>(null);

    // --- HISTORY STATES ---
    const [historySales, setHistorySales] = useState<Sale[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [selectedHistoryBranch, setSelectedHistoryBranch] = useState<string>(
        user.role === UserRole.ADMIN ? 'ALL' : (user.branchId || 'BR-CENTRO')
    );
    const [historyPeriod, setHistoryPeriod] = useState<Period>('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedHistorySale, setSelectedHistorySale] = useState<Sale | null>(null);

    // --- POS EFFECTS ---
    useEffect(() => {
        if (selectedClient) {
            ClientService.getClientFinancials(selectedClient.id).then(setClientFinancials);
        } else {
            setClientFinancials(null);
        }
    }, [selectedClient]);

    useEffect(() => {
        loadInitialData();
        loadBranches();
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

            const branchesData = await InventoryService.getBranches();
            const myBranch = branchesData.find(b => b.id === currentBranchId);
            if (myBranch) setBranchConfig(myBranch.config);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- HISTORY EFFECTS & METHODS ---
    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistorySales();
        }
    }, [activeTab, historyPeriod, customStart, customEnd, selectedHistoryBranch]);

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
            setHistorySales(data.filter(s => s.isWholesale));
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoading(false);
        }
    };

`;

    // Extract POS Logic
    const posMatch = posCode.match(/const addToCart = [\s\S]*?const handleFinalizeSale = async \(\) => \{[\s\S]*?try \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/);
    if (posMatch) {
        newCode += posMatch[0] + '\n\n';
    } else {
        console.error("POS MATCH FAILED");
    }

    // Render Setup
    newCode += `    return (
        <div className="h-screen flex overflow-hidden">
            <Sidebar user={user} onLogout={onLogout} />

            <main className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50 dark:bg-slate-950">
                <header className="h-20 flex items-center justify-between px-6 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 lg:hidden" />
                        <div className="flex items-center gap-2 text-primary">
                            <span className="material-symbols-outlined font-black">groups</span>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase hidden sm:block">Ventas Mayoreo</h2>
                        </div>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
                        {([
                            { key: 'pos', label: 'Nueva Venta' },
                            { key: 'history', label: 'Historial' }
                        ] as const).map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={\`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all \${activeTab === tab.key ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}\`}>
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
`;

    const posDomStart = posCode.indexOf('<div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900 relative">');
    const posDomEnd = posCode.lastIndexOf('</main>');
    if (posDomStart !== -1 && posDomEnd !== -1) {
        let posDom = posCode.substring(posDomStart, posDomEnd);
        newCode += `                {activeTab === 'pos' && (\n                    ${posDom}\n                )}\n`;
    } else {
        console.error("POS DOM MATCH FAILED");
    }

    const histDomStart = historyCode.indexOf('<div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6">');
    const histDomEnd = historyCode.lastIndexOf('</main>');
    if (histDomStart !== -1 && histDomEnd !== -1) {
        let histDom = historyCode.substring(histDomStart, histDomEnd)
            // Rename logic
            .replace(/period ===/g, 'historyPeriod ===')
            .replace(/setPeriod\(/g, 'setHistoryPeriod(')
            .replace(/period\}/g, 'historyPeriod}')
            .replace(/sales\.length/g, 'historySales.length')
            .replace(/sales\./g, 'historySales.')
            .replace(/sales\.reduce/g, 'historySales.reduce')
            .replace(/sales\.map/g, 'historySales.map')
            .replace(/loading \?/g, 'historyLoading ?')
            .replace(/setLoading\(/g, 'setHistoryLoading(')
            .replace(/setSelectedSale/g, 'setSelectedHistorySale')
            .replace(/selectedSale/g, 'selectedHistorySale');

        newCode += `                {activeTab === 'history' && (\n                    <div className="flex-1 flex flex-col overflow-hidden">\n                        ${histDom}\n                    </div>\n                )}\n`;
    } else {
        console.error("HISTORY DOM MATCH FAILED");
    }

    newCode += `            </main>
        </div>
    );
};

export default WholesalePOS;
`;

    fs.writeFileSync('views/WholesalePOS.tsx', newCode);
    console.log('Merged WholesalePOS successfully!');
} catch (e) {
    console.error(e);
}
