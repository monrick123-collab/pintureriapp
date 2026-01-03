import { supabase } from './supabase';
import { Sale, SaleItem } from '../types';

export const SalesService = {
    /**
     * Procesa una venta completa de manera atómica usando una función RPC en Supabase.
     */
    async processSale(
        branchId: string,
        items: SaleItem[],
        total: number,
        paymentMethod: string,
        clientId?: string,
        extra?: { subtotal: number, discountAmount: number, iva: number }
    ): Promise<string> {
        // Preparamos los items para enviarlos al RPC
        const rpcItems = items.map(i => ({
            product_id: i.productId,
            quantity: i.quantity,
            price: i.price,
            product_name: i.productName
        }));

        const { data, error } = await supabase.rpc('process_sale', {
            p_branch_id: branchId,
            p_total: total,
            p_payment_method: paymentMethod,
            p_items: rpcItems,
            p_subtotal: extra?.subtotal || total,
            p_discount_amount: extra?.discountAmount || 0,
            p_iva: extra?.iva || 0
        });

        if (error) {
            console.error("Error processing sale:", error);
            throw new Error(error.message);
        }

        // Si hay cliente, actualizamos la venta recién creada para vincularla
        if (clientId && data) {
            await supabase
                .from('sales')
                .update({ client_id: clientId })
                .eq('id', data);
        }

        return data;
    },

    async getSalesByBranch(branchId: string): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .select(`
        *,
        sale_items (*)
      `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            clientId: s.client_id,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            createdAt: s.created_at,
            items: s.sale_items.map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        }));
    },

    async getSalesWithFilters(startDate: string, endDate: string, branchId?: string): Promise<Sale[]> {
        let query = supabase
            .from('sales')
            .select(`
                *,
                branch:branches(name),
                sale_items (*)
            `)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data.map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            branchName: s.branch?.name,
            clientId: s.client_id,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            createdAt: s.created_at,
            items: s.sale_items.map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        }));
    }
};
