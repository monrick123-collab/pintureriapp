-- =============================================================================
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- Script INDEPENDIENTE — solo arregla notificaciones (sin dependencias de packaging)
--
-- Problema: El script anterior mezclaba notificaciones + packaging.
-- Si packaging fallaba, toda la transacción se revertía y las notificaciones
-- quedaban sin permisos para el rol anon.
-- =============================================================================


-- 1. Crear tabla si no existe (cubre el caso de que la migración original nunca se corrió)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    target_role TEXT,
    target_branch_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);


-- 2. Agregar columna target_branch_id si falta (por si la tabla ya existía sin ella)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS target_branch_id TEXT;


-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_target_branch ON public.notifications(target_branch_id);


-- 4. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- 5. Borrar TODAS las políticas existentes (sin importar el nombre)
--    Las políticas originales usaban auth.uid() que siempre es NULL para anon
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
    END LOOP;
END $$;


-- 6. Crear política permisiva para anon (la app usa clave anon, no JWT)
CREATE POLICY "Enable All for Anon" ON public.notifications
    FOR ALL TO anon USING (true) WITH CHECK (true);


-- 7. Otorgar permisos de tabla al rol anon
--    SIN ESTO: SELECT devuelve vacío e INSERT falla silenciosamente
GRANT ALL ON public.notifications TO anon;


-- 8. Habilitar Realtime para la suscripción postgres_changes
--    SIN ESTO: NotificationBell.tsx no recibe notificaciones en tiempo real
--    (Si ya está agregada, este comando da un aviso pero NO falla)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'notifications ya está en supabase_realtime, OK';
END $$;


-- 9. Test de verificación
--    Si ves "Test Notificaciones OK" en la campanita de TODOS los perfiles, funciona.
--    Borrar después con: DELETE FROM public.notifications WHERE title = 'Test Notificaciones OK';
INSERT INTO public.notifications (target_role, title, message, action_url, is_read)
VALUES ('ALL', 'Test Notificaciones OK', 'Si ves esto en la campanita, las notificaciones ya funcionan correctamente.', '/', false);


-- =============================================================================
-- VERIFICACIÓN — Ejecutar estas queries para confirmar que todo quedó bien:
-- =============================================================================

-- Debe retornar al menos 1:
SELECT count(*) AS total_notifications FROM public.notifications;

-- Debe mostrar "Enable All for Anon" con roles {anon}:
SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'notifications';

-- Debe incluir "notifications":
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';
