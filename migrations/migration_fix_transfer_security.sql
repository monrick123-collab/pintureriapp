-- ============================================================
-- FIX C2 + S1: Blindar confirm_transfer_receipt
-- C2: Validar stock antes de descontar (evitar error 23514)
-- S1: Validar autorización (auth.uid debe ser de sucursal destino o ADMIN)
-- ============================================================

DROP FUNCTION IF EXISTS public.confirm_transfer_receipt(UUID);

CREATE OR REPLACE FUNCTION public.confirm_transfer_receipt(p_transfer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_transfer RECORD;
  v_user_role TEXT;
  v_user_branch TEXT;
  v_current_stock INT;
  v_product_name TEXT;
BEGIN
  -- S1: Validar autorización
  SELECT role, branch_id INTO v_user_role, v_user_branch
  FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO v_transfer FROM public.stock_transfers WHERE id = p_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Traspaso no encontrado: %', p_transfer_id;
  END IF;

  IF v_transfer.status != 'in_transit' THEN
    RAISE EXCEPTION 'El traspaso debe estar en tránsito para confirmarse (estado actual: %)', v_transfer.status;
  END IF;

  -- Solo ADMIN o el encargado de la sucursal destino pueden confirmar
  IF v_user_role IS NULL OR (v_user_role != 'ADMIN' AND v_user_branch != v_transfer.to_branch_id) THEN
    RAISE EXCEPTION 'No autorizado: solo el encargado de la sucursal destino o un ADMIN pueden confirmar la recepción';
  END IF;

  -- C2: Validar stock suficiente en origen ANTES de descontar
  FOR v_item IN
    SELECT sti.*, p.name as product_name
    FROM public.stock_transfer_items sti
    JOIN public.products p ON p.id = sti.product_id
    WHERE sti.transfer_id = p_transfer_id
  LOOP
    SELECT COALESCE(stock, 0) INTO v_current_stock
    FROM public.inventory
    WHERE product_id = v_item.product_id AND branch_id = v_transfer.from_branch_id;

    IF v_current_stock IS NULL THEN
      v_current_stock := 0;
    END IF;

    IF v_current_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente en origen para "%" (Disponible: %, Solicitado: %)',
        v_item.product_name, v_current_stock, v_item.quantity;
    END IF;
  END LOOP;

  -- Si todo OK, descontar de origen y sumar a destino (UPDATE directo, no UPSERT)
  FOR v_item IN
    SELECT * FROM public.stock_transfer_items WHERE transfer_id = p_transfer_id
  LOOP
    -- Restar de origen
    UPDATE public.inventory
    SET stock = stock - v_item.quantity, updated_at = now()
    WHERE product_id = v_item.product_id AND branch_id = v_transfer.from_branch_id;

    -- Sumar a destino (UPSERT aquí sí es seguro porque suma, no resta)
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (v_item.product_id, v_transfer.to_branch_id, v_item.quantity, now())
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now();
  END LOOP;

  -- Marcar como completado
  UPDATE public.stock_transfers
  SET status = 'completed', updated_at = now()
  WHERE id = p_transfer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_transfer_receipt(UUID) TO anon, authenticated;