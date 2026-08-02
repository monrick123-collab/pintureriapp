-- ============================================================
-- MIGRACIÓN: Consolidar process_sale en una sola versión
-- Elimina las 3 versiones sobrecargadas y crea una unificada
-- con todos los parámetros (seller_id + atomic credit)
-- ============================================================

-- 1. Verificar y añadir columna seller_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'seller_id') THEN
    ALTER TABLE public.sales ADD COLUMN seller_id TEXT;
    RAISE NOTICE 'Columna seller_id añadida a sales';
  ELSE
    RAISE NOTICE 'Columna seller_id ya existe en sales';
  END IF;
END $$;

-- 2. DROP de TODAS las versiones existentes de process_sale
-- Versión de 19 parámetros
DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID
);

-- Versión de 22 parámetros (con credit)
DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  BOOLEAN, UUID, TEXT
);

-- Versión de 23 parámetros (con seller_id)
DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  BOOLEAN, UUID, TEXT, TEXT
);

-- 3. CREATE función unificada con TODOS los parámetros
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
BEGIN
  -- 1. Marcar como pending si es efectivo/transferencia
  IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
  END IF;

  -- 2. Generar folio secuencial
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
  FROM public.sales WHERE branch_id = p_branch_id;

  -- 3. Insertar venta
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

  -- 4. Procesar items: descontar inventario + insertar sale_items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (
      (v_item->>'product_id')::uuid, p_branch_id,
      -((v_item->>'quantity')::int), now()
    )
    ON CONFLICT (product_id, branch_id) DO UPDATE
      SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now();

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_sale_id, (v_item->>'product_id')::uuid, v_item->>'product_name',
      (v_item->>'quantity')::int, (v_item->>'price')::numeric
    );
  END LOOP;

  -- 5. Cargo atómico de crédito (si aplica)
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

-- 4. Permisos
GRANT EXECUTE ON FUNCTION public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL,
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT,
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID,
  BOOLEAN, UUID, TEXT, TEXT
) TO anon, authenticated;