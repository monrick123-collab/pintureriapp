import React, { useState, useMemo } from 'react';
import { Product } from '../types';

interface SmartSearchProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  currentBranchId: string;
  includeZeroStock?: boolean;
}

const SmartSearch: React.FC<SmartSearchProps> = ({ products, onSelectProduct, currentBranchId, includeZeroStock = false }) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'category' | 'brand' | 'status'>('all');

  // Filtrar productos por sucursal actual
  const branchProducts = useMemo(() => {
    if (includeZeroStock) return products;
    // Si no hay branchId definida (p.ej. Admin sin sucursal seleccionada), mostrar todos
    if (!currentBranchId) return products;
    return products.filter(product => {
      const branchStock = product.inventory?.[currentBranchId] || 0;
      return branchStock > 0;
    });
  }, [products, currentBranchId, includeZeroStock]);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) {
      // Mostrar productos populares (los que tienen más stock)
      return [...branchProducts]
        .sort((a, b) => {
          const stockA = a.inventory?.[currentBranchId] || 0;
          const stockB = b.inventory?.[currentBranchId] || 0;
          return stockB - stockA;
        })
        .slice(0, 8);
    }
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return branchProducts.filter(product => {
      // Búsqueda por múltiples criterios
      const searchableText = `
        ${product.name.toLowerCase()}
        ${product.sku.toLowerCase()}
        ${product.category?.toLowerCase() || ''}
        ${product.description?.toLowerCase() || ''}
        ${product.brand?.toLowerCase() || ''}
      `;
      
      // Coincidencia parcial de todos los términos
      return searchTerms.every(term => searchableText.includes(term));
    }).slice(0, 15); // Limitar resultados
  }, [query, branchProducts, currentBranchId]);

  // Agrupar por categoría para navegación rápida
  const categories = useMemo(() => {
    const cats = new Set(branchProducts.map(p => p.category).filter(Boolean));
    return Array.from(cats).slice(0, 8) as string[]; // Top 8 categorías
  }, [branchProducts]);

  // Obtener marcas únicas
  const brands = useMemo(() => {
    const brandSet = new Set(branchProducts.map(p => p.brand).filter(Boolean));
    return Array.from(brandSet).slice(0, 6) as string[]; // Top 6 marcas
  }, [branchProducts]);

  const handleProductSelect = (product: Product) => {
    onSelectProduct(product);
    setQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda principal */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto, SKU, categoría, marca..."
            className="w-full p-4 pl-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-primary focus:outline-none transition-colors"
            autoComplete="off"
          />
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          
          {/* Botón para limpiar búsqueda */}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
        
        {/* Filtros rápidos */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          <button
            onClick={() => {
              setQuery('');
              setActiveFilter('all');
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              activeFilter === 'all' && !query 
                ? 'bg-primary text-white' 
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            Todos
          </button>
          
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setQuery(cat);
                setActiveFilter('category');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                query === cat 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
          
          {brands.map(brand => (
            <button
              key={brand}
              onClick={() => {
                setQuery(brand);
                setActiveFilter('brand');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                query === brand 
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' 
                  : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {/* Resultados con preview */}
      {query && filteredProducts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 max-h-80 overflow-y-auto animate-in fade-in duration-200">
          <div className="p-2 border-b dark:border-slate-700">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          {filteredProducts.map(product => {
            const branchStock = product.inventory?.[currentBranchId] || 0;
            
            return (
              <button
                key={product.id}
                onClick={() => handleProductSelect(product)}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 last:border-b-0 transition-colors group"
              >
                <div className="relative">
                  <img 
                    src={product.image} 
                    className="w-12 h-12 object-contain rounded-lg bg-slate-100 dark:bg-slate-900 p-1" 
                    alt={product.name} 
                  />
                  {branchStock < 5 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {branchStock}
                    </div>
                  )}
                </div>
                
                <div className="text-left flex-1 min-w-0">
                  <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                    {product.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">SKU: {product.sku}</span>
                    <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{product.category}</span>
                    {product.brand && (
                      <span className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{product.brand}</span>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-primary">${product.price.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Stock: <span className={branchStock < 5 ? 'text-red-500 font-bold' : 'text-green-600 font-bold'}>
                      {branchStock}
                    </span>
                  </p>
                </div>
                
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">
                  add_circle
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sin resultados */}
      {query && filteredProducts.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border dark:border-slate-700 p-6 text-center animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">
            search_off
          </span>
          <p className="font-bold text-slate-600 dark:text-slate-300">No se encontraron productos</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Intenta con otras palabras o revisa otra categoría
          </p>
          <button
            onClick={() => setQuery('')}
            className="mt-3 px-4 py-2 text-sm font-bold bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Limpiar búsqueda
          </button>
        </div>
      )}

      {/* Sugerencias cuando no hay búsqueda */}
      {!query && (
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Sugerencias de búsqueda:</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setQuery('vinil')}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg hover:border-primary transition-colors"
            >
              "vinil"
            </button>
            <button
              onClick={() => setQuery('esmalte')}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg hover:border-primary transition-colors"
            >
              "esmalte"
            </button>
            <button
              onClick={() => setQuery('rodillo')}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg hover:border-primary transition-colors"
            >
              "rodillo"
            </button>
            <button
              onClick={() => setQuery('blanca')}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg hover:border-primary transition-colors"
            >
              "blanca"
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartSearch;