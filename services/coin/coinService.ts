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

    async createCoinChangeRequest(branchId: string, userId: string, amount: number, breakdown?: Record<string, number>, collectedBy?: string): Promise<void> {
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
                collected_by: collectedBy || null,
                status: 'pending',
                breakdown_details: breakdown
            });
        if (error) throw error;
    },

    async updateCoinChangeStatus(requestId: string, status: 'pending' | 'coins_sent' | 'completed' | 'cancelled', receiverId?: string): Promise<void> {
        const updates: any = { status };
        if (receiverId) updates.receiver_id = receiverId;
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        if (status === 'coins_sent') updates.coins_sent_at = new Date().toISOString();

        const { error } = await supabase
            .from('coin_change_requests')
            .update(updates)
            .eq('id', requestId);
        if (error) throw error;
    },

    async confirmCoinsSent(requestId: string, confirmedById: string): Promise<void> {
        const { error } = await supabase
            .from('coin_change_requests')
            .update({ status: 'coins_sent', coins_sent_at: new Date().toISOString(), coins_confirmed_by: confirmedById })
            .eq('id', requestId);
        if (error) throw error;
    },

    async confirmBillsReceived(requestId: string, adminId: string): Promise<void> {
        const { error } = await supabase
            .from('coin_change_requests')
            .update({ status: 'completed', completed_at: new Date().toISOString(), receiver_id: adminId })
            .eq('id', requestId);
        if (error) throw error;
    }
};