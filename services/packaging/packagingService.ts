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

    async getPackagingRequestById(requestId: string): Promise<any> {
        const { data, error } = await supabase
            .from('packaging_requests')
            .select(`
                *,
                products (name, sku),
                branches (name)
            `)
            .eq('id', requestId)
            .single();
        
        if (error) throw error;
        return data;
    },

    async updatePackagingStatus(requestId: string, status: string, userId?: string): Promise<void> {
        const now = new Date().toISOString();
        const update: Record<string, any> = { status, updated_at: now };
        if (status === 'processing') update.started_at = now;
        if (status === 'completed') {
            update.completed_at = now;
            
            // Cuando se completa el envasado, disminuir el inventario del tambo
            // Primero obtenemos los detalles del request
            const request = await this.getPackagingRequestById(requestId);
            
            if (request && request.bulk_product_id && request.branch_id && request.quantity_drum && request.target_package_type) {
                // Calcular litros por tipo de envase
                const getLitersPerPackage = (type: string): number => {
                    switch (type) {
                        case 'cuarto_litro': return 0.25;
                        case 'medio_litro': return 0.5;
                        case 'litro': return 1;
                        case 'galon': return 3.8;
                        default: return 0;
                    }
                };
                
                const litersPerPackage = getLitersPerPackage(request.target_package_type);
                // Cada tambo es 200L, así que disminuimos 200 litros por cada tambo
                const quantityToDecrease = request.quantity_drum * 200; // 200 litros por tambo
                
                // Llamamos a la función RPC para disminuir el inventario
                const { error: consumptionError } = await supabase.rpc('process_internal_consumption', {
                    p_product_id: request.bulk_product_id,
                    p_branch_id: request.branch_id,
                    p_user_id: userId || 'system',
                    p_quantity: quantityToDecrease,
                    p_reason: `Envasado a ${request.target_package_type} (${litersPerPackage} L c/u)`
                });
                
                if (consumptionError) {
                    console.error('Error al disminuir inventario:', consumptionError);
                    // No lanzamos error para no bloquear la actualización de estado
                }
            }
        }

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