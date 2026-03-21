-- =====================================================
-- FIX: Agregar columna folio a la tabla sales
--
-- Problema: La función process_sale usa sales.folio para
-- generar folios secuenciales por sucursal, pero la columna
-- nunca fue agregada al schema de la tabla sales.
-- =====================================================

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS folio INTEGER NOT NULL DEFAULT 0;

-- Crear índice para acelerar el MAX(folio) por sucursal
CREATE INDEX IF NOT EXISTS idx_sales_branch_folio ON public.sales (branch_id, folio);
