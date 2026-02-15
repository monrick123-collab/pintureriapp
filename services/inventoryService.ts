
import { supabase } from './supabase';
import { Product, Branch, RestockRequest } from '../types';

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

    async getRestockRequests(branchId?: string, status?: string | string[]): Promise<any[]> {
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

    async getRestockRequestById(id: string): Promise<any> {
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

    async getRestockSheets(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('restock_sheets')
            .select(`
                *,
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(s => ({
            id: s.id,
            branchId: s.branch_id,
            branchName: s.branches?.name,
            folio: s.folio,
            totalAmount: s.total_amount,
            status: s.status,
            createdAt: s.created_at
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
            items: (items || []).map(i => ({
                id: i.id,
                sheetId: i.sheet_id,
                productId: i.product_id,
                quantity: i.quantity,
                unitPrice: i.unit_price,
                totalPrice: i.total_price,
                product: mapDbProduct(i.products)
            }))
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

    // --- SUPPLY ORDERS (Punto 2) ---

    async getSupplyOrders(branchId?: string): Promise<any[]> {
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

    async confirmSupplyOrderArrival(orderId: string): Promise<void> {
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

        // 2. Update status
        const { error: updateError } = await supabase
            .from('supply_orders')
            .update({ status: 'received', updated_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updateError) throw updateError;

        // 3. Update Inventory for each item
        for (const item of order.supply_order_items) {
            // Logic: Insert or Update inventory for this branch
            const { data: currentInv } = await supabase
                .from('inventory')
                .select('*')
                .eq('branch_id', order.branch_id)
                .eq('product_id', item.product_id)
                .single();

            if (currentInv) {
                await supabase
                    .from('inventory')
                    .update({ stock: currentInv.stock + item.quantity, updated_at: new Date().toISOString() })
                    .eq('id', currentInv.id);
            } else {
                await supabase
                    .from('inventory')
                    .insert({
                        branch_id: order.branch_id,
                        product_id: item.product_id,
                        stock: item.quantity
                    });
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
    },

    async createPriceRequest(productId: string, userId: string): Promise<void> {
        const { error } = await supabase.from('price_requests').insert({
            product_id: productId,
            requester_id: userId,
            status: 'pending'
        });
        if (error) throw error;
    },

    // --- RETURNS FLOW (Punto 6) ---

    async createReturnRequest(branchId: string, productId: string, quantity: number, reason: string, transportedBy: string, receivedBy: string): Promise<void> {
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: branchId,
            p_folio_type: 'return'
        });

        const { error } = await supabase
            .from('returns')
            .insert({
                branch_id: branchId,
                folio: folio || 0,
                product_id: productId,
                quantity: quantity,
                reason: reason,
                transported_by: transportedBy,
                received_by: receivedBy,
                status: 'pending_authorization'
            });
        if (error) throw error;
    },

    async getReturnRequests(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('returns')
            .select(`
                *,
                products (name, sku),
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async authorizeReturn(returnId: string, adminId: string, approved: boolean): Promise<void> {
        const { error } = await supabase
            .from('returns')
            .update({
                status: approved ? 'approved' : 'rejected',
                authorized_by: adminId,
                updated_at: new Date().toISOString()
            })
            .eq('id', returnId);
        if (error) throw error;

        // Nota: El ajuste de inventario real debería hacerse mediante una RPC 
        // para asegurar atomicidad si es aprobado.
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
                bulk_product_id: request.bulkProductId,
                target_package_type: request.targetPackageType,
                quantity_drum: request.quantityDrum,
                branch_id: request.branchId,
                status: 'sent_to_branch'
            });
        if (error) throw error;
    },

    async getPackagingRequests(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('packaging_requests')
            .select(`
                *,
                products (name, sku),
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async updatePackagingStatus(requestId: string, status: string): Promise<void> {
        const { error } = await supabase
            .from('packaging_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', requestId);
        if (error) throw error;
    },

    // --- COIN CHANGE ---

    async getCoinChangeRequests(branchId?: string): Promise<any[]> {
        let query = supabase
            .from('coin_change_requests')
            .select(`
                *,
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async createCoinChangeRequest(branchId: string, userId: string, amount: number): Promise<void> {
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
                status: 'pending'
            });
        if (error) throw error;
    },

    // --- STOCK TRANSFERS ---

    async getStockTransfers(branchId?: string): Promise<any[]> {
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

        const { data, error } = await query;
        if (error) throw error;

        return (data || []).map(t => ({
            ...t,
            fromBranchName: (t.from as any)?.name,
            toBranchName: (t.to as any)?.name
        }));
    },

    async createStockTransfer(fromId: string, toId: string, notes: string, items: { productId: string, quantity: number }[]): Promise<void> {
        const { data: folio } = await supabase.rpc('get_next_folio', {
            p_branch_id: fromId,
            p_folio_type: 'transfer'
        });

        const { data: transfer, error: tError } = await supabase
            .from('stock_transfers')
            .insert({
                from_branch_id: fromId,
                to_branch_id: toId,
                folio: folio || 0,
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
    }
};
