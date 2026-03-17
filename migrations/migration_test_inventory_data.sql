-- =====================================================
-- DATOS DE PRUEBA PARA VALIDACIÓN DE INVENTARIOS
-- Productos identificables por SKU con prefijo TEST-
-- Para limpiar: ejecutar cleanup_test_data.sql
-- =====================================================

-- PRODUCTOS DE PRUEBA (UUIDs fijos para fácil limpieza)
INSERT INTO public.products (id, sku, name, brand, category, price, wholesale_price, status)
VALUES
  ('a1111111-0000-0000-0000-000000000001', 'TEST-PINT-01', '[TEST] Pintura Blanca 20L',  'TestBrand', 'Interiores',  980.00, 850.00, 'available'),
  ('a1111111-0000-0000-0000-000000000002', 'TEST-PINT-02', '[TEST] Esmalte Negro 1L',    'TestBrand', 'Esmaltes',    320.00, 280.00, 'available'),
  ('a1111111-0000-0000-0000-000000000003', 'TEST-ACC-01',  '[TEST] Brocha 3" Prueba',    'TestBrand', 'Accesorios',   55.00,  45.00, 'available')
ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- =====================================================
-- INVENTARIO INICIAL EN TODAS LAS SUCURSALES
-- (Si ya existe, sobreescribe el stock a estos valores)
-- =====================================================

-- TEST-PINT-01: Pintura Blanca
INSERT INTO public.inventory (product_id, branch_id, stock, updated_at) VALUES
  ('a1111111-0000-0000-0000-000000000001', 'BR-MAIN',    200, now()),
  ('a1111111-0000-0000-0000-000000000001', 'BR-CENTRO',   30, now()),
  ('a1111111-0000-0000-0000-000000000001', 'BR-NORTE',    25, now()),
  ('a1111111-0000-0000-0000-000000000001', 'BR-SUR',      20, now()),
  ('a1111111-0000-0000-0000-000000000001', 'BR-MAYOREO',  50, now())
ON CONFLICT (product_id, branch_id) DO UPDATE
  SET stock = EXCLUDED.stock, updated_at = now();

-- TEST-PINT-02: Esmalte Negro
INSERT INTO public.inventory (product_id, branch_id, stock, updated_at) VALUES
  ('a1111111-0000-0000-0000-000000000002', 'BR-MAIN',    100, now()),
  ('a1111111-0000-0000-0000-000000000002', 'BR-CENTRO',   15, now()),
  ('a1111111-0000-0000-0000-000000000002', 'BR-NORTE',    10, now()),
  ('a1111111-0000-0000-0000-000000000002', 'BR-SUR',       8, now()),
  ('a1111111-0000-0000-0000-000000000002', 'BR-MAYOREO',  20, now())
ON CONFLICT (product_id, branch_id) DO UPDATE
  SET stock = EXCLUDED.stock, updated_at = now();

-- TEST-ACC-01: Brocha
INSERT INTO public.inventory (product_id, branch_id, stock, updated_at) VALUES
  ('a1111111-0000-0000-0000-000000000003', 'BR-MAIN',    500, now()),
  ('a1111111-0000-0000-0000-000000000003', 'BR-CENTRO',   40, now()),
  ('a1111111-0000-0000-0000-000000000003', 'BR-NORTE',    35, now()),
  ('a1111111-0000-0000-0000-000000000003', 'BR-SUR',      30, now()),
  ('a1111111-0000-0000-0000-000000000003', 'BR-MAYOREO', 100, now())
ON CONFLICT (product_id, branch_id) DO UPDATE
  SET stock = EXCLUDED.stock, updated_at = now();

-- =====================================================
-- QUERY DE VERIFICACIÓN (correr en SQL Editor antes
-- y después de cada prueba para ver los cambios)
-- =====================================================
-- SELECT p.sku, p.name, i.branch_id, i.stock, i.updated_at
-- FROM inventory i
-- JOIN products p ON p.id = i.product_id
-- WHERE p.sku LIKE 'TEST-%'
-- ORDER BY p.sku, i.branch_id;

-- =====================================================
-- ESCENARIOS A VALIDAR:
--
-- 1. VENTA en BR-CENTRO (qty 5 de TEST-PINT-01)
--    Esperado: BR-CENTRO baja de 30 → 25
--
-- 2. RESURTIDO para BR-NORTE (qty 10 de TEST-PINT-02)
--    Esperado: BR-MAIN baja de 100 → 90, BR-NORTE sube de 10 → 20
--
-- 3. TRASPASO BR-MAIN → BR-SUR (qty 20 de TEST-ACC-01)
--    Esperado: BR-MAIN baja de 500 → 480, BR-SUR sube de 30 → 50
-- =====================================================
