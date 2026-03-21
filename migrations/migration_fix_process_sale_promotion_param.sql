-- =====================================================
-- FIX: Actualizar process_sale para incluir p_promotion_request_id
--
-- Problema: El frontend envía p_promotion_request_id en el RPC call
-- pero la función en DB sólo tiene 18 parámetros. Esto causa error
-- "function does not exist" en todas las ventas de mayoreo.
--
-- También corrige el INSERT en sale_items para omitir la columna
-- `total` que en algunos esquemas es GENERATED ALWAYS AS.
-- =====================================================

-- Eliminar todas las versiones anteriores (18 y 19 parámetros)
DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
);

-- Crear la versión final con p_promotion_request_id
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
  -- 1. Si es efectivo o transferencia y no se especificó pending, marcar como pending
  IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
  END IF;

  -- 2. Generar folio secuencial por sucursal
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
  FROM public.sales
  WHERE branch_id = p_branch_id;

  -- 3. Insertar venta principal
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

  -- 4. Procesar items: descontar inventario (UPSERT) e insertar sale_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP

    -- Descontar stock (inserta con stock negativo si no existe, decrementa si existe)
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (
      (v_item->>'product_id')::uuid,
      p_branch_id,
      -((v_item->>'quantity')::int),
      now()
    )
    ON CONFLICT (product_id, branch_id) DO UPDATE
      SET stock = public.inventory.stock + EXCLUDED.stock,
          updated_at = now();

    -- Insertar item de venta (sin columna total para compatibilidad con GENERATED ALWAYS AS)
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      (v_item->>'quantity')::int,
      (v_item->>'price')::numeric
    );

  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Otorgar permisos al rol anon (necesario para la clave anon de Supabase)
GRANT EXECUTE ON FUNCTION public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
) TO anon;
