-- Ampliar constraint de supply_orders para incluir el status 'incident_reviewed'
-- Este status lo asigna el Admin desde el Dashboard al revisar un pedido con incidencias.
-- Ejecutar en Supabase SQL Editor antes de desplegar los cambios de frontend.

ALTER TABLE public.supply_orders DROP CONSTRAINT IF EXISTS supply_orders_status_check;

ALTER TABLE public.supply_orders ADD CONSTRAINT supply_orders_status_check
    CHECK (status IN (
        'pending',
        'processing',
        'shipped',
        'received',
        'received_with_incidents',
        'incident_reviewed',
        'cancelled'
    ));
