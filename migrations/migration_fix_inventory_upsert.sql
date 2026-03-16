-- Migración para arreglar la deducción/actualización de inventario en ventas y surtidos

-- 1. Reafirmar que "anon" (el rol por defecto del cliente) puede leer e insertar/actualizar al inventario
DROP POLICY IF EXISTS "Enable All for Anon" ON public.inventory;
CREATE POLICY "Enable All for Anon" ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Modificar process_sale para garantizar que haga un UPSERT si el stock no existía (evita fallos silenciosos)
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
  p_payment_status TEXT DEFAULT 'pending',
  p_transfer_reference TEXT DEFAULT NULL,
  p_billing_bank TEXT DEFAULT NULL,
  p_billing_social_reason TEXT DEFAULT NULL,
  p_billing_invoice_number TEXT DEFAULT NULL,
  p_delivery_receiver_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_current_stock INT;
  v_folio INT;
BEGIN
  -- 1. Obtener y asegurar folio consecutivo
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio FROM public.sales WHERE branch_id = p_branch_id;

  -- 2. Insertar Venta
  INSERT INTO public.sales (
    branch_id, folio, total, payment_method, payment_type, is_wholesale,
    client_id, departure_admin_id, subtotal, discount_amount, iva, credit_days,
    payment_status, transfer_reference, billing_bank, billing_social_reason,
    billing_invoice_number, delivery_receiver_name
  )
  VALUES (
    p_branch_id, v_folio, p_total, p_payment_method, p_payment_type, p_is_wholesale,
    p_client_id, p_departure_admin_id, p_subtotal, p_discount_amount, p_iva, p_credit_days,
    p_payment_status, p_transfer_reference, p_billing_bank, p_billing_social_reason,
    p_billing_invoice_number, p_delivery_receiver_name
  )
  RETURNING id INTO v_sale_id;

  -- 3. Procesar Items y descontar inventario
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    
    -- Insert / Update atómico de inventario (evita que falle silenciosamente si no existe fila param esa bodega/producto)
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES ((v_item->>'product_id')::uuid, p_branch_id, -((v_item->>'quantity')::int), now())
    ON CONFLICT (product_id, branch_id) DO UPDATE 
    SET stock = public.inventory.stock - EXCLUDED.stock, updated_at = now();

    -- Check por si quedo en negativo (podríamos mandar un WARNING pero no detener la venta si así lo deciden, por ahora lo dejamos pasar o podríamos lanzar EXCEPTION)
    -- IF v_current_stock < 0 THEN RAISE EXCEPTION 'Stock insuficiente para %', ... END IF;
    -- (Por simplicidad y evitar que ventas tarden o crasheen, permitiremos inventario negativo temporal)

    -- Guardar item de venta
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
  
  -- 4. Si es a crédito, el pago principal no se registra como client_payments inmediatamente,
  -- a menos que den anticipo (a implementar a futuro o manejar separadamente)

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Modificar confirm_restock_arrival para UPSERT seguro
CREATE OR REPLACE FUNCTION public.confirm_restock_arrival(p_request_id UUID) RETURNS VOID AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM public.restock_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN RAISE EXCEPTION 'Petición no encontrada'; END IF;
  IF v_req.status != 'shipped' THEN RAISE EXCEPTION 'Pedido no enviado aún'; END IF;

  -- Descontar de Hub (Bodega Principal) usando UPSERT
  INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
  VALUES (v_req.product_id, 'BR-MAIN', -(v_req.quantity), now())
  ON CONFLICT (product_id, branch_id) DO UPDATE 
  SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now(); -- EXCLUDED.stock es negativo

  -- Sumar a destino
  INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
  VALUES (v_req.product_id, v_req.branch_id, v_req.quantity, now())
  ON CONFLICT (product_id, branch_id) DO UPDATE 
  SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now();

  UPDATE public.restock_requests SET status = 'completed', received_at = now() WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;
