import { supabase } from '../supabase';

export const PackagingService = {
    async createPackagingRequest(request: any): Promise<void> {
        const { error } = await supabase
            .from('packaging_requests')
            .insert({
                bulk_product_id: request.bulkProductId,
                target_package_type: request.targetPackageType,
                quantity_drum: request.quantityDrum,
                branch_id: request.branchId,
                status: 'sent_to_branch'
            });
        if (error) throw error;
    },

    async getPackagingRequests(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('packaging_requests')
            .select(`
                *,
                products (name, sku),
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
            stockReleased: r.stock_released
        }));
    },

    async updatePackagingStatus(requestId: string, status: string): Promise<void> {
        const now = new Date().toISOString();
        const update: Record<string, any> = { status, updated_at: now };
        if (status === 'processing') update.started_at = now;
        if (status === 'completed') update.completed_at = now;

        const { error } = await supabase
            .from('packaging_requests')
            .update(update)
            .eq('id', requestId);
        if (error) throw error;
    },

    async authorizePackaging(requestId: string): Promise<void> {
        const { error } = await supabase
            .from('packaging_requests')
            .update({ stock_released: true })
            .eq('id', requestId);
        if (error) throw error;
    },

    async confirmPackagingReceipt(requestId: string): Promise<void> {
        const { error } = await supabase
            .from('packaging_requests')
            .update({ status: 'received_at_branch', updated_at: new Date().toISOString() })
            .eq('id', requestId);
        if (error) throw error;
    }
};