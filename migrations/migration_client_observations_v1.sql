-- =============================================================================
-- Migration: client_observations_v1
-- Cubre observaciones del cliente: retorno cierre Admin, suministros estado,
-- moneda mensajero/validación cruzada, cotización sale_id
-- =============================================================================

-- 1. returns: agregar estado 'closed' a la constraint
-- Nota: actualizar constraint si existe (depende del setup actual)
ALTER TABLE public.returns
  DROP CONSTRAINT IF EXISTS returns_status_check;

ALTER TABLE public.returns
  ADD CONSTRAINT returns_status_check
  CHECK (status IN ('pending_authorization','approved','rejected','received_at_warehouse','closed'));

-- 2. internal_supplies: agregar campos status, shipped_at, shipped_by
ALTER TABLE public.internal_supplies
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending','shipped')),
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_by TEXT;

-- 3. coin_change_requests: agregar campos para mensajero y validación cruzada
ALTER TABLE public.coin_change_requests
  ADD COLUMN IF NOT EXISTS collected_by TEXT,
  ADD COLUMN IF NOT EXISTS coins_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coins_confirmed_by TEXT;

-- Actualizar constraint de status en coin_change_requests
ALTER TABLE public.coin_change_requests
  DROP CONSTRAINT IF EXISTS coin_change_requests_status_check;

ALTER TABLE public.coin_change_requests
  ADD CONSTRAINT coin_change_requests_status_check
  CHECK (status IN ('pending','coins_sent','completed','cancelled'));

-- 4. quotations: agregar campo sale_id
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

-- =============================================================================
-- Permisos anon para nuevas columnas (Supabase RLS)
-- =============================================================================

-- Las tablas ya tienen RLS configurado; las nuevas columnas heredan las políticas existentes.
-- No se requieren cambios adicionales de RLS para estas columnas.
