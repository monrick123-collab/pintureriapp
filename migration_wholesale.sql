-- Migración para precios de mayoreo
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS wholesale_min_qty INTEGER DEFAULT 12;

-- Comentario para verificar
COMMENT ON COLUMN products.wholesale_price IS 'Precio especial para ventas por volumen';
COMMENT ON COLUMN products.wholesale_min_qty IS 'Cantidad mínima de piezas para aplicar precio de mayoreo';
