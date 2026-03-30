-- =====================================================
-- RPC: process_municipal_sale
--
-- Fix crítico: las ventas municipales no descontaban inventario.
-- cancel_municipal_sale y edit_municipal_sale SÍ manipulan stock,
-- creando inconsistencia. Este RPC hace todo atómicamente:
--   1. Genera folio
--   2. Inserta municipal_sales
--   3. Valida extra_percentage del cliente contra DB
--   4. Inserta municipal_sale_items con precio validado
--   5. Descuenta inventory (con validación de stock suficiente)
--   6. Actualiza municipal_accounts si es crédito
--
-- Patrón de inventario: UPDATE con WHERE stock >= quantity
-- (mismo patrón que process_sale, respeta CHECK constraint
--  inventory_stock_non_negative)
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_municipal_sale(
  p_branch_id TEXT,
  p_items JSONB,
  p_municipality TEXT,
  p_total DECIMAL,
  p_subtotal DECIMAL DEFAULT 0,
  p_iva DECIMAL DEFAULT 0,
  p_discount_amount DECIMAL DEFAULT 0,
  p_department TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_social_reason TEXT DEFAULT NULL,
  p_rfc TEXT DEFAULT NULL,
  p_invoice_number TEXT DEFAULT NULL,
  p_authorized_exit_by TEXT DEFAULT NULL,
  p_delivery_receiver TEXT DEFAULT NULL,
  p_payment_type TEXT DEFAULT 'contado',
  p_payment_method TEXT DEFAULT 'cash',
  p_credit_days INTEGER DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_transfer_reference TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_applied_extra_pct NUMERIC DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_folio INT;
  v_item JSONB;
  v_payment_status TEXT;
  v_extra_pct NUMERIC := 0;
  v_multiplier NUMERIC := 1;
  v_base_price NUMERIC;
  v_validated_price NUMERIC;
  v_quantity INT;
  v_product_name TEXT;
  v_rows_updated INT;
  v_account_id UUID;
BEGIN
  -- 1. Generar folio municipal
  BEGIN
    SELECT public.get_next_folio(p_branch_id, 'municipal') INTO v_folio;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: MAX(folio) + 1
    SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
    FROM public.municipal_sales
    WHERE branch_id = p_branch_id;
  END;

  -- 2. Determinar payment_status
  IF p_payment_method IN ('transfer', 'cash') THEN
    v_payment_status := 'pending';
  ELSE
    v_payment_status := 'approved';
  END IF;

  -- 3. Validar extra_percentage del cliente (no confiar en el frontend)
  IF p_client_id IS NOT NULL THEN
    SELECT COALESCE(extra_percentage, 0) INTO v_extra_pct
    FROM public.clients
    WHERE id = p_client_id;

    v_multiplier := 1 + (v_extra_pct / 100);
  END IF;

  -- 4. Insertar venta municipal
  INSERT INTO public.municipal_sales (
    branch_id, folio, municipality, department, contact_name,
    social_reason, rfc, invoice_number, authorized_exit_by,
    delivery_receiver, payment_type, payment_method, credit_days,
    subtotal, discount_amount, iva, total, notes,
    payment_status, pending_since, transfer_reference,
    applied_extra_pct, status
  ) VALUES (
    p_branch_id, v_folio, p_municipality, p_department, p_contact_name,
    p_social_reason, p_rfc, p_invoice_number, p_authorized_exit_by,
    p_delivery_receiver, p_payment_type, p_payment_method, p_credit_days,
    p_subtotal, p_discount_amount, p_iva, p_total, p_notes,
    v_payment_status,
    CASE WHEN v_payment_status = 'pending' THEN now() ELSE NULL END,
    p_transfer_reference,
    p_applied_extra_pct, 'completed'
  )
  RETURNING id INTO v_sale_id;

  -- 5. Procesar items: validar precio, insertar item, descontar inventario
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP

    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::int;

    -- Obtener precio base del producto desde DB
    SELECT COALESCE(price, 0) INTO v_base_price
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid;

    -- Aplicar multiplicador de extra_percentage
    v_validated_price := ROUND(v_base_price * v_multiplier, 2);

    -- Insertar item con precio validado
    INSERT INTO public.municipal_sale_items (
      sale_id, product_id, product_name, quantity, unit_price, total_price
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      v_product_name,
      v_quantity,
      v_validated_price,
      ROUND(v_validated_price * v_quantity, 2)
    );

    -- Descontar inventario (mismo patrón que process_sale)
    UPDATE public.inventory
    SET stock = stock - v_quantity, updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid
      AND branch_id = p_branch_id
      AND stock >= v_quantity;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto "%" en esta sucursal. Verifica el inventario antes de continuar.',
        v_product_name;
    END IF;

  END LOOP;

  -- 6. Si es crédito, actualizar saldo de municipal_accounts
  IF p_payment_type = 'credito' THEN
    -- UPSERT: crear cuenta si no existe, o sumar al balance
    INSERT INTO public.municipal_accounts (branch_id, municipality, balance, updated_at)
    VALUES (p_branch_id, p_municipality, p_total, now())
    ON CONFLICT (branch_id, municipality) DO UPDATE
    SET balance = public.municipal_accounts.balance + EXCLUDED.balance,
        updated_at = now();
  END IF;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Permisos para rol anon (la app usa clave anon, no JWT)
GRANT EXECUTE ON FUNCTION public.process_municipal_sale TO anon;
