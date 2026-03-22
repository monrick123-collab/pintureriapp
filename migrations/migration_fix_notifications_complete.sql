-- =============================================================================
-- MIGRACIÓN COMPLETA: Fix notificaciones (RLS + columna branch + test)
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- 1. Habilitar RLS
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar TODAS las políticas existentes (auth.uid() no funciona con clave anon)
DROP POLICY IF EXISTS "Users can view own or role notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.notifications;

-- 3. Crear política única para anon (la app no usa Supabase Auth / JWT)
CREATE POLICY "Enable All for Anon" ON public.notifications
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Garantizar permisos al rol anon
GRANT ALL ON public.notifications TO anon;

-- 5. Agregar columna target_branch_id (para notificaciones por sucursal)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS target_branch_id TEXT;

-- 6. Agregar FK si branches existe (ignorar error si ya existe)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_target_branch_id_fkey
            FOREIGN KEY (target_branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_target_branch
    ON public.notifications(target_branch_id);

-- =============================================================================
-- VERIFICACIÓN: insertar notificación de prueba
-- Si la ves en el campana, el sistema funciona. Después bórrala.
-- =============================================================================
INSERT INTO public.notifications (target_role, title, message, action_url, is_read)
VALUES ('ALL', '✅ Test notificación', 'Si ves esto, las notificaciones funcionan correctamente.', '/', false);

-- Para borrar la de prueba después:
-- DELETE FROM public.notifications WHERE title = '✅ Test notificación';

-- =============================================================================
-- DIAGNÓSTICO: verificar políticas activas (corre esto si quieres confirmar)
-- =============================================================================
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'notifications';
-- SELECT COUNT(*), is_read FROM notifications GROUP BY is_read;
