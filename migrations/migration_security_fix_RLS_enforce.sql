-- SECURITY FIX: ENFORCE RLS ON VULNERABLE TABLES
-- This script ensures RLS is enabled on all tables reported by Supabase Security Linter.
-- It also re-applies policies to ensure they are correctly set for authenticated users.

-- 1. Client Marketing Spend
ALTER TABLE IF EXISTS public.client_marketing_spend ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_marketing_spend TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_marketing_spend;
CREATE POLICY "Enable All for Auth" ON public.client_marketing_spend FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Client Payments
ALTER TABLE IF EXISTS public.client_payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_payments TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_payments;
CREATE POLICY "Enable All for Auth" ON public.client_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Internal Consumption
ALTER TABLE IF EXISTS public.internal_consumption ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.internal_consumption TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_consumption;
CREATE POLICY "Enable All for Auth" ON public.internal_consumption FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Internal Supplies
ALTER TABLE IF EXISTS public.internal_supplies ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.internal_supplies TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_supplies;
CREATE POLICY "Enable All for Auth" ON public.internal_supplies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Packaging Requests
ALTER TABLE IF EXISTS public.packaging_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.packaging_requests TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.packaging_requests;
CREATE POLICY "Enable All for Auth" ON public.packaging_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Price Requests
ALTER TABLE IF EXISTS public.price_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.price_requests TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.price_requests;
CREATE POLICY "Enable All for Auth" ON public.price_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Quotations
ALTER TABLE IF EXISTS public.quotations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.quotations TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.quotations;
CREATE POLICY "Enable All for Auth" ON public.quotations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Restock Requests
ALTER TABLE IF EXISTS public.restock_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.restock_requests TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_requests;
CREATE POLICY "Enable All for Auth" ON public.restock_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Restock Sheets
ALTER TABLE IF EXISTS public.restock_sheets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.restock_sheets TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_sheets;
CREATE POLICY "Enable All for Auth" ON public.restock_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Returns
ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.returns TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.returns;
CREATE POLICY "Enable All for Auth" ON public.returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. Supply Order Items
ALTER TABLE IF EXISTS public.supply_order_items ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.supply_order_items TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_order_items;
CREATE POLICY "Enable All for Auth" ON public.supply_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. Supply Orders
ALTER TABLE IF EXISTS public.supply_orders ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.supply_orders TO authenticated;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_orders;
CREATE POLICY "Enable All for Auth" ON public.supply_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Additional checks for recent tables not in report but potentially vulnerable
ALTER TABLE IF EXISTS public.restock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_items;
CREATE POLICY "Enable All for Auth" ON public.restock_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.coin_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.coin_change_requests;
CREATE POLICY "Enable All for Auth" ON public.coin_change_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfers;
CREATE POLICY "Enable All for Auth" ON public.stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfer_items;
CREATE POLICY "Enable All for Auth" ON public.stock_transfer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
