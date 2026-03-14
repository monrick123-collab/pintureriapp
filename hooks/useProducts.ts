import { useEffect } from 'react';
import { useProductStore } from '../store/productStore';
import { Product } from '../types';

export const useProducts = (branchId?: string) => {
  const {
    products,
    loading,
    error,
    currentBranchId,
    fetchProducts,
    setCurrentBranch,
    getProductsByCategory,
    searchProducts,
    getLowStockProducts
  } = useProductStore();

  useEffect(() => {
    if (branchId && branchId !== currentBranchId) {
      setCurrentBranch(branchId);
    }
  }, [branchId, currentBranchId, setCurrentBranch]);

  useEffect(() => {
    fetchProducts(branchId);
  }, [branchId, fetchProducts]);

  const getProductsByCategoryFiltered = (category: string) => {
    return getProductsByCategory(category);
  };

  const searchProductsFiltered = (query: string) => {
    return searchProducts(query);
  };

  const getProductStock = (productId: string): number => {
    const product = products.find(p => p.id === productId);
    return product?.inventory[currentBranchId] || 0;
  };

  const getProductMinStock = (productId: string): number => {
    const product = products.find(p => p.id === productId);
    return product?.min_stock || 10;
  };

  const isLowStock = (productId: string): boolean => {
    const stock = getProductStock(productId);
    const minStock = getProductMinStock(productId);
    return stock <= minStock;
  };

  const getStockStatus = (productId: string): 'available' | 'low' | 'out' => {
    const stock = getProductStock(productId);
    const minStock = getProductMinStock(productId);
    
    if (stock === 0) return 'out';
    if (stock <= minStock) return 'low';
    return 'available';
  };

  return {
    products,
    loading,
    error,
    currentBranchId,
    refetch: () => fetchProducts(branchId),
    getProductsByCategory: getProductsByCategoryFiltered,
    searchProducts: searchProductsFiltered,
    getLowStockProducts,
    getProductStock,
    getProductMinStock,
    isLowStock,
    getStockStatus
  };
};