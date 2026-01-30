-- Migración para Puntos 2, 3 y 4 de Bodega

-- 1. Punto 4: Agregar campo 'brand' a la tabla de productos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;

-- 2. Punto 2: Tabla de Pedidos de Suministro (Supply Orders - Bodega a Admin)
CREATE TABLE IF NOT EXISTS public.supply_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folio SERIAL,
    branch_id TEXT REFERENCES public.branches(id), -- Usualmente la bodega
    created_by UUID REFERENCES auth.users(id),
    assigned_admin_id UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'processing', 'shipped', 'received', 'cancelled')) DEFAULT 'pending',
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.supply_order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.supply_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0
);

-- 3. Punto 3: Adaptar tabla de ventas para Mayoreo y Crédito
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('contado', 'credito')) DEFAULT 'contado';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS departure_admin_id UUID REFERENCES auth.users(id);

-- 4. Punto 4: Tabla para Solicitud de Precios (Bodega -> Contador)
CREATE TABLE IF NOT EXISTS public.price_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    requester_id UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS para supply_orders
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supply orders are viewable by everyone in the branch/admin" ON public.supply_orders
    FOR SELECT USING (true);
CREATE POLICY "Warehouse and Admin can create supply orders" ON public.supply_orders
    FOR INSERT WITH CHECK (true);

-- Folios automáticos para supply_orders (opcional, usando SERIAL por ahora)
-- Pero si queremos por sucursal como en restock:
CREATE OR REPLACE FUNCTION get_next_supply_folio()
RETURNS TRIGGER AS $$
BEGIN
  -- Simple serial for now across all supply orders, or could be per branch
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
