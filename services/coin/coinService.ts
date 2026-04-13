import { supabase } from '../supabase';
import { NotificationService } from '../notificationService';

export const CoinService = {
    async createCoinChangeRequest(branchId: string, userId: string, amount: number, breakdown?: Record<string, number>, collectedBy?: string): Promise<void> {
        const { data: folio, error: folioError } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'coin_change'
        });

        if (folioError || !folio) {
            throw new Error(`Error al generar folio de cambio de moneda: ${folioError?.message || 'folio vacío'}`);
        }

        const { error } = await supabase
            .from('coin_change_requests')
            .insert({
                branch_id: branchId,
                folio: folio,
                amount: amount,
                requester_id: userId,
                collected_by: collectedBy || null,
                status: 'pending',
                breakdown_details: breakdown
            });
        if (error) throw error;

        try {
            const { data: bData } = await supabase.from('branches').select('name').eq('id', branchId).single();
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Nueva Solicitud de Cambio de Moneda',
                message: `La sucursal ${bData?.name || branchId} solicita cambio por $${amount.toLocaleString()}.`,
                actionUrl: '/coin-change'
            });
        } catch (e) {
            console.error('Error enviando notificación de cambio de moneda:', e);
        }
    },

    async updateCoinChangeStatus(requestId: string, status: 'pending' | 'coins_sent' | 'completed' | 'cancelled', receiverId?: string): Promise<void> {
        const updates: any = { status };
        if (receiverId) updates.receiver_id = receiverId;
        if (status === 'completed') updates.completed_at = new Date().toISOString();
        if (status === 'coins_sent') updates.coins_sent_at = new Date().toISOString();

        const { error } = await supabase
            .from('coin_change_requests')
            .update(updates)
            .eq('id', requestId);
        if (error) throw error;
    },

    async confirmCoinsSent(requestId: string, confirmedById: string): Promise<void> {
        const { error } = await supabase
            .from('coin_change_requests')
            .update({ status: 'coins_sent', coins_sent_at: new Date().toISOString(), coins_confirmed_by: confirmedById })
            .eq('id', requestId);
        if (error) throw error;
    },

    async confirmBillsReceived(requestId: string, adminId: string): Promise<void> {
        const { error } = await supabase
            .from('coin_change_requests')
            .update({ status: 'completed', completed_at: new Date().toISOString(), receiver_id: adminId })
            .eq('id', requestId);
        if (error) throw error;
    }
};