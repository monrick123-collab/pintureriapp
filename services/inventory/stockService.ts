import { supabase } from '../supabase';
import { Product } from '../../types';

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

export const StockService = {
    async getProductsByBranch(branchId: string): Promise<Product[]> {
        if (branchId === 'ALL') {
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
        }

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
            inventory: { [branchId]: item.stock }
        }));
    },

    async updateStock(productId: string, branchId: string, newStock: number): Promise<void> {
        const { error } = await supabase
            .from('inventory')
            .upsert({
                product_id: productId,
                branch_id: branchId,
                stock: newStock
            }, { onConflict: 'product_id,branch_id' });

        if (error) throw error;
    },

    async getStockByProductAndBranch(productId: string, branchId: string): Promise<number> {
        const { data, error } = await supabase
            .from('inventory')
            .select('stock')
            .eq('product_id', productId)
            .eq('branch_id', branchId)
            .single();

        if (error) return 0;
        return data?.stock || 0;
    },

    async getStockSummary(branchId: string): Promise<{
        totalProducts: number;
        lowStock: number;
        outOfStock: number;
        totalValue: number;
    }> {
        const products = await this.getProductsByBranch(branchId);
        
        let lowStock = 0;
        let outOfStock = 0;
        let totalValue = 0;

        products.forEach(product => {
            const stock = product.inventory[branchId] || 0;
            const minStock = product.min_stock || 10;
            
            if (stock === 0) outOfStock++;
            else if (stock <= minStock) lowStock++;
            
            totalValue += stock * (product.costPrice || product.price);
        });

        return {
            totalProducts: products.length,
            lowStock,
            outOfStock,
            totalValue
        };
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
    }
};