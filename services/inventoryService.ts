
import { supabase } from './supabase';
import { Product, Branch, RestockRequest } from '../types';

// Convertir respuesta de DB a Tipos de App
const mapDbProduct = (item: any): Product => ({
    id: item.product_id || item.id, // Maneja joined tables
    sku: item.sku || item.products?.sku,
    name: item.name || item.products?.name,
    category: item.category || item.products?.category,
    description: item.description || item.products?.description,
    price: parseFloat(item.price || item.products?.price || '0'),
    image: item.image || item.products?.image,
    status: item.status || item.products?.status,
    stock: item.stock || 0,
    wholesalePrice: parseFloat(item.wholesale_price || item.products?.wholesale_price || '0'),
    wholesaleMinQty: parseInt(item.wholesale_min_qty || item.products?.wholesale_min_qty || '12'),
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

        return data.map(p => {
            const prodInv = inventoryData?.filter((i: any) => i.product_id === p.id) || [];
            const inventoryMap: Record<string, number> = {};
            prodInv.forEach((i: any) => inventoryMap[i.branch_id] = i.stock);

            return {
                ...p,
                stock: prodInv.reduce((acc: number, curr: any) => acc + curr.stock, 0),
                inventory: inventoryMap
            } as Product;
        });
    },

    // Obtener productos filtrados por sucursal específica
    async getProductsByBranch(branchId: string): Promise<Product[]> {
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

        return data.map(item => ({
            ...item.products,
            stock: item.stock,
            inventory: { [branchId]: item.stock } // Partial view
        })) as unknown as Product[];
    },

    async createProduct(product: Omit<Product, 'id' | 'inventory'>): Promise<any> {
        const { data, error } = await supabase
            .from('products')
            .insert([{
                sku: product.sku,
                name: product.name,
                category: product.category,
                description: product.description,
                price: product.price,
                image: product.image,
                status: product.status,
                wholesale_price: product.wholesalePrice || 0,
                wholesale_min_qty: product.wholesaleMinQty || 12
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
                description: updates.description,
                price: updates.price,
                image: updates.image,
                status: updates.status,
                wholesale_price: updates.wholesalePrice,
                wholesale_min_qty: updates.wholesaleMinQty
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

    async getRestockRequests(branchId?: string, status?: string): Promise<any[]> {
        let query = supabase
            .from('restock_requests')
            .select(`
                *,
                products (name, sku, image),
                branches (name)
            `)
            .order('created_at', { ascending: false });

        if (branchId) query = query.eq('branch_id', branchId);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        return data.map((r: any) => ({
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
    }
};
