import { supabase } from '../supabase';

export const InternalSupplyService = {
    async createInternalSupply(supply: any): Promise<void> {
        const { error } = await supabase
            .from('internal_supplies')
            .insert({
                branch_id: supply.branchId,
                description: supply.description,
                amount: supply.amount,
                category: supply.category
            });
        if (error) throw error;
    },

    async getInternalSupplies(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('internal_supplies')
            .select(`
                *,
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((s: any) => ({
            id: s.id,
            description: s.description,
            category: s.category,
            amount: s.amount,
            branchId: s.branch_id,
            branches: s.branches,
            createdAt: s.created_at,
            created_at: s.created_at
        }));
    }
};