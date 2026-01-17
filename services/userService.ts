
import { supabase } from './supabase';
import { User, UserRole } from '../types';

export const UserService = {
    async getProfiles(): Promise<Record<string, any>[]> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async createProfile(profile: { id: string, name: string, email: string, role: string, branchId?: string }): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .insert([{
                id: profile.id,
                full_name: profile.name,
                email: profile.email,
                role: profile.role,
                branch_id: profile.branchId
            }]);

        if (error) throw error;
    },

    async deleteProfile(id: string): Promise<void> {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
