-- MIGRACIÓN: Habilitar el rol "anon" para la tabla returns
-- La tabla returns solo tenía política para "authenticated", pero la app
-- no usa autenticación JWT de Supabase — todas las consultas llegan como "anon".
-- Sin esta política, tanto el INSERT (crear devolución) como el SELECT (ver historial)
-- son bloqueados por RLS para todos los roles (admin, bodega, encargado, vendedor).

ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.returns;
CREATE POLICY "Enable All for Anon" ON public.returns FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON public.returns TO anon;
