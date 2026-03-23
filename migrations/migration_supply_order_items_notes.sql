-- Agrega columna de notas/comentarios por item en supply_order_items
ALTER TABLE public.supply_order_items
  ADD COLUMN IF NOT EXISTS notes TEXT;
