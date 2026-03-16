import { supabase } from './supabase';
import { NotificationService } from './notificationService';

export interface WholesalePromotion {
    id: string;
    name: string;
    description?: string;
    minQuantity: number;
    maxQuantity?: number;
    discountPercent: number;
    isActive: boolean;
    autoApply: boolean;
    startDate?: string;
    endDate?: string;
    createdAt: string;
    updatedAt: string;
}

export interface PromotionRequest {
    id: string;
    saleId?: string;
    promotionId?: string;
    branchId: string;
    clientId?: string;
    clientName?: string;
    totalItems: number;
    subtotal: number;
    requestedDiscountPercent: number;
    requestedDiscountAmount: number;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedBy: string;
    reviewedBy?: string;
    reviewedAt?: string;
    rejectionReason?: string;
    createdAt: string;
}

export const PromotionService = {
    async getPromotions(): Promise<WholesalePromotion[]> {
        const { data, error } = await supabase
            .from('wholesale_promotions')
            .select('*')
            .order('min_quantity', { ascending: true });

        if (error) throw error;

        return (data || []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            minQuantity: p.min_quantity,
            maxQuantity: p.max_quantity,
            discountPercent: parseFloat(p.discount_percent) || 0,
            isActive: p.is_active,
            autoApply: p.auto_apply,
            startDate: p.start_date,
            endDate: p.end_date,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        }));
    },

    async getActivePromotions(): Promise<WholesalePromotion[]> {
        const { data, error } = await supabase
            .from('wholesale_promotions')
            .select('*')
            .eq('is_active', true)
            .order('min_quantity', { ascending: true });

        if (error) throw error;

        return (data || []).map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            minQuantity: p.min_quantity,
            maxQuantity: p.max_quantity,
            discountPercent: parseFloat(p.discount_percent) || 0,
            isActive: p.is_active,
            autoApply: p.auto_apply,
            startDate: p.start_date,
            endDate: p.end_date,
            createdAt: p.created_at,
            updatedAt: p.updated_at
        }));
    },

    async getApplicablePromotion(quantity: number): Promise<WholesalePromotion | null> {
        const { data, error } = await supabase.rpc('get_applicable_promotion', {
            p_quantity: quantity
        });

        if (error) throw error;

        if (!data || data.length === 0) return null;

        return {
            id: data[0].id,
            name: data[0].name,
            discountPercent: parseFloat(data[0].discount_percent) || 0,
            autoApply: data[0].auto_apply,
            minQuantity: 0,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    },

    async createPromotion(promotion: Partial<WholesalePromotion>): Promise<string> {
        const { data, error } = await supabase
            .from('wholesale_promotions')
            .insert({
                name: promotion.name,
                description: promotion.description,
                min_quantity: promotion.minQuantity || 0,
                max_quantity: promotion.maxQuantity,
                discount_percent: promotion.discountPercent || 0,
                is_active: promotion.isActive ?? true,
                auto_apply: promotion.autoApply ?? false,
                start_date: promotion.startDate,
                end_date: promotion.endDate
            })
            .select('id')
            .single();

        if (error) throw error;
        return data.id;
    },

    async updatePromotion(id: string, updates: Partial<WholesalePromotion>): Promise<void> {
        const { error } = await supabase
            .from('wholesale_promotions')
            .update({
                name: updates.name,
                description: updates.description,
                min_quantity: updates.minQuantity,
                max_quantity: updates.maxQuantity,
                discount_percent: updates.discountPercent,
                is_active: updates.isActive,
                auto_apply: updates.autoApply,
                start_date: updates.startDate,
                end_date: updates.endDate,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
    },

    async deletePromotion(id: string): Promise<void> {
        const { error } = await supabase
            .from('wholesale_promotions')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getPendingRequests(): Promise<PromotionRequest[]> {
        const { data, error } = await supabase
            .from('promotion_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(r => this.mapRequest(r));
    },

    async getAllRequests(branchId?: string): Promise<PromotionRequest[]> {
        let query = supabase
            .from('promotion_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map(r => this.mapRequest(r));
    },

    async createRequest(params: {
        saleId?: string;
        branchId: string;
        clientId?: string;
        clientName?: string;
        totalItems: number;
        subtotal: number;
        discountPercent: number;
        discountAmount: number;
        reason?: string;
        requestedBy: string;
        promotionId?: string;
    }): Promise<string> {
        const { data, error } = await supabase.rpc('create_promotion_request', {
            p_sale_id: params.saleId || null,
            p_branch_id: params.branchId,
            p_client_id: params.clientId || null,
            p_client_name: params.clientName || null,
            p_total_items: params.totalItems,
            p_subtotal: params.subtotal,
            p_discount_percent: params.discountPercent,
            p_discount_amount: params.discountAmount,
            p_reason: params.reason || null,
            p_requested_by: params.requestedBy,
            p_promotion_id: params.promotionId || null
        });

        if (error) throw error;

        await NotificationService.createNotification({
            targetRole: 'ADMIN',
            title: 'Nueva Solicitud de Promoción',
            message: `Solicitud de ${params.discountPercent}% descuento para ${params.clientName || 'cliente'}`,
            actionUrl: '/admin/promotions'
        });

        return data;
    },

    async approveRequest(requestId: string, reviewedBy: string): Promise<void> {
        const { error } = await supabase.rpc('approve_promotion_request', {
            p_request_id: requestId,
            p_reviewed_by: reviewedBy
        });

        if (error) throw error;

        const { data: request } = await supabase
            .from('promotion_requests')
            .select('branch_id, client_name')
            .eq('id', requestId)
            .single();

        if (request) {
            await NotificationService.createNotification({
                targetRole: 'STORE_MANAGER',
                title: 'Promoción Aprobada',
                message: `La promoción para ${request.client_name || 'cliente'} ha sido aprobada`,
                actionUrl: '/wholesale-pos'
            });
        }
    },

    async rejectRequest(requestId: string, reviewedBy: string, rejectionReason?: string): Promise<void> {
        const { error } = await supabase.rpc('reject_promotion_request', {
            p_request_id: requestId,
            p_reviewed_by: reviewedBy,
            p_rejection_reason: rejectionReason || null
        });

        if (error) throw error;

        const { data: request } = await supabase
            .from('promotion_requests')
            .select('branch_id, client_name')
            .eq('id', requestId)
            .single();

        if (request) {
            await NotificationService.createNotification({
                targetRole: 'STORE_MANAGER',
                title: 'Promoción Rechazada',
                message: `La promoción para ${request.client_name || 'cliente'} ha sido rechazada`,
                actionUrl: '/wholesale-pos'
            });
        }
    },

    mapRequest(r: any): PromotionRequest {
        return {
            id: r.id,
            saleId: r.sale_id,
            promotionId: r.promotion_id,
            branchId: r.branch_id,
            clientId: r.client_id,
            clientName: r.client_name,
            totalItems: r.total_items,
            subtotal: parseFloat(r.subtotal) || 0,
            requestedDiscountPercent: parseFloat(r.requested_discount_percent) || 0,
            requestedDiscountAmount: parseFloat(r.requested_discount_amount) || 0,
            reason: r.reason,
            status: r.status,
            requestedBy: r.requested_by,
            reviewedBy: r.reviewed_by,
            reviewedAt: r.reviewed_at,
            rejectionReason: r.rejection_reason,
            createdAt: r.created_at
        };
    }
};
