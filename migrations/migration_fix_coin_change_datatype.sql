-- FIX: Cambiar los tipos de datos de UUID a TEXT en coin_change_requests
-- La aplicación utiliza IDs de sesión simulada (ej. 'ADM-001', 'sub-1') que son cadenas de texto (TEXT).
-- Esta tabla se creó erróneamente con tipo UUID y limitaba la inserción arrojando errores "invalid input syntax for type uuid".

-- 1. Eliminar llaves foráneas que referencian a auth.users(id) (UUID)
ALTER TABLE public.coin_change_requests DROP CONSTRAINT IF EXISTS coin_change_requests_requester_id_fkey;
ALTER TABLE public.coin_change_requests DROP CONSTRAINT IF EXISTS coin_change_requests_receiver_id_fkey;
ALTER TABLE public.coin_change_requests DROP CONSTRAINT IF EXISTS coin_change_requests_collected_by_id_fkey;

-- 2. Cambiar tipo de columnas a TEXT
ALTER TABLE public.coin_change_requests ALTER COLUMN requester_id TYPE TEXT USING requester_id::TEXT;
ALTER TABLE public.coin_change_requests ALTER COLUMN receiver_id TYPE TEXT USING receiver_id::TEXT;
ALTER TABLE public.coin_change_requests ALTER COLUMN collected_by_id TYPE TEXT USING collected_by_id::TEXT;
