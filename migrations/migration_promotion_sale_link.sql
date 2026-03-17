-- =====================================================
-- Vincular solicitudes de promoción con ventas
-- 1. Guardar items del carrito en promotion_requests
-- 2. Enlazar ventas con la solicitud de promoción que las originó
-- =====================================================

-- Agregar columna items a promotion_requests para guardar el carrito
ALTER TABLE public.promotion_requests ADD COLUMN IF NOT EXISTS items JSONB;

-- Agregar columna promotion_request_id a sales para el vínculo
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS promotion_request_id UUID REFERENCES public.promotion_requests(id);

-- =====================================================
-- Actualizar create_promotion_request para aceptar items
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_promotion_request(
    p_sale_id UUID,
    p_branch_id TEXT,
    p_total_items INTEGER,
    p_subtotal DECIMAL(12,2),
    p_discount_percent DECIMAL(5,2),
    p_discount_amount DECIMAL(12,2),
    p_requested_by TEXT,
    p_client_id UUID DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_promotion_id UUID DEFAULT NULL,
    p_items JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    INSERT INTO public.promotion_requests (
        sale_id, branch_id, client_id, client_name, total_items,
        subtotal, requested_discount_percent, requested_discount_amount,
        reason, requested_by, promotion_id, items
    ) VALUES (
        p_sale_id, p_branch_id, p_client_id, p_client_name, p_total_items,
        p_subtotal, p_discount_percent, p_discount_amount,
        p_reason, p_requested_by, p_promotion_id, p_items
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_promotion_request(UUID, TEXT, INTEGER, DECIMAL, DECIMAL, DECIMAL, TEXT, UUID, TEXT, TEXT, UUID, JSONB) TO anon;

-- =====================================================
-- Actualizar process_sale para aceptar promotion_request_id
-- =====================================================
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
  p_promotion_request_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_folio INT;
BEGIN
  IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
  END IF;

  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio FROM public.sales WHERE branch_id = p_branch_id;

  INSERT INTO public.sales (
    branch_id, folio, total, payment_method, subtotal, discount_amount, iva,
    client_id, is_wholesale, payment_type, departure_admin_id, credit_days,
    billing_bank, billing_social_reason, billing_invoice_number,
    delivery_receiver_name, payment_status, transfer_reference, pending_since,
    promotion_request_id
  )
  VALUES (
    p_branch_id, v_folio, p_total, p_payment_method, p_subtotal, p_discount_amount, p_iva,
    p_client_id, p_is_wholesale, p_payment_type, p_departure_admin_id, p_credit_days,
    p_billing_bank, p_billing_social_reason, p_billing_invoice_number,
    p_delivery_receiver_name, p_payment_status, p_transfer_reference,
    CASE WHEN p_payment_status = 'pending' THEN now() ELSE NULL END,
    p_promotion_request_id
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES ((v_item->>'product_id')::uuid, p_branch_id, -((v_item->>'quantity')::int), now())
    ON CONFLICT (product_id, branch_id) DO UPDATE
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now();

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::int,
      (v_item->>'price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'price')::numeric
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) TO anon;
