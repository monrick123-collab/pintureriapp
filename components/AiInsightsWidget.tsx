
import React, { useState, useEffect } from 'react';
import { AiService } from '../services/aiService';
import { SalesService } from '../services/salesService';
import { InventoryService } from '../services/inventoryService';

interface Tip {
    title: string;
    description: string;
}

export const AiInsightsWidget: React.FC = () => {
    const [tips, setTips] = useState<Tip[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const loadInsights = async () => {
        setLoading(true);
        setError(false);
        try {
            // 1. Get Real Data (Last 30 days)
            const today = new Date();
            const lastMonth = new Date();
            lastMonth.setDate(today.getDate() - 30);

            const [sales, products] = await Promise.all([
                SalesService.getSalesWithFilters(lastMonth.toISOString(), today.toISOString(), 'ALL'),
                InventoryService.getProductsByBranch('ALL')
            ]);

            // 2. Ask Groq
            const jsonResponse = await AiService.generateBusinessInsights({ sales, products });
            const parsed = JSON.parse(jsonResponse);

            if (parsed.tips && Array.isArray(parsed.tips)) {
                setTips(parsed.tips.slice(0, 3));
            } else {
                throw new Error("Invalid format");
            }

        } catch (err) {
            console.error("Failed to load AI insights", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInsights();
    }, []);

    if (error) return null; // Hide if fails

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 md:p-8 rounded-[32px] shadow-xl text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                        <span className="material-symbols-outlined text-yellow-300">lightbulb</span>
                    </div>
                    <div>
                        <h3 className="font-black text-lg tracking-tight">Consejos Estratégicos</h3>
                        <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">IA Consulting de Pintamax</p>
                    </div>
                </div>
                <button
                    onClick={loadInsights}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                >
                    <span className={`material-symbols-outlined text-white/50 ${loading ? 'animate-spin' : ''}`}>refresh</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                {loading ? (
                    // Skeletons
                    [1, 2, 3].map(i => (
                        <div key={i} className="bg-white/5 p-4 rounded-2xl animate-pulse h-24"></div>
                    ))
                ) : (
                    tips.map((tip, idx) => (
                        <div key={idx} className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/5 hover:bg-white/20 transition-all cursor-default">
                            <h4 className="font-bold text-yellow-300 text-xs uppercase tracking-wider mb-2">{tip.title}</h4>
                            <p className="text-sm font-medium leading-relaxed opacity-90">{tip.description}</p>
                        </div>
                    ))
                )}
            </div>

            {!loading && tips.length === 0 && (
                <div className="text-center py-4 text-white/50 text-xs italic">
                    No hay suficientes datos para generar consejos hoy.
                </div>
            )}
        </div>
    );
};
