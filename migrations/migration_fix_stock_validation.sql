-- ============================================================
-- FIX: process_sale - Validar stock antes de descontar
-- Evita el error crudo 23514 (inventory_stock_non_negative)
-- lanzando una excepción clara "Stock insuficiente"
-- ============================================================

DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  BOOLEAN, UUID, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.process_sale(
  p_branch_id TEXT,
  p_total DECIMAL,
  p_payment_method TEXT,
  p_items JSONB,
  p_client_id UUID DEFAULT NULL,
  p_subtotal DECIMAL DEFAULT 0,
  p_discount_amount DECIMAL DEFAULT 0,
  p_iva DECIMAL DEFAULT 0,
  p_payment_type TEXT DEFAULT 'contado',
  p_is_wholesale BOOLEAN DEFAULT FALSE,
  p_departure_admin_id TEXT DEFAULT NULL,
  p_credit_days INTEGER DEFAULT 0,
  p_payment_status TEXT DEFAULT 'approved',
  p_transfer_reference TEXT DEFAULT NULL,
  p_billing_bank TEXT DEFAULT NULL,
  p_billing_social_reason TEXT DEFAULT NULL,
  p_billing_invoice_number TEXT DEFAULT NULL,
  p_delivery_receiver_name TEXT DEFAULT NULL,
  p_promotion_request_id UUID DEFAULT NULL,
  p_register_credit BOOLEAN DEFAULT FALSE,
  p_credit_client_id UUID DEFAULT NULL,
  p_credit_client_name TEXT DEFAULT NULL,
  p_seller_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_folio INT;
  v_credit_account_id UUID;
  v_current_stock INT;
  v_requested_qty INT;
  v_product_name TEXT;
  v_product_id UUID;
BEGIN
  -- 1. Marcar como pending si es efectivo/transferencia
  IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
  END IF;

  -- 2. Generar folio secuencial
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
  FROM public.sales WHERE branch_id = p_branch_id;

  -- 3. Validar stock ANTES de insertar la venta
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_requested_qty := (v_item->>'quantity')::int;
    v_product_name := v_item->>'product_name';

    SELECT COALESCE(stock, 0) INTO v_current_stock
    FROM public.inventory
    WHERE product_id = v_product_id AND branch_id = p_branch_id;

    IF v_current_stock IS NULL THEN
      v_current_stock := 0;
    END IF;

    IF v_current_stock < v_requested_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para "%" (SKU: %). Disponible: %, Solicitado: %',
        v_product_name, v_product_id, v_current_stock, v_requested_qty;
    END IF;
  END LOOP;

  -- 4. Insertar venta (solo si todo el stock es suficiente)
  INSERT INTO public.sales (
    branch_id, folio, total, payment_method, subtotal, discount_amount, iva,
    client_id, is_wholesale, payment_type, departure_admin_id, credit_days,
    billing_bank, billing_social_reason, billing_invoice_number,
    delivery_receiver_name, payment_status, transfer_reference, pending_since,
    promotion_request_id, seller_id
  )
  VALUES (
    p_branch_id, v_folio, p_total, p_payment_method, p_subtotal, p_discount_amount, p_iva,
    p_client_id, p_is_wholesale, p_payment_type, p_departure_admin_id, p_credit_days,
    p_billing_bank, p_billing_social_reason, p_billing_invoice_number,
    p_delivery_receiver_name, p_payment_status, p_transfer_reference,
    CASE WHEN p_payment_status = 'pending' THEN now() ELSE NULL END,
    p_promotion_request_id, p_seller_id
  )
  RETURNING id INTO v_sale_id;

  -- 5. Descontar inventario (UPDATE directo, no UPSERT)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    UPDATE public.inventory
    SET stock = stock - (v_item->>'quantity')::int, updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_sale_id, (v_item->>'product_id')::uuid, v_item->>'product_name',
      (v_item->>'quantity')::int, (v_item->>'price')::numeric
    );
  END LOOP;

  -- 6. Cargo atómico de crédito (si aplica)
  IF p_register_credit AND p_credit_client_id IS NOT NULL THEN
    SELECT id INTO v_credit_account_id
    FROM public.wholesale_accounts
    WHERE client_id = p_credit_client_id AND branch_id = p_branch_id
    LIMIT 1;

    IF v_credit_account_id IS NOT NULL THEN
      INSERT INTO public.wholesale_payments (
        wholesale_account_id, amount, payment_type, sale_id, notes, registered_by
      ) VALUES (
        v_credit_account_id, p_total, 'cargo', v_sale_id,
        'Cargo automático - Venta ' || v_sale_id, p_seller_id
      );
      UPDATE public.wholesale_accounts
      SET balance = balance + p_total, updated_at = now()
      WHERE id = v_credit_account_id;
    END IF;
  END IF;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Permisos
GRANT EXECUTE ON FUNCTION public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  BOOLEAN, UUID, TEXT, TEXT
) TO anon, authenticated;