-- =============================================================================
-- FIX DEFINITIVO: NOTIFICACIONES - RLS + COLUMNA target_branch_id
-- Ejecuta este script completo en Supabase SQL Editor
-- =============================================================================

-- 1. Asegurar que la columna target_branch_id exista
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS target_branch_id TEXT;

-- 2. Desactivar RLS existente y limpiar políticas anteriores
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable All for Anon" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own or role notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- 3. Volver a activar RLS con política abierta para rol anon (la app usa anon)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable All for Anon"
    ON public.notifications
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 4. Dar permisos completos a los roles relevantes
GRANT ALL ON public.notifications TO anon;
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 5. Refrescar el caché de PostgREST para que los cambios surtan efecto
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- VERIFICACIÓN: ejecuta estas consultas para confirmar
-- =============================================================================
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'notifications';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position;
