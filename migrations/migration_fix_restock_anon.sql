-- FIX: Permitir operaciones en Resurtidos (restock_sheets, restock_items, branch_folios)
-- para el rol 'anon' ya que la app usa autenticación propia (no Supabase Auth).

-- 1. Hoja de Resurtido
ALTER TABLE IF EXISTS public.restock_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_sheets;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_sheets;
CREATE POLICY "Enable All for Anon" ON public.restock_sheets FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Items de Resurtido
ALTER TABLE IF EXISTS public.restock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_items;
CREATE POLICY "Enable All for Anon" ON public.restock_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. Folios por Sucursal (necesario para get_next_folio RPC)
ALTER TABLE IF EXISTS public.branch_folios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.branch_folios;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.branch_folios;
CREATE POLICY "Enable All for Anon" ON public.branch_folios FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. Asegurarse de que la función get_next_folio puede ejecutarse como anon
GRANT EXECUTE ON FUNCTION public.get_next_folio(TEXT, TEXT) TO anon;
