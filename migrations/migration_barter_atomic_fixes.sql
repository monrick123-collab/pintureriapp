-- MIGRACIÓN: BARTER ATOMIC FIXES
-- Ejecutar en Supabase SQL Editor
--
-- Resuelve dos puntos de no-atomicidad del módulo Trueque:
--   1) confirmBarterReception: received_by se escribía antes del RPC atómico.
--      Ahora process_barter_transfer_bidirectional acepta p_received_by y lo setea
--      dentro de la misma transacción que mueve stock y marca 'completed'.
--   2) cancelBarterTransfer: llamaba 2 RPCs separados (release_barter_holds +
--      cancel_barter_transfer) con estados permitidos incoherentes. Nuevo RPC
--      cancel_barter_transfer_full hace ambas cosas en una sola transacción.
--
-- Backward-compatible: p_received_by tiene DEFAULT NULL; el RPC viejo
-- cancel_barter_transfer se deja intacto para no romper callers desconocidos.

-- =========================================================================
-- 1. process_barter_transfer_bidirectional — ahora acepta p_received_by
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_barter_transfer_bidirectional(
  p_barter_id UUID,
  p_received_by TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_from_branch_id TEXT;
  v_to_branch_id TEXT;
BEGIN
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
    AND inv.branch_id  = h.branch_id;

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

  -- Marcar completado y registrar quién recibió (atómico)
  UPDATE public.barter_transfers
  SET status      = 'completed',
      received_by = COALESCE(p_received_by, received_by),
      received_at = NOW(),
      updated_at  = NOW()
  WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.process_barter_transfer_bidirectional(UUID, TEXT) TO anon;

-- =========================================================================
-- 2. cancel_barter_transfer_full — cancela + libera holds en una transacción
-- =========================================================================
CREATE OR REPLACE FUNCTION public.cancel_barter_transfer_full(
  p_barter_id UUID,
  p_cancelled_by TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Bloquear la fila para evitar carrera con dispatch/reception concurrentes
  SELECT status INTO v_current_status
  FROM public.barter_transfers
  WHERE id = p_barter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trueque no existe';
  END IF;

  IF v_current_status IN ('completed', 'cancelled', 'rejected') THEN
    RAISE EXCEPTION 'Trueque ya está en estado terminal (%): no cancelable', v_current_status;
  END IF;

  -- Liberar holds (idempotente: no falla si no hay holds, estados tempranos)
  DELETE FROM public.barter_inventory_holds WHERE barter_id = p_barter_id;

  UPDATE public.barter_transfers
  SET status     = 'cancelled',
      updated_at = NOW()
  WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.cancel_barter_transfer_full(UUID, TEXT) TO anon;
