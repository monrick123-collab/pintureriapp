-- =====================================================================
-- MIGRACIÓN CORRECTIVA COMPLETA: Políticas anon para todas las tablas
-- =====================================================================
-- La app usa la anon key de Supabase (no JWT auth). Todas las consultas
-- llegan con rol 'anon'. Esta migración es idempotente — se puede ejecutar
-- varias veces sin problemas.
-- Corrige conflicto con migration_security_fix_RLS_enforce.sql que dejó
-- solo políticas 'authenticated' en varias tablas.
-- También agrega GRANT EXECUTE a confirm_restock_arrival que faltaba.
-- =====================================================================

-- 1. RESURTIDO — HOJAS (restock_sheets)
ALTER TABLE IF EXISTS public.restock_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_sheets;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_sheets;
CREATE POLICY "Enable All for Anon" ON public.restock_sheets FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_sheets TO anon;

-- 2. RESURTIDO — ITEMS (restock_items)
ALTER TABLE IF EXISTS public.restock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_items;
CREATE POLICY "Enable All for Anon" ON public.restock_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_items TO anon;

-- 3. RESURTIDO — SOLICITUDES (restock_requests)
ALTER TABLE IF EXISTS public.restock_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_requests;
CREATE POLICY "Enable All for Anon" ON public.restock_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_requests TO anon;

-- 4. RESURTIDO — INCIDENCIAS (restock_incidents)
ALTER TABLE IF EXISTS public.restock_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth restock_incidents" ON public.restock_incidents;
DROP POLICY IF EXISTS "Enable All for Anon restock_incidents" ON public.restock_incidents;
CREATE POLICY "Enable All for Anon" ON public.restock_incidents FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_incidents TO anon;

-- 5. FOLIOS POR SUCURSAL (branch_folios)
ALTER TABLE IF EXISTS public.branch_folios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.branch_folios;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.branch_folios;
CREATE POLICY "Enable All for Anon" ON public.branch_folios FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.branch_folios TO anon;

-- 6. CAMBIO DE MONEDA (coin_change_requests)
ALTER TABLE IF EXISTS public.coin_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.coin_change_requests;
DROP POLICY IF EXISTS "Enable All for Auth coin_change_requests" ON public.coin_change_requests;
DROP POLICY IF EXISTS "Enable All for anon coin_change_requests" ON public.coin_change_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.coin_change_requests;
CREATE POLICY "Enable All for Anon" ON public.coin_change_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.coin_change_requests TO anon;

-- 7. TRASPASOS (stock_transfers)
ALTER TABLE IF EXISTS public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfers;
DROP POLICY IF EXISTS "Enable All for Auth stock_transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "Enable All for anon stock_transfers" ON public.stock_transfers;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.stock_transfers;
CREATE POLICY "Enable All for Anon" ON public.stock_transfers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.stock_transfers TO anon;

-- 8. TRASPASOS — ITEMS (stock_transfer_items)
ALTER TABLE IF EXISTS public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Enable All for Auth stock_transfer_items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Enable All for anon stock_transfer_items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.stock_transfer_items;
CREATE POLICY "Enable All for Anon" ON public.stock_transfer_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.stock_transfer_items TO anon;

-- 9. GASTOS DE MARKETING DE CLIENTES (client_marketing_spend)
ALTER TABLE IF EXISTS public.client_marketing_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_marketing_spend;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.client_marketing_spend;
CREATE POLICY "Enable All for Anon" ON public.client_marketing_spend FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.client_marketing_spend TO anon;

-- 10. PAGOS DE CLIENTES (client_payments)
ALTER TABLE IF EXISTS public.client_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_payments;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.client_payments;
CREATE POLICY "Enable All for Anon" ON public.client_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.client_payments TO anon;

-- 11. CONSUMO INTERNO (internal_consumption)
ALTER TABLE IF EXISTS public.internal_consumption ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_consumption;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.internal_consumption;
CREATE POLICY "Enable All for Anon" ON public.internal_consumption FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.internal_consumption TO anon;

-- 12. INSUMOS INTERNOS (internal_supplies)
ALTER TABLE IF EXISTS public.internal_supplies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_supplies;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.internal_supplies;
CREATE POLICY "Enable All for Anon" ON public.internal_supplies FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.internal_supplies TO anon;

-- 13. SOLICITUDES DE EMPAQUE (packaging_requests)
ALTER TABLE IF EXISTS public.packaging_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.packaging_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_requests;
CREATE POLICY "Enable All for Anon" ON public.packaging_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_requests TO anon;

-- 14. SOLICITUDES DE PRECIO / DESCUENTO (price_requests)
ALTER TABLE IF EXISTS public.price_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.price_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.price_requests;
CREATE POLICY "Enable All for Anon" ON public.price_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.price_requests TO anon;

-- 15. COTIZACIONES (quotations)
ALTER TABLE IF EXISTS public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.quotations;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.quotations;
CREATE POLICY "Enable All for Anon" ON public.quotations FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.quotations TO anon;

-- 16. PEDIDOS DE INSUMOS — ITEMS (supply_order_items)
ALTER TABLE IF EXISTS public.supply_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_order_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supply_order_items;
CREATE POLICY "Enable All for Anon" ON public.supply_order_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supply_order_items TO anon;

-- 17. PEDIDOS DE INSUMOS (supply_orders)
ALTER TABLE IF EXISTS public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_orders;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supply_orders;
CREATE POLICY "Enable All for Anon" ON public.supply_orders FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supply_orders TO anon;

-- =====================================================================
-- GRANTS DE FUNCIONES RPC
-- =====================================================================

-- confirm_restock_arrival: FALTABA en todas las migraciones anteriores
GRANT EXECUTE ON FUNCTION public.confirm_restock_arrival(UUID) TO anon;

-- Re-confirmar grants existentes (idempotente)
GRANT EXECUTE ON FUNCTION public.get_next_folio(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_restock_with_differences(UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_restock_incident(UUID, TEXT, DECIMAL, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_pending_restock_incidents() TO anon;
