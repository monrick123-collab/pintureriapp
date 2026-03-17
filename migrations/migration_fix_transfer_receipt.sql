-- =====================================================
-- FIX: Implementar confirm_transfer_receipt
-- Esta función era llamada por transferService.ts pero
-- nunca fue creada en ninguna migración.
-- Sin ella los traspasos NO actualizan el inventario.
-- =====================================================

CREATE OR REPLACE FUNCTION public.confirm_transfer_receipt(p_transfer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
  v_transfer RECORD;
BEGIN
  SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Traspaso no encontrado: %', p_transfer_id;
  END IF;

  IF v_transfer.status != 'in_transit' THEN
    RAISE EXCEPTION 'El traspaso debe estar en tránsito para confirmarse (estado actual: %)', v_transfer.status;
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    -- Descontar de la sucursal origen
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (v_item.product_id, v_transfer.from_branch_id, -v_item.quantity, now())
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now();

    -- Agregar a la sucursal destino
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (v_item.product_id, v_transfer.to_branch_id, v_item.quantity, now())
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now();
  END LOOP;

  UPDATE public.stock_transfers
  SET status = 'completed', updated_at = now()
  WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.confirm_transfer_receipt(UUID) TO anon;
