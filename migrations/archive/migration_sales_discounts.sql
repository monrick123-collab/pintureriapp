-- Migration to persist discount information in sales
-- Run this in Supabase SQL Editor

-- 1. Add columns to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS subtotal numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva numeric(10, 2) DEFAULT 0;

-- 2. Update process_sale RPC to handle these new fields
CREATE OR REPLACE FUNCTION public.process_sale(
  p_branch_id text,
  p_total numeric,
  p_payment_method text,
  p_items jsonb,
  p_subtotal numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0,
  p_iva numeric DEFAULT 0
) RETURNS uuid AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_current_stock int;
BEGIN
  -- 1. Crear Venta con toda la información financiera
  INSERT INTO public.sales (branch_id, total, payment_method, subtotal, discount_amount, iva)
  VALUES (p_branch_id, p_total, p_payment_method, p_subtotal, p_discount_amount, p_iva)
  RETURNING id INTO v_sale_id;

  -- 2. Procesar Items (Mantenemos la lógica de stock)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Verificar Stock
    SELECT stock INTO v_current_stock 
    FROM public.inventory 
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    IF v_current_stock < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Stock insuficiente para el producto %', (v_item->>'product_name');
    END IF;

    -- Descontar Inventario
    UPDATE public.inventory 
    SET stock = stock - (v_item->>'quantity')::int,
        updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    -- Registrar Item de Venta
    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'product_name'),
      (v_item->>'quantity')::int,
      (v_item->>'price')::numeric
    );
  END LOOP;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;
