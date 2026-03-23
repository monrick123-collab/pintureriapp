-- Agregar columnas faltantes a supply_order_items
-- Necesario para el flujo de confirmación de recepción con incidencias

ALTER TABLE public.supply_order_items
ADD COLUMN IF NOT EXISTS status TEXT
  CHECK (status IN ('pending', 'received_full', 'received_partial', 'damaged'))
  DEFAULT 'pending';

ALTER TABLE public.supply_order_items
ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0;
