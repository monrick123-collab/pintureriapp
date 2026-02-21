-- Agregar campos a supply_order_items para recepción parcial/con incidencias
ALTER TABLE public.supply_order_items ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('pending', 'received_full', 'received_partial', 'damaged'));
ALTER TABLE public.supply_order_items ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0;

-- Actualizar el check constraint de status en supply_orders para incluir 'received_with_incidents'
ALTER TABLE public.supply_orders DROP CONSTRAINT IF EXISTS supply_orders_status_check;
ALTER TABLE public.supply_orders ADD CONSTRAINT supply_orders_status_check CHECK (status IN ('pending', 'processing', 'shipped', 'received', 'received_with_incidents', 'cancelled'));

-- Set default status for existing items to 'pending' if it was null
UPDATE public.supply_order_items SET status = 'pending' WHERE status IS NULL;
UPDATE public.supply_order_items SET received_quantity = quantity WHERE status = 'received_full'; 
-- Si no sabemos cuáles ya estaban recibidos, podemos dejarlos a 0. O si sabemos el estado general de la cabecera:
UPDATE public.supply_order_items SET status = 'received_full', received_quantity = quantity 
FROM public.supply_orders
WHERE supply_order_items.order_id = supply_orders.id AND supply_orders.status = 'received';
