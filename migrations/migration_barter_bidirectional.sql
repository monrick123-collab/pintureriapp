-- MIGRACIÓN: SISTEMA DE TRUEQUE BIDIRECCIONAL
-- Permite que una sucursal ofrezca productos y la otra seleccione qué quiere recibir

-- 1. Agregar nuevos estados a barter_transfers (modificar constraint existente)
ALTER TABLE public.barter_transfers 
DROP CONSTRAINT IF EXISTS barter_transfers_status_check;

ALTER TABLE public.barter_transfers 
ADD CONSTRAINT barter_transfers_status_check 
CHECK (status IN ('pending_offer', 'pending_selection', 'pending_approval', 'approved', 'completed', 'rejected', 'cancelled', 'counter_proposed'));

-- 2. Agregar columnas para tracking de selección y contra-ofertas
ALTER TABLE public.barter_transfers 
ADD COLUMN IF NOT EXISTS selected_by TEXT,
ADD COLUMN IF NOT EXISTS selected_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS counter_proposal_by TEXT,
ADD COLUMN IF NOT EXISTS counter_proposal_at TIMESTAMP WITH TIME ZONE;

-- 3. Tabla para selecciones (lo que la sucursal destino quiere recibir)
CREATE TABLE IF NOT EXISTS public.barter_selections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barter_id UUID REFERENCES public.barter_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    selected_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla para contra-ofertas
CREATE TABLE IF NOT EXISTS public.barter_counter_offers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    barter_id UUID REFERENCES public.barter_transfers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL,
    proposed_by TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Habilitar RLS
ALTER TABLE public.barter_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barter_counter_offers ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acceso
CREATE POLICY "Enable All for Auth barter_selections" ON public.barter_selections 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable All for Auth barter_counter_offers" ON public.barter_counter_offers 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_barter_selections_barter ON public.barter_selections(barter_id);
CREATE INDEX IF NOT EXISTS idx_barter_counter_offers_barter ON public.barter_counter_offers(barter_id);

-- 8. Función para crear oferta de trueque inicial
CREATE OR REPLACE FUNCTION public.create_barter_offer(
    p_from_branch_id TEXT,
    p_to_branch_id TEXT,
    p_requested_by TEXT,
    p_notes TEXT DEFAULT NULL,
    p_given_items JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_barter_id UUID;
    v_folio INTEGER;
    v_item JSONB;
BEGIN
    -- Obtener siguiente folio
    SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
    FROM public.barter_transfers 
    WHERE from_branch_id = p_from_branch_id;
    
    -- Crear cabecera del trueque
    INSERT INTO public.barter_transfers (
        from_branch_id, to_branch_id, folio, status, notes, requested_by
    ) VALUES (
        p_from_branch_id, p_to_branch_id, v_folio, 'pending_offer', p_notes, p_requested_by
    ) RETURNING id INTO v_barter_id;
    
    -- Insertar items ofrecidos
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_given_items)
    LOOP
        INSERT INTO public.barter_given_items (barter_id, product_id, quantity)
        VALUES (v_barter_id, (v_item->>'productId')::uuid, (v_item->>'quantity')::integer);
    END LOOP;
    
    RETURN v_barter_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Función para obtener ofertas pendientes para una sucursal
CREATE OR REPLACE FUNCTION public.get_pending_barter_offers(p_branch_id TEXT)
RETURNS TABLE (
    id UUID,
    from_branch_id TEXT,
    from_branch_name TEXT,
    to_branch_id TEXT,
    to_branch_name TEXT,
    folio INTEGER,
    status TEXT,
    notes TEXT,
    requested_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bt.id,
        bt.from_branch_id,
        fb.name as from_branch_name,
        bt.to_branch_id,
        tb.name as to_branch_name,
        bt.folio,
        bt.status,
        bt.notes,
        bt.requested_by,
        bt.created_at
    FROM public.barter_transfers bt
    LEFT JOIN public.branches fb ON bt.from_branch_id = fb.id
    LEFT JOIN public.branches tb ON bt.to_branch_id = tb.id
    WHERE bt.to_branch_id = p_branch_id 
      AND bt.status IN ('pending_offer', 'counter_proposed')
    ORDER BY bt.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 10. Función para seleccionar items del inventario del solicitante
CREATE OR REPLACE FUNCTION public.select_barter_items(
    p_barter_id UUID,
    p_selected_by TEXT,
    p_selections JSONB
)
RETURNS VOID AS $$
DECLARE
    v_selection JSONB;
    v_from_branch TEXT;
    v_to_branch TEXT;
BEGIN
    -- Verificar que el trueque está en estado correcto
    SELECT from_branch_id, to_branch_id INTO v_from_branch, v_to_branch
    FROM public.barter_transfers 
    WHERE id = p_barter_id AND status IN ('pending_offer', 'counter_proposed');
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trueque no encontrado o no está en estado pendiente';
    END IF;
    
    -- Limpiar selecciones previas
    DELETE FROM public.barter_selections WHERE barter_id = p_barter_id;
    
    -- Insertar nuevas selecciones
    FOR v_selection IN SELECT * FROM jsonb_array_elements(p_selections)
    LOOP
        INSERT INTO public.barter_selections (barter_id, product_id, quantity, selected_by)
        VALUES (
            p_barter_id, 
            (v_selection->>'productId')::uuid, 
            (v_selection->>'quantity')::integer,
            p_selected_by
        );
    END LOOP;
    
    -- Actualizar estado del trueque
    UPDATE public.barter_transfers 
    SET status = 'pending_approval',
        selected_by = p_selected_by,
        selected_at = NOW(),
        updated_at = NOW()
    WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;

-- 11. Función para proponer contra-oferta
CREATE OR REPLACE FUNCTION public.propose_barter_counter_offer(
    p_barter_id UUID,
    p_proposed_by TEXT,
    p_notes TEXT DEFAULT NULL,
    p_counter_items JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID AS $$
DECLARE
    v_item JSONB;
BEGIN
    -- Verificar que el trueque está en estado correcto
    IF NOT EXISTS (
        SELECT 1 FROM public.barter_transfers 
        WHERE id = p_barter_id AND status = 'pending_offer'
    ) THEN
        RAISE EXCEPTION 'Trueque no encontrado o no puede recibir contra-oferta';
    END IF;
    
    -- Limpiar contra-ofertas previas
    DELETE FROM public.barter_counter_offers WHERE barter_id = p_barter_id;
    
    -- Insertar items de contra-oferta
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_counter_items)
    LOOP
        INSERT INTO public.barter_counter_offers (barter_id, product_id, quantity, proposed_by, notes)
        VALUES (
            p_barter_id, 
            (v_item->>'productId')::uuid, 
            (v_item->>'quantity')::integer,
            p_proposed_by,
            p_notes
        );
    END LOOP;
    
    -- Actualizar estado del trueque
    UPDATE public.barter_transfers 
    SET status = 'counter_proposed',
        counter_proposal_by = p_proposed_by,
        counter_proposal_at = NOW(),
        updated_at = NOW()
    WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;

-- 12. Función para aceptar contra-oferta (por el solicitante original)
CREATE OR REPLACE FUNCTION public.accept_barter_counter_offer(p_barter_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Mover items de contra-oferta a received_items
    INSERT INTO public.barter_received_items (barter_id, product_id, quantity)
    SELECT barter_id, product_id, quantity
    FROM public.barter_counter_offers
    WHERE barter_id = p_barter_id;
    
    -- Actualizar estado
    UPDATE public.barter_transfers 
    SET status = 'pending_approval',
        updated_at = NOW()
    WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;

-- 13. Función actualizada para procesar trueque aprobado
CREATE OR REPLACE FUNCTION public.process_barter_transfer_bidirectional(p_barter_id UUID)
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
    
    -- 3. Procesar selecciones (lo que la sucursal destino eligió recibir)
    -- Si hay selecciones, usarlas; si no, usar received_items tradicional
    IF EXISTS (SELECT 1 FROM public.barter_selections WHERE barter_id = p_barter_id) THEN
        -- Reducir stock de productos seleccionados (desde sucursal destino = from_branch del solicitante)
        UPDATE public.inventory inv
        SET stock = inv.stock - bs.quantity
        FROM public.barter_selections bs
        WHERE inv.product_id = bs.product_id 
            AND inv.branch_id = v_from_branch_id
            AND bs.barter_id = p_barter_id;
        
        -- Aumentar stock de productos seleccionados (en sucursal que recibió = to_branch)
        INSERT INTO public.inventory (product_id, branch_id, stock)
        SELECT bs.product_id, v_to_branch_id, bs.quantity
        FROM public.barter_selections bs
        WHERE bs.barter_id = p_barter_id
        ON CONFLICT (product_id, branch_id) 
        DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;
    ELSE
        -- Flujo tradicional con received_items
        UPDATE public.inventory inv
        SET stock = inv.stock - br.quantity
        FROM public.barter_received_items br
        WHERE inv.product_id = br.product_id 
            AND inv.branch_id = v_to_branch_id
            AND br.barter_id = p_barter_id;
        
        INSERT INTO public.inventory (product_id, branch_id, stock)
        SELECT br.product_id, v_from_branch_id, br.quantity
        FROM public.barter_received_items br
        WHERE br.barter_id = p_barter_id
        ON CONFLICT (product_id, branch_id) 
        DO UPDATE SET stock = inventory.stock + EXCLUDED.stock;
    END IF;
    
    -- 4. Marcar trueque como completado
    UPDATE public.barter_transfers 
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_barter_id;
END;
$$ LANGUAGE plpgsql;

-- 14. Función para cancelar trueque
CREATE OR REPLACE FUNCTION public.cancel_barter_transfer(p_barter_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.barter_transfers 
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = p_barter_id 
      AND status IN ('pending_offer', 'pending_selection', 'counter_proposed');
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se puede cancelar este trueque en su estado actual';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 15. Comentarios descriptivos
COMMENT ON TABLE public.barter_selections IS 'Productos seleccionados por la sucursal destino del inventario del solicitante';
COMMENT ON TABLE public.barter_counter_offers IS 'Contra-ofertas propuestas cuando no hay stock disponible';

-- 16. Actualizar trueques existentes a nuevo estado 'pending' -> 'pending_offer'
UPDATE public.barter_transfers 
SET status = 'pending_offer' 
WHERE status = 'pending';
