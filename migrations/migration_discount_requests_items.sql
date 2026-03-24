-- =====================================================
-- Agregar persistencia de carrito a discount_requests
--
-- Problema: Cuando un cajero solicita un descuento y navega a otra
-- pantalla, el carrito se pierde porque es solo estado React en memoria.
-- Cuando el admin aprueba, el cajero tiene que reconstruir toda la venta.
--
-- Solución: Agregar columna items JSONB (mismo patrón que promotion_requests)
-- y status 'used' para marcar solicitudes ya consumidas en una venta.
-- =====================================================

-- 1. Agregar columna items JSONB para persistir el carrito
ALTER TABLE public.discount_requests ADD COLUMN IF NOT EXISTS items JSONB;

-- 2. Ampliar el CHECK constraint para incluir estado 'used'
ALTER TABLE public.discount_requests DROP CONSTRAINT IF EXISTS discount_requests_status_check;
ALTER TABLE public.discount_requests ADD CONSTRAINT discount_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'used'));
