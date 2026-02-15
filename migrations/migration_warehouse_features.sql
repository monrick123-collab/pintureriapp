-- MIGRACIÓN: FUNCIONES DE ENCARGADO DE BODEGA Y MEJORAS DE CONTROL
-- Este script agrega tablas para resurtidos foliados, traspasos, cambio de moneda y mejora el control de folios por sucursal.

-- 1. Tabla para control de folios por sucursal
CREATE TABLE IF NOT EXISTS public.branch_folios (
    branch_id TEXT REFERENCES public.branches(id) PRIMARY KEY,
    last_restock_folio INTEGER DEFAULT -1,
    last_transfer_folio INTEGER DEFAULT -1,
    last_quotation_folio INTEGER DEFAULT -1,
    last_return_folio INTEGER DEFAULT -1,
    last_wholesale_folio INTEGER DEFAULT -1,
    last_retail_folio INTEGER DEFAULT -1,
    last_coin_change_folio INTEGER DEFAULT -1
);

-- Inicializar folios para las sucursales existentes
INSERT INTO public.branch_folios (branch_id)
SELECT id FROM public.branches
ON CONFLICT (branch_id) DO NOTHING;

-- 2. Hojas de Resurtido (Agrupador)
CREATE TABLE IF NOT EXISTS public.restock_sheets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    folio INTEGER NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'approved', 'shipped', 'completed', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(branch_id, folio)
);

-- 3. Ítems de la Hoja de Resurtido
CREATE TABLE IF NOT EXISTS public.restock_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sheet_id UUID REFERENCES public.restock_sheets(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Solicitudes de Cambio de Moneda
CREATE TABLE public.coin_change_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    folio INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    requester_id UUID REFERENCES auth.users(id),
    receiver_id UUID REFERENCES auth.users(id), -- Quien de bodega/admin lo manda
    collected_by_id UUID REFERENCES auth.users(id), -- Quien de la sucursal lo recibe
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(branch_id, folio)
);

-- 5. Traspasos entre Sucursales
CREATE TABLE public.stock_transfers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    from_branch_id TEXT REFERENCES public.branches(id),
    to_branch_id TEXT REFERENCES public.branches(id),
    folio INTEGER NOT NULL,
    status TEXT CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(from_branch_id, folio)
);

CREATE TABLE public.stock_transfer_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    transfer_id UUID REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL
);

-- 6. Función para obtener el siguiente folio y actualizarlo
CREATE OR REPLACE FUNCTION public.get_next_folio(p_branch_id TEXT, p_folio_type TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_folio INTEGER;
BEGIN
    IF p_folio_type = 'restock' THEN
        UPDATE public.branch_folios SET last_restock_folio = last_restock_folio + 1 WHERE branch_id = p_branch_id RETURNING last_restock_folio INTO v_folio;
    ELSIF p_folio_type = 'transfer' THEN
        UPDATE public.branch_folios SET last_transfer_folio = last_transfer_folio + 1 WHERE branch_id = p_branch_id RETURNING last_transfer_folio INTO v_folio;
    ELSIF p_folio_type = 'quotation' THEN
        UPDATE public.branch_folios SET last_quotation_folio = last_quotation_folio + 1 WHERE branch_id = p_branch_id RETURNING last_quotation_folio INTO v_folio;
    ELSIF p_folio_type = 'return' THEN
        UPDATE public.branch_folios SET last_return_folio = last_return_folio + 1 WHERE branch_id = p_branch_id RETURNING last_return_folio INTO v_folio;
    ELSIF p_folio_type = 'coin_change' THEN
        UPDATE public.branch_folios SET last_coin_change_folio = last_coin_change_folio + 1 WHERE branch_id = p_branch_id RETURNING last_coin_change_folio INTO v_folio;
    END IF;
    
    RETURN v_folio;
END;
$$ LANGUAGE plpgsql;

-- 7. Habilitar RLS
ALTER TABLE public.branch_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso Total para Autenticados (Simplificado)
CREATE POLICY "Enable All for Auth branch_folios" ON public.branch_folios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth restock_sheets" ON public.restock_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth restock_items" ON public.restock_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth coin_change_requests" ON public.coin_change_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth stock_transfers" ON public.stock_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth stock_transfer_items" ON public.stock_transfer_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. Sucursal de Mayoreo
INSERT INTO public.branches (id, name, type) 
VALUES ('BR-MAYOREO', 'Sucursal Mayoreo', 'store')
ON CONFLICT (id) DO NOTHING;

-- 12. Tabla de Vales / Cupones
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    branch_id TEXT REFERENCES public.branches(id),
    status TEXT CHECK (status IN ('active', 'redeemed', 'expired')) DEFAULT 'active',
    redeemed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso total coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);
