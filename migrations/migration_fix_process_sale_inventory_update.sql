-- =====================================================
-- FIX CRÍTICO: Corregir descuento de inventario en process_sale
--
-- Problema: El UPSERT actual hace INSERT con stock = -quantity si no
-- existe fila para (product_id, branch_id). Esto viola el CHECK constraint
-- "inventory_stock_non_negative" y da error 500 al usuario aunque el
-- stock mostrado en pantalla sea positivo.
--
-- Solución: Reemplazar el UPSERT por UPDATE atómico con validación de stock.
-- El UPDATE solo procede si stock >= quantity (previene race conditions).
-- Si no actualiza ninguna fila, lanza RAISE EXCEPTION con mensaje legible.
-- =====================================================

-- Eliminar todas las versiones anteriores de process_sale
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

-- Versión corregida: UPDATE atómico con validación de stock
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
  v_rows_updated INT;
  v_product_name TEXT;
  v_quantity INT;
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

  -- 4. Procesar items: descontar inventario con UPDATE atómico e insertar sale_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP

    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::int;

    -- Descontar stock de forma atómica: solo actualiza si hay stock suficiente
    -- La condición WHERE stock >= v_quantity previene race conditions y stock negativo
    UPDATE public.inventory
    SET stock = stock - v_quantity,
        updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid
      AND branch_id = p_branch_id
      AND stock >= v_quantity;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    -- Si no se actualizó ninguna fila: stock insuficiente o fila inexistente
    IF v_rows_updated = 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto "%" en esta sucursal. Verifica el inventario antes de continuar.',
        v_product_name;
    END IF;

    -- Insertar item de venta (sin columna total para compatibilidad con GENERATED ALWAYS AS)
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_product_name,
      v_quantity,
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
