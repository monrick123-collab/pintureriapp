import { supabase } from './supabase';
import { Quotation } from '../types';

export const quotationService = {
    async getQuotations(branchId?: string) {
        let query = supabase
            .from('quotations')
            .select('*')
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return data as Quotation[];
    },

    async getQuotationById(id: string) {
        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Quotation;
    },

    async createQuotation(quotation: Omit<Quotation, 'id' | 'folio' | 'createdAt'>) {
        const { data, error } = await supabase
            .from('quotations')
            .insert([{
                client_id: quotation.clientId || null,
                client_name: quotation.clientName,
                items: quotation.items,
                subtotal: quotation.subtotal,
                discount_amount: quotation.discountAmount,
                iva: quotation.iva,
                total: quotation.total,
                status: quotation.status,
                branch_id: quotation.branchId,
                created_by: quotation.createdBy || null,
            }])
            .select()
            .single();

        if (error) throw error;
        return data as Quotation;
    },

    async updateQuotationStatus(id: string, status: Quotation['status']) {
        const { data, error } = await supabase
            .from('quotations')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data as Quotation;
    },

    async linkToSale(quotationId: string, saleId: string) {
        const { error } = await supabase
            .from('quotations')
            .update({ sale_id: saleId, status: 'completed' })
            .eq('id', quotationId);

        if (error) throw error;
    },

    async markAsSaleClosed(quotationId: string) {
        const { error } = await supabase
            .from('quotations')
            .update({ status: 'completed' })
            .eq('id', quotationId);

        if (error) throw error;
    }
};
