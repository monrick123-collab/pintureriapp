-- MIGRACIÓN: Habilitar el rol "anon" para todas las tablas que quedaron con política "authenticated" únicamente.
-- La app usa la clave anon de Supabase para todas las consultas (no hay JWT de Supabase).
-- Sin política anon, SELECT devuelve vacío y INSERT/UPDATE/DELETE lanzan error RLS silencioso.

-- 1. CORTE DE CAJA
ALTER TABLE IF EXISTS public.cash_cuts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.cash_cuts;
CREATE POLICY "Enable All for Anon" ON public.cash_cuts FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.cash_cuts TO anon;

-- 2. SOLICITUDES DE DESCUENTO
ALTER TABLE IF EXISTS public.discount_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.discount_requests;
CREATE POLICY "Enable All for Anon" ON public.discount_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.discount_requests TO anon;

-- 3. SISTEMA DE TRUEQUE (5 tablas)
ALTER TABLE IF EXISTS public.barter_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_transfers;
CREATE POLICY "Enable All for Anon" ON public.barter_transfers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_transfers TO anon;

ALTER TABLE IF EXISTS public.barter_given_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_given_items;
CREATE POLICY "Enable All for Anon" ON public.barter_given_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_given_items TO anon;

ALTER TABLE IF EXISTS public.barter_received_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_received_items;
CREATE POLICY "Enable All for Anon" ON public.barter_received_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_received_items TO anon;

ALTER TABLE IF EXISTS public.barter_selections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_selections;
CREATE POLICY "Enable All for Anon" ON public.barter_selections FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_selections TO anon;

ALTER TABLE IF EXISTS public.barter_counter_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_counter_offers;
CREATE POLICY "Enable All for Anon" ON public.barter_counter_offers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_counter_offers TO anon;

-- 4. TABLAS DE FINANZAS (preventivo — sin política explícita confirmada)
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.suppliers;
CREATE POLICY "Enable All for Anon" ON public.suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.suppliers TO anon;

ALTER TABLE IF EXISTS public.supplier_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supplier_invoices;
CREATE POLICY "Enable All for Anon" ON public.supplier_invoices FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supplier_invoices TO anon;

ALTER TABLE IF EXISTS public.supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supplier_payments;
CREATE POLICY "Enable All for Anon" ON public.supplier_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supplier_payments TO anon;

ALTER TABLE IF EXISTS public.leases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.leases;
CREATE POLICY "Enable All for Anon" ON public.leases FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.leases TO anon;

ALTER TABLE IF EXISTS public.lease_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.lease_payments;
CREATE POLICY "Enable All for Anon" ON public.lease_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.lease_payments TO anon;

ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.expenses;
CREATE POLICY "Enable All for Anon" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.expenses TO anon;

ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.audit_logs;
CREATE POLICY "Enable All for Anon" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.audit_logs TO anon;
