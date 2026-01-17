-- COMPREHENSIVE RLS FIX
-- Runs on all operational tables to ensure authenticated users can Read/Write

-- 1. RETURNS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.returns;
DROP POLICY IF EXISTS "Total access returns" ON public.returns;
CREATE POLICY "Enable All for Auth" ON public.returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. QUOTATIONS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.quotations;
DROP POLICY IF EXISTS "Total access quotations" ON public.quotations;
CREATE POLICY "Enable All for Auth" ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. PACKAGING REQUESTS (Envasado)
ALTER TABLE public.packaging_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.packaging_requests;
DROP POLICY IF EXISTS "Total access packaging_requests" ON public.packaging_requests;
CREATE POLICY "Enable All for Auth" ON public.packaging_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. CLIENT PAYMENTS (Cobranza)
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_payments;
DROP POLICY IF EXISTS "Total access client_payments" ON public.client_payments;
CREATE POLICY "Enable All for Auth" ON public.client_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. CLIENT MARKETING SPEND
ALTER TABLE public.client_marketing_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_marketing_spend;
DROP POLICY IF EXISTS "Total access marketing_spend" ON public.client_marketing_spend;
CREATE POLICY "Enable All for Auth" ON public.client_marketing_spend FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. SUPPLY ORDERS (Pedidos a Admin - Nuevo)
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_orders;
CREATE POLICY "Enable All for Auth" ON public.supply_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. SUPPLY ORDER ITEMS
ALTER TABLE public.supply_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_order_items;
CREATE POLICY "Enable All for Auth" ON public.supply_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. PRICE REQUESTS
ALTER TABLE public.price_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.price_requests;
CREATE POLICY "Enable All for Auth" ON public.price_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
