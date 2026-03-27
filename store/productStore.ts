import { create } from 'zustand';
import { Product } from '../types';
import { ProductService } from '../services/productService';
import { StockService } from '../services/inventory/stockService';
import { WAREHOUSE_BRANCH_ID } from '../constants';

interface ProductStore {
  products: Product[];
  loading: boolean;
  error: string | null;
  currentBranchId: string;
  
  // Actions
  setCurrentBranch: (branchId: string) => void;
  fetchProducts: (branchId?: string) => Promise<void>;
  fetchProductById: (id: string) => Promise<Product | null>;
  createProduct: (product: Omit<Product, 'id' | 'inventory'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateStock: (productId: string, branchId: string, newStock: number) => Promise<void>;
  
  // Selectors
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (category: string) => Product[];
  searchProducts: (query: string) => Product[];
  getLowStockProducts: () => Product[];
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  loading: false,
  error: null,
  currentBranchId: WAREHOUSE_BRANCH_ID,

  setCurrentBranch: (branchId: string) => {
    set({ currentBranchId: branchId });
  },

  fetchProducts: async (branchId?: string) => {
    const targetBranchId = branchId || get().currentBranchId;
    
    set({ loading: true, error: null });
    try {
      const products = await StockService.getProductsByBranch(targetBranchId);
      set({ products, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Error fetching products:', error);
    }
  },

  fetchProductById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const product = await ProductService.getProductById(id);
      set({ loading: false });
      return product;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Error fetching product:', error);
      return null;
    }
  },

  createProduct: async (product: Omit<Product, 'id' | 'inventory'>) => {
    set({ loading: true, error: null });
    try {
      await ProductService.createProduct(product);
      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Error creating product:', error);
      throw error;
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    set({ loading: true, error: null });
    try {
      await ProductService.updateProduct(id, updates);
      await get().fetchProducts();
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Error updating product:', error);
      throw error;
    }
  },

  deleteProduct: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await ProductService.deleteProduct(id);
      set(state => ({
        products: state.products.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  updateStock: async (productId: string, branchId: string, newStock: number) => {
    set({ loading: true, error: null });
    try {
      await StockService.updateStock(productId, branchId, newStock);
      
      // Update local state
      set(state => ({
        products: state.products.map(p => {
          if (p.id === productId) {
            const updatedInventory = { ...p.inventory, [branchId]: newStock };
            const totalStock = Object.values(updatedInventory).reduce((sum, stock) => sum + stock, 0);
            return {
              ...p,
              stock: totalStock,
              inventory: updatedInventory
            };
          }
          return p;
        }),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Error updating stock:', error);
      throw error;
    }
  },

  // Selectors
  getProductById: (id: string) => {
    return get().products.find(p => p.id === id);
  },

  getProductsByCategory: (category: string) => {
    if (category === 'Todos') return get().products;
    return get().products.filter(p => p.category === category);
  },

  searchProducts: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().products.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      p.description?.toLowerCase().includes(lowerQuery)
    );
  },

  getLowStockProducts: () => {
    const { products, currentBranchId } = get();
    return products.filter(p => {
      const stock = p.inventory[currentBranchId] || 0;
      const minStock = p.min_stock || 10;
      return stock <= minStock;
    });
  }
}));