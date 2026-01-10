-- ==========================================================
-- MIGRACIÓN INTEGRAL PARA EL SISTEMA DE BODEGA PINTAMAX
-- (Puntos 2, 3 y 4: Pedidos, Ventas Mayoreo e Inventario)
-- ==========================================================

-- 1. TABLA DE PRODUCTOS: Agregar Marca y Tipos de Envase
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS package_type TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_min_qty INTEGER DEFAULT 12;

-- 2. TABLA DE PEDIDOS DE SUMINISTRO (Bodega -> Admin)
CREATE TABLE IF NOT EXISTS public.supply_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folio SERIAL,
    branch_id TEXT REFERENCES public.branches(id),
    created_by TEXT, -- Cambiado de UUID a TEXT para soportar IDs de prueba (Mocks)
    assigned_admin_id TEXT, -- Cambiado de UUID a TEXT
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

-- 3. TABLA DE VENTAS: Adaptación para Mayoreo y Crédito
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('contado', 'credito')) DEFAULT 'contado';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS departure_admin_id TEXT; -- Cambiado de UUID a TEXT para Mocks

-- Si las columnas ya existían como UUID, las convertimos a TEXT (para evitar errores con IDs manuales como 'WH-001')
DO $$ 
BEGIN 
    ALTER TABLE public.sales ALTER COLUMN departure_admin_id TYPE TEXT;
EXCEPTION WHEN OTHERS THEN 
    NULL; 
END $$;

-- 4. TABLA DE SOLICITUD DE PRECIOS (Bodega -> Contador)
CREATE TABLE IF NOT EXISTS public.price_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    requester_id TEXT, -- Cambiado de UUID a TEXT para Mocks
    status TEXT CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. SEGURIDAD (RLS)
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_requests ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para desarrollo
DROP POLICY IF EXISTS "Public access supply_orders" ON public.supply_orders;
CREATE POLICY "Public access supply_orders" ON public.supply_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access price_requests" ON public.price_requests;
CREATE POLICY "Public access price_requests" ON public.price_requests FOR ALL USING (true) WITH CHECK (true);

-- 6. FOLIOS PARA RESURTIDO (Asegurar que la función exista)
CREATE OR REPLACE FUNCTION get_next_restock_folio(p_branch_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_next_folio INTEGER;
BEGIN
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_next_folio
  FROM public.restock_sheets
  WHERE branch_id = p_branch_id;
  RETURN v_next_folio;
END;
$$ LANGUAGE plpgsql;
