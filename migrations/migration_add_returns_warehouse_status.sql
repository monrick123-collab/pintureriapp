-- FIX: Añadir el estado 'received_at_warehouse' al check constraint de la tabla returns.
-- El constraint original solo permitía: 'pending_authorization', 'approved', 'rejected'
-- Ahora agregamos 'received_at_warehouse' para que bodega pueda confirmar recepción física.

-- 1. Eliminar el constraint anterior
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;

-- 2. Recrearlo incluyendo el nuevo estado
ALTER TABLE public.returns
    ADD CONSTRAINT returns_status_check
    CHECK (status IN ('pending_authorization', 'approved', 'rejected', 'received_at_warehouse'));
