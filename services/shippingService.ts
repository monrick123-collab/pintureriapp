import { supabase } from './supabase';
import { NotificationService } from './notificationService';

export type ShippingEntityType = 'stock_transfer' | 'barter_transfer' | 'restock_sheet';
export type ShippingStatus = 'pending' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled';

export interface ShippingOrder {
    id: string;
    entityType: ShippingEntityType;
    entityId: string;
    originBranchId: string;
    destinationBranchId: string;
    carrier?: string;
    trackingNumber?: string;
    status: ShippingStatus;
    estimatedDeliveryDate?: string;
    shippedAt?: string;
    deliveredAt?: string;
    notes?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export interface ShippingTrackingHistory {
    id: string;
    shippingOrderId: string;
    status: string;
    location?: string;
    notes?: string;
    createdAt: string;
}

export const ShippingService = {
    async createShippingOrder(params: {
        entityType: ShippingEntityType;
        entityId: string;
        originBranchId: string;
        destinationBranchId: string;
        createdBy: string;
        carrier?: string;
        trackingNumber?: string;
        notes?: string;
    }): Promise<string> {
        const { data, error } = await supabase.rpc('create_shipping_order', {
            p_entity_type: params.entityType,
            p_entity_id: params.entityId,
            p_origin_branch_id: params.originBranchId,
            p_destination_branch_id: params.destinationBranchId,
            p_created_by: params.createdBy,
            p_carrier: params.carrier || null,
            p_tracking_number: params.trackingNumber || null,
            p_notes: params.notes || null
        });

        if (error) throw error;
        return data;
    },

    async getShippingByEntity(entityType: ShippingEntityType, entityId: string): Promise<ShippingOrder | null> {
        const { data, error } = await supabase.rpc('get_shipping_by_entity', {
            p_entity_type: entityType,
            p_entity_id: entityId
        });

        if (error) throw error;

        if (!data || data.length === 0) return null;

        return {
            id: data[0].id,
            entityType: entityType,
            entityId: entityId,
            originBranchId: '',
            destinationBranchId: '',
            carrier: data[0].carrier,
            trackingNumber: data[0].tracking_number,
            status: data[0].status,
            shippedAt: data[0].shipped_at,
            deliveredAt: data[0].delivered_at,
            notes: data[0].notes,
            createdBy: '',
            createdAt: data[0].created_at,
            updatedAt: data[0].created_at
        };
    },

    async getShippingOrder(shippingId: string): Promise<ShippingOrder | null> {
        const { data, error } = await supabase
            .from('shipping_orders')
            .select('*')
            .eq('id', shippingId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return this.mapShippingOrder(data);
    },

    async updateShippingStatus(params: {
        shippingId: string;
        newStatus: ShippingStatus;
        carrier?: string;
        trackingNumber?: string;
        notes?: string;
    }): Promise<void> {
        const { error } = await supabase.rpc('update_shipping_status', {
            p_shipping_id: params.shippingId,
            p_new_status: params.newStatus,
            p_carrier: params.carrier || null,
            p_tracking_number: params.trackingNumber || null,
            p_notes: params.notes || null
        });

        if (error) throw error;

        const { data: shipping } = await supabase
            .from('shipping_orders')
            .select('entity_type, destination_branch_id')
            .eq('id', params.shippingId)
            .single();

        if (shipping) {
            const statusMessages: Record<ShippingStatus, string> = {
                'pending': 'Envío pendiente',
                'shipped': 'Envío en camino',
                'in_transit': 'Envío en tránsito',
                'delivered': 'Envío entregado',
                'cancelled': 'Envío cancelado'
            };

            await NotificationService.createNotification({
                targetRole: 'STORE_MANAGER',
                title: 'Actualización de Envío',
                message: statusMessages[params.newStatus] + (params.trackingNumber ? ` - Guía: ${params.trackingNumber}` : ''),
                actionUrl: '/transfers'
            });
        }
    },

    async getTrackingHistory(shippingOrderId: string): Promise<ShippingTrackingHistory[]> {
        const { data, error } = await supabase
            .from('shipping_tracking_history')
            .select('*')
            .eq('shipping_order_id', shippingOrderId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return (data || []).map(h => ({
            id: h.id,
            shippingOrderId: h.shipping_order_id,
            status: h.status,
            location: h.location,
            notes: h.notes,
            createdAt: h.created_at
        }));
    },

    async getPendingShipments(branchId?: string): Promise<ShippingOrder[]> {
        let query = supabase
            .from('shipping_orders')
            .select('*')
            .in('status', ['pending', 'shipped', 'in_transit'])
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.or(`origin_branch_id.eq.${branchId},destination_branch_id.eq.${branchId}`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map(s => this.mapShippingOrder(s));
    },

    async linkShippingToEntity(params: {
        entityType: ShippingEntityType;
        entityId: string;
        shippingId: string;
    }): Promise<void> {
        const tableName = params.entityType === 'stock_transfer' 
            ? 'stock_transfers' 
            : params.entityType === 'barter_transfer' 
                ? 'barter_transfers' 
                : 'restock_sheets';

        const { error } = await supabase
            .from(tableName)
            .update({ shipping_id: params.shippingId })
            .eq('id', params.entityId);

        if (error) throw error;
    },

    mapShippingOrder(s: any): ShippingOrder {
        return {
            id: s.id,
            entityType: s.entity_type,
            entityId: s.entity_id,
            originBranchId: s.origin_branch_id,
            destinationBranchId: s.destination_branch_id,
            carrier: s.carrier,
            trackingNumber: s.tracking_number,
            status: s.status,
            estimatedDeliveryDate: s.estimated_delivery_date,
            shippedAt: s.shipped_at,
            deliveredAt: s.delivered_at,
            notes: s.notes,
            createdBy: s.created_by,
            createdAt: s.created_at,
            updatedAt: s.updated_at
        };
    }
};

export const CARRIER_OPTIONS = [
    { value: 'DHL', label: 'DHL' },
    { value: 'Estafeta', label: 'Estafeta' },
    { value: 'FedEx', label: 'FedEx' },
    { value: 'UPS', label: 'UPS' },
    { value: 'Redpack', label: 'Redpack' },
    { value: 'Propio', label: 'Transporte Propio' },
    { value: 'Otro', label: 'Otro' }
];

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
    'pending': 'Pendiente de Envío',
    'shipped': 'Enviado',
    'in_transit': 'En Tránsito',
    'delivered': 'Entregado',
    'cancelled': 'Cancelado'
};
