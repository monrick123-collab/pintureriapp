-- =====================================================
-- FIX: Cambiar políticas RLS de 'authenticated' a 'anon'
-- para las tablas creadas en migration_new_features.sql
--
-- El app usa autenticación personalizada (localStorage),
-- no Supabase Auth. Todas las queries llegan como rol 'anon'.
-- =====================================================

-- wholesale_promotions
DROP POLICY IF EXISTS "Enable All for Auth wholesale_promotions" ON public.wholesale_promotions;
CREATE POLICY "Enable All for Anon wholesale_promotions" ON public.wholesale_promotions
FOR ALL TO anon USING (true) WITH CHECK (true);

-- promotion_requests
DROP POLICY IF EXISTS "Enable All for Auth promotion_requests" ON public.promotion_requests;
CREATE POLICY "Enable All for Anon promotion_requests" ON public.promotion_requests
FOR ALL TO anon USING (true) WITH CHECK (true);

-- shipping_orders
DROP POLICY IF EXISTS "Enable All for Auth shipping_orders" ON public.shipping_orders;
CREATE POLICY "Enable All for Anon shipping_orders" ON public.shipping_orders
FOR ALL TO anon USING (true) WITH CHECK (true);

-- shipping_tracking_history
DROP POLICY IF EXISTS "Enable All for Auth shipping_tracking_history" ON public.shipping_tracking_history;
CREATE POLICY "Enable All for Anon shipping_tracking_history" ON public.shipping_tracking_history
FOR ALL TO anon USING (true) WITH CHECK (true);

-- restock_incidents
DROP POLICY IF EXISTS "Enable All for Auth restock_incidents" ON public.restock_incidents;
CREATE POLICY "Enable All for Anon restock_incidents" ON public.restock_incidents
FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- GRANT EXECUTE para funciones RPC nuevas
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_applicable_promotion(INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION public.create_promotion_request(UUID, TEXT, INTEGER, DECIMAL, DECIMAL, DECIMAL, TEXT, UUID, TEXT, TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.approve_promotion_request(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reject_promotion_request(UUID, TEXT, TEXT) TO anon;

GRANT EXECUTE ON FUNCTION public.create_shipping_order(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_shipping_status(UUID, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_shipping_by_entity(TEXT, UUID) TO anon;

GRANT EXECUTE ON FUNCTION public.confirm_restock_with_differences(UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_restock_incident(UUID, TEXT, DECIMAL, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_pending_restock_incidents() TO anon;
