-- =====================================================================
-- MIGRACIÓN: Reparar tabla returns - agregar columnas faltantes
-- =====================================================================

-- 1. Columnas faltantes en la tabla returns
ALTER TABLE public.returns
    ADD COLUMN IF NOT EXISTS folio           INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS transported_by  TEXT,
    ADD COLUMN IF NOT EXISTS received_by     TEXT;

-- 2. Asegurar que TODAS las sucursales tienen registro en branch_folios
INSERT INTO public.branch_folios (branch_id)
SELECT id FROM public.branches
ON CONFLICT (branch_id) DO NOTHING;

-- 3. Permisos para que usuarios autenticados puedan llamar la RPC
GRANT EXECUTE ON FUNCTION public.get_next_folio(TEXT, TEXT) TO authenticated;

-- 4. Política de acceso a branch_folios (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'branch_folios'
          AND policyname = 'Enable All for Auth branch_folios'
    ) THEN
        CREATE POLICY "Enable All for Auth branch_folios"
        ON public.branch_folios FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
