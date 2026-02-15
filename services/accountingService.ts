
import { supabase } from './supabase';
import { Expense, ExpenseCategory } from '../types';

export const AccountingService = {
    async getExpenses(branchId?: string): Promise<Expense[]> {
        let query = supabase.from('expenses').select('*').order('created_at', { ascending: false });
        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data.map(e => ({
            id: e.id,
            description: e.description,
            amount: e.amount,
            category: e.category as ExpenseCategory,
            branchId: e.branch_id,
            createdAt: e.created_at
        }));
    },

    async createExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<void> {
        const { error } = await supabase.from('expenses').insert({
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            branch_id: expense.branchId
        });
        if (error) throw error;
    },

    async getFinancialSummary(startDate: string, endDate: string, branchId?: string) {
        // 1. Sales
        let salesQuery = supabase.from('sales').select('total, sale_items(quantity, unit_price, products(cost_price))')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (branchId && branchId !== 'ALL') {
            salesQuery = salesQuery.eq('branch_id', branchId);
        }

        const { data: salesData, error: salesError } = await salesQuery;
        if (salesError) throw salesError;

        const totalSales = salesData.reduce((acc, s) => acc + Number(s.total), 0);
        let totalCogs = 0; // Cost of Goods Sold

        (salesData || []).forEach((sale: any) => {
            (sale.sale_items || []).forEach((item: any) => {
                const cost = item.products?.cost_price || 0;
                totalCogs += (item.quantity * cost);
            });
        });

        // 2. Expenses
        let expensesQuery = supabase.from('expenses').select('amount')
            .gte('created_at', startDate)
            .lte('created_at', endDate);

        if (branchId && branchId !== 'ALL') {
            expensesQuery = expensesQuery.eq('branch_id', branchId);
        }

        const { data: expensesData, error: expensesError } = await expensesQuery;
        if (expensesError) throw expensesError;

        const totalExpenses = expensesData.reduce((acc, e) => acc + Number(e.amount), 0);

        // 3. Tax (IVA 16%)
        const totalIva = totalSales / 1.16 * 0.16;

        return {
            totalSales,
            totalCogs,
            totalExpenses,
            totalIva,
            grossProfit: totalSales - totalCogs,
            netProfit: totalSales - totalCogs - totalExpenses
        };
    },

    async getDailyCashCut(branchId: string, date: string) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // 1. Sales by payment method
        const { data: sales, error: sError } = await supabase.from('sales')
            .select('*')
            .eq('branch_id', branchId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        if (sError) throw sError;

        const summary = {
            cash: 0,
            card: 0,
            transfer: 0,
            total: 0
        };

        (sales || []).forEach(s => {
            const method = s.payment_method?.toLowerCase() || 'cash';
            if (method.includes('efectivo') || method === 'cash') summary.cash += Number(s.total);
            else if (method.includes('tarjeta') || method === 'card') summary.card += Number(s.total);
            else if (method.includes('transfer') || method === 'transferencia') summary.transfer += Number(s.total);
            summary.total += Number(s.total);
        });

        // 2. Expenses
        const { data: expenses, error: eError } = await supabase.from('expenses')
            .select('*')
            .eq('branch_id', branchId)
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString());

        if (eError) throw eError;

        // 3. Coupons (Redeemed)
        const { data: coupons, error: cError } = await supabase.from('coupons')
            .select('*')
            .eq('branch_id', branchId)
            .eq('status', 'redeemed')
            .gte('redeemed_at', start.toISOString())
            .lte('redeemed_at', end.toISOString());

        if (cError) throw cError;

        return {
            summary,
            expenses: expenses || [],
            coupons: coupons || [],
            salesCount: (sales || []).length
        };
    }
};
