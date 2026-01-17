import { supabase } from './supabase';
import { Quotation } from '../types';

export const quotationService = {
    async getQuotations() {
        const { data, error } = await supabase
            .from('quotations')
            .select('*')
            .order('created_at', { ascending: false });

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
            .insert([quotation])
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
    }
};
