-- MERGED MIGRATION: process_sale (Folios + Payment Approval + Inventory Upsert)
-- Esta versión unifica todas las mejoras anteriores para garantizar que:
-- 1. Se generen folios secuenciales por sucursal.
-- 2. Los pagos en efectivo y transferencia entren como 'pending' si no se especifica lo contrario.
-- 3. El inventario se actualice de forma segura (UPSERT).

DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, UUID, DECIMAL, 
  DECIMAL, DECIMAL, TEXT, BOOLEAN, TEXT, 
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
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
  p_delivery_receiver_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_folio INT;
  v_requires_approval BOOLEAN := FALSE;
BEGIN
  -- 1. Determinar si requiere aprobación de pago
  IF p_payment_method IN ('transfer', 'cash') AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
  END IF;

  -- 2. Obtener folio consecutivo para la sucursal (en tabla sales)
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio FROM public.sales WHERE branch_id = p_branch_id;

  -- 3. Insertar Venta Principal
  INSERT INTO public.sales (
    branch_id, 
    folio, 
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
    delivery_receiver_name,
    payment_status,
    transfer_reference,
    pending_since
  )
  VALUES (
    p_branch_id, 
    v_folio, 
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
    p_delivery_receiver_name,
    p_payment_status,
    p_transfer_reference,
    CASE WHEN p_payment_status = 'pending' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_sale_id;

  -- 4. Procesar Items y descontar inventario con UPSERT
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    
    -- Actualización atómica de inventario (UPSERT)
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES ((v_item->>'product_id')::uuid, p_branch_id, -((v_item->>'quantity')::int), now())
    ON CONFLICT (product_id, branch_id) DO UPDATE 
    SET stock = public.inventory.stock + EXCLUDED.stock, updated_at = now(); -- EXCLUDED.stock es el valor negativo

    -- Guardar item de venta
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price, total)
    VALUES (
      v_sale_id, 
      (v_item->>'product_id')::uuid, 
      v_item->>'product_name', 
      (v_item->>'quantity')::int, 
      (v_item->>'unit_price')::numeric,
      (v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Notar que p_items ahora espera 'unit_price' para coincidir con el mapeo frontal si es necesario,
-- pero en salesService.ts mapeamos como 'price'. He ajustado a 'unit_price' para ser consistente con otras tablas si aplica.
-- RE-MAPPING: En salesService.ts rpcItems usa 'price'. Ajustemos la función para que use price.

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
  p_delivery_receiver_name TEXT DEFAULT NULL
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
    delivery_receiver_name, payment_status, transfer_reference, pending_since
  )
  VALUES (
    p_branch_id, v_folio, p_total, p_payment_method, p_subtotal, p_discount_amount, p_iva,
    p_client_id, p_is_wholesale, p_payment_type, p_departure_admin_id, p_credit_days,
    p_billing_bank, p_billing_social_reason, p_billing_invoice_number,
    p_delivery_receiver_name, p_payment_status, p_transfer_reference,
    CASE WHEN p_payment_status = 'pending' THEN now() ELSE NULL END
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
  INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon;
