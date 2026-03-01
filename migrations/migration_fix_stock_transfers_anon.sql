-- FIX: Permitir operaciones en traspasos (stock_transfers) sin Restricción de Rol 'authenticated'
-- Dado que la app usa un sistema de autenticación propio (no Supabase Auth),
-- las consultas llegan con el rol 'anon'. Las políticas anteriores
-- restringían a 'authenticated', causando el error de RLS.

ALTER TABLE IF EXISTS public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth stock_transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfers;

CREATE POLICY "Enable All for anon stock_transfers" 
ON public.stock_transfers 
FOR ALL USING (true) WITH CHECK (true);


ALTER TABLE IF EXISTS public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth stock_transfer_items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfer_items;

CREATE POLICY "Enable All for anon stock_transfer_items" 
ON public.stock_transfer_items 
FOR ALL USING (true) WITH CHECK (true);
