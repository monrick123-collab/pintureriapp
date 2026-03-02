-- FIX: Permitir operaciones en cambio de moneda (coin_change_requests) sin Restricción de Rol 'authenticated'
-- Dado que la app usa un sistema de autenticación propio (no Supabase Auth),
-- las consultas llegan con el rol 'anon'. Las políticas anteriores
-- restringían a 'authenticated', causando fallos silenciosos.

ALTER TABLE IF EXISTS public.coin_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth coin_change_requests" ON public.coin_change_requests;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.coin_change_requests;

CREATE POLICY "Enable All for anon coin_change_requests" 
ON public.coin_change_requests 
FOR ALL USING (true) WITH CHECK (true);
