import { supabase } from '../supabase';

export const CoinService = {
    async getCoinChangeRequests(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('coin_change_requests')
            .select(`
                *,
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((r: any) => ({
            ...r,
            branchName: r.branches?.name,
            breakdown: r.breakdown_details,
            createdAt: r.created_at
        }));
    },

    async createCoinChangeRequest(branchId: string, userId: string, amount: number, breakdown?: Record<string, number>): Promise<void> {
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'coin_change'
        });

        const { error } = await supabase
            .from('coin_change_requests')
            .insert({
                branch_id: branchId,
                folio: folio || 0,
                amount: amount,
                requester_id: userId,
                status: 'pending',
                breakdown_details: breakdown
            });
        if (error) throw error;
    },

    async updateCoinChangeStatus(requestId: string, status: 'pending' | 'completed' | 'cancelled', receiverId?: string): Promise<void> {
        const updates: any = { status };
        if (receiverId) updates.receiver_id = receiverId;
        if (status === 'completed') updates.completed_at = new Date().toISOString();

        const { error } = await supabase
            .from('coin_change_requests')
            .update(updates)
            .eq('id', requestId);
        if (error) throw error;
    }
};