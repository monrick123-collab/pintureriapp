import { supabase } from '../supabase';
import { StockTransfer } from '../../types';

export const TransferService = {
    async getStockTransfers(branchId?: string, startDate?: string, endDate?: string): Promise<StockTransfer[]> {
        let query = supabase
            .from('stock_transfers')
            .select(`
                *,
                from:branches!from_branch_id (name),
                to:branches!to_branch_id (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
        }
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(t => ({
            ...t,
            fromBranchName: (t.from as any)?.name,
            toBranchName: (t.to as any)?.name,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));
    },

    async getStockTransferDetail(transferId: string): Promise<StockTransfer> {
        const { data, error } = await supabase
            .from('stock_transfers')
            .select(`
                *,
                from:branches!from_branch_id (name),
                to:branches!to_branch_id (name),
                items:stock_transfer_items (
                    *,
                    product:products ( name, sku, image )
                )
            `)
            .eq('id', transferId)
            .single();

        if (error) throw error;

        return {
            ...data,
            fromBranchName: (data.from as any)?.name,
            toBranchName: (data.to as any)?.name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            items: (data.items || []).map((i: any) => ({
                id: i.id,
                transferId: i.transfer_id,
                productId: i.product_id,
                quantity: i.quantity,
                productName: i.product?.name,
                productSku: i.product?.sku,
                productImage: i.product?.image
            }))
        };
    },

    async createStockTransfer(fromId: string, toId: string, notes: string, items: { productId: string, quantity: number }[]): Promise<void> {
        const { data: maxCheck } = await supabase
            .from('stock_transfers')
            .select('folio')
            .eq('from_branch_id', fromId)
            .order('folio', { ascending: false })
            .limit(1);

        const maxFolio = (maxCheck && maxCheck.length > 0) ? maxCheck[0].folio : 0;

        let rpcFolio = 0;
        try {
            const { data } = await supabase.rpc('get_next_folio', {
                p_branch_id: fromId,
                p_folio_type: 'transfer'
            });
            if (data && typeof data === 'number') rpcFolio = data;
        } catch (e) {
            console.warn("RPC get_next_folio failed, using table max:", e);
        }

        const finalFolio = Math.max(maxFolio + 1, rpcFolio);

        const { data: transfer, error: tError } = await supabase
            .from('stock_transfers')
            .insert({
                from_branch_id: fromId,
                to_branch_id: toId,
                folio: finalFolio,
                notes: notes,
                status: 'pending'
            })
            .select()
            .single();

        if (tError) throw tError;

        const transferItems = items.map(i => ({
            transfer_id: transfer.id,
            product_id: i.productId,
            quantity: i.quantity
        }));

        const { error: iError } = await supabase.from('stock_transfer_items').insert(transferItems);
        if (iError) throw iError;
    },

    async updateTransferStatus(transferId: string, status: 'pending' | 'in_transit' | 'completed' | 'cancelled'): Promise<void> {
        const { error } = await supabase
            .from('stock_transfers')
            .update({ 
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', transferId);

        if (error) throw error;
    },

    async confirmTransferReceipt(transferId: string): Promise<void> {
        const { error } = await supabase.rpc('confirm_transfer_receipt', {
            p_transfer_id: transferId
        });

        if (error) throw error;
    }
};