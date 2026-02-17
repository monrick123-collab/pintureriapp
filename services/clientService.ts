
import { supabase } from './supabase';
import { Client } from '../types';

export const ClientService = {
    async getClients(): Promise<Client[]> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        return data.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            taxId: c.tax_id || '',
            address: c.address || '',
            type: c.type as 'Individual' | 'Empresa',
            municipality: c.municipality,
            locality: c.locality,
            creditLimit: c.credit_limit,
            creditDays: c.credit_days,
            isActiveCredit: c.is_active_credit
        }));
    },

    async createClient(client: Omit<Client, 'id'>): Promise<Client> {
        const { data, error } = await supabase
            .from('clients')
            .insert([{
                name: client.name,
                email: client.email,
                phone: client.phone,
                tax_id: client.taxId,
                address: client.address,
                type: client.type,
                municipality: client.municipality,
                locality: client.locality,
                credit_limit: client.creditLimit,
                credit_days: client.creditDays,
                is_active_credit: client.isActiveCredit
            }])
            .select()
            .single();

        if (error) throw error;

        return {
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            taxId: data.tax_id,
            address: data.address,
            type: data.type,
            municipality: data.municipality,
            locality: data.locality,
            creditLimit: data.credit_limit,
            creditDays: data.credit_days,
            isActiveCredit: data.is_active_credit
        };
    },

    async updateClient(id: string, client: Partial<Client>): Promise<void> {
        const updates: any = {};
        if (client.name) updates.name = client.name;
        if (client.email !== undefined) updates.email = client.email;
        if (client.phone !== undefined) updates.phone = client.phone;
        if (client.taxId !== undefined) updates.tax_id = client.taxId;
        if (client.address !== undefined) updates.address = client.address;
        if (client.type) updates.type = client.type;
        if (client.municipality !== undefined) updates.municipality = client.municipality;
        if (client.locality !== undefined) updates.locality = client.locality;
        if (client.creditLimit !== undefined) updates.credit_limit = client.creditLimit;
        if (client.creditDays !== undefined) updates.credit_days = client.creditDays;
        if (client.isActiveCredit !== undefined) updates.is_active_credit = client.isActiveCredit;
        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async registerPayment(payment: {
        clientId: string,
        amount: number,
        paymentMethod: string,
        receivedByAdminId?: string,
        authorizedByAdminId?: string,
        transferReference?: string,
        paymentStatus: string
    }) {
        const { data, error } = await supabase
            .from('client_payments')
            .insert([{
                client_id: payment.clientId,
                amount: payment.amount,
                payment_method: payment.paymentMethod,
                received_by_admin_id: payment.receivedByAdminId,
                authorized_by_admin_id: payment.authorizedByAdminId,
                transfer_reference: payment.transferReference,
                payment_status: payment.paymentStatus
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getClientPayments(clientId: string) {
        const { data, error } = await supabase
            .from('client_payments')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async addMarketingSpend(spend: {
        clientId: string,
        description: string,
        amount: number
    }) {
        const { data, error } = await supabase
            .from('client_marketing_spend')
            .insert([{
                client_id: spend.clientId,
                description: spend.description,
                amount: spend.amount
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async getMarketingHistory(clientId: string) {
        const { data, error } = await supabase
            .from('client_marketing_spend')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async deleteClient(id: string): Promise<void> {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getClientFinancials(clientId: string): Promise<{ balance: number, oldestPendingDate: string | null }> {
        // 1. Get total credit sales (completed)
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('total, created_at')
            .eq('client_id', clientId)
            .eq('payment_type', 'credito')
            .eq('status', 'completed');

        if (salesError) throw salesError;

        // 2. Get total payments
        const { data: payments, error: paymentsError } = await supabase
            .from('client_payments')
            .select('amount, created_at')
            .eq('client_id', clientId);

        if (paymentsError) throw paymentsError;

        const totalDebt = sales?.reduce((acc, s) => acc + (s.total || 0), 0) || 0;
        const totalPaid = payments?.reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
        const currentBalance = totalDebt - totalPaid;

        // FIFO calculation for oldest pending date
        let oldestDate: string | null = null;
        if (currentBalance > 0 && sales && sales.length > 0) {
            // Sort sales by date ascending (oldest first)
            const sortedSales = sales.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            let paidAccumulator = totalPaid;

            for (const sale of sortedSales) {
                if (paidAccumulator >= sale.total) {
                    paidAccumulator -= sale.total;
                } else {
                    // This sale is partially or fully unpaid
                    oldestDate = sale.created_at;
                    break;
                }
            }
        }

        return {
            balance: Math.max(0, currentBalance),
            oldestPendingDate: oldestDate
        };
    }
};
