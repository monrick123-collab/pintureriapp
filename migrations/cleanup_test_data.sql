-- =====================================================
-- LIMPIEZA DE DATOS DE PRUEBA
-- Ejecutar cuando terminen las pruebas de inventario
-- =====================================================

-- 1. Borrar items de ventas que usen productos de prueba
DELETE FROM public.sale_items
WHERE product_id IN (
  SELECT id FROM public.products WHERE sku LIKE 'TEST-%'
);

-- 2. Borrar ventas que queden sin items (si quedaron vacías)
DELETE FROM public.sales
WHERE id NOT IN (SELECT DISTINCT sale_id FROM public.sale_items)
  AND is_wholesale = false
  AND created_at > now() - INTERVAL '7 days';

-- 3. Borrar items de resurtidos de prueba
DELETE FROM public.restock_items
WHERE product_id IN (
  SELECT id FROM public.products WHERE sku LIKE 'TEST-%'
);

-- 4. Borrar items de traspasos de prueba
DELETE FROM public.stock_transfer_items
WHERE product_id IN (
  SELECT id FROM public.products WHERE sku LIKE 'TEST-%'
);

-- 5. Borrar inventario de prueba
DELETE FROM public.inventory
WHERE product_id IN (
  SELECT id FROM public.products WHERE sku LIKE 'TEST-%'
);

-- 6. Borrar los productos de prueba
DELETE FROM public.products WHERE sku LIKE 'TEST-%';

-- Verificar que quedó limpio:
-- SELECT COUNT(*) FROM products WHERE sku LIKE 'TEST-%';
-- SELECT COUNT(*) FROM inventory WHERE product_id IN ('a1111111-0000-0000-0000-000000000001','a1111111-0000-0000-0000-000000000002','a1111111-0000-0000-0000-000000000003');
