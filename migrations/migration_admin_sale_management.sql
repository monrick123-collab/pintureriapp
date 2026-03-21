-- =====================================================
-- MIGRACIÓN: Sistema de Cancelación y Edición de Ventas (Admin)
--
-- Agrega columnas de cancelación a sales y municipal_sales
-- Crea RPCs atómicos para cancelar y editar ventas
-- =====================================================

-- ============================================================
-- 1. COLUMNAS DE CANCELACIÓN
-- ============================================================

-- 1a. Tabla sales (menudeo + mayoreo)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 1b. Tabla municipal_sales
ALTER TABLE public.municipal_sales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.municipal_sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.municipal_sales ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE public.municipal_sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ============================================================
-- 2. RPC: cancel_sale (menudeo + mayoreo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_sale(
  p_sale_id UUID,
  p_reason TEXT,
  p_admin_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_account_id UUID;
BEGIN
  -- 1. Obtener la venta y verificar que no esté ya cancelada
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'La venta ya está cancelada';
  END IF;

  -- 2. Marcar como cancelada
  UPDATE public.sales SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_admin_id,
    cancellation_reason = p_reason
  WHERE id = p_sale_id;

  -- 3. Revertir inventario
  FOR v_item IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE public.inventory
    SET stock = stock + v_item.quantity, updated_at = NOW()
    WHERE product_id = v_item.product_id AND branch_id = v_sale.branch_id;
  END LOOP;

  -- 4. Si es venta a crédito mayoreo, revertir saldo de wholesale_accounts
  IF v_sale.is_wholesale = true AND v_sale.payment_type = 'credito' AND v_sale.client_id IS NOT NULL THEN
    SELECT id INTO v_account_id FROM public.wholesale_accounts
    WHERE client_id = v_sale.client_id AND branch_id = v_sale.branch_id
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      -- Restar del balance
      UPDATE public.wholesale_accounts
      SET balance = GREATEST(balance - v_sale.total, 0), updated_at = NOW()
      WHERE id = v_account_id;

      -- Registrar movimiento de reversa
      INSERT INTO public.wholesale_payments (wholesale_account_id, amount, payment_type, sale_id, notes, registered_by)
      VALUES (v_account_id, v_sale.total, 'abono', p_sale_id, 'Reversa por cancelación: ' || p_reason, p_admin_id);
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. RPC: cancel_municipal_sale
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_municipal_sale(
  p_sale_id UUID,
  p_reason TEXT,
  p_admin_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_account_id UUID;
BEGIN
  -- 1. Obtener la venta
  SELECT * INTO v_sale FROM public.municipal_sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta municipal no encontrada';
  END IF;
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'La venta ya está cancelada';
  END IF;

  -- 2. Marcar como cancelada
  UPDATE public.municipal_sales SET
    status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = p_admin_id,
    cancellation_reason = p_reason
  WHERE id = p_sale_id;

  -- 3. Revertir inventario
  FOR v_item IN SELECT product_id, quantity FROM public.municipal_sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE public.inventory
    SET stock = stock + v_item.quantity, updated_at = NOW()
    WHERE product_id = v_item.product_id AND branch_id = v_sale.branch_id;
  END LOOP;

  -- 4. Si es crédito, revertir saldo de municipal_accounts
  IF v_sale.payment_type = 'credito' THEN
    SELECT id INTO v_account_id FROM public.municipal_accounts
    WHERE municipality = v_sale.municipality AND branch_id = v_sale.branch_id
    LIMIT 1;

    IF v_account_id IS NOT NULL THEN
      UPDATE public.municipal_accounts
      SET balance = GREATEST(balance - v_sale.total, 0), updated_at = NOW()
      WHERE id = v_account_id;

      INSERT INTO public.municipal_payments (account_id, amount, type, notes, registered_by)
      VALUES (v_account_id, v_sale.total, 'abono', 'Reversa por cancelación: ' || p_reason, NULL);
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. RPC: edit_sale (menudeo + mayoreo)
-- ============================================================
CREATE OR REPLACE FUNCTION public.edit_sale(
  p_sale_id UUID,
  p_items JSONB,
  p_client_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_type TEXT DEFAULT NULL,
  p_subtotal DECIMAL DEFAULT NULL,
  p_discount_amount DECIMAL DEFAULT NULL,
  p_iva DECIMAL DEFAULT NULL,
  p_total DECIMAL DEFAULT NULL,
  p_billing_bank TEXT DEFAULT NULL,
  p_billing_social_reason TEXT DEFAULT NULL,
  p_billing_invoice_number TEXT DEFAULT NULL,
  p_delivery_receiver_name TEXT DEFAULT NULL,
  p_credit_days INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_new_item JSONB;
  v_old_total DECIMAL;
  v_account_id UUID;
BEGIN
  -- 1. Obtener la venta original
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF v_sale.status = 'cancelled' THEN RAISE EXCEPTION 'No se puede editar una venta cancelada'; END IF;

  v_old_total := v_sale.total;

  -- 2. Revertir inventario de items originales
  FOR v_item IN SELECT product_id, quantity FROM public.sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE public.inventory
    SET stock = stock + v_item.quantity, updated_at = NOW()
    WHERE product_id = v_item.product_id AND branch_id = v_sale.branch_id;
  END LOOP;

  -- 3. Borrar items originales
  DELETE FROM public.sale_items WHERE sale_id = p_sale_id;

  -- 4. Insertar nuevos items y descontar inventario
  FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (
      p_sale_id,
      (v_new_item->>'product_id')::uuid,
      v_new_item->>'product_name',
      (v_new_item->>'quantity')::int,
      (v_new_item->>'price')::numeric
    );

    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES ((v_new_item->>'product_id')::uuid, v_sale.branch_id, -((v_new_item->>'quantity')::int), NOW())
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = NOW();
  END LOOP;

  -- 5. Actualizar la venta
  UPDATE public.sales SET
    client_id = COALESCE(p_client_id, client_id),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_type = COALESCE(p_payment_type, payment_type),
    subtotal = COALESCE(p_subtotal, subtotal),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    iva = COALESCE(p_iva, iva),
    total = COALESCE(p_total, total),
    billing_bank = COALESCE(p_billing_bank, billing_bank),
    billing_social_reason = COALESCE(p_billing_social_reason, billing_social_reason),
    billing_invoice_number = COALESCE(p_billing_invoice_number, billing_invoice_number),
    delivery_receiver_name = COALESCE(p_delivery_receiver_name, delivery_receiver_name),
    credit_days = COALESCE(p_credit_days, credit_days)
  WHERE id = p_sale_id;

  -- 6. Si era crédito wholesale, ajustar saldo
  IF v_sale.is_wholesale = true AND v_sale.payment_type = 'credito' AND v_sale.client_id IS NOT NULL THEN
    SELECT id INTO v_account_id FROM public.wholesale_accounts
    WHERE client_id = v_sale.client_id AND branch_id = v_sale.branch_id
    LIMIT 1;

    IF v_account_id IS NOT NULL AND p_total IS NOT NULL THEN
      UPDATE public.wholesale_accounts
      SET balance = GREATEST(balance - v_old_total + p_total, 0), updated_at = NOW()
      WHERE id = v_account_id;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. RPC: edit_municipal_sale
-- ============================================================
CREATE OR REPLACE FUNCTION public.edit_municipal_sale(
  p_sale_id UUID,
  p_items JSONB,
  p_municipality TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT NULL,
  p_payment_type TEXT DEFAULT NULL,
  p_subtotal DECIMAL DEFAULT NULL,
  p_discount_amount DECIMAL DEFAULT NULL,
  p_iva DECIMAL DEFAULT NULL,
  p_total DECIMAL DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_new_item JSONB;
  v_old_total DECIMAL;
  v_account_id UUID;
BEGIN
  -- 1. Obtener la venta
  SELECT * INTO v_sale FROM public.municipal_sales WHERE id = p_sale_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta municipal no encontrada'; END IF;
  IF v_sale.status = 'cancelled' THEN RAISE EXCEPTION 'No se puede editar una venta cancelada'; END IF;

  v_old_total := v_sale.total;

  -- 2. Revertir inventario
  FOR v_item IN SELECT product_id, quantity FROM public.municipal_sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE public.inventory
    SET stock = stock + v_item.quantity, updated_at = NOW()
    WHERE product_id = v_item.product_id AND branch_id = v_sale.branch_id;
  END LOOP;

  -- 3. Borrar items originales
  DELETE FROM public.municipal_sale_items WHERE sale_id = p_sale_id;

  -- 4. Insertar nuevos items y descontar inventario
  FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.municipal_sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (
      p_sale_id,
      (v_new_item->>'product_id')::uuid,
      v_new_item->>'product_name',
      (v_new_item->>'quantity')::int,
      (v_new_item->>'price')::numeric,
      (v_new_item->>'quantity')::numeric * (v_new_item->>'price')::numeric
    );

    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES ((v_new_item->>'product_id')::uuid, v_sale.branch_id, -((v_new_item->>'quantity')::int), NOW())
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = NOW();
  END LOOP;

  -- 5. Actualizar la venta
  UPDATE public.municipal_sales SET
    municipality = COALESCE(p_municipality, municipality),
    department = COALESCE(p_department, department),
    payment_method = COALESCE(p_payment_method, payment_method),
    payment_type = COALESCE(p_payment_type, payment_type),
    subtotal = COALESCE(p_subtotal, subtotal),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    iva = COALESCE(p_iva, iva),
    total = COALESCE(p_total, total),
    invoice_number = COALESCE(p_invoice_number, invoice_number),
    notes = COALESCE(p_notes, notes),
    updated_at = NOW()
  WHERE id = p_sale_id;

  -- 6. Si era crédito, ajustar saldo municipal
  IF v_sale.payment_type = 'credito' THEN
    SELECT id INTO v_account_id FROM public.municipal_accounts
    WHERE municipality = v_sale.municipality AND branch_id = v_sale.branch_id
    LIMIT 1;

    IF v_account_id IS NOT NULL AND p_total IS NOT NULL THEN
      UPDATE public.municipal_accounts
      SET balance = GREATEST(balance - v_old_total + p_total, 0), updated_at = NOW()
      WHERE id = v_account_id;
    END IF;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. GRANTS para rol anon
-- ============================================================
GRANT EXECUTE ON FUNCTION public.cancel_sale(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.cancel_municipal_sale(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.edit_sale(UUID, JSONB, UUID, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.edit_municipal_sale(UUID, JSONB, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT, TEXT) TO anon;
