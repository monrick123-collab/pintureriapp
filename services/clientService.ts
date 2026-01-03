
import { supabase } from './supabase';
import { Client } from '../types';

export const ClientService = {
    async getClients(): Promise<Client[]> {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            taxId: c.tax_id || '',
            address: c.address || '',
            type: c.type as 'Individual' | 'Empresa'
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
                type: client.type
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
            type: data.type
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
        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from('clients')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteClient(id: string): Promise<void> {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
