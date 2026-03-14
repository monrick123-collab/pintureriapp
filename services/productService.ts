import { supabase } from './supabase';
import { Product } from '../types';
import { NotificationService } from './notificationService';

// Helper function moved from inventoryService
const mapDbProduct = (item: Record<string, any>): Product => ({
    id: item.product_id || item.id,
    sku: item.sku || item.products?.sku || '',
    name: item.name || item.products?.name || 'Producto sin nombre',
    category: item.category || item.products?.category || 'Sin categoría',
    brand: item.brand || item.products?.brand,
    description: item.description || item.products?.description || '',
    price: parseFloat(item.price || item.products?.price || '0'),
    image: item.image || item.products?.image || '',
    status: (item.status || item.products?.status || 'out') as 'available' | 'low' | 'out' | 'expired',
    stock: item.stock || 0,
    wholesalePrice: parseFloat(item.wholesale_price || item.products?.wholesale_price || '0'),
    wholesaleMinQty: parseInt(item.wholesale_min_qty || item.products?.wholesale_min_qty || '12'),
    costPrice: parseFloat(item.cost_price || item.products?.cost_price || '0'),
    packageType: item.package_type || item.products?.package_type,
    min_stock: item.min_stock || item.products?.min_stock || 10,
    max_stock: item.max_stock || item.products?.max_stock || 100,
    location: item.location || item.products?.location || '',
    unit_measure: item.unit_measure || item.products?.unit_measure || 'pza',
    supplier_id: item.supplier_id || item.products?.supplier_id,
    inventory: {}
});

export const ProductService = {
    async getProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*');

        if (error) throw error;

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

    async getProductById(id: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;

        const { data: inventoryData } = await supabase
            .from('inventory')
            .select('*')
            .eq('product_id', id);

        const inventoryMap: Record<string, number> = {};
        (inventoryData || []).forEach((i: any) => inventoryMap[i.branch_id] = i.stock);

        return {
            ...mapDbProduct(data),
            stock: (inventoryData || []).reduce((acc: number, curr: any) => acc + curr.stock, 0),
            inventory: inventoryMap
        };
    },

    async createProduct(product: Omit<Product, 'id' | 'inventory'>): Promise<Product> {
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

        const { data: branches } = await supabase.from('branches').select('id');
        if (branches) {
            const inventoryInit = branches.map(b => ({
                product_id: data.id,
                branch_id: b.id,
                stock: 0
            }));
            await supabase.from('inventory').insert(inventoryInit);
        }

        return {
            ...mapDbProduct(data),
            stock: 0,
            inventory: {}
        };
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
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async bulkCreateProducts(products: Omit<Product, 'id' | 'inventory'>[]): Promise<void> {
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
            .upsert(productsToInsert, { onConflict: 'sku' })
            .select();

        if (prodError) throw prodError;
        if (!insertedProducts) return;

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

        const { error: invError } = await supabase
            .from('inventory')
            .upsert(inventoryEntries, { onConflict: 'product_id,branch_id' });

        if (invError) throw invError;
    },

    // --- PRICE REQUESTS ---
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
            requesterName: r.requester_id,
            status: r.status,
            createdAt: r.created_at
        }));
    },

    async resolvePriceRequest(requestId: string, productId: string, newPrice: number): Promise<void> {
        const { error: pError } = await supabase
            .from('products')
            .update({ price: newPrice })
            .eq('id', productId);

        if (pError) throw pError;

        const { error: rError } = await supabase
            .from('price_requests')
            .update({ status: 'resolved' })
            .eq('id', requestId);

        if (rError) throw rError;

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
    }
};