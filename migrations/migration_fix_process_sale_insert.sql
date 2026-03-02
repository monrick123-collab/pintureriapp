-- FIX: Actualizar la función process_sale para recibir todos los campos en el INSERT
-- Esto evita tener que hacer un UPDATE posterior que falla por bloqueos o reglas de RLS.

DROP FUNCTION IF EXISTS public.process_sale(TEXT, DECIMAL, TEXT, JSONB, DECIMAL, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS public.process_sale(TEXT, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.process_sale(
  p_branch_id TEXT,
  p_total DECIMAL,
  p_payment_method TEXT,
  p_items JSONB,
  p_subtotal DECIMAL DEFAULT 0,
  p_discount_amount DECIMAL DEFAULT 0,
  p_iva DECIMAL DEFAULT 0,
  p_client_id UUID DEFAULT NULL,
  p_is_wholesale BOOLEAN DEFAULT FALSE,
  p_payment_type TEXT DEFAULT 'contado',
  p_departure_admin_id TEXT DEFAULT NULL,
  p_credit_days INTEGER DEFAULT 0,
  p_billing_bank TEXT DEFAULT NULL,
  p_billing_social_reason TEXT DEFAULT NULL,
  p_billing_invoice_number TEXT DEFAULT NULL,
  p_delivery_receiver_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_current_stock INT;
BEGIN
  -- Insertamos la venta con todos los campos adicionales (Mayoreo, Crédito, Cliente, Admin, Facturación)
  INSERT INTO public.sales (
    branch_id, 
    total, 
    payment_method, 
    subtotal, 
    discount_amount, 
    iva,
    client_id,
    is_wholesale,
    payment_type,
    departure_admin_id,
    credit_days,
    billing_bank,
    billing_social_reason,
    billing_invoice_number,
    delivery_receiver_name
  )
  VALUES (
    p_branch_id, 
    p_total, 
    p_payment_method, 
    p_subtotal, 
    p_discount_amount, 
    p_iva,
    p_client_id,
    p_is_wholesale,
    p_payment_type,
    p_departure_admin_id,
    p_credit_days,
    p_billing_bank,
    p_billing_social_reason,
    p_billing_invoice_number,
    p_delivery_receiver_name
  )
  RETURNING id INTO v_sale_id;

  -- Procesamos los items descontando inventario
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT stock INTO v_current_stock FROM public.inventory 
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    IF v_current_stock < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Stock insuficiente para %', (v_item->>'product_name');
    END IF;

    UPDATE public.inventory SET stock = stock - (v_item->>'quantity')::int, updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (v_sale_id, (v_item->>'product_id')::uuid, v_item->>'product_name', (v_item->>'quantity')::int, (v_item->>'price')::numeric);
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Volver a otorgar permisos al rol anon
GRANT EXECUTE ON FUNCTION public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, DECIMAL, 
  DECIMAL, DECIMAL, UUID, BOOLEAN, TEXT, 
  TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT
) TO anon;
