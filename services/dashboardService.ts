import { supabase } from "./supabase";

export interface DashboardMetrics {
    salesToday: number;
    salesPercentageChange: number;
    shipmentsToday: number;
    lowStockPct: number;
}

export const DashboardService = {
    async getMetrics(): Promise<DashboardMetrics | null> {
        try {
            const { data, error } = await supabase.rpc("get_dashboard_metrics");
            if (error) throw error;
            if (!data) return null;
            return {
                salesToday: Number(data.sales_today) || 0,
                salesPercentageChange: Number(data.sales_percentage_change) || 0,
                shipmentsToday: Number(data.shipments_today) || 0,
                lowStockPct: Number(data.low_stock_pct) || 0,
            };
        } catch (e) {
            console.error("Error loading dashboard metrics:", e);
            return null;
        }
    },
};
