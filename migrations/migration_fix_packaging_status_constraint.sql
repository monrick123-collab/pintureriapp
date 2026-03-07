-- FIX: Agregar estado 'received_at_branch' al check constraint de packaging_requests.
-- El flujo de envasado usa este estado para confirmar recepción en sucursal,
-- pero no estaba incluido en la validación de la tabla.

ALTER TABLE public.packaging_requests DROP CONSTRAINT IF EXISTS packaging_requests_status_check;

ALTER TABLE public.packaging_requests
    ADD CONSTRAINT packaging_requests_status_check
    CHECK (status IN ('sent_to_branch', 'received_at_branch', 'processing', 'completed', 'cancelled'));
