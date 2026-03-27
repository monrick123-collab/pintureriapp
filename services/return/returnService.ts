import { supabase } from '../supabase';
import { NotificationService } from '../notificationService';

export const ReturnService = {
    async createReturnRequest(branchId: string, items: { productId: string, quantity: number, reason: string }[], transportedBy: string, receivedBy: string): Promise<void> {
        const { data: folio, error: folioError } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'return'
        });

        if (folioError || !folio) {
            throw new Error(`Error al generar folio de devolución: ${folioError?.message || 'folio vacío'}`);
        }

        const returnRows = items.map(item => ({
            branch_id: branchId,
            folio: folio,
            product_id: item.productId,
            quantity: item.quantity,
            reason: item.reason,
            transported_by: transportedBy,
            received_by: receivedBy,
            status: 'pending_authorization'
        }));

        const { error } = await supabase
            .from('returns')
            .insert(returnRows);
        if (error) throw error;

        try {
            const { data: bData } = await supabase.from('branches').select('name').eq('id', branchId).single();
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Nueva Solicitud de Devolución',
                message: `La sucursal ${bData?.name || branchId} ha enviado productos para devolución.`,
                actionUrl: '/returns'
            });
            await NotificationService.createNotification({
                targetRole: 'WAREHOUSE',
                title: 'Devolución en Camino',
                message: `La sucursal ${bData?.name || branchId} enviará productos de devolución — prepara recepción.`,
                actionUrl: '/returns'
            });
        } catch(e) { console.error(e) }
    },

    async getReturnRequests(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('returns')
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
        return data || [];
    },

    async getReturnRequestById(returnId: string): Promise<any> {
        const { data, error } = await supabase
            .from('returns')
            .select(`
                *,
                products (name, sku),
                branches (name)
            `)
            .eq('id', returnId)
            .single();

        if (error) throw error;
        return data;
    },

    async authorizeReturn(returnId: string, adminId: string, approved: boolean): Promise<void> {
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adminId);

        const updatePayload: any = {
            status: approved ? 'approved' : 'rejected',
            updated_at: new Date().toISOString()
        };

        if (isValidUUID) {
            updatePayload.authorized_by = adminId;
        }

        const { error } = await supabase
            .from('returns')
            .update(updatePayload)
            .eq('id', returnId);

        if (error) throw error;
    },

    async processReturn(returnId: string): Promise<void> {
        const { error } = await supabase.rpc('process_return', {
            p_return_id: returnId
        });

        if (error) throw error;
    }
};