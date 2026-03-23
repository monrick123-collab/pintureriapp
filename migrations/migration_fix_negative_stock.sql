-- ============================================================
-- Migración: Corregir stock negativo y agregar constraint
-- ============================================================

-- 1. Corregir datos existentes con stock negativo
UPDATE inventory SET stock = 0 WHERE stock < 0;

-- 2. Agregar constraint para prevenir stock negativo en el futuro
--    Si el constraint ya existe, no falla
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_stock_non_negative;

ALTER TABLE inventory
ADD CONSTRAINT inventory_stock_non_negative CHECK (stock >= 0);
