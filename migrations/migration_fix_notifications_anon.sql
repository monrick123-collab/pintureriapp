-- MIGRACIÓN DE URGENCIA: Habilitar "anon" para Notificaciones
-- Al no usar Supabase Auth, auth.uid() es nulo y la RLS bloqueaba ver campanas de notificación.

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Eliminar políticas restrictivas previas
DROP POLICY IF EXISTS "Users can view own or role notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;

-- 2. Conceder acceso a anon
DROP POLICY IF EXISTS "Enable All for Anon" ON public.notifications;
CREATE POLICY "Enable All for Anon" ON public.notifications FOR ALL TO anon USING (true) WITH CHECK (true);
