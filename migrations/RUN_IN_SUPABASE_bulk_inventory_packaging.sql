-- =============================================================================
-- MIGRACIÓN: Envasado v3 — Inventario a Granel (Remanentes)
-- 
-- Cambios:
--   1. Nueva tabla: branch_bulk_inventory (guarda litros restantes de tambos útiles)
--   2. RLS Policies para la nueva tabla
--   3. RPC complete_packaging_v2 MODIFICADO:
--      - Suma los tambos abiertos al granel disponible
--      - Descuenta litros usados del granel disponible
--      - Evita convertir todo el sobrante en merma
-- =============================================================================

-- =============================================================================
-- 1. TABLA: branch_bulk_inventory
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.branch_bulk_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL REFERENCES public.branches(id),
    product_id UUID NOT NULL REFERENCES public.products(id),
    available_liters NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (available_liters >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(branch_id, product_id)
);

-- RLS
ALTER TABLE public.branch_bulk_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.branch_bulk_inventory;
CREATE POLICY "Enable All for Anon" ON public.branch_bulk_inventory
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.branch_bulk_inventory TO anon;


-- =============================================================================
-- 2. RPC: complete_packaging_v2 (MODIFICADO)
-- =============================================================================

DROP FUNCTION IF EXISTS complete_packaging_v2(UUID, TEXT);

CREATE OR REPLACE FUNCTION complete_packaging_v2(
    p_order_id UUID,
    p_user_id  TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order          RECORD;
    v_line           RECORD;
    v_drum_liters    NUMERIC;
    v_total_capacity NUMERIC := 0;
    v_total_liters   NUMERIC := 0;
    v_lines_count    INT     := 0;
    v_available_bulk NUMERIC := 0;
BEGIN
    -- -----------------------------------------------------------------------
    -- a) Cargar y bloquear la orden
    -- -----------------------------------------------------------------------
    SELECT * INTO v_order
    FROM public.packaging_requests
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Orden de envasado no encontrada: %', p_order_id;
    END IF;

    IF v_order.status != 'processing' THEN
        RAISE EXCEPTION
            'La orden debe estar en estado "processing" para finalizar. Estado actual: %',
            v_order.status;
    END IF;

    -- -----------------------------------------------------------------------
    -- b) Leer litros por tambo desde configuración
    -- -----------------------------------------------------------------------
    SELECT value INTO v_drum_liters
    FROM public.packaging_settings
    WHERE key = 'drum_liters';

    v_drum_liters    := COALESCE(v_drum_liters, 200);
    v_total_capacity := v_order.quantity_drum * v_drum_liters;

    -- -----------------------------------------------------------------------
    -- c) Añadir los tambos destinados al inventario a granel y descontarlos
    -- -----------------------------------------------------------------------
    IF v_order.quantity_drum > 0 THEN
        -- Sumar los litros de los tambos abiertos al granel de la sucursal
        INSERT INTO public.branch_bulk_inventory (branch_id, product_id, available_liters, updated_at)
        VALUES (v_order.branch_id, v_order.bulk_product_id, v_total_capacity, NOW())
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET
            available_liters = public.branch_bulk_inventory.available_liters + EXCLUDED.available_liters,
            updated_at = NOW();

        -- Descontar el tambo completo físico de public.inventory
        UPDATE public.inventory
        SET
            stock      = GREATEST(0, stock - v_order.quantity_drum),
            updated_at = NOW()
        WHERE product_id = v_order.bulk_product_id
          AND branch_id  = v_order.branch_id;
    END IF;

    -- -----------------------------------------------------------------------
    -- d) Procesar cada línea de producción
    -- -----------------------------------------------------------------------
    FOR v_line IN
        SELECT * FROM public.packaging_order_lines
        WHERE order_id = p_order_id
        FOR UPDATE
    LOOP
        v_total_liters := v_total_liters + v_line.liters_subtotal;
        v_lines_count  := v_lines_count + 1;

        -- Agregar unidades producidas al inventario de la sucursal
        INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
        VALUES (v_line.target_product_id, v_order.branch_id, v_line.quantity_requested, NOW())
        ON CONFLICT (product_id, branch_id)
        DO UPDATE SET
            stock      = public.inventory.stock + EXCLUDED.stock,
            updated_at = NOW();

        -- Marcar línea como producida
        UPDATE public.packaging_order_lines
        SET quantity_produced = quantity_requested
        WHERE id = v_line.id;
    END LOOP;

    IF v_lines_count = 0 THEN
        RAISE EXCEPTION
            'La orden no tiene líneas de producción. Agrega al menos una presentación.';
    END IF;

    -- -----------------------------------------------------------------------
    -- e) Validar que los litros producidos NO superen el GRANEL TOTAL disponible
    -- -----------------------------------------------------------------------
    SELECT available_liters INTO v_available_bulk
    FROM public.branch_bulk_inventory
    WHERE branch_id = v_order.branch_id AND product_id = v_order.bulk_product_id
    FOR UPDATE;

    v_available_bulk := COALESCE(v_available_bulk, 0);

    IF v_total_liters > v_available_bulk THEN
        RAISE EXCEPTION
            'Los litros totales (%.4f L) superan el granel disponible (%.4f L). Revisa las cantidades.',
            v_total_liters, v_available_bulk;
    END IF;

    -- -----------------------------------------------------------------------
    -- f) Descontar los litros usados del granel disponible
    -- -----------------------------------------------------------------------
    UPDATE public.branch_bulk_inventory
    SET available_liters = available_liters - v_total_liters,
        updated_at = NOW()
    WHERE branch_id = v_order.branch_id AND product_id = v_order.bulk_product_id;

    -- -----------------------------------------------------------------------
    -- g) Registrar merma
    --    En esta v3 con granel, ya NO se asume que lo que sobra de 200L es merma.
    --    La merma intrínseca se registra como 0 (o podría capturarse luego en UI).
    -- -----------------------------------------------------------------------
    INSERT INTO public.packaging_waste (order_id, waste_liters, notes)
    VALUES (
        p_order_id,
        0,
        'Merma real=0 calculada usando inventario a granel (remanentes guardados en BD). Usuario: ' || p_user_id
    );

    -- -----------------------------------------------------------------------
    -- h) Cerrar la orden
    -- -----------------------------------------------------------------------
    UPDATE public.packaging_requests SET
        status            = 'completed',
        total_liters_used = v_total_liters,
        waste_liters      = 0,
        completed_at      = NOW(),
        updated_at        = NOW()
    WHERE id = p_order_id;

    -- -----------------------------------------------------------------------
    -- i) Retornar resumen para el frontend
    -- -----------------------------------------------------------------------
    RETURN json_build_object(
        'total_liters_used', v_total_liters,
        'waste_liters',      0,
        'available_bulk',    v_available_bulk - v_total_liters,
        'lines_count',       v_lines_count
    );

END;
$$;

-- Grant de ejecución para el rol anon
GRANT EXECUTE ON FUNCTION public.complete_packaging_v2(UUID, TEXT) TO anon;

-- INDEX
CREATE INDEX IF NOT EXISTS idx_branch_bulk_inventory_branch
    ON public.branch_bulk_inventory(branch_id);
