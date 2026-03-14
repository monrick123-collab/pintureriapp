import { supabase } from '../supabase';
import { SupplyOrder } from '../../types';

export const SupplyService = {
    async getSupplyOrders(branchId?: string): Promise<SupplyOrder[]> {
        let query = supabase
            .from('supply_orders')
            .select(`
                *,
                branches (name),
                supply_order_items (
                    product_id,
                    quantity,
                    unit_price,
                    total_price,
                    status,
                    received_quantity,
                    products ( name, sku, image )
                )
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query as { data: any[] | null, error: any };
        if (error) throw error;

        return (data || []).map(s => ({
            id: s.id,
            folio: s.folio,
            branchId: s.branch_id,
            branchName: s.branches?.name,
            createdBy: s.created_by,
            createdByName: s.created_by,
            assignedAdminId: s.assigned_admin_id,
            assignedAdminName: s.assigned_admin_id,
            status: s.status,
            estimatedArrival: s.estimated_arrival,
            totalAmount: s.total_amount,
            createdAt: s.created_at,
            items: s.supply_order_items?.map((i: any) => ({
                id: i.id || 'N/A',
                orderId: s.id,
                productId: i.product_id,
                quantity: i.quantity,
                unitPrice: i.unit_price,
                totalPrice: i.total_price,
                status: i.status || 'pending',
                received_quantity: i.received_quantity || 0,
                productName: i.products?.name,
                productImage: i.products?.image
            }))
        }));
    },

    async createSupplyOrder(branchId: string, userId: string, items: { productId: string, quantity: number, unitPrice: number }[]): Promise<string> {
        const totalAmount = items.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);

        const { data: order, error: oError } = await supabase
            .from('supply_orders')
            .insert({
                branch_id: branchId,
                created_by: userId,
                total_amount: totalAmount,
                status: 'pending'
            })
            .select()
            .single();

        if (oError) throw oError;

        const orderItems = items.map(i => ({
            order_id: order.id,
            product_id: i.productId,
            quantity: i.quantity,
            unit_price: i.unitPrice,
            total_price: i.quantity * i.unitPrice
        }));

        const { error: iError } = await supabase.from('supply_order_items').insert(orderItems);
        if (iError) throw iError;

        return order.id;
    },

    async updateSupplyOrderStatus(orderId: string, status: string, adminId?: string): Promise<void> {
        const updates: any = { status };
        if (adminId) updates.assigned_admin_id = adminId;
        if (status === 'shipped') updates.estimated_arrival = new Date(Date.now() + 86400000).toISOString();

        const { error } = await supabase
            .from('supply_orders')
            .update(updates)
            .eq('id', orderId);

        if (error) throw error;
    },

    async confirmSupplyOrderArrival(orderId: string, receivedItems?: { id: string, productId: string, status: string, receivedQuantity: number }[]): Promise<void> {
        const { data: order, error: fetchError } = await supabase
            .from('supply_orders')
            .select(`
                *,
                supply_order_items (*)
            `)
            .eq('id', orderId)
            .single();

        if (fetchError) throw fetchError;
        if (order.status !== 'shipped') throw new Error("El pedido no está en estado 'Enviado'");

        let hasIncidents = false;

        if (receivedItems && receivedItems.length > 0) {
            for (const rItem of receivedItems) {
                if (rItem.status !== 'received_full') {
                    hasIncidents = true;
                }
                const { error: itemUpdateError } = await supabase
                    .from('supply_order_items')
                    .update({ status: rItem.status, received_quantity: rItem.receivedQuantity })
                    .eq('id', rItem.id);

                if (itemUpdateError) throw itemUpdateError;
            }
        } else {
            const { error: itemsUpdateError } = await supabase
                .from('supply_order_items')
                .update({ status: 'received_full' })
                .eq('order_id', orderId);
            if (itemsUpdateError) throw itemsUpdateError;
        }

        const finalStatus = hasIncidents ? 'received_with_incidents' : 'received';

        const { error: updateError } = await supabase
            .from('supply_orders')
            .update({ status: finalStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updateError) throw updateError;

        const itemsToProcess = receivedItems || order.supply_order_items.map((i: any) => ({
            productId: i.product_id,
            receivedQuantity: i.quantity
        }));

        for (const item of itemsToProcess) {
            if (item.receivedQuantity > 0) {
                const { data: currentInv } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('branch_id', order.branch_id)
                    .eq('product_id', item.productId)
                    .single();

                if (currentInv) {
                    await supabase
                        .from('inventory')
                        .update({ stock: currentInv.stock + item.receivedQuantity, updated_at: new Date().toISOString() })
                        .eq('id', currentInv.id);
                } else {
                    await supabase
                        .from('inventory')
                        .insert({
                            branch_id: order.branch_id,
                            product_id: item.productId,
                            stock: item.receivedQuantity
                        });
                }
            }
        }
    }
};