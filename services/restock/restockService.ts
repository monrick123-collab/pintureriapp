import { supabase } from '../supabase';
import { RestockRequest, RestockSheet } from '../../types';
import { NotificationService } from '../notificationService';

export const RestockService = {
    async getRestockRequests(branchId?: string, status?: string | string[]): Promise<RestockRequest[]> {
        let query = supabase
            .from('restock_requests')
            .select(`
                *,
                products (name, sku, image),
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);
        if (status) {
            if (Array.isArray(status)) {
                query = query.in('status', status);
            } else {
                query = query.eq('status', status);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((r: any) => ({
            id: r.id,
            branchId: r.branch_id,
            branchName: r.branches?.name,
            productId: r.product_id,
            productName: r.products?.name,
            productImage: r.products?.image,
            quantity: r.quantity,
            status: r.status,
            createdAt: r.created_at,
            shippedAt: r.shipped_at
        }));
    },

    async getRestockRequestById(id: string): Promise<RestockRequest> {
        const { data, error } = await supabase
            .from('restock_requests')
            .select(`
                *,
                products (name, sku, image),
                branches (name)
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return {
            id: data.id,
            branchId: data.branch_id,
            branchName: data.branches?.name,
            productId: data.product_id,
            productName: data.products?.name,
            productImage: data.products?.image,
            quantity: data.quantity,
            status: data.status,
            createdAt: data.created_at
        };
    },

    async createRestockRequest(branchId: string, productId: string, quantity: number): Promise<void> {
        const { error } = await supabase.from('restock_requests').insert({
            branch_id: branchId,
            product_id: productId,
            quantity: quantity,
            status: 'pending_admin'
        });
        if (error) throw error;

        try {
            const { data: bData } = await supabase.from('branches').select('name').eq('id', branchId).single();
            await NotificationService.createNotification({
                targetRole: 'WAREHOUSE',
                title: 'Nueva Solicitud de Resurtido',
                message: `La sucursal ${bData?.name || branchId} solicitó un nuevo producto.`,
                actionUrl: '/restocks'
            });
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async updateRestockStatus(requestId: string, newStatus: string): Promise<void> {
        const updates: any = { status: newStatus };
        if (newStatus === 'approved_warehouse') updates.approved_at = new Date().toISOString();
        if (newStatus === 'shipped') updates.shipped_at = new Date().toISOString();

        const { error } = await supabase
            .from('restock_requests')
            .update(updates)
            .eq('id', requestId);
        if (error) throw error;

        try {
            if (newStatus === 'shipped') {
                const { data: reqData } = await supabase.from('restock_requests').select('branch_id').eq('id', requestId).single();
                if (reqData) {
                    const { data: bData } = await supabase.from('branches').select('name').eq('id', reqData.branch_id).single();
                    await NotificationService.createNotification({
                        targetRole: 'STORE_MANAGER',
                        title: 'Resurtido en Camino',
                        message: `Un paquete de resurtido para la sucursal ${bData?.name || 'Local'} va en camino.`,
                        actionUrl: '/restocks'
                    });
                }
            }
        } catch (e) {
            console.error('Failed to notify', e);
        }
    },

    async confirmRestockArrival(requestId: string): Promise<void> {
        const { error } = await supabase.rpc('confirm_restock_arrival', {
            p_request_id: requestId
        });
        if (error) throw error;
    },

    // --- RESTOCK SHEETS ---
    async getRestockSheets(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('restock_sheets')
            .select(`
                *,
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999-06:00`);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(s => ({
            id: s.id,
            branchId: s.branch_id,
            branchName: s.branches?.name,
            folio: s.folio,
            totalAmount: s.total_amount,
            status: s.status,
            createdAt: s.created_at,
            departureTime: s.departure_time,
            arrivalTime: s.arrival_time
        }));
    },

    async getRestockSheetDetail(sheetId: string): Promise<any> {
        const { data: sheet, error: sError } = await supabase
            .from('restock_sheets')
            .select(`*, branches(*)`)
            .eq('id', sheetId)
            .single();

        if (sError) throw sError;

        const { data: items, error: iError } = await supabase
            .from('restock_items')
            .select(`
                *,
                products (*)
            `)
            .eq('sheet_id', sheetId);

        if (iError) throw iError;

        return {
            ...sheet,
            branchName: sheet.branches?.name,
            totalAmount: sheet.total_amount || 0,
            createdAt: sheet.created_at,
            items: (items || []).map(i => ({
                id: i.id,
                sheetId: i.sheet_id,
                productId: i.product_id,
                quantity: i.quantity,
                unitPrice: i.unit_price,
                totalPrice: i.total_price,
                product: i.products
            })),
            departureTime: sheet.departure_time,
            arrivalTime: sheet.arrival_time
        };
    },

    async createRestockSheet(branchId: string, items: { productId: string, quantity: number, unitPrice: number }[]): Promise<string> {
        const { data: folio, error: fError } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'restock'
        });
        if (fError) throw fError;

        const totalAmount = items.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);

        const { data: sheet, error: sError } = await supabase
            .from('restock_sheets')
            .insert({
                branch_id: branchId,
                folio: folio,
                total_amount: totalAmount,
                status: 'pending'
            })
            .select()
            .single();

        if (sError) throw sError;

        const sheetItems = items.map(i => ({
            sheet_id: sheet.id,
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            total_price: i.quantity * i.unitPrice
        }));

        const { error: rError } = await supabase.from('restock_items').insert(sheetItems);
        if (rError) throw rError;

        return sheet.id;
    },

    async updateRestockSheetStatus(sheetId: string, status: string): Promise<void> {
        const { error } = await supabase
            .from('restock_sheets')
            .update({ status })
            .eq('id', sheetId);
        if (error) throw error;
    },

    async updateRestockSheetTime(sheetId: string, type: 'departure' | 'arrival', time: string): Promise<void> {
        const update = type === 'departure' ? { departure_time: time, status: 'shipped' } : { arrival_time: time, status: 'completed' };

        const { error } = await supabase
            .from('restock_sheets')
            .update(update)
            .eq('id', sheetId);
        if (error) throw error;
    }
};