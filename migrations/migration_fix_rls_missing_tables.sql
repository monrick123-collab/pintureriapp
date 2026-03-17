-- MIGRACIÓN: Habilitar RLS en tablas con políticas definidas pero RLS desactivado
-- Tablas identificadas en análisis de vulnerabilidades (vulnerabilidades_supabase.json)
-- IMPORTANTE: Se reemplaza la política "Enable All for Auth" por "Enable All for Anon"
--             ya que la app usa el cliente con la anon key (sin Supabase Auth).

-- ============================================================
-- client_marketing_spend
-- ============================================================
ALTER TABLE IF EXISTS public.client_marketing_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_marketing_spend;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.client_marketing_spend;
CREATE POLICY "Enable All for Anon" ON public.client_marketing_spend
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- client_payments
-- ============================================================
ALTER TABLE IF EXISTS public.client_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_payments;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.client_payments;
CREATE POLICY "Enable All for Anon" ON public.client_payments
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- internal_consumption
-- ============================================================
ALTER TABLE IF EXISTS public.internal_consumption ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_consumption;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.internal_consumption;
CREATE POLICY "Enable All for Anon" ON public.internal_consumption
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- internal_supplies
-- ============================================================
ALTER TABLE IF EXISTS public.internal_supplies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_supplies;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.internal_supplies;
CREATE POLICY "Enable All for Anon" ON public.internal_supplies
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- packaging_requests
-- ============================================================
ALTER TABLE IF EXISTS public.packaging_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.packaging_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_requests;
CREATE POLICY "Enable All for Anon" ON public.packaging_requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- price_requests
-- ============================================================
ALTER TABLE IF EXISTS public.price_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.price_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.price_requests;
CREATE POLICY "Enable All for Anon" ON public.price_requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- quotations
-- ============================================================
ALTER TABLE IF EXISTS public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.quotations;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.quotations;
CREATE POLICY "Enable All for Anon" ON public.quotations
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- restock_requests
-- ============================================================
ALTER TABLE IF EXISTS public.restock_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_requests;
CREATE POLICY "Enable All for Anon" ON public.restock_requests
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- restock_sheets
-- ============================================================
ALTER TABLE IF EXISTS public.restock_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_sheets;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_sheets;
CREATE POLICY "Enable All for Anon" ON public.restock_sheets
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- returns
-- ============================================================
ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.returns;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.returns;
CREATE POLICY "Enable All for Anon" ON public.returns
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- supply_order_items
-- ============================================================
ALTER TABLE IF EXISTS public.supply_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_order_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supply_order_items;
CREATE POLICY "Enable All for Anon" ON public.supply_order_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- supply_orders
-- ============================================================
ALTER TABLE IF EXISTS public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_orders;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supply_orders;
CREATE POLICY "Enable All for Anon" ON public.supply_orders
  FOR ALL TO anon USING (true) WITH CHECK (true);
