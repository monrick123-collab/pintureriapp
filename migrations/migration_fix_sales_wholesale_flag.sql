-- FIX COMPLEMENTARIO: Permitir ejecución de la función RPC process_sale para anon
-- y corregir las ventas existentes que quedaron sin la marca is_wholesale=true.

-- 1. Dar permiso de ejecución de la RPC al rol anon
GRANT EXECUTE ON FUNCTION public.process_sale TO anon;

-- 2. (OPCIONAL) Actualizar las ventas existentes que tienen datos de mayoreo
-- pero quedaron sin la marca is_wholesale=true .
-- Basamos la detección en que las ventas mayoristas SIEMPRE tienen:
--   - delivery_receiver_name (nombre del que recibe la mercancía — campo obligatorio en WholesalePOS)
-- Esto las diferencia de las ventas de punto de venta retail.
UPDATE public.sales
SET is_wholesale = true
WHERE delivery_receiver_name IS NOT NULL
  AND delivery_receiver_name <> ''
  AND (is_wholesale IS NULL OR is_wholesale = false);
