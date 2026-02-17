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
        extra?: {
            subtotal: number,
            discountAmount?: number,
            iva: number,
            isWholesale?: boolean,
            paymentType?: 'contado' | 'credito',
            departureAdminId?: string,
            creditDays?: number,
            billingBank?: string,
            billingSocialReason?: string,
            billingInvoiceNumber?: string,
            deliveryReceiverName?: string,
        }
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

        // Actualizamos campos adicionales (Mayoreo, Crédito, Cliente, Admin)
        if (data) {
            const updates: any = {};
            if (clientId) updates.client_id = clientId;
            if (extra?.isWholesale !== undefined) updates.is_wholesale = extra.isWholesale;
            if (extra?.paymentType) updates.payment_type = extra.paymentType;
            if (extra?.departureAdminId) updates.departure_admin_id = extra.departureAdminId;
            if (extra?.creditDays !== undefined) updates.credit_days = extra.creditDays;

            // New fields updates
            if (extra?.billingBank) updates.billing_bank = extra.billingBank;
            if (extra?.billingSocialReason) updates.billing_social_reason = extra.billingSocialReason;
            if (extra?.billingInvoiceNumber) updates.billing_invoice_number = extra.billingInvoiceNumber;
            if (extra?.deliveryReceiverName) updates.delivery_receiver_name = extra.deliveryReceiverName;

            if (Object.keys(updates).length > 0) {
                await supabase
                    .from('sales')
                    .update(updates)
                    .eq('id', data);
            }
        }

        return data;
    },

    async getSalesByBranch(branchId: string): Promise<Sale[]> {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*),
                clients (name)
            `)
            .eq('branch_id', branchId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            clientId: s.client_id,
            clientName: s.clients?.name,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            createdAt: s.created_at,
            isWholesale: s.is_wholesale,
            paymentType: s.payment_type,
            departureAdminId: s.departure_admin_id,
            items: (s.sale_items || []).map((i: any) => ({
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
                sale_items (*),
                clients (name)
            `)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .order('created_at', { ascending: false });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map((s: any) => ({
            id: s.id,
            branchId: s.branch_id,
            branchName: s.branch?.name,
            clientId: s.client_id,
            clientName: s.clients?.name,
            subtotal: s.subtotal || 0,
            discountAmount: s.discount_amount || 0,
            iva: s.iva || 0,
            total: s.total,
            status: s.status,
            paymentMethod: s.payment_method,
            createdAt: s.created_at,
            isWholesale: s.is_wholesale,
            paymentType: s.payment_type,
            departureAdminId: s.departure_admin_id,
            departureAdminName: s.departure_admin_id, // Fallback to ID
            items: (s.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        }));
    },

    async getAdmins(): Promise<{ id: string, name: string }[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'ADMIN');

        if (error) throw error;

        return (data || []).map((d: { id: string, full_name: string | null }) => ({
            id: d.id,
            name: d.full_name || 'Sin nombre'
        }));
    },

    async getSaleDetail(id: string): Promise<Sale> {
        const { data, error } = await supabase
            .from('sales')
            .select(`
                *,
                sale_items (*),
                clients (*)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return {
            id: data.id,
            branchId: data.branch_id,
            clientId: data.client_id,
            clientName: data.clients?.name,
            subtotal: data.subtotal || 0,
            discountAmount: data.discount_amount || 0,
            iva: data.iva || 0,
            total: data.total,
            status: data.status,
            paymentMethod: data.payment_method,
            createdAt: data.created_at,
            isWholesale: data.is_wholesale,
            paymentType: data.payment_type,
            departureAdminId: data.departure_admin_id,
            departureAdminName: data.departure_admin_id,
            items: (data.sale_items || []).map((i: any) => ({
                productId: i.product_id,
                productName: i.product_name,
                quantity: i.quantity,
                price: i.unit_price,
                total: i.quantity * i.unit_price
            }))
        };
    }
};
