-- =====================================================================
-- MIGRACIÓN: Fix completo para devoluciones
-- =====================================================================
-- 1. Asegurar que el estado 'closed' está en el constraint de returns
-- 2. Agregar columna destination_branch_id si no existe
-- 3. GRANT EXECUTE a process_return para rol anon (faltaba en todas las migraciones)
-- =====================================================================

-- 1. Actualizar constraint de status para incluir 'closed'
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns
    ADD CONSTRAINT returns_status_check
    CHECK (status IN (
        'pending_authorization',
        'approved',
        'rejected',
        'received_at_warehouse',
        'closed'
    ));

-- 2. Agregar columna destination_branch_id si no existe (usada por process_return)
ALTER TABLE public.returns
    ADD COLUMN IF NOT EXISTS destination_branch_id TEXT,
    ADD COLUMN IF NOT EXISTS authorized_by TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. GRANT EXECUTE a process_return para anon (faltaba en todas las migraciones)
GRANT EXECUTE ON FUNCTION public.process_return(UUID, TEXT, TEXT) TO anon;

-- 4. Re-confirmar política anon en returns (idempotente)
ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.returns;
CREATE POLICY "Enable All for Anon" ON public.returns FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.returns TO anon;
