-- =====================================================
-- MIGRACIÓN: 3 NUEVAS FUNCIONALIDADES
-- 1. Promociones por volumen en mayoreo
-- 2. Sistema de tracking de envíos
-- 3. Diferencias en resurtidos (solo Admin)
-- =====================================================

-- =====================================================
-- PARTE 1: SISTEMA DE PROMOCIONES POR VOLUMEN (MAYOREO)
-- =====================================================

-- Tabla de promociones configurables
CREATE TABLE IF NOT EXISTS public.wholesale_promotions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    min_quantity INTEGER NOT NULL DEFAULT 0,
    max_quantity INTEGER,
    discount_percent DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    auto_apply BOOLEAN DEFAULT false,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de solicitudes de promoción para aprobación
CREATE TABLE IF NOT EXISTS public.promotion_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    promotion_id UUID REFERENCES public.wholesale_promotions(id) ON DELETE SET NULL,
    branch_id TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id),
    client_name TEXT,
    total_items INTEGER NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    requested_discount_percent DECIMAL(5,2) NOT NULL,
    requested_discount_amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_by TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.wholesale_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_requests ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Enable All for Auth wholesale_promotions" ON public.wholesale_promotions 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable All for Auth promotion_requests" ON public.promotion_requests 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Función para obtener promoción aplicable por cantidad
CREATE OR REPLACE FUNCTION public.get_applicable_promotion(p_quantity INTEGER)
RETURNS TABLE (
    id UUID,
    name TEXT,
    discount_percent DECIMAL(5,2),
    auto_apply BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT wp.id, wp.name, wp.discount_percent, wp.auto_apply
    FROM public.wholesale_promotions wp
    WHERE wp.is_active = true
      AND wp.min_quantity <= p_quantity
      AND (wp.max_quantity IS NULL OR wp.max_quantity >= p_quantity)
      AND (wp.start_date IS NULL OR wp.start_date <= NOW())
      AND (wp.end_date IS NULL OR wp.end_date >= NOW())
    ORDER BY wp.discount_percent DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Función para crear solicitud de promoción
CREATE OR REPLACE FUNCTION public.create_promotion_request(
    p_sale_id UUID,
    p_branch_id TEXT,
    p_client_id UUID DEFAULT NULL,
    p_client_name TEXT DEFAULT NULL,
    p_total_items INTEGER,
    p_subtotal DECIMAL(12,2),
    p_discount_percent DECIMAL(5,2),
    p_discount_amount DECIMAL(12,2),
    p_reason TEXT DEFAULT NULL,
    p_requested_by TEXT,
    p_promotion_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
BEGIN
    INSERT INTO public.promotion_requests (
        sale_id, branch_id, client_id, client_name, total_items,
        subtotal, requested_discount_percent, requested_discount_amount,
        reason, requested_by, promotion_id
    ) VALUES (
        p_sale_id, p_branch_id, p_client_id, p_client_name, p_total_items,
        p_subtotal, p_discount_percent, p_discount_amount,
        p_reason, p_requested_by, p_promotion_id
    ) RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Función para aprobar solicitud de promoción
CREATE OR REPLACE FUNCTION public.approve_promotion_request(
    p_request_id UUID,
    p_reviewed_by TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.promotion_requests
    SET status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW()
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada o ya procesada';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Función para rechazar solicitud de promoción
CREATE OR REPLACE FUNCTION public.reject_promotion_request(
    p_request_id UUID,
    p_reviewed_by TEXT,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.promotion_requests
    SET status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        rejection_reason = p_rejection_reason
    WHERE id = p_request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitud no encontrada o ya procesada';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PARTE 2: SISTEMA DE TRACKING DE ENVÍOS
-- =====================================================

-- Tabla de órdenes de envío
CREATE TABLE IF NOT EXISTS public.shipping_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('stock_transfer', 'barter_transfer', 'restock_sheet')),
    entity_id UUID NOT NULL,
    origin_branch_id TEXT REFERENCES public.branches(id),
    destination_branch_id TEXT REFERENCES public.branches(id),
    carrier TEXT,
    tracking_number TEXT,
    status TEXT CHECK (status IN ('pending', 'shipped', 'in_transit', 'delivered', 'cancelled')) DEFAULT 'pending',
    estimated_delivery_date DATE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de historial de tracking
CREATE TABLE IF NOT EXISTS public.shipping_tracking_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shipping_order_id UUID REFERENCES public.shipping_orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.shipping_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_tracking_history ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Enable All for Auth shipping_orders" ON public.shipping_orders 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable All for Auth shipping_tracking_history" ON public.shipping_tracking_history 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_shipping_orders_entity ON public.shipping_orders(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shipping_tracking_shipping ON public.shipping_tracking_history(shipping_order_id);

-- Función para crear orden de envío
CREATE OR REPLACE FUNCTION public.create_shipping_order(
    p_entity_type TEXT,
    p_entity_id UUID,
    p_origin_branch_id TEXT,
    p_destination_branch_id TEXT,
    p_created_by TEXT,
    p_carrier TEXT DEFAULT NULL,
    p_tracking_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_shipping_id UUID;
BEGIN
    INSERT INTO public.shipping_orders (
        entity_type, entity_id, origin_branch_id, destination_branch_id,
        created_by, carrier, tracking_number, notes
    ) VALUES (
        p_entity_type, p_entity_id, p_origin_branch_id, p_destination_branch_id,
        p_created_by, p_carrier, p_tracking_number, p_notes
    ) RETURNING id INTO v_shipping_id;
    
    -- Agregar entrada inicial al historial
    INSERT INTO public.shipping_tracking_history (shipping_order_id, status, notes)
    VALUES (v_shipping_id, 'pending', 'Orden de envío creada');
    
    RETURN v_shipping_id;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar estado de envío
CREATE OR REPLACE FUNCTION public.update_shipping_status(
    p_shipping_id UUID,
    p_new_status TEXT,
    p_carrier TEXT DEFAULT NULL,
    p_tracking_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.shipping_orders
    SET status = p_new_status,
        carrier = COALESCE(p_carrier, carrier),
        tracking_number = COALESCE(p_tracking_number, tracking_number),
        shipped_at = CASE WHEN p_new_status = 'shipped' THEN NOW() ELSE shipped_at END,
        delivered_at = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE delivered_at END,
        updated_at = NOW()
    WHERE id = p_shipping_id;
    
    -- Agregar entrada al historial
    INSERT INTO public.shipping_tracking_history (shipping_order_id, status, notes)
    VALUES (p_shipping_id, p_new_status, p_notes);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener tracking de una entidad
CREATE OR REPLACE FUNCTION public.get_shipping_by_entity(
    p_entity_type TEXT,
    p_entity_id UUID
)
RETURNS TABLE (
    id UUID,
    carrier TEXT,
    tracking_number TEXT,
    status TEXT,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT so.id, so.carrier, so.tracking_number, so.status,
           so.shipped_at, so.delivered_at, so.notes, so.created_at
    FROM public.shipping_orders so
    WHERE so.entity_type = p_entity_type AND so.entity_id = p_entity_id
    ORDER BY so.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Agregar columna shipping_id a tablas existentes
ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS shipping_id UUID REFERENCES public.shipping_orders(id);
ALTER TABLE public.barter_transfers ADD COLUMN IF NOT EXISTS shipping_id UUID REFERENCES public.shipping_orders(id);
ALTER TABLE public.restock_sheets ADD COLUMN IF NOT EXISTS shipping_id UUID REFERENCES public.shipping_orders(id);

-- =====================================================
-- PARTE 3: DIFERENCIAS EN RESURTIDOS (SOLO ADMIN)
-- =====================================================

-- Agregar columnas a restock_items para diferencias
ALTER TABLE public.restock_items ADD COLUMN IF NOT EXISTS received_quantity INTEGER;
ALTER TABLE public.restock_items ADD COLUMN IF NOT EXISTS difference_reason TEXT;

-- Tabla de incidencias de resurtido
CREATE TABLE IF NOT EXISTS public.restock_incidents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restock_sheet_id UUID REFERENCES public.restock_sheets(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT,
    expected_quantity INTEGER NOT NULL,
    received_quantity INTEGER NOT NULL,
    difference INTEGER GENERATED ALWAYS AS (received_quantity - expected_quantity) STORED,
    incident_type TEXT CHECK (incident_type IN ('missing', 'damaged', 'extra', 'wrong_product', 'other')) DEFAULT 'missing',
    notes TEXT,
    status TEXT CHECK (status IN ('pending', 'resolved', 'credited')) DEFAULT 'pending',
    created_by TEXT NOT NULL,
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    credit_amount DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.restock_incidents ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Enable All for Auth restock_incidents" ON public.restock_incidents 
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_restock_incidents_sheet ON public.restock_incidents(restock_sheet_id);
CREATE INDEX IF NOT EXISTS idx_restock_incidents_status ON public.restock_incidents(status);

-- Función para confirmar recepción con diferencias
CREATE OR REPLACE FUNCTION public.confirm_restock_with_differences(
    p_restock_sheet_id UUID,
    p_items JSONB,
    p_confirmed_by TEXT
)
RETURNS VOID AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_expected INTEGER;
    v_received INTEGER;
    v_branch_id TEXT;
    v_difference INTEGER;
BEGIN
    -- Obtener branch_id del restock
    SELECT branch_id INTO v_branch_id FROM public.restock_sheets WHERE id = p_restock_sheet_id;
    
    -- Procesar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'productId')::uuid;
        v_expected := (v_item->>'expectedQuantity')::integer;
        v_received := (v_item->>'receivedQuantity')::integer;
        v_difference := v_received - v_expected;
        
        -- Actualizar restock_items
        UPDATE public.restock_items
        SET received_quantity = v_received,
            difference_reason = v_item->>'reason'
        WHERE sheet_id = p_restock_sheet_id AND product_id = v_product_id;
        
        -- Ajustar inventario con la cantidad recibida
        UPDATE public.inventory
        SET stock = stock + v_received
        WHERE product_id = v_product_id AND branch_id = v_branch_id;
        
        -- Si hay diferencia, crear incidencia
        IF v_difference <> 0 THEN
            INSERT INTO public.restock_incidents (
                restock_sheet_id, product_id, product_name,
                expected_quantity, received_quantity,
                incident_type, notes, created_by
            ) VALUES (
                p_restock_sheet_id, v_product_id, v_item->>'productName',
                v_expected, v_received,
                CASE 
                    WHEN v_difference < 0 THEN 'missing'
                    ELSE 'extra'
                END,
                v_item->>'reason',
                p_confirmed_by
            );
        END IF;
    END LOOP;
    
    -- Actualizar estado del restock_sheet
    UPDATE public.restock_sheets
    SET status = 'completed',
        arrival_time = NOW(),
        updated_at = NOW()
    WHERE id = p_restock_sheet_id;
END;
$$ LANGUAGE plpgsql;

-- Función para resolver incidencia
CREATE OR REPLACE FUNCTION public.resolve_restock_incident(
    p_incident_id UUID,
    p_resolved_by TEXT,
    p_credit_amount DECIMAL(12,2) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.restock_incidents
    SET status = 'resolved',
        resolved_by = p_resolved_by,
        resolved_at = NOW(),
        credit_amount = p_credit_amount,
        notes = COALESCE(p_notes, notes)
    WHERE id = p_incident_id;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener incidencias pendientes
CREATE OR REPLACE FUNCTION public.get_pending_restock_incidents()
RETURNS TABLE (
    id UUID,
    restock_sheet_id UUID,
    product_name TEXT,
    expected_quantity INTEGER,
    received_quantity INTEGER,
    difference INTEGER,
    incident_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT ri.id, ri.restock_sheet_id, ri.product_name,
           ri.expected_quantity, ri.received_quantity, ri.difference,
           ri.incident_type, ri.created_at
    FROM public.restock_incidents ri
    WHERE ri.status = 'pending'
    ORDER BY ri.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DATOS INICIALES
-- =====================================================

-- Insertar promociones de ejemplo
INSERT INTO public.wholesale_promotions (name, description, min_quantity, discount_percent, is_active, auto_apply)
VALUES 
    ('Promo Básica', 'Descuento para compras desde 50 unidades', 50, 5.00, true, true),
    ('Promo Media', 'Descuento para compras desde 100 unidades', 100, 10.00, true, true),
    ('Promo Mayorista', 'Descuento para compras desde 200 unidades', 200, 15.00, true, true)
ON CONFLICT DO NOTHING;

-- Comentarios descriptivos
COMMENT ON TABLE public.wholesale_promotions IS 'Promociones configurables para ventas mayoreo';
COMMENT ON TABLE public.promotion_requests IS 'Solicitudes de promoción pendientes de aprobación';
COMMENT ON TABLE public.shipping_orders IS 'Órdenes de envío para traspasos, trueques y resurtidos';
COMMENT ON TABLE public.shipping_tracking_history IS 'Historial de seguimiento de envíos';
COMMENT ON TABLE public.restock_incidents IS 'Incidencias de diferencias en resurtidos';
