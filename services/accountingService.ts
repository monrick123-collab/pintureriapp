
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

        salesData.forEach((sale: any) => {
            sale.sale_items.forEach((item: any) => {
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
        // Assuming 'total' in sales includes IVA. 
        // Total = Subtotal * 1.16 -> IVA = Total / 1.16 * 0.16
        const totalIva = totalSales / 1.16 * 0.16;

        return {
            totalSales,
            totalCogs,
            totalExpenses,
            totalIva,
            grossProfit: totalSales - totalCogs,
            netProfit: totalSales - totalCogs - totalExpenses
        };
    }
};
