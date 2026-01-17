import { supabase } from './supabase';
import { DiscountRequest } from '../types';

export const DiscountService = {
    async requestDiscount(requesterId: string, requesterName: string, branchId: string, amount: number, type: 'percentage' | 'fixed', reason: string): Promise<string> {
        const { data, error } = await supabase
            .from('discount_requests')
            .insert([{
                requester_id: requesterId,
                requester_name: requesterName,
                branch_id: branchId,
                amount: amount,
                type: type,
                reason: reason,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    },

    async getPendingRequests(): Promise<DiscountRequest[]> {
        const { data, error } = await supabase
            .from('discount_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(this.mapDbRequest);
    },

    async approveDiscount(id: string): Promise<void> {
        const { error } = await supabase
            .from('discount_requests')
            .update({ status: 'approved' })
            .eq('id', id);

        if (error) throw error;
    },

    async rejectDiscount(id: string): Promise<void> {
        const { error } = await supabase
            .from('discount_requests')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) throw error;
    },

    subscribeToRequest(id: string, onUpdate: (request: DiscountRequest) => void) {
        return supabase
            .channel(`discount-${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'discount_requests',
                filter: `id=eq.${id}`
            }, (payload) => {
                onUpdate(this.mapDbRequest(payload.new));
            })
            .subscribe();
    },

    subscribeToAllPending(onUpdate: () => void) {
        return supabase
            .channel('all-discounts')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'discount_requests'
            }, () => {
                onUpdate();
            })
            .subscribe();
    },

    mapDbRequest(r: Record<string, any>): DiscountRequest {
        return {
            id: r.id,
            requesterId: r.requester_id,
            requesterName: r.requester_name,
            branchId: r.branch_id,
            amount: r.amount,
            type: r.type,
            status: r.status,
            reason: r.reason,
            createdAt: r.created_at
        };
    }
};
