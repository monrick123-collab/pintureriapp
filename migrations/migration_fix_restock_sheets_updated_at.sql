-- Fix: restock_sheets.updated_at no existe en producción
-- El RPC confirm_restock_with_differences hace SET updated_at = NOW()
-- pero la columna no fue creada en esta instancia de DB.
-- La columna sí estaba en migration_warehouse_features.sql:29 — esto la restaura.

ALTER TABLE public.restock_sheets
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
