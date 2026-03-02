-- FIX: Permitir operaciones en tabla 'sales' y 'sale_items' para rol 'anon'
-- La app usa autenticación propia (localStorage), por lo que las consultas llegan como 'anon'.
-- El flujo de venta mayoreo hace:
--   1. INSERT via RPC process_sale (registra la venta)
--   2. UPDATE a la venta para marcarla como is_wholesale=true, agregar cliente, admin, etc.
-- El paso 2 fallaba silenciosamente por permisos RLS, dejando is_wholesale=NULL.
-- Por eso el historial de mayoreo no mostraba nada (filtra por is_wholesale=true).

-- 1. Tabla de Ventas
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.sales;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.sales;
CREATE POLICY "Enable All for Anon" ON public.sales FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Items de Venta
ALTER TABLE IF EXISTS public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.sale_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.sale_items;
CREATE POLICY "Enable All for Anon" ON public.sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
