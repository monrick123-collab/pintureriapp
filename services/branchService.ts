import { supabase } from './supabase';
import { Branch } from '../types';

export const BranchService = {
    async getBranches(): Promise<Branch[]> {
        const { data, error } = await supabase.from('branches').select('*');
        if (error) throw error;
        return data as Branch[];
    },

    async getBranchById(id: string): Promise<Branch | null> {
        const { data, error } = await supabase
            .from('branches')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) return null;
        return data as Branch;
    },

    async createBranch(branch: Branch): Promise<void> {
        const { error } = await supabase.from('branches').insert(branch);
        if (error) throw error;
    },

    async updateBranch(branch: Branch): Promise<void> {
        const { error } = await supabase
            .from('branches')
            .update(branch)
            .eq('id', branch.id);
        if (error) throw error;
    },

    async deleteBranch(id: string): Promise<void> {
        const { error } = await supabase
            .from('branches')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};