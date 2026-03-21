-- MIGRACIÓN v3: TRUEQUE BIPARTITO — RESERVA DE STOCK + ESTADO IN_TRANSIT + SUGERENCIAS
-- Ejecutar en Supabase SQL Editor

-- =========================================================================
-- 1. Agregar estado in_transit al constraint de barter_transfers
-- =========================================================================
ALTER TABLE public.barter_transfers
DROP CONSTRAINT IF EXISTS barter_transfers_status_check;

ALTER TABLE public.barter_transfers
ADD CONSTRAINT barter_transfers_status_check
CHECK (status IN (
  'pending_offer', 'pending_selection', 'pending_approval',
  'approved', 'in_transit', 'completed', 'rejected', 'cancelled', 'counter_proposed'
));

-- =========================================================================
-- 2. Columnas de tracking de envío en barter_transfers
-- =========================================================================
ALTER TABLE public.barter_transfers
ADD COLUMN IF NOT EXISTS dispatched_by TEXT,
ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS received_by TEXT,
ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;

-- =========================================================================
-- 3. Tabla barter_inventory_holds (reservas de stock durante el proceso)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.barter_inventory_holds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barter_id UUID REFERENCES public.barter_transfers(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.barter_inventory_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable All for Anon barter_inventory_holds" ON public.barter_inventory_holds;
CREATE POLICY "Enable All for Anon barter_inventory_holds"
  ON public.barter_inventory_holds FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_inventory_holds TO anon;

CREATE INDEX IF NOT EXISTS idx_barter_holds_barter ON public.barter_inventory_holds(barter_id);
CREATE INDEX IF NOT EXISTS idx_barter_holds_branch_product ON public.barter_inventory_holds(branch_id, product_id);

-- =========================================================================
-- 4. Corregir RLS de tablas existentes (bug: usaban authenticated en vez de anon)
-- =========================================================================

-- barter_transfers
DROP POLICY IF EXISTS "Enable All for Auth barter_transfers" ON public.barter_transfers;
DROP POLICY IF EXISTS "Enable All for Anon barter_transfers" ON public.barter_transfers;
CREATE POLICY "Enable All for Anon barter_transfers"
  ON public.barter_transfers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_transfers TO anon;

-- barter_given_items
DROP POLICY IF EXISTS "Enable All for Auth barter_given_items" ON public.barter_given_items;
DROP POLICY IF EXISTS "Enable All for Anon barter_given_items" ON public.barter_given_items;
CREATE POLICY "Enable All for Anon barter_given_items"
  ON public.barter_given_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_given_items TO anon;

-- barter_received_items
DROP POLICY IF EXISTS "Enable All for Auth barter_received_items" ON public.barter_received_items;
DROP POLICY IF EXISTS "Enable All for Anon barter_received_items" ON public.barter_received_items;
CREATE POLICY "Enable All for Anon barter_received_items"
  ON public.barter_received_items FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_received_items TO anon;

-- barter_selections
DROP POLICY IF EXISTS "Enable All for Auth barter_selections" ON public.barter_selections;
DROP POLICY IF EXISTS "Enable All for Anon barter_selections" ON public.barter_selections;
CREATE POLICY "Enable All for Anon barter_selections"
  ON public.barter_selections FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_selections TO anon;

-- barter_counter_offers
DROP POLICY IF EXISTS "Enable All for Auth barter_counter_offers" ON public.barter_counter_offers;
DROP POLICY IF EXISTS "Enable All for Anon barter_counter_offers" ON public.barter_counter_offers;
CREATE POLICY "Enable All for Anon barter_counter_offers"
  ON public.barter_counter_offers FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.barter_counter_offers TO anon;

-- =========================================================================
-- 5. RPC: reserve_barter_inventory — crea holds al aprobar
-- =========================================================================
CREATE OR REPLACE FUNCTION public.reserve_barter_inventory(p_barter_id UUID)
RETURNS VOID AS $$
DECLARE
  v_from TEXT;
  v_to TEXT;
BEGIN
  SELECT from_branch_id, to_branch_id INTO v_from, v_to
  FROM public.barter_transfers
  WHERE id = p_barter_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trueque no está aprobado o no existe';
  END IF;

  -- Reservar ítems que sucursal origen va a enviar (given_items)
  INSERT INTO public.barter_inventory_holds (barter_id, branch_id, product_id, quantity)
  SELECT p_barter_id, v_from, product_id, quantity
  FROM public.barter_given_items
  WHERE barter_id = p_barter_id;

  -- Reservar ítems que sucursal destino va a enviar (selections o received_items)
  IF EXISTS (SELECT 1 FROM public.barter_selections WHERE barter_id = p_barter_id) THEN
    INSERT INTO public.barter_inventory_holds (barter_id, branch_id, product_id, quantity)
    SELECT p_barter_id, v_to, product_id, quantity
    FROM public.barter_selections
    WHERE barter_id = p_barter_id;
  ELSE
    INSERT INTO public.barter_inventory_holds (barter_id, branch_id, product_id, quantity)
    SELECT p_barter_id, v_to, product_id, quantity
    FROM public.barter_received_items
    WHERE barter_id = p_barter_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.reserve_barter_inventory TO anon;

-- =========================================================================
-- 6. RPC: confirm_barter_dispatch — approved → in_transit
-- =========================================================================
CREATE OR REPLACE FUNCTION public.confirm_barter_dispatch(
  p_barter_id UUID,
  p_dispatched_by TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.barter_transfers
  SET
    status = 'in_transit',
    dispatched_by = p_dispatched_by,
    dispatched_at = NOW(),
    updated_at = NOW()
  WHERE id = p_barter_id AND status = 'approved';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trueque no está en estado aprobado o no existe';
  END IF;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.confirm_barter_dispatch TO anon;

-- =========================================================================
-- 7. RPC: release_barter_holds — libera reservas al cancelar/rechazar
-- =========================================================================
CREATE OR REPLACE FUNCTION public.release_barter_holds(p_barter_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM public.barter_inventory_holds WHERE barter_id = p_barter_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.release_barter_holds TO anon;

-- =========================================================================
-- 8. RPC: process_barter_transfer_bidirectional — actualizado para in_transit
--    Consume holds, mueve stock, marca completed
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_barter_transfer_bidirectional(p_barter_id UUID)
RETURNS VOID AS $$
DECLARE
  v_from_branch_id TEXT;
  v_to_branch_id TEXT;
BEGIN
  -- Verificar que está en tránsito (ya no en approved como antes)
  SELECT from_branch_id, to_branch_id INTO v_from_branch_id, v_to_branch_id
  FROM public.barter_transfers
  WHERE id = p_barter_id AND status = 'in_transit';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trueque no está en tránsito o no existe';
  END IF;

  -- Reducir stock según holds (atómico: si falta stock hace rollback automático)
  UPDATE public.inventory inv
  SET stock = inv.stock - h.quantity
  FROM public.barter_inventory_holds h
  WHERE h.barter_id = p_barter_id
    AND inv.product_id = h.product_id
    AND inv.branch_id = h.branch_id;

  -- Agregar stock de given_items a sucursal destino
  INSERT INTO public.inventory (product_id, branch_id, stock)
  SELECT product_id, v_to_branch_id, quantity
  FROM public.barter_given_items
  WHERE barter_id = p_barter_id
  ON CONFLICT (product_id, branch_id)
  DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;

  -- Agregar stock de selections/received_items a sucursal origen
  IF EXISTS (SELECT 1 FROM public.barter_selections WHERE barter_id = p_barter_id) THEN
    INSERT INTO public.inventory (product_id, branch_id, stock)
    SELECT product_id, v_from_branch_id, quantity
    FROM public.barter_selections
    WHERE barter_id = p_barter_id
    ON CONFLICT (product_id, branch_id)
    DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;
  ELSE
    INSERT INTO public.inventory (product_id, branch_id, stock)
    SELECT product_id, v_from_branch_id, quantity
    FROM public.barter_received_items
    WHERE barter_id = p_barter_id
    ON CONFLICT (product_id, branch_id)
    DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;
  END IF;

  -- Liberar holds
  DELETE FROM public.barter_inventory_holds WHERE barter_id = p_barter_id;

  -- Marcar como completado
  UPDATE public.barter_transfers
  SET status = 'completed', received_at = NOW(), updated_at = NOW()
  WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.process_barter_transfer_bidirectional TO anon;

-- =========================================================================
-- 9. RPC: suggest_barter_items — sugerencias inteligentes basadas en excedentes
-- =========================================================================
CREATE OR REPLACE FUNCTION public.suggest_barter_items(
  p_from_branch_id TEXT,
  p_to_branch_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  product_sku TEXT,
  from_branch_stock INT,
  to_branch_stock INT,
  surplus INT,
  deficit INT,
  suggestion_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    COALESCE(from_inv.stock, 0)::INT AS from_branch_stock,
    COALESCE(to_inv.stock, 0)::INT AS to_branch_stock,
    GREATEST(0, COALESCE(from_inv.stock, 0) - COALESCE(p.max_stock, 10))::INT AS surplus,
    GREATEST(0, COALESCE(p.min_stock, 2) - COALESCE(to_inv.stock, 0))::INT AS deficit,
    (
      GREATEST(0, COALESCE(from_inv.stock, 0) - COALESCE(p.max_stock, 10)) +
      GREATEST(0, COALESCE(p.min_stock, 2) - COALESCE(to_inv.stock, 0))
    )::NUMERIC AS suggestion_score
  FROM public.products p
  LEFT JOIN public.inventory from_inv
    ON from_inv.product_id = p.id AND from_inv.branch_id = p_from_branch_id
  LEFT JOIN public.inventory to_inv
    ON to_inv.product_id = p.id AND to_inv.branch_id = p_to_branch_id
  WHERE
    COALESCE(from_inv.stock, 0) > COALESCE(p.max_stock, 10)
    AND COALESCE(to_inv.stock, 0) < COALESCE(p.min_stock, 2)
  ORDER BY suggestion_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
GRANT EXECUTE ON FUNCTION public.suggest_barter_items TO anon;
