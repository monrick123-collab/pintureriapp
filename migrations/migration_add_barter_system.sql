-- MIGRACIÓN: SISTEMA DE TRUEQUES (INTERCAMBIO DE PRODUCTOS ENTRE SUCURSALES)
-- Este script agrega tablas para manejar trueques entre sucursales con autorización del administrador.

-- 1. Tabla de Trueques (Cabecera)
CREATE TABLE IF NOT EXISTS public.barter_transfers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    from_branch_id TEXT REFERENCES public.branches(id),
    to_branch_id TEXT REFERENCES public.branches(id),
    folio INTEGER NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')) DEFAULT 'pending',
    notes TEXT,
    requested_by TEXT, -- Usuario que solicita el trueque
    authorized_by TEXT, -- Administrador que autoriza (si aplica)
    authorized_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(from_branch_id, folio)
);

-- 2. Tabla de Productos que se Dan (desde sucursal origen)
CREATE TABLE IF NOT EXISTS public.barter_given_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    barter_id UUID REFERENCES public.barter_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Productos que se Reciben (hacia sucursal origen)
CREATE TABLE IF NOT EXISTS public.barter_received_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    barter_id UUID REFERENCES public.barter_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Agregar tipo de folio para trueques en la tabla branch_folios
ALTER TABLE public.branch_folios 
ADD COLUMN IF NOT EXISTS last_barter_folio INTEGER DEFAULT -1;

-- 5. Extender la función get_next_folio para soportar trueques
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
    ELSIF p_folio_type = 'barter' THEN
        UPDATE public.branch_folios SET last_barter_folio = last_barter_folio + 1 WHERE branch_id = p_branch_id RETURNING last_barter_folio INTO v_folio;
    END IF;
    
    RETURN v_folio;
END;
$$ LANGUAGE plpgsql;

-- 6. Habilitar RLS para las nuevas tablas
ALTER TABLE public.barter_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barter_given_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barter_received_items ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de acceso para las nuevas tablas
CREATE POLICY "Enable All for Auth barter_transfers" ON public.barter_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth barter_given_items" ON public.barter_given_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable All for Auth barter_received_items" ON public.barter_received_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Función para procesar trueques autorizados (ajustar inventario)
CREATE OR REPLACE FUNCTION public.process_barter_transfer(p_barter_id UUID)
RETURNS VOID AS $$
DECLARE
    v_from_branch_id TEXT;
    v_to_branch_id TEXT;
BEGIN
    -- Obtener sucursales involucradas
    SELECT from_branch_id, to_branch_id INTO v_from_branch_id, v_to_branch_id
    FROM public.barter_transfers 
    WHERE id = p_barter_id AND status = 'approved';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trueque no encontrado o no está aprobado';
    END IF;
    
    -- 1. Reducir stock de productos dados (desde sucursal origen)
    UPDATE public.inventory inv
    SET stock = inv.stock - bg.quantity
    FROM public.barter_given_items bg
    WHERE inv.product_id = bg.product_id 
        AND inv.branch_id = v_from_branch_id
        AND bg.barter_id = p_barter_id;
    
    -- 2. Aumentar stock de productos dados (en sucursal destino)
    INSERT INTO public.inventory (product_id, branch_id, stock)
    SELECT bg.product_id, v_to_branch_id, bg.quantity
    FROM public.barter_given_items bg
    WHERE bg.barter_id = p_barter_id
    ON CONFLICT (product_id, branch_id) 
    DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;
    
    -- 3. Reducir stock de productos recibidos (desde sucursal destino)
    UPDATE public.inventory inv
    SET stock = inv.stock - br.quantity
    FROM public.barter_received_items br
    WHERE inv.product_id = br.product_id 
        AND inv.branch_id = v_to_branch_id
        AND br.barter_id = p_barter_id;
    
    -- 4. Aumentar stock de productos recibidos (en sucursal origen)
    INSERT INTO public.inventory (product_id, branch_id, stock)
    SELECT br.product_id, v_from_branch_id, br.quantity
    FROM public.barter_received_items br
    WHERE br.barter_id = p_barter_id
    ON CONFLICT (product_id, branch_id) 
    DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;
    
    -- 5. Marcar trueque como completado
    UPDATE public.barter_transfers 
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_barter_id;
    
END;
$$ LANGUAGE plpgsql;

-- 9. Comentarios descriptivos
COMMENT ON TABLE public.barter_transfers IS 'Cabecera de trueques entre sucursales';
COMMENT ON TABLE public.barter_given_items IS 'Productos que se dan en un trueque';
COMMENT ON TABLE public.barter_received_items IS 'Productos que se reciben en un trueque';
COMMENT ON FUNCTION public.process_barter_transfer IS 'Procesa un trueque aprobado ajustando el inventario de ambas sucursales';