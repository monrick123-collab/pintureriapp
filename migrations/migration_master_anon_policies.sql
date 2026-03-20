-- ============================================================
-- MIGRACIÓN MAESTRA: Políticas RLS para rol 'anon' en TODAS las tablas
-- ============================================================
-- La app NO usa Supabase Auth / JWT. Todas las consultas llegan
-- con el rol 'anon'. Sin esta política:
--   - SELECT devuelve vacío (historial vacío)
--   - INSERT/UPDATE/DELETE fallan silenciosamente o con error RLS
--
-- EJECUTAR ESTE ARCHIVO EN SUPABASE SQL EDITOR UNA SOLA VEZ.
-- Es idempotente: usa DROP IF EXISTS antes de cada CREATE.
-- ============================================================

-- 1. PRODUCTOS
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.products;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.products;
CREATE POLICY "Enable All for Anon" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.products TO anon;

-- 2. INVENTARIO
ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.inventory;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.inventory;
CREATE POLICY "Enable All for Anon" ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.inventory TO anon;

-- 3. SUCURSALES
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.branches;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.branches;
CREATE POLICY "Enable All for Anon" ON public.branches FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.branches TO anon;

-- 4. PERFILES DE USUARIO
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.profiles;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.profiles;
CREATE POLICY "Enable All for Anon" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.profiles TO anon;

-- 5. VENTAS
ALTER TABLE IF EXISTS public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.sales;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.sales;
CREATE POLICY "Enable All for Anon" ON public.sales FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.sales TO anon;

ALTER TABLE IF EXISTS public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.sale_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.sale_items;
CREATE POLICY "Enable All for Anon" ON public.sale_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.sale_items TO anon;

-- 6. DEVOLUCIONES
ALTER TABLE IF EXISTS public.returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.returns;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.returns;
CREATE POLICY "Enable All for Anon" ON public.returns FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.returns TO anon;

-- 7. RESURTIDOS (hojas, items, solicitudes, folios, incidencias)
ALTER TABLE IF EXISTS public.restock_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_requests;
CREATE POLICY "Enable All for Anon" ON public.restock_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_requests TO anon;

ALTER TABLE IF EXISTS public.restock_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_sheets;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_sheets;
CREATE POLICY "Enable All for Anon" ON public.restock_sheets FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_sheets TO anon;

ALTER TABLE IF EXISTS public.restock_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_items;
CREATE POLICY "Enable All for Anon" ON public.restock_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_items TO anon;

ALTER TABLE IF EXISTS public.restock_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.restock_incidents;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.restock_incidents;
CREATE POLICY "Enable All for Anon" ON public.restock_incidents FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.restock_incidents TO anon;

ALTER TABLE IF EXISTS public.branch_folios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.branch_folios;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.branch_folios;
CREATE POLICY "Enable All for Anon" ON public.branch_folios FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.branch_folios TO anon;

-- 8. TRASPASOS
ALTER TABLE IF EXISTS public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfers;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.stock_transfers;
CREATE POLICY "Enable All for Anon" ON public.stock_transfers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.stock_transfers TO anon;

ALTER TABLE IF EXISTS public.stock_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.stock_transfer_items;
CREATE POLICY "Enable All for Anon" ON public.stock_transfer_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.stock_transfer_items TO anon;

-- 9. TRUEQUE (5 tablas)
ALTER TABLE IF EXISTS public.barter_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.barter_transfers;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_transfers;
CREATE POLICY "Enable All for Anon" ON public.barter_transfers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_transfers TO anon;

ALTER TABLE IF EXISTS public.barter_given_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.barter_given_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_given_items;
CREATE POLICY "Enable All for Anon" ON public.barter_given_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_given_items TO anon;

ALTER TABLE IF EXISTS public.barter_received_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.barter_received_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_received_items;
CREATE POLICY "Enable All for Anon" ON public.barter_received_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_received_items TO anon;

ALTER TABLE IF EXISTS public.barter_selections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.barter_selections;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_selections;
CREATE POLICY "Enable All for Anon" ON public.barter_selections FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_selections TO anon;

ALTER TABLE IF EXISTS public.barter_counter_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.barter_counter_offers;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.barter_counter_offers;
CREATE POLICY "Enable All for Anon" ON public.barter_counter_offers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_counter_offers TO anon;

-- 10. CAMBIO DE MONEDA
ALTER TABLE IF EXISTS public.coin_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.coin_change_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.coin_change_requests;
CREATE POLICY "Enable All for Anon" ON public.coin_change_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.coin_change_requests TO anon;

-- 11. CORTE DE CAJA
ALTER TABLE IF EXISTS public.cash_cuts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.cash_cuts;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.cash_cuts;
CREATE POLICY "Enable All for Anon" ON public.cash_cuts FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.cash_cuts TO anon;

-- 12. ENVASADO / TINTORERÍA
ALTER TABLE IF EXISTS public.packaging_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.packaging_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_requests;
CREATE POLICY "Enable All for Anon" ON public.packaging_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_requests TO anon;

-- 13. SUMINISTROS INTERNOS
ALTER TABLE IF EXISTS public.internal_supplies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_supplies;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.internal_supplies;
CREATE POLICY "Enable All for Anon" ON public.internal_supplies FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.internal_supplies TO anon;

ALTER TABLE IF EXISTS public.supply_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_orders;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supply_orders;
CREATE POLICY "Enable All for Anon" ON public.supply_orders FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supply_orders TO anon;

ALTER TABLE IF EXISTS public.supply_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supply_order_items;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supply_order_items;
CREATE POLICY "Enable All for Anon" ON public.supply_order_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supply_order_items TO anon;

ALTER TABLE IF EXISTS public.internal_consumption ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_consumption;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.internal_consumption;
CREATE POLICY "Enable All for Anon" ON public.internal_consumption FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.internal_consumption TO anon;

-- 14. COTIZACIONES
ALTER TABLE IF EXISTS public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.quotations;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.quotations;
CREATE POLICY "Enable All for Anon" ON public.quotations FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.quotations TO anon;

-- 15. CLIENTES Y COBRANZA
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.clients;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.clients;
CREATE POLICY "Enable All for Anon" ON public.clients FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.clients TO anon;

ALTER TABLE IF EXISTS public.client_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_payments;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.client_payments;
CREATE POLICY "Enable All for Anon" ON public.client_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.client_payments TO anon;

ALTER TABLE IF EXISTS public.client_marketing_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.client_marketing_spend;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.client_marketing_spend;
CREATE POLICY "Enable All for Anon" ON public.client_marketing_spend FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.client_marketing_spend TO anon;

-- 16. DESCUENTOS Y PROMOCIONES
ALTER TABLE IF EXISTS public.discount_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.discount_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.discount_requests;
CREATE POLICY "Enable All for Anon" ON public.discount_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.discount_requests TO anon;

ALTER TABLE IF EXISTS public.wholesale_promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.wholesale_promotions;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.wholesale_promotions;
DROP POLICY IF EXISTS "Enable All for Anon wholesale_promotions" ON public.wholesale_promotions;
CREATE POLICY "Enable All for Anon" ON public.wholesale_promotions FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.wholesale_promotions TO anon;

ALTER TABLE IF EXISTS public.promotion_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.promotion_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.promotion_requests;
DROP POLICY IF EXISTS "Enable All for Anon promotion_requests" ON public.promotion_requests;
CREATE POLICY "Enable All for Anon" ON public.promotion_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.promotion_requests TO anon;

-- 17. ENVÍOS
ALTER TABLE IF EXISTS public.shipping_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.shipping_orders;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.shipping_orders;
DROP POLICY IF EXISTS "Enable All for Anon shipping_orders" ON public.shipping_orders;
CREATE POLICY "Enable All for Anon" ON public.shipping_orders FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.shipping_orders TO anon;

ALTER TABLE IF EXISTS public.shipping_tracking_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.shipping_tracking_history;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.shipping_tracking_history;
DROP POLICY IF EXISTS "Enable All for Anon shipping_tracking_history" ON public.shipping_tracking_history;
CREATE POLICY "Enable All for Anon" ON public.shipping_tracking_history FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.shipping_tracking_history TO anon;

-- 18. NOTIFICACIONES
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.notifications;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.notifications;
CREATE POLICY "Enable All for Anon" ON public.notifications FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.notifications TO anon;

-- 19. FINANZAS (proveedores, facturas, pagos, arrendamientos, gastos)
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.suppliers;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.suppliers;
CREATE POLICY "Enable All for Anon" ON public.suppliers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.suppliers TO anon;

ALTER TABLE IF EXISTS public.supplier_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supplier_invoices;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supplier_invoices;
CREATE POLICY "Enable All for Anon" ON public.supplier_invoices FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supplier_invoices TO anon;

ALTER TABLE IF EXISTS public.supplier_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.supplier_payments;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.supplier_payments;
CREATE POLICY "Enable All for Anon" ON public.supplier_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.supplier_payments TO anon;

ALTER TABLE IF EXISTS public.leases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.leases;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.leases;
CREATE POLICY "Enable All for Anon" ON public.leases FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.leases TO anon;

ALTER TABLE IF EXISTS public.lease_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.lease_payments;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.lease_payments;
CREATE POLICY "Enable All for Anon" ON public.lease_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.lease_payments TO anon;

ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.expenses;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.expenses;
CREATE POLICY "Enable All for Anon" ON public.expenses FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.expenses TO anon;

-- 20. VENTAS MUNICIPALES
ALTER TABLE IF EXISTS public.municipal_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.municipal_accounts;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.municipal_accounts;
CREATE POLICY "Enable All for Anon" ON public.municipal_accounts FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.municipal_accounts TO anon;

ALTER TABLE IF EXISTS public.municipal_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.municipal_payments;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.municipal_payments;
CREATE POLICY "Enable All for Anon" ON public.municipal_payments FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.municipal_payments TO anon;

-- 21. SOLICITUDES DE PRECIO
ALTER TABLE IF EXISTS public.price_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.price_requests;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.price_requests;
CREATE POLICY "Enable All for Anon" ON public.price_requests FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.price_requests TO anon;

-- 22. AUDITORÍA
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.audit_logs;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.audit_logs;
CREATE POLICY "Enable All for Anon" ON public.audit_logs FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.audit_logs TO anon;

-- ============================================================
-- GRANT EXECUTE en todas las RPCs críticas para el rol anon
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_next_folio(TEXT, TEXT) TO anon;

-- Ventas
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.process_sale TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Devoluciones
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.process_return TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Resurtidos
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.confirm_restock_arrival TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.confirm_restock_with_differences TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.resolve_restock_incident TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.get_pending_restock_incidents TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Traspasos
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.confirm_transfer_receipt TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Envasado
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.complete_packaging TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.process_internal_consumption TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Corte de caja
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.get_daily_cash_cut_data TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Trueque
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.process_barter_transfer_bidirectional TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Envíos
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.create_shipping_order TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.update_shipping_status TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.get_shipping_by_entity TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Promociones
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.get_applicable_promotion TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.create_promotion_request TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.approve_promotion_request TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN
  GRANT EXECUTE ON FUNCTION public.reject_promotion_request TO anon;
EXCEPTION WHEN undefined_function THEN NULL; END $$;
