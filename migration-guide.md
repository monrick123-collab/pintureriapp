# Guía de Migración - Nueva Arquitectura

## 🎯 Objetivo
Migrar gradualmente del código legacy a la nueva arquitectura modular sin romper funcionalidad existente.

## 📋 Componentes Prioritarios para Migrar

### 1. **POS.tsx** (ALTA PRIORIDAD)
- **Estado actual**: 875 líneas, lógica compleja
- **Nuevo archivo**: `POS-refactored.tsx` (ya creado)
- **Acciones**:
  - Reemplazar imports legacy
  - Usar hooks personalizados (`useProducts`, `useCart`, `useSales`)
  - Usar stores de Zustand
  - Usar componentes UI reutilizables

### 2. **Inventory.tsx** (ALTA PRIORIDAD)
- **Estado actual**: 785 líneas, múltiples modales
- **Acciones**:
  - Migrar a `useProducts` hook
  - Usar `ProductService` y `StockService`
  - Implementar modales con `Modal` component
  - Usar `Toast` para notificaciones

### 3. **Dashboard.tsx** (MEDIA PRIORIDAD)
- **Estado actual**: 429 líneas, múltiples KPIs
- **Acciones**:
  - Usar `useSales` para datos de ventas
  - Implementar cards con componente `Card`
  - Usar `Badge` para estados

## 🔄 Pasos de Migración por Componente

### Paso 1: Actualizar Imports
```typescript
// IMPORTS LEGACY (eliminar)
import { InventoryService } from '../services/inventoryService';
import { useState, useEffect } from 'react';

// IMPORTS NUEVOS (agregar)
import { ProductService, StockService } from '../services';
import { useProducts, useToast } from '../hooks';
import { useProductStore, useUIStore } from '../store';
import { Button, Input, Modal, Card, Badge } from '../components/ui';
```

### Paso 2: Reemplazar Estado Local
```typescript
// ESTADO LEGACY (eliminar)
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

// ESTADO NUEVO (agregar)
const { products, loading, error, fetchProducts } = useProductStore();
const uiStore = useUIStore();
const toast = useToast();
```

### Paso 3: Reemplazar Efectos
```typescript
// EFECTO LEGACY (eliminar)
useEffect(() => {
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await InventoryService.getProductsByBranch(branchId);
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  loadData();
}, [branchId]);

// EFECTO NUEVO (agregar)
useEffect(() => {
  fetchProducts(branchId);
}, [branchId, fetchProducts]);
```

### Paso 4: Reemplazar Handlers
```typescript
// HANDLER LEGACY (eliminar)
const handleAddProduct = async (productData) => {
  setLoading(true);
  try {
    await InventoryService.createProduct(productData);
    await loadData();
    alert('Producto creado exitosamente');
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    setLoading(false);
  }
};

// HANDLER NUEVO (agregar)
const handleAddProduct = async (productData) => {
  uiStore.setLoading(true);
  try {
    await ProductService.createProduct(productData);
    await fetchProducts();
    toast.success('Producto creado exitosamente');
  } catch (err) {
    toast.error('Error: ' + err.message);
  } finally {
    uiStore.setLoading(false);
  }
};
```

### Paso 5: Reemplazar JSX
```typescript
// JSX LEGACY (eliminar)
<button 
  className="px-4 py-2 bg-primary text-white rounded-xl disabled:opacity-50"
  disabled={loading}
  onClick={handleSubmit}
>
  {loading ? 'Guardando...' : 'Guardar'}
</button>

// JSX NUEVO (agregar)
<Button
  variant="primary"
  loading={uiStore.loading}
  onClick={handleSubmit}
>
  Guardar
</Button>
```

## 🛠️ Utilidades de Migración

### 1. **Script de Búsqueda de Patrones**
```bash
# Buscar usos de InventoryService
grep -r "InventoryService" --include="*.tsx" --include="*.ts" .

# Buscar useState para productos
grep -r "useState.*Product" --include="*.tsx" --include="*.ts" .

# Buscar alert() nativos
grep -r "alert(" --include="*.tsx" --include="*.ts" .
```

### 2. **Plantilla de Componente Migrado**
Ver `views/POS-refactored.tsx` como referencia completa.

### 3. **Utilidades de Depuración**
```typescript
// En desarrollo, agregar esto para debug
import { useDebugValue } from 'react';

const useProducts = (branchId) => {
  const store = useProductStore();
  useDebugValue({ 
    productsCount: store.products.length,
    loading: store.loading,
    branchId 
  });
  return store;
};
```

## 🧪 Testing de Migración

### 1. **Pruebas Unitarias**
```typescript
// tests/store/productStore.test.ts
import { useProductStore } from '../../store/productStore';

describe('ProductStore', () => {
  test('fetchProducts loads products', async () => {
    const store = useProductStore.getState();
    await store.fetchProducts('BR-MAIN');
    expect(store.products.length).toBeGreaterThan(0);
    expect(store.loading).toBe(false);
  });
});
```

### 2. **Pruebas de Integración**
- Verificar que el carrito funcione correctamente
- Confirmar que las ventas se procesen
- Validar que el inventario se actualice

### 3. **Pruebas de UI**
- Confirmar que los modales se abran/cierren
- Verificar que las notificaciones toast aparezcan
- Validar que los botones tengan estados correctos

## 🚨 Errores Comunes y Soluciones

### Error 1: "Cannot read property of undefined"
**Causa**: Acceso a store antes de inicialización
**Solución**: Usar selectores seguros
```typescript
// MAL
const product = useProductStore().products[0];

// BIEN
const { getProductById } = useProductStore();
const product = getProductById(productId);
```

### Error 2: "Too many re-renders"
**Causa**: Actualización de estado en render
**Solución**: Usar useEffect o handlers
```typescript
// MAL
if (condition) {
  useProductStore.getState().setLoading(true);
}

// BIEN
useEffect(() => {
  if (condition) {
    useProductStore.getState().setLoading(true);
  }
}, [condition]);
```

### Error 3: "Type mismatch"
**Causa**: Tipos diferentes entre servicios
**Solución**: Usar funciones de mapeo
```typescript
// En services/productService.ts
const mapDbProduct = (item: any): Product => ({
  // mapeo completo
});
```

## 📊 Métricas de Progreso

### Checklist de Migración
- [ ] **POS.tsx** - Completado (ver `POS-refactored.tsx`)
- [ ] **Inventory.tsx** - Pendiente
- [ ] **Dashboard.tsx** - Pendiente
- [ ] **Finance.tsx** - Pendiente
- [ ] **Clients.tsx** - Pendiente
- [ ] **Quotations.tsx** - Pendiente
- [ ] **Returns.tsx** - Pendiente
- [ ] **Restocks.tsx** - Pendiente
- [ ] **Transfers.tsx** - Pendiente

### Métricas de Calidad
- **Cobertura de tests**: 0% → 70% (objetivo)
- **Complexidad ciclomática**: Reducir 50%
- **Líneas de código**: Reducir 30%
- **Tiempo de build**: Mantener < 10s

## 🔮 Próximos Pasos

### Fase 1: Componentes Críticos (1-2 semanas)
- Migrar POS, Inventory, Dashboard
- Establecer patrones base
- Validar con usuarios

### Fase 2: Componentes Secundarios (2-3 semanas)
- Migrar módulos restantes
- Implementar tests unitarios
- Optimizar performance

### Fase 3: Mejoras Avanzadas (3-4 semanas)
- Implementar React Query
- Agregar PWA features
- Optimizar bundle size

## 📞 Soporte Técnico

### Canales de Ayuda
1. **Documentación**: `README-refactor.md`
2. **Ejemplos**: `views/POS-refactored.tsx`
3. **Plantillas**: `components/ui/`
4. **Hooks**: `hooks/`
5. **Stores**: `store/`

### Contacto
- Revisar errores en consola del navegador
- Usar React DevTools para debug de estado
- Verificar network requests en DevTools

## 🎉 Celebración de Hitos
- **10% migrado**: Equipo de desarrollo familiarizado
- **50% migrado**: Mejoras de performance visibles
- **100% migrado**: Sistema completamente modernizado