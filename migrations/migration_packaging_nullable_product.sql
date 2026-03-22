-- Make target_product_id nullable in packaging_order_lines
-- Product assignment happens at completion time, not at request time
ALTER TABLE public.packaging_order_lines
    ALTER COLUMN target_product_id DROP NOT NULL;
