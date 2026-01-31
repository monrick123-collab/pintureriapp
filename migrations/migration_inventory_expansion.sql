-- Migration to add robust inventory fields to products table

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS unit_measure TEXT DEFAULT 'pza';

-- Comment: min_stock helps in auto-reordering.
-- Comment: location helps in picking.
-- Comment: cost_price allows for real-time margin calculation.
