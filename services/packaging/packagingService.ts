import { supabase } from '../supabase';
import { PackagingSettings, PackagingOrderLine } from '../../types';
import { NotificationService } from '../notificationService';

export const PackagingService = {

    // -------------------------------------------------------------------------
    // SETTINGS (galón configurable)
    // -------------------------------------------------------------------------

    async getSettings(): Promise<PackagingSettings> {
        const { data } = await supabase
            .from('packaging_settings')
            .select('key, value');
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => { map[r.key] = parseFloat(r.value); });
        return {
            galon_liters: map.galon_liters ?? 3.785,
            drum_liters:  map.drum_liters  ?? 200
        };
    },

    async updateSetting(key: string, value: number): Promise<void> {
        const { error } = await supabase
            .from('packaging_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key);
        if (error) throw error;
    },

    // -------------------------------------------------------------------------
    // LEGACY — mantiene compatibilidad con órdenes de una sola presentación
    // -------------------------------------------------------------------------

    async createPackagingRequest(request: any): Promise<void> {
        const { error } = await supabase
            .from('packaging_requests')
            .insert({
                bulk_product_id:    request.bulkProductId,
                target_package_type: request.targetPackageType,
                target_product_id:  request.targetProductId || null,
                quantity_drum:      request.quantityDrum,
                liters_requested:   request.litersRequested || null,
                branch_id:          request.branchId,
                status:             'sent_to_branch'
            });
        if (error) throw error;
    },

    async getPackagingRequests(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('packaging_requests')
            .select(`
                *,
                products:bulk_product_id (name, sku),
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId)    query = query.eq('branch_id', branchId);
        if (startDate)   query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate)     query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) { console.error('getPackagingRequests error:', error); throw error; }
        return (data || []).map((r: any) => ({
            ...r,
            stockReleased: r.stock_released,
            isV3: !r.target_package_type   // órdenes v3 no tienen target_package_type
        }));
    },

    async getPackagingRequestById(requestId: string): Promise<any> {
        const { data, error } = await supabase
            .from('packaging_requests')
            .select(`
                *,
                products:bulk_product_id (name, sku),
                branches (name)
            `)
            .eq('id', requestId)
            .single();
        if (error) throw error;
        return data;
    },

    async updatePackagingStatus(requestId: string, status: string, userId?: string): Promise<void> {
        const now  = new Date().toISOString();
        const update: Record<string, any> = { status, updated_at: now };
        if (status === 'processing') update.started_at  = now;
        if (status === 'completed')  update.completed_at = now;

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
    },

    // -------------------------------------------------------------------------
    // V3 — Órdenes multi-presentación con calculadora
    // -------------------------------------------------------------------------

    /** Crea la orden + líneas y llama al RPC atómico en una sola operación. */
    async submitPackagingOrderV3(
        branchId:       string,
        bulkProductId:  string,
        drumQty:        number,
        lines: {
            packageType:      string;
            targetProductId:  string;
            quantity:         number;
            litersPerUnit:    number;
        }[]
    ): Promise<{ orderId: string; result: any }> {

        // 1. Crear cabecera de la orden en estado 'processing'
        const { data: order, error: oErr } = await supabase
            .from('packaging_requests')
            .insert({
                branch_id:       branchId,
                bulk_product_id: bulkProductId,
                quantity_drum:   drumQty,
                status:          'processing',
                started_at:      new Date().toISOString()
                // target_package_type omitido → NULL indica orden v3
            })
            .select()
            .single();
        if (oErr) throw oErr;

        // 2. Insertar líneas de producción
        const lineRows = lines.map(l => ({
            order_id:          order.id,
            package_type:      l.packageType,
            target_product_id: l.targetProductId,
            quantity_requested: l.quantity,
            liters_per_unit:   l.litersPerUnit
        }));

        const { error: lErr } = await supabase
            .from('packaging_order_lines')
            .insert(lineRows);

        if (lErr) {
            // Cancelar la orden si falló la inserción de líneas
            await supabase
                .from('packaging_requests')
                .update({ status: 'cancelled' })
                .eq('id', order.id);
            throw lErr;
        }

        // 3. Llamar al RPC atómico que completa todo
        const { data: result, error: rpcErr } = await supabase.rpc('complete_packaging_v2', {
            p_order_id: order.id,
            p_user_id:  'system'   // el userId real se pasa desde la vista
        });

        if (rpcErr) {
            await supabase
                .from('packaging_requests')
                .update({ status: 'cancelled' })
                .eq('id', order.id);
            throw rpcErr;
        }

        return { orderId: order.id, result };
    },

    /** Versión con userId explícito para auditoría. */
    async submitPackagingOrderV3WithUser(
        branchId:      string,
        bulkProductId: string,
        drumQty:       number,
        userId:        string,
        lines: {
            packageType:     string;
            targetProductId: string;
            quantity:        number;
            litersPerUnit:   number;
        }[]
    ): Promise<{ orderId: string; result: any }> {

        const { data: order, error: oErr } = await supabase
            .from('packaging_requests')
            .insert({
                branch_id:       branchId,
                bulk_product_id: bulkProductId,
                quantity_drum:   drumQty,
                status:          'processing',
                started_at:      new Date().toISOString()
            })
            .select()
            .single();
        if (oErr) throw oErr;

        const lineRows = lines.map(l => ({
            order_id:           order.id,
            package_type:       l.packageType,
            target_product_id:  l.targetProductId,
            quantity_requested: l.quantity,
            liters_per_unit:    l.litersPerUnit
        }));

        const { error: lErr } = await supabase
            .from('packaging_order_lines')
            .insert(lineRows);

        if (lErr) {
            await supabase.from('packaging_requests').update({ status: 'cancelled' }).eq('id', order.id);
            throw lErr;
        }

        const { data: result, error: rpcErr } = await supabase.rpc('complete_packaging_v2', {
            p_order_id: order.id,
            p_user_id:  userId
        });

        if (rpcErr) {
            await supabase.from('packaging_requests').update({ status: 'cancelled' }).eq('id', order.id);
            throw rpcErr;
        }

        return { orderId: order.id, result };
    },

    /**
     * Crea orden V3 multi-línea en estado 'sent_to_branch' y notifica al STORE_MANAGER.
     * NO llama al RPC — el inventario se actualiza cuando la sucursal completa el envasado.
     */
    async createPackagingOrderV3(
        branchId:      string,
        bulkProductId: string,
        drumQty:       number,
        userId:        string,
        lines: {
            packageType:     string;
            targetProductId: string;
            quantity:        number;
            litersPerUnit:   number;
        }[],
        branchName?: string,
        productName?: string
    ): Promise<string> {

        // 1. Crear cabecera de la orden
        const { data: order, error: oErr } = await supabase
            .from('packaging_requests')
            .insert({
                branch_id:       branchId,
                bulk_product_id: bulkProductId,
                quantity_drum:   drumQty,
                status:          'sent_to_branch',
                created_by:      userId
            })
            .select()
            .single();
        if (oErr) throw oErr;

        // 2. Insertar líneas (omitir target_product_id si no hay producto asignado)
        const lineRows = lines.map(l => {
            const row: Record<string, any> = {
                order_id:           order.id,
                package_type:       l.packageType,
                quantity_requested: l.quantity,
                liters_per_unit:    l.litersPerUnit
            };
            if (l.targetProductId) row.target_product_id = l.targetProductId;
            return row;
        });

        const { error: lErr } = await supabase
            .from('packaging_order_lines')
            .insert(lineRows);

        if (lErr) {
            await supabase.from('packaging_requests').update({ status: 'cancelled' }).eq('id', order.id);
            throw lErr;
        }

        // 3. Notificar al STORE_MANAGER (no bloquea)
        try {
            await NotificationService.createNotification({
                targetRole: 'STORE_MANAGER',
                title: 'Nueva Orden de Envasado',
                message: `Se enviaron ${drumQty} tambo(s) de "${productName || bulkProductId}" a ${branchName || branchId} para envasar.`,
                actionUrl: '/packaging'
            });
        } catch (notifErr) {
            console.warn('No se pudo enviar notificación de envasado:', notifErr);
        }

        return order.id;
    },

    /**
     * La sucursal completa el envasado: pone la orden en 'processing' y llama al RPC
     * que actualiza el inventario y fija el status a 'completed'.
     */
    async completePackagingOrder(
        orderId:  string,
        userId:   string,
        branchName?: string,
        productName?: string
    ): Promise<any> {

        // 1. Marcar como en proceso
        await PackagingService.updatePackagingStatus(orderId, 'processing', userId);

        // 2. Llamar RPC atómico
        const { data: result, error: rpcErr } = await supabase.rpc('complete_packaging_v2', {
            p_order_id: orderId,
            p_user_id:  userId
        });

        if (rpcErr) {
            // Revertir a received_at_branch para que la sucursal pueda reintentar
            await supabase.from('packaging_requests')
                .update({ status: 'received_at_branch', updated_at: new Date().toISOString() })
                .eq('id', orderId);
            throw rpcErr;
        }

        // 3. Notificar al ADMIN (no bloquea)
        try {
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Envasado Completado',
                message: `La sucursal ${branchName || ''} completó el envasado de "${productName || orderId}". Inventario actualizado.`,
                actionUrl: '/packaging'
            });
        } catch (notifErr) {
            console.warn('No se pudo enviar notificación de completado:', notifErr);
        }

        return result;
    },

    /** Obtiene las líneas de producción de una orden v3. */
    async getOrderLines(orderId: string): Promise<PackagingOrderLine[]> {
        const { data, error } = await supabase
            .from('packaging_order_lines')
            .select(`
                *,
                products (name, sku)
            `)
            .eq('order_id', orderId)
            .order('created_at');
        if (error) throw error;

        return (data || []).map((l: any) => ({
            id:                l.id,
            orderId:           l.order_id,
            packageType:       l.package_type,
            targetProductId:   l.target_product_id,
            targetProductName: l.products?.name,
            quantityRequested: l.quantity_requested,
            litersPerUnit:     parseFloat(l.liters_per_unit),
            litersSubtotal:    parseFloat(l.liters_subtotal ?? (l.quantity_requested * l.liters_per_unit)),
            quantityProduced:  l.quantity_produced
        }));
    },

    /** Obtiene la merma registrada de una orden. */
    async getOrderWaste(orderId: string): Promise<number | null> {
        const { data, error } = await supabase
            .from('packaging_waste')
            .select('waste_liters')
            .eq('order_id', orderId)
            .single();
        if (error) return null;
        return data ? parseFloat(data.waste_liters) : null;
    }
};
