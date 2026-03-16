-- MIGRATION: Actualizar función process_sale para incluir payment_status y transfer_reference
-- Esto es necesario para el sistema de aprobación de pagos en transferencia/efectivo

-- Primero eliminamos la función existente
DROP FUNCTION IF EXISTS public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, DECIMAL, 
  DECIMAL, DECIMAL, UUID, BOOLEAN, TEXT, 
  TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT
);

-- Creamos la nueva versión con payment_status y transfer_reference
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
  p_delivery_receiver_name TEXT DEFAULT NULL,
  p_payment_status TEXT DEFAULT 'approved', -- Nuevo: 'pending', 'approved', 'rejected'
  p_transfer_reference TEXT DEFAULT NULL    -- Nuevo: referencia de transferencia
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_current_stock INT;
  v_requires_approval BOOLEAN := FALSE;
BEGIN
  -- Determinar si requiere aprobación
  -- Transferencias y efectivo requieren aprobación del administrador
  IF p_payment_method IN ('transfer', 'cash') THEN
    v_requires_approval := TRUE;
  END IF;
  
  -- Si requiere aprobación y no se especificó status, establecer como pending
  IF v_requires_approval AND p_payment_status = 'approved' THEN
    p_payment_status := 'pending';
  END IF;

  -- Insertamos la venta con todos los campos adicionales
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
    delivery_receiver_name,
    payment_status,        -- Nuevo campo
    transfer_reference,    -- Nuevo campo
    pending_since          -- Nuevo campo (se establece automáticamente si es pending)
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
    p_delivery_receiver_name,
    p_payment_status,
    p_transfer_reference,
    CASE WHEN p_payment_status = 'pending' THEN now() ELSE NULL END
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

-- Otorgar permisos al rol anon
GRANT EXECUTE ON FUNCTION public.process_sale(
  TEXT, DECIMAL, TEXT, JSONB, DECIMAL, 
  DECIMAL, DECIMAL, UUID, BOOLEAN, TEXT, 
  TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT
) TO anon;

-- También necesitamos actualizar la función para ventas municipales si existe
-- Nota: La función para ventas municipales es diferente (create_municipal_sale)
-- y ya fue actualizada en la migración anterior (migration_sales_payment_approval_and_municipality.sql)