import re

with open('views/WholesalePOS.tsx', 'r', encoding='utf-8') as f:
    pos_code = f.read()

with open('views/WholesaleHistory.tsx', 'r', encoding='utf-8') as f:
    hist_code = f.read()

# 1. Imports and Setup
new_code = """import React, { useState, useEffect } from 'react';
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
"""

# Extract all state variables from POS
states_match = re.search(r"const currentBranchId = user\.branchId \|\| 'BR-MAIN';(.*?)useEffect\(\(\) => \{", pos_code, re.DOTALL)
if states_match:
    new_code += "    const currentBranchId = user.branchId || 'BR-MAIN';\n"
    new_code += states_match.group(1)

# Add History States
new_code += """
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

"""

# Add POS Effects
effects_match = re.search(r"(useEffect\(\(\) => \{\s*if \(selectedClient\).*?const addToCart =)", pos_code, re.DOTALL)
if effects_match:
    new_code += effects_match.group(1)[:-16] # Remove 'const addToCart ='

# Add History Effects
new_code += """
    // --- HISTORY EFFECTS & METHODS ---
    useEffect(() => {
        if (activeTab === 'history') {
            loadBranches();
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

"""

# Add POS Logic
logic_match = re.search(r"(const addToCart =.*?return \(\s*<div)", pos_code, re.DOTALL)
if logic_match:
    new_code += logic_match.group(1)[:-15]

# Render
new_code += """
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
                            { key: 'history', label: 'Historial' }
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
"""

# Include POS DOM
dom_match = re.search(r'(<div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-900 relative">.*)</main>', pos_code, re.DOTALL)
if dom_match:
    new_code += "                {activeTab === 'pos' && (\n                    " + dom_match.group(1).replace('\n', '\n                    ') + "\n                )}\n"

# Include History DOM
hist_dom_match = re.search(r'(<div className="p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6">.*)</main>', hist_code, re.DOTALL)
if hist_dom_match:
    hist_dom = hist_dom_match.group(1)
    hist_dom = hist_dom.replace('period ===', 'historyPeriod ===')
    hist_dom = hist_dom.replace('setPeriod(', 'setHistoryPeriod(')
    hist_dom = hist_dom.replace('period}', 'historyPeriod}')
    hist_dom = hist_dom.replace('sales.length', 'historySales.length')
    hist_dom = hist_dom.replace('sales.', 'historySales.')
    hist_dom = hist_dom.replace('sales.reduce', 'historySales.reduce')
    hist_dom = hist_dom.replace('sales.map', 'historySales.map')
    hist_dom = hist_dom.replace('loading ?', 'historyLoading ?')
    hist_dom = hist_dom.replace('setSelectedSale', 'setSelectedHistorySale')
    hist_dom = hist_dom.replace('selectedSale', 'selectedHistorySale')
    new_code += "                {activeTab === 'history' && (\n                    <div className=\"flex-1 flex flex-col overflow-hidden\">\n                        " + hist_dom.replace('\n', '\n                        ') + "\n                    </div>\n                )}\n"

new_code += """            </main>
        </div>
    );
};

export default WholesalePOS;
"""

with open('views/WholesalePOS.tsx', 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Merge Wholesale Python Script Done")
