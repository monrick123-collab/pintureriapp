
import { supabase } from './supabase';
import { Product, Branch, RestockRequest, SupplyOrder, StockTransfer, BarterTransfer, BarterItem, BarterSuggestion } from '../types';
import { NotificationService } from './notificationService';

// Convertir respuesta de DB a Tipos de App
const mapDbProduct = (item: Record<string, any>): Product => ({
    id: item.product_id || item.id, // Maneja joined tables
    sku: item.sku || item.products?.sku || '',
    name: item.name || item.products?.name || 'Producto sin nombre',
    category: item.category || item.products?.category || 'Sin categoría',
    brand: item.brand || item.products?.brand, // New field
    description: item.description || item.products?.description || '',
    price: parseFloat(item.price || item.products?.price || '0'),
    image: item.image || item.products?.image || '',
    status: (item.status || item.products?.status || 'out') as 'available' | 'low' | 'out' | 'expired',
    stock: item.stock || 0,
    wholesalePrice: parseFloat(item.wholesale_price || item.products?.wholesale_price || '0'),
    wholesaleMinQty: parseInt(item.wholesale_min_qty || item.products?.wholesale_min_qty || '12'),
    costPrice: parseFloat(item.cost_price || item.products?.cost_price || '0'),
    packageType: item.package_type || item.products?.package_type,
    // New Fields Mapping
    min_stock: item.min_stock || item.products?.min_stock || 10,
    max_stock: item.max_stock || item.products?.max_stock || 100,
    location: item.location || item.products?.location || '',
    unit_measure: item.unit_measure || item.products?.unit_measure || 'pza',
    supplier_id: item.supplier_id || item.products?.supplier_id,
    inventory: {}
});

export const InventoryService = {
    // Obtener todos los productos con su stock TOTAL (suma de sucursales)
    async getProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*');

        if (error) throw error;

        // Para obtener el inventario detallado, necesitamos otra consulta
        const { data: inventoryData } = await supabase.from('inventory').select('*');

        return (data || []).map(p => {
            const prodInv = (inventoryData || []).filter((i: any) => i.product_id === p.id) || [];
            const inventoryMap: Record<string, number> = {};
            prodInv.forEach((i: any) => inventoryMap[i.branch_id] = i.stock);

            const mapped = mapDbProduct(p);
            return {
                ...mapped,
                stock: prodInv.reduce((acc: number, curr: any) => acc + curr.stock, 0),
                inventory: inventoryMap
            } as Product;
        });
    },

    // Obtener productos filtrados por sucursal específica
    async getProductsByBranch(branchId: string): Promise<Product[]> {
        if (branchId === 'ALL') return this.getProducts();

        // Join products + inventory
        const { data, error } = await supabase
            .from('inventory')
            .select(`
            stock,
            branch_id,
            products (*)
        `)
            .eq('branch_id', branchId);

        if (error) throw error;

        return (data || []).map(item => ({
            ...mapDbProduct(item.products),
            stock: item.stock,
            inventory: { [branchId]: item.stock } // Partial view
        }));
    },

    async createProduct(product: Omit<Product, 'id' | 'inventory'>): Promise<any> {
        const { data, error } = await supabase
            .from('products')
            .insert([{
                sku: product.sku,
                name: product.name,
                category: product.category,
                brand: product.brand,
                description: product.description,
                price: product.price,
                image: product.image,
                status: product.status,
                wholesale_price: product.wholesalePrice || 0,
                wholesale_min_qty: product.wholesaleMinQty || 12,
                package_type: product.packageType,
                // New Fields
                min_stock: product.min_stock,
                max_stock: product.max_stock,
                location: product.location,
                cost_price: product.costPrice,
                unit_measure: product.unit_measure,
                supplier_id: product.supplier_id
            }])
            .select()
            .single();

        if (error) throw error;

        // Inicializar inventario en 0 para todas las sucursales activas
        const { data: branches } = await supabase.from('branches').select('id');
        if (branches) {
            const inventoryInit = branches.map(b => ({
                product_id: data.id,
                branch_id: b.id,
                stock: 0
            }));
            await supabase.from('inventory').insert(inventoryInit);
        }

        return data;
    },

    async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
        const { error } = await supabase
            .from('products')
            .update({
                sku: updates.sku,
                name: updates.name,
                category: updates.category,
                brand: updates.brand,
                description: updates.description,
                price: updates.price,
                image: updates.image,
                status: updates.status,
                wholesale_price: updates.wholesalePrice,
                wholesale_min_qty: updates.wholesaleMinQty,
                package_type: updates.packageType,
                // New Fields
                min_stock: updates.min_stock,
                max_stock: updates.max_stock,
                location: updates.location,
                cost_price: updates.costPrice,
                unit_measure: updates.unit_measure,
                supplier_id: updates.supplier_id
            })
            .eq('id', id);

        if (error) throw error;
    },

    async deleteProduct(id: string): Promise<void> {
        // Inventory and other related data should be handled by DB CASCADE or manual cleanup
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async updateStock(productId: string, branchId: string, newStock: number) {
        // Upsert: Si existe actualiza, si no crea
        const { error } = await supabase
            .from('inventory')
            .upsert({
                product_id: productId,
                branch_id: branchId,
                stock: newStock
            }, { onConflict: 'product_id,branch_id' });

        if (error) throw error;
    },

    async getBranches(): Promise<Branch[]> {
        const { data, error } = await supabase.from('branches').select('*');
        if (error) throw error;
        return data as Branch[];
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

    async bulkCreateProducts(products: Omit<Product, 'id' | 'inventory'>[]): Promise<void> {
        // 1. Insert Products in bulk
        // We use upsert based on SKU if we want to update, but for now specific requirement was creating.
        // Let's use insert. Note: Supabase limits bulk inserts, but for reasonable CSVs it's fine.
        const productsToInsert = products.map(p => ({
            sku: p.sku,
            name: p.name,
            category: p.category,
            description: p.description,
            price: p.price,
            image: p.image,
            status: p.status,
            wholesale_price: p.wholesalePrice || 0,
            wholesale_min_qty: p.wholesaleMinQty || 12
        }));

        const { data: insertedProducts, error: prodError } = await supabase
            .from('products')
            .upsert(productsToInsert, { onConflict: 'sku' }) // Upsert by SKU to avoid dupes
            .select();

        if (prodError) throw prodError;
        if (!insertedProducts) return;

        // 2. Initialize Inventory for these products in ALL branches
        const { data: branches } = await supabase.from('branches').select('id');
        if (!branches) return;

        const inventoryEntries = [];
        for (const prod of insertedProducts) {
            for (const branch of branches) {
                inventoryEntries.push({
                    product_id: prod.id,
                    branch_id: branch.id,
                    stock: 0
                });
            }
        }

        // Bulk insert inventory (ignore duplicates with onConflict if we prefer)
        const { error: invError } = await supabase
            .from('inventory')
            .upsert(inventoryEntries, { onConflict: 'product_id,branch_id' });

        if (invError) throw invError;
    },

    // --- RESTOCK FLOW ---

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

        // Notification to WAREHOUSE
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

        // Notification to Branch based on requestId
        try {
            if (newStatus === 'shipped') {
                 const { data: reqData } = await supabase.from('restock_requests').select('branch_id').eq('id', requestId).single();
                 if (reqData) {
                     const { data: bData } = await supabase.from('branches').select('name').eq('id', reqData.branch_id).single();
                     await NotificationService.createNotification({
                         // Normally we should target specific branch users, but targetting admins + store managers is a good start
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
        // Calls the RPC to atomically move stock
        const { error } = await supabase.rpc('confirm_restock_arrival', {
            p_request_id: requestId
        });
        if (error) throw error;
    },

    // --- INTERNAL CONSUMPTION ---

    async recordInternalConsumption(productId: string, branchId: string, userId: string, quantity: number, reason: string): Promise<void> {
        const { error } = await supabase.rpc('process_internal_consumption', {
            p_product_id: productId,
            p_branch_id: branchId,
            p_user_id: userId,
            p_quantity: quantity,
            p_reason: reason
        });

        if (error) throw error;
    },

    async getInternalConsumptionHistory(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('internal_consumption')
            .select(`
                *,
                products (name, sku, image),
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId && branchId !== 'ALL') {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.products?.name,
            productImage: item.products?.image,
            branchId: item.branch_id,
            branchName: item.branches?.name,
            userId: item.user_id,
            quantity: item.quantity,
            reason: item.reason,
            costAtTime: parseFloat(item.cost_at_time || '0'),
            createdAt: item.created_at
        }));
    },

    // --- NUEVAS FUNCIONES DE HOJAS DE RESURTIDO ---

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
        // 1. Obtener cabecera
        const { data: sheet, error: sError } = await supabase
            .from('restock_sheets')
            .select(`*, branches(*)`)
            .eq('id', sheetId)
            .single();

        if (sError) throw sError;

        // 2. Obtener items
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
                product: mapDbProduct(i.products)
            })),
            departureTime: sheet.departure_time,
            arrivalTime: sheet.arrival_time
        };
    },

    async createRestockSheet(branchId: string, items: { productId: string, quantity: number, unitPrice: number }[]): Promise<string> {
        // 1. Obtener siguiente folio usando la función genérica
        const { data: folio, error: fError } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'restock'
        });
        if (fError) throw fError;

        const totalAmount = items.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);

        // 2. Crear cabecera
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

        // 3. Crear items
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
    },

    // --- SUPPLY ORDERS (Punto 2) ---

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
            createdByName: s.created_by, // Fallback to ID/Email stored in column if available
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
        if (status === 'shipped') updates.estimated_arrival = new Date(Date.now() + 86400000).toISOString(); // +1 day estimate

        const { error } = await supabase
            .from('supply_orders')
            .update(updates)
            .eq('id', orderId);

        if (error) throw error;
    },

    async confirmSupplyOrderArrival(orderId: string, receivedItems?: { id: string, productId: string, status: string, receivedQuantity: number }[]): Promise<void> {
        // 1. Get order items
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
            // Update each item
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
            // Recibido completamente (flujo por defecto / retrocompatibilidad)
            const { error: itemsUpdateError } = await supabase
                .from('supply_order_items')
                .update({ status: 'received_full' })
                .eq('order_id', orderId);
            if (itemsUpdateError) throw itemsUpdateError;
        }

        const finalStatus = hasIncidents ? 'received_with_incidents' : 'received';

        // 2. Update status
        const { error: updateError } = await supabase
            .from('supply_orders')
            .update({ status: finalStatus, updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // 3. Update Inventory for each item, but only the received quantity
        const itemsToProcess = receivedItems || order.supply_order_items.map((i: any) => ({
            productId: i.product_id,
            receivedQuantity: i.quantity // If no specific items passed, assume full reception
        }));

        for (const item of itemsToProcess) {
            // Solo aumentamos stock si quantity > 0
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
    },

    // --- PRICE REQUESTS (Punto 4) ---

    async getPriceRequests(): Promise<any[]> {
        const { data, error } = await supabase
            .from('price_requests')
            .select(`
                *,
                products (name, sku)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(r => ({
            id: r.id,
            productId: r.product_id,
            productName: r.products?.name,
            requesterId: r.requester_id,
            requesterName: r.requester_id, // Fallback to ID since strict auth join was removed
            status: r.status,
            createdAt: r.created_at
        }));
    },

    async resolvePriceRequest(requestId: string, productId: string, newPrice: number): Promise<void> {
        // 1. Update product price
        const { error: pError } = await supabase
            .from('products')
            .update({ price: newPrice })
            .eq('id', productId);

        if (pError) throw pError;

        // 2. Mark request as resolved
        const { error: rError } = await supabase
            .from('price_requests')
            .update({ status: 'resolved' })
            .eq('id', requestId);

        if (rError) throw rError;

        // Notify user who requested
        try {
            const { data } = await supabase.from('price_requests').select('requester_id, products(name)').eq('id', requestId).single();
            if (data) {
                await NotificationService.createNotification({
                    userId: data.requester_id,
                    title: 'Precio Autorizado',
                    message: `Se ha autorizado un nuevo precio para el producto ${(data.products as any)?.name}.`,
                    actionUrl: '/pos'
                });
            }
        } catch(e) { console.error(e) }
    },

    async createPriceRequest(productId: string, userId: string): Promise<void> {
        const { error } = await supabase.from('price_requests').insert({
            product_id: productId,
            requester_id: userId,
            status: 'pending'
        });
        if (error) throw error;

        try {
            const { data } = await supabase.from('products').select('name').eq('id', productId).single();
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Solicitud de Precio',
                message: `Se ha solicitado autorización de precio para: ${data?.name}.`,
                actionUrl: '/inventory'
            });
        } catch(e) { console.error(e) }
    },

    // --- RETURNS FLOW (Punto 6) ---

    async createReturnRequest(branchId: string, items: { productId: string, quantity: number, reason: string }[], transportedBy: string, receivedBy: string): Promise<void> {
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'return'
        });

        const returnRows = items.map(item => ({
            branch_id: branchId,
            folio: folio || 0,
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

        // Notify ADMIN
        try {
            const { data: bData } = await supabase.from('branches').select('name').eq('id', branchId).single();
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Nueva Solicitud de Devolución',
                message: `La sucursal ${bData?.name || branchId} ha enviado productos rotos o dañados.`,
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

    async authorizeReturn(returnId: string, adminId: string, approved: boolean, destinationBranchId?: string): Promise<void> {
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adminId);

        if (approved && destinationBranchId) {
            // Primero marcar como aprobado
            const updatePayload: any = {
                status: 'approved',
                updated_at: new Date().toISOString()
            };
            if (isValidUUID) updatePayload.authorized_by = adminId;

            const { error: approveError } = await supabase
                .from('returns')
                .update(updatePayload)
                .eq('id', returnId);
            if (approveError) throw approveError;

            // Luego procesar el movimiento de inventario con destino elegido
            const { error: rpcError } = await supabase.rpc('process_return', {
                p_return_id:             returnId,
                p_user_id:               adminId,
                p_destination_branch_id: destinationBranchId
            });
            if (rpcError) {
                // Compensating rollback: revertir status para que el Admin pueda reintentar
                await supabase
                    .from('returns')
                    .update({ status: 'pending_authorization', authorized_by: null, updated_at: new Date().toISOString() })
                    .eq('id', returnId);
                throw rpcError;
            }
        } else {
            // Rechazo: solo cambiar estado
            const updatePayload: any = {
                status: 'rejected',
                updated_at: new Date().toISOString()
            };
            if (isValidUUID) updatePayload.authorized_by = adminId;

            const { error } = await supabase
                .from('returns')
                .update(updatePayload)
                .eq('id', returnId);
            if (error) throw error;
        }
    },

    // --- INTERNAL SUPPLIES (Punto 7) ---

    async createInternalSupply(supply: any): Promise<void> {
        const { error } = await supabase
            .from('internal_supplies')
            .insert({
                branch_id: supply.branchId,
                description: supply.description,
                amount: supply.amount,
                category: supply.category
            });
        if (error) throw error;
    },

    async getInternalSupplies(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('internal_supplies')
            .select(`
                *,
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((s: any) => ({
            id: s.id,
            description: s.description,
            category: s.category,
            amount: s.amount,
            branchId: s.branch_id,
            branches: s.branches, // Keeping this for the view which accesses s.branches?.name
            createdAt: s.created_at,
            created_at: s.created_at // Keeping snake_case just in case other views use it
        }));
    },

    // --- PACKAGING / LITREADOS (Punto 8) ---

    async createPackagingRequest(request: any): Promise<void> {
        const { error } = await supabase
            .from('packaging_requests')
            .insert({
                bulk_product_id:    request.bulkProductId,
                target_package_type: request.targetPackageType,
                target_product_id:  request.targetProductId || null,
                quantity_drum:      request.quantityDrum,
                liters_requested:   request.litersRequested ?? (request.quantityDrum * 200),
                branch_id:          request.branchId,
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

        // Solo filtrar por sucursal si se especifica explicitamente
        if (branchId) query = query.eq('branch_id', branchId);

        // Filtro por rango de fechas (basado en created_at)
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((r: any) => ({
            ...r,
            stockReleased:    r.stock_released,
            litersRequested:  r.liters_requested,
            targetProductId:  r.target_product_id,
            packagesProduced: r.packages_produced,
        }));
    },

    async updatePackagingStatus(requestId: string, status: string, userId?: string): Promise<void> {
        const now = new Date().toISOString();

        if (status === 'processing') {
            const { error } = await supabase
                .from('packaging_requests')
                .update({ status, started_at: now, updated_at: now })
                .eq('id', requestId);
            if (error) throw error;
            return;
        }

        if (status === 'completed') {
            // El RPC maneja: descuento de tambo + alta de botellas + update del request
            const { error } = await supabase.rpc('complete_packaging', {
                p_request_id: requestId,
                p_user_id: userId || 'system'
            });
            if (error) throw error;
            return;
        }

        const { error } = await supabase
            .from('packaging_requests')
            .update({ status, updated_at: now })
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

    // --- COIN CHANGE ---

    async getCoinChangeRequests(branchId?: string, startDate?: string, endDate?: string): Promise<any[]> {
        let query = supabase
            .from('coin_change_requests')
            .select(`
                *,
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
            branchName: r.branches?.name,
            breakdown: r.breakdown_details,
            createdAt: r.created_at
        }));
    },

    async createCoinChangeRequest(branchId: string, userId: string, amount: number, breakdown?: Record<string, number>): Promise<void> {
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'coin_change'
        });

        const { error } = await supabase
            .from('coin_change_requests')
            .insert({
                branch_id: branchId,
                folio: folio || 0,
                amount: amount,
                requester_id: userId,
                status: 'pending',
                breakdown_details: breakdown
            });
        if (error) throw error;
    },

    // --- STOCK TRANSFERS ---

    async getStockTransfers(branchId?: string, startDate?: string, endDate?: string): Promise<StockTransfer[]> {
        let query = supabase
            .from('stock_transfers')
            .select(`
                *,
                from:branches!from_branch_id (name),
                to:branches!to_branch_id (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
        }
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(t => ({
            ...t,
            fromBranchName: (t.from as any)?.name,
            toBranchName: (t.to as any)?.name,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));
    },

    async getStockTransferDetail(transferId: string): Promise<StockTransfer> {
        const { data, error } = await supabase
            .from('stock_transfers')
            .select(`
                *,
                from:branches!from_branch_id (name),
                to:branches!to_branch_id (name),
                items:stock_transfer_items (
                    *,
                    product:products ( name, sku, image )
                )
            `)
            .eq('id', transferId)
            .single();

        if (error) throw error;

        return {
            ...data,
            fromBranchName: (data.from as any)?.name,
            toBranchName: (data.to as any)?.name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            items: (data.items || []).map((i: any) => ({
                id: i.id,
                transferId: i.transfer_id,
                productId: i.product_id,
                quantity: i.quantity,
                productName: i.product?.name,
                productSku: i.product?.sku,
                productImage: i.product?.image
            }))
        };
    },

    async createStockTransfer(fromId: string, toId: string, notes: string, items: { productId: string, quantity: number }[]): Promise<void> {
        // Always derive folio from MAX(folio)+1 for this branch to avoid stale RPC counters
        const { data: maxCheck } = await supabase
            .from('stock_transfers')
            .select('folio')
            .eq('from_branch_id', fromId)
            .order('folio', { ascending: false })
            .limit(1);

        const maxFolio = (maxCheck && maxCheck.length > 0) ? maxCheck[0].folio : 0;

        // Also check the RPC hint — use whichever is higher to handle concurrent inserts
        let rpcFolio = 0;
        try {
            const { data } = await supabase.rpc('get_next_folio', {
                p_branch_id: fromId,
                p_folio_type: 'transfer'
            });
            if (data && typeof data === 'number') rpcFolio = data;
        } catch (e) {
            console.warn("RPC get_next_folio failed, using table max:", e);
        }

        const finalFolio = Math.max(maxFolio + 1, rpcFolio);

        const { data: transfer, error: tError } = await supabase
            .from('stock_transfers')
            .insert({
                from_branch_id: fromId,
                to_branch_id: toId,
                folio: finalFolio,
                notes: notes,
                status: 'pending'
            })
            .select()
            .single();

        if (tError) throw tError;

        const transferItems = items.map(i => ({
            transfer_id: transfer.id,
            product_id: i.productId,
            quantity: i.quantity
        }));

        const { error: iError } = await supabase.from('stock_transfer_items').insert(transferItems);
        if (iError) throw iError;
    },

    // --- BARTER SYSTEM (TRUEQUES) ---

    async getBarterTransfers(branchId?: string, startDate?: string, endDate?: string): Promise<BarterTransfer[]> {
        let query = supabase
            .from('barter_transfers')
            .select(`
                *,
                from_branch:branches!from_branch_id(name),
                to_branch:branches!to_branch_id(name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) {
            query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
        }
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00-06:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59-06:00`);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(t => ({
            ...t,
            fromBranchName: (t.from as any)?.name,
            toBranchName: (t.to as any)?.name,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            requestedBy: t.requested_by,
            authorizedBy: t.authorized_by,
            authorizedAt: t.authorized_at
        }));
    },

    async getBarterDetail(barterId: string): Promise<BarterTransfer> {
        const { data, error } = await supabase
            .from('barter_transfers')
            .select(`
                *,
                from:branches!from_branch_id (name),
                to:branches!to_branch_id (name),
                given:barter_given_items (
                    *,
                    product:products ( name, sku, image )
                ),
                received:barter_received_items (
                    *,
                    product:products ( name, sku, image )
                )
            `)
            .eq('id', barterId)
            .single();

        if (error) throw error;

        return {
            ...data,
            fromBranchName: (data.from as any)?.name,
            toBranchName: (data.to as any)?.name,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
            givenItems: (data.given || []).map((i: any) => ({
                id: i.id,
                barterId: i.barter_id,
                productId: i.product_id,
                quantity: i.quantity,
                productName: i.product?.name,
                productSku: i.product?.sku,
                productImage: i.product?.image
            })),
            receivedItems: (data.received || []).map((i: any) => ({
                id: i.id,
                barterId: i.barter_id,
                productId: i.product_id,
                quantity: i.quantity,
                productName: i.product?.name,
                productSku: i.product?.sku,
                productImage: i.product?.image
            }))
        };
    },

    async createBarterTransfer(params: { 
        fromBranchId: string, 
        toBranchId: string, 
        requestedBy: string, 
        notes: string, 
        givenItems: { productId: string, quantity: number }[],
        receivedItems: { productId: string, quantity: number }[]
    }): Promise<void> {
        // Get next folio
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: params.fromBranchId,
            p_folio_type: 'barter'
        });

        const { data: barter, error: bError } = await supabase
            .from('barter_transfers')
            .insert({
                from_branch_id: params.fromBranchId,
                to_branch_id: params.toBranchId,
                folio: folio || 1,
                notes: params.notes,
                requested_by: params.requestedBy,
                status: 'pending'
            })
            .select()
            .single();

        if (bError) throw bError;

        const givenRows = params.givenItems.map(i => ({
            barter_id: barter.id,
            product_id: i.productId,
            quantity: i.quantity
        }));

        const receivedRows = params.receivedItems.map(i => ({
            barter_id: barter.id,
            product_id: i.productId,
            quantity: i.quantity
        }));

        const [gRes, rRes] = await Promise.all([
            supabase.from('barter_given_items').insert(givenRows),
            supabase.from('barter_received_items').insert(receivedRows)
        ]);

        if (gRes.error) throw gRes.error;
        if (rRes.error) throw rRes.error;

        // Notification to admins
        try {
            const { data: fromBranch } = await supabase.from('branches').select('name').eq('id', params.fromBranchId).single();
            const { data: toBranch } = await supabase.from('branches').select('name').eq('id', params.toBranchId).single();
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Nuevo Trueque Solicitado',
                message: `${fromBranch?.name || params.fromBranchId} solicitó un trueque con ${toBranch?.name || params.toBranchId}. Folio #B-${barter.folio.toString().padStart(4, '0')}`,
                actionUrl: '/transfers?tab=barter_history'
            });
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async approveBarterTransfer(barterId: string, adminId: string): Promise<void> {
        // First update status to approved
        const { error: updateError } = await supabase
            .from('barter_transfers')
            .update({ 
                status: 'approved', 
                authorized_by: adminId, 
                authorized_at: new Date().toISOString() 
            })
            .eq('id', barterId);
        
        if (updateError) throw updateError;

        // Reserve stock in both branches (holds until completion)
        const { error: reserveError } = await supabase.rpc('reserve_barter_inventory', {
            p_barter_id: barterId
        });

        if (reserveError) {
            // Compensating rollback: revertir aprobación para evitar barter atascado
            await supabase
                .from('barter_transfers')
                .update({ status: 'pending_approval', authorized_by: null, authorized_at: null, updated_at: new Date().toISOString() })
                .eq('id', barterId);
            throw reserveError;
        }

        // Notification to requesting branch
        try {
            const { data: barter } = await supabase.from('barter_transfers').select('from_branch_id, to_branch_id, folio').eq('id', barterId).single();
            if (barter) {
                const { data: fromBranch } = await supabase.from('branches').select('name').eq('id', barter.from_branch_id).single();
                const { data: toBranch } = await supabase.from('branches').select('name').eq('id', barter.to_branch_id).single();
                await NotificationService.createNotification({
                    targetRole: 'STORE_MANAGER',
                    title: 'Trueque Aprobado — Listo para Envío',
                    message: `Trueque #B-${barter.folio.toString().padStart(4, '0')} entre ${fromBranch?.name || barter.from_branch_id} y ${toBranch?.name || barter.to_branch_id} ha sido aprobado. Confirme el envío cuando despache la mercancía.`,
                    actionUrl: '/transfers?tab=barter_history'
                });
            }
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async rejectBarterTransfer(barterId: string): Promise<void> {
        const { error } = await supabase
            .from('barter_transfers')
            .update({ status: 'rejected' })
            .eq('id', barterId);
        if (error) throw error;

        // Notification to requesting branch
        try {
            const { data: barter } = await supabase.from('barter_transfers').select('from_branch_id, to_branch_id, folio').eq('id', barterId).single();
            if (barter) {
                const { data: fromBranch } = await supabase.from('branches').select('name').eq('id', barter.from_branch_id).single();
                const { data: toBranch } = await supabase.from('branches').select('name').eq('id', barter.to_branch_id).single();
                await NotificationService.createNotification({
                    targetRole: 'ADMIN',
                    title: 'Trueque Rechazado',
                    message: `Trueque #B-${barter.folio.toString().padStart(4, '0')} entre ${fromBranch?.name || barter.from_branch_id} y ${toBranch?.name || barter.to_branch_id} ha sido rechazado.`,
                    actionUrl: '/transfers?tab=barter_history'
                });
            }
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    // --- BARTER BIDIRECTIONAL SYSTEM ---

    async createBarterOffer(params: {
        fromBranchId: string,
        toBranchId: string,
        requestedBy: string,
        notes?: string,
        givenItems: { productId: string, quantity: number }[]
    }): Promise<string> {
        const { data: barterId, error } = await supabase.rpc('create_barter_offer', {
            p_from_branch_id: params.fromBranchId,
            p_to_branch_id: params.toBranchId,
            p_requested_by: params.requestedBy,
            p_notes: params.notes || null,
            p_given_items: params.givenItems
        });

        if (error) throw error;

        // Notify destination branch (WAREHOUSE and STORE_MANAGER)
        try {
            const { data: fromBranch } = await supabase.from('branches').select('name').eq('id', params.fromBranchId).single();
            const { data: toBranch } = await supabase.from('branches').select('name').eq('id', params.toBranchId).single();
            
            await NotificationService.createNotification({
                targetRole: 'WAREHOUSE',
                title: 'Nueva Oferta de Trueque',
                message: `${fromBranch?.name} solicita hacer trueque con ustedes. Revisar productos ofrecidos.`,
                actionUrl: '/transfers?tab=barter_pending'
            });
            
            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Nueva Oferta de Trueque',
                message: `${fromBranch?.name} ofrece trueque a ${toBranch?.name}. Pendiente de selección.`,
                actionUrl: '/transfers?tab=barter_history'
            });
        } catch (e) {
            console.error('Failed to send notification', e);
        }

        return barterId;
    },

    async getPendingBarterOffers(branchId: string): Promise<BarterTransfer[]> {
        const { data, error } = await supabase.rpc('get_pending_barter_offers', {
            p_branch_id: branchId
        });

        if (error) throw error;

        return (data || []).map((t: any) => ({
            id: t.id,
            fromBranchId: t.from_branch_id,
            fromBranchName: t.from_branch_name,
            toBranchId: t.to_branch_id,
            toBranchName: t.to_branch_name,
            folio: t.folio,
            status: t.status,
            notes: t.notes,
            requestedBy: t.requested_by,
            createdAt: t.created_at,
            updatedAt: t.created_at
        }));
    },

    async getBarterOfferWithInventory(barterId: string): Promise<BarterTransfer & { offeredProducts: any[] }> {
        // Get barter detail
        const { data: barter, error: barterError } = await supabase
            .from('barter_transfers')
            .select(`
                *,
                from_branch:branches!from_branch_id (name),
                to_branch:branches!to_branch_id (name),
                given:barter_given_items (
                    *,
                    product:products (id, name, sku, image)
                ),
                selections:barter_selections (
                    *,
                    product:products (id, name, sku, image)
                )
            `)
            .eq('id', barterId)
            .single();

        if (barterError) throw barterError;

        // Get inventory of the offering branch (from_branch)
        const { data: inventory, error: invError } = await supabase
            .from('inventory')
            .select(`
                product_id,
                stock,
                product:products (id, name, sku, image, price)
            `)
            .eq('branch_id', barter.from_branch_id);

        if (invError) throw invError;

        // Map inventory with product details
        const offeredProducts = (inventory || []).map((inv: any) => ({
            productId: inv.product_id,
            productName: inv.product?.name,
            productSku: inv.product?.sku,
            productImage: inv.product?.image,
            price: inv.product?.price,
            stock: inv.stock
        }));

        return {
            id: barter.id,
            fromBranchId: barter.from_branch_id,
            fromBranchName: (barter.from_branch as any)?.name,
            toBranchId: barter.to_branch_id,
            toBranchName: (barter.to_branch as any)?.name,
            folio: barter.folio,
            status: barter.status,
            notes: barter.notes,
            requestedBy: barter.requested_by,
            selectedBy: barter.selected_by,
            selectedAt: barter.selected_at,
            counterProposalBy: barter.counter_proposal_by,
            counterProposalAt: barter.counter_proposal_at,
            createdAt: barter.created_at,
            updatedAt: barter.updated_at,
            givenItems: (barter.given || []).map((i: any) => ({
                id: i.id,
                barterId: i.barter_id,
                productId: i.product_id,
                quantity: i.quantity,
                productName: i.product?.name,
                productSku: i.product?.sku,
                productImage: i.product?.image
            })),
            selections: (barter.selections || []).map((s: any) => ({
                id: s.id,
                barterId: s.barter_id,
                productId: s.product_id,
                quantity: s.quantity,
                selectedBy: s.selected_by,
                productName: s.product?.name,
                productSku: s.product?.sku,
                productImage: s.product?.image,
                createdAt: s.created_at
            })),
            offeredProducts
        } as any;
    },

    async selectBarterItems(barterId: string, selectedBy: string, selections: { productId: string, quantity: number }[]): Promise<void> {
        const { error } = await supabase.rpc('select_barter_items', {
            p_barter_id: barterId,
            p_selected_by: selectedBy,
            p_selections: selections
        });

        if (error) throw error;

        // Notify admins
        try {
            const { data: barter } = await supabase
                .from('barter_transfers')
                .select(`
                    folio,
                    from_branch:branches!from_branch_id (name),
                    to_branch:branches!to_branch_id (name)
                `)
                .eq('id', barterId)
                .single();

            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Trueque Listo para Acreditación',
                message: `Trueque #B-${String(barter?.folio || 0).padStart(4, '0')} entre ${(barter?.from_branch as any)?.name} y ${(barter?.to_branch as any)?.name} está listo para aprobación.`,
                actionUrl: '/transfers?tab=barter_history'
            });
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async proposeCounterOffer(barterId: string, proposedBy: string, notes: string, counterItems: { productId: string, quantity: number }[]): Promise<void> {
        const { error } = await supabase.rpc('propose_barter_counter_offer', {
            p_barter_id: barterId,
            p_proposed_by: proposedBy,
            p_notes: notes || null,
            p_counter_items: counterItems
        });

        if (error) throw error;

        // Notify original requester
        try {
            const { data: barter } = await supabase
                .from('barter_transfers')
                .select(`
                    folio,
                    from_branch_id,
                    to_branch:branches!to_branch_id (name)
                `)
                .eq('id', barterId)
                .single();

            await NotificationService.createNotification({
                targetRole: 'WAREHOUSE',
                title: 'Contra-Oferta Recibida',
                message: `${(barter?.to_branch as any)?.name} ha enviado una contra-oferta para el trueque #B-${String(barter?.folio || 0).padStart(4, '0')}.`,
                actionUrl: '/transfers?tab=barter_history'
            });

            await NotificationService.createNotification({
                targetRole: 'ADMIN',
                title: 'Contra-Oferta de Trueque',
                message: `Nueva contra-oferta en trueque #B-${String(barter?.folio || 0).padStart(4, '0')}. Pendiente de resolución.`,
                actionUrl: '/transfers?tab=barter_history'
            });
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async acceptCounterOffer(barterId: string): Promise<void> {
        // Move counter offer items to received items and set to pending_approval
        const { data: counterItems } = await supabase
            .from('barter_counter_offers')
            .select('*')
            .eq('barter_id', barterId);

        if (counterItems && counterItems.length > 0) {
            const receivedRows = counterItems.map((i: any) => ({
                barter_id: i.barter_id,
                product_id: i.product_id,
                quantity: i.quantity
            }));

            await supabase.from('barter_received_items').insert(receivedRows);
        }

        await supabase
            .from('barter_transfers')
            .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
            .eq('id', barterId);
    },

    async cancelBarterTransfer(barterId: string): Promise<void> {
        // Release any stock holds before cancelling
        try {
            await supabase.rpc('release_barter_holds', { p_barter_id: barterId });
        } catch (_e) {
            // Holds may not exist yet; continue with cancellation
        }

        const { error } = await supabase.rpc('cancel_barter_transfer', {
            p_barter_id: barterId
        });

        if (error) throw error;
    },

    async confirmBarterDispatch(barterId: string, dispatchedBy: string): Promise<void> {
        const { error } = await supabase.rpc('confirm_barter_dispatch', {
            p_barter_id: barterId,
            p_dispatched_by: dispatchedBy
        });

        if (error) throw error;

        try {
            const { data: barter } = await supabase
                .from('barter_transfers')
                .select('from_branch_id, to_branch_id, folio')
                .eq('id', barterId)
                .single();
            if (barter) {
                const { data: toBranch } = await supabase.from('branches').select('name').eq('id', barter.to_branch_id).single();
                await NotificationService.createNotification({
                    targetRole: 'STORE_MANAGER',
                    title: 'Trueque en Tránsito',
                    message: `Trueque #B-${String(barter.folio).padStart(4, '0')} ha sido despachado. Confirme la recepción cuando llegue a ${toBranch?.name || barter.to_branch_id}.`,
                    actionUrl: '/transfers?tab=barter_history'
                });
            }
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async confirmBarterReception(barterId: string, receivedBy: string): Promise<void> {
        // Register who receives before the atomic RPC
        const { error: updateError } = await supabase
            .from('barter_transfers')
            .update({ received_by: receivedBy, updated_at: new Date().toISOString() })
            .eq('id', barterId);

        if (updateError) throw updateError;

        // Atomic: moves stock, releases holds, marks completed
        const { error } = await supabase.rpc('process_barter_transfer_bidirectional', {
            p_barter_id: barterId
        });

        if (error) throw error;

        try {
            const { data: barter } = await supabase
                .from('barter_transfers')
                .select('from_branch_id, to_branch_id, folio')
                .eq('id', barterId)
                .single();
            if (barter) {
                const { data: fromBranch } = await supabase.from('branches').select('name').eq('id', barter.from_branch_id).single();
                const { data: toBranch } = await supabase.from('branches').select('name').eq('id', barter.to_branch_id).single();
                await NotificationService.createNotification({
                    targetRole: 'ADMIN',
                    title: 'Trueque Completado',
                    message: `Trueque #B-${String(barter.folio).padStart(4, '0')} entre ${fromBranch?.name || barter.from_branch_id} y ${toBranch?.name || barter.to_branch_id} ha sido completado. Inventarios actualizados.`,
                    actionUrl: '/transfers?tab=barter_history'
                });
            }
        } catch (e) {
            console.error('Failed to send notification', e);
        }
    },

    async suggestBarterItems(fromBranchId: string, toBranchId: string, limit = 10): Promise<BarterSuggestion[]> {
        const { data, error } = await supabase.rpc('suggest_barter_items', {
            p_from_branch_id: fromBranchId,
            p_to_branch_id: toBranchId,
            p_limit: limit
        });

        if (error) throw error;

        return (data ?? []).map((r: any) => ({
            productId: r.product_id,
            productName: r.product_name,
            productSku: r.product_sku,
            fromBranchStock: r.from_branch_stock,
            toBranchStock: r.to_branch_stock,
            surplus: r.surplus,
            deficit: r.deficit,
            suggestionScore: r.suggestion_score
        }));
    },

    async confirmRestockWithDifferences(
        restockSheetId: string,
        items: { productId: string; productName: string; expectedQuantity: number; receivedQuantity: number; reason: string }[],
        confirmedBy: string
    ): Promise<void> {
        const { error } = await supabase.rpc('confirm_restock_with_differences', {
            p_restock_sheet_id: restockSheetId,
            p_items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                expectedQuantity: item.expectedQuantity,
                receivedQuantity: item.receivedQuantity,
                reason: item.reason
            })),
            p_confirmed_by: confirmedBy
        });

        if (error) throw error;
    },

    async getRestockIncidents(restockSheetId?: string): Promise<any[]> {
        let query = supabase
            .from('restock_incidents')
            .select('*')
            .order('created_at', { ascending: false });

        if (restockSheetId) {
            query = query.eq('restock_sheet_id', restockSheetId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async resolveRestockIncident(incidentId: string, resolvedBy: string, creditAmount?: number, notes?: string): Promise<void> {
        const { error } = await supabase.rpc('resolve_restock_incident', {
            p_incident_id: incidentId,
            p_resolved_by: resolvedBy,
            p_credit_amount: creditAmount || null,
            p_notes: notes || null
        });

        if (error) throw error;
    }
};
