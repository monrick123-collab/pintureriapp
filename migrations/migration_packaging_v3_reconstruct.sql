-- =============================================================================
-- MIGRACIÓN: Envasado v3 — Reconstrucción completa del módulo
--
-- Cambios:
--   1. Nueva tabla: packaging_settings  (galón configurable)
--   2. Nueva tabla: packaging_order_lines  (multi-presentación por orden)
--   3. Nueva tabla: packaging_waste  (registro de merma)
--   4. ALTER packaging_requests: campos total_liters_used + waste_liters;
--      target_package_type pasa a nullable (legacy)
--   5. RPC complete_packaging_v2: transacción 100% atómica
--   6. Políticas RLS anon para las 3 tablas nuevas
--
-- COMPATIBILIDAD: Las órdenes antiguas (1 tipo de envase) NO se rompen.
-- =============================================================================


-- =============================================================================
-- 1. TABLA: packaging_settings
--    Constantes de negocio configurables desde el ERP.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.packaging_settings (
    key         TEXT        PRIMARY KEY,
    value       NUMERIC     NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores por defecto (INSERT OR IGNORE para idempotencia)
INSERT INTO public.packaging_settings (key, value, description)
VALUES
    ('galon_liters', 3.785,
     'Litros por galón. Usa 3.785 para galón americano estándar o 4.0 para cubeta exacta.'),
    ('drum_liters',  200,
     'Litros por tambo. Capacidad estándar del contenedor de materia prima.')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE public.packaging_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_settings;
CREATE POLICY "Enable All for Anon" ON public.packaging_settings
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_settings TO anon;


-- =============================================================================
-- 2. TABLA: packaging_order_lines
--    Líneas de producción de una orden (multi-presentación).
--    Una sola orden puede tener galones + litros + medios + cuartos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.packaging_order_lines (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID        NOT NULL
                                    REFERENCES public.packaging_requests(id)
                                    ON DELETE CASCADE,
    package_type        TEXT        NOT NULL
                                    CHECK (package_type IN
                                        ('cuarto_litro', 'medio_litro', 'litro', 'galon')),
    target_product_id   UUID        NOT NULL
                                    REFERENCES public.products(id),
    -- Unidades que el usuario quiere llenar
    quantity_requested  INT         NOT NULL CHECK (quantity_requested > 0),
    -- Litros por unidad CONGELADOS al momento de crear la orden.
    -- Para 'galon' toma el valor de packaging_settings en ese instante.
    liters_per_unit     NUMERIC(10,4) NOT NULL CHECK (liters_per_unit > 0),
    -- Columna calculada: litros totales de esta línea
    liters_subtotal     NUMERIC(10,4) GENERATED ALWAYS AS
                            (quantity_requested * liters_per_unit) STORED,
    -- Unidades realmente producidas (NULL hasta que se completa la orden)
    quantity_produced   INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.packaging_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_order_lines;
CREATE POLICY "Enable All for Anon" ON public.packaging_order_lines
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_order_lines TO anon;


-- =============================================================================
-- 3. TABLA: packaging_waste
--    Registro permanente de merma por orden.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.packaging_waste (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID        NOT NULL
                              REFERENCES public.packaging_requests(id),
    waste_liters  NUMERIC(10,4) NOT NULL CHECK (waste_liters >= 0),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.packaging_waste ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_waste;
CREATE POLICY "Enable All for Anon" ON public.packaging_waste
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_waste TO anon;


-- =============================================================================
-- 4. ALTER packaging_requests
--    Extender la tabla existente sin romper datos antiguos.
-- =============================================================================

-- Litros totales realmente usados (calculado al completar)
ALTER TABLE public.packaging_requests
    ADD COLUMN IF NOT EXISTS total_liters_used NUMERIC(10,4);

-- Merma en litros (calculada al completar)
ALTER TABLE public.packaging_requests
    ADD COLUMN IF NOT EXISTS waste_liters NUMERIC(10,4);

-- target_package_type pasa a nullable: las órdenes v3 (multi-línea)
-- no usan este campo; las órdenes legacy lo conservan.
ALTER TABLE public.packaging_requests
    ALTER COLUMN target_package_type DROP NOT NULL;

-- Actualizar el CHECK para aceptar NULL (órdenes v3)
ALTER TABLE public.packaging_requests
    DROP CONSTRAINT IF EXISTS packaging_requests_target_package_type_check;

ALTER TABLE public.packaging_requests
    ADD CONSTRAINT packaging_requests_target_package_type_check
    CHECK (
        target_package_type IS NULL
        OR target_package_type IN ('cuarto_litro', 'medio_litro', 'litro', 'galon')
    );


-- =============================================================================
-- 5. RPC: complete_packaging_v2
--
--    Transacción 100% atómica. Hace TODO en una sola llamada:
--      a) Valida que los litros totales no excedan la capacidad del tambo
--      b) Descuenta el tambo del inventario de la sucursal
--      c) Suma cada presentación producida al inventario de la sucursal
--      d) Registra la merma en packaging_waste
--      e) Marca la orden como 'completed' con totales finales
--
--    Si CUALQUIER paso falla, toda la transacción hace ROLLBACK.
--
--    INPUTS:
--      p_order_id  — UUID de la packaging_request en estado 'processing'
--      p_user_id   — ID del usuario que ejecuta (para auditoría)
--
--    RETURNS: JSON con { total_liters_used, waste_liters, total_capacity, lines_count }
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
    v_total_capacity NUMERIC;
    v_total_liters   NUMERIC := 0;
    v_waste_liters   NUMERIC;
    v_lines_count    INT     := 0;
BEGIN
    -- -----------------------------------------------------------------------
    -- a) Cargar y bloquear la orden (FOR UPDATE previene doble-click)
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
    -- c) Procesar cada línea de producción
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
    -- d) Validar que los litros no superen la capacidad del tambo
    --    (doble-seguro: la UI también lo bloquea)
    -- -----------------------------------------------------------------------
    IF v_total_liters > v_total_capacity THEN
        RAISE EXCEPTION
            'Los litros totales (%.4f L) superan la capacidad del tambo (%.0f L). Revisa las cantidades.',
            v_total_liters, v_total_capacity;
    END IF;

    -- -----------------------------------------------------------------------
    -- e) Calcular merma y registrarla
    -- -----------------------------------------------------------------------
    v_waste_liters := v_total_capacity - v_total_liters;

    INSERT INTO public.packaging_waste (order_id, waste_liters, notes)
    VALUES (
        p_order_id,
        v_waste_liters,
        'Merma calculada al finalizar envasado. Usuario: ' || p_user_id
    );

    -- -----------------------------------------------------------------------
    -- f) Descontar el tambo del inventario (en unidades de tambo, no litros)
    --    El inventario del producto "Tambo 200L" se mide en piezas.
    -- -----------------------------------------------------------------------
    UPDATE public.inventory
    SET
        stock      = GREATEST(0, stock - v_order.quantity_drum),
        updated_at = NOW()
    WHERE product_id = v_order.bulk_product_id
      AND branch_id  = v_order.branch_id;

    -- -----------------------------------------------------------------------
    -- g) Cerrar la orden
    -- -----------------------------------------------------------------------
    UPDATE public.packaging_requests SET
        status            = 'completed',
        total_liters_used = v_total_liters,
        waste_liters      = v_waste_liters,
        completed_at      = NOW(),
        updated_at        = NOW()
    WHERE id = p_order_id;

    -- -----------------------------------------------------------------------
    -- h) Retornar resumen para el frontend
    -- -----------------------------------------------------------------------
    RETURN json_build_object(
        'total_liters_used', v_total_liters,
        'waste_liters',      v_waste_liters,
        'total_capacity',    v_total_capacity,
        'lines_count',       v_lines_count
    );

END;
$$;

-- Grant de ejecución para el rol anon
GRANT EXECUTE ON FUNCTION public.complete_packaging_v2(UUID, TEXT) TO anon;


-- =============================================================================
-- 6. ÍNDICES de rendimiento
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_packaging_order_lines_order_id
    ON public.packaging_order_lines(order_id);

CREATE INDEX IF NOT EXISTS idx_packaging_waste_order_id
    ON public.packaging_waste(order_id);

CREATE INDEX IF NOT EXISTS idx_packaging_requests_branch_status
    ON public.packaging_requests(branch_id, status);


-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================
DO $$
BEGIN
    -- Verificar las 3 tablas nuevas
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packaging_settings'),
        'ERROR: tabla packaging_settings no existe';
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packaging_order_lines'),
        'ERROR: tabla packaging_order_lines no existe';
    ASSERT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'packaging_waste'),
        'ERROR: tabla packaging_waste no existe';

    -- Verificar columnas nuevas en packaging_requests
    ASSERT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'packaging_requests' AND column_name = 'total_liters_used'
    ), 'ERROR: columna total_liters_used no existe en packaging_requests';

    ASSERT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'packaging_requests' AND column_name = 'waste_liters'
    ), 'ERROR: columna waste_liters no existe en packaging_requests';

    -- Verificar valores de configuración
    ASSERT EXISTS (SELECT 1 FROM public.packaging_settings WHERE key = 'galon_liters'),
        'ERROR: configuración galon_liters no insertada';

    RAISE NOTICE '✅ Migración packaging_v3 ejecutada correctamente.';
    RAISE NOTICE '   → packaging_settings: galón = % L',
        (SELECT value FROM public.packaging_settings WHERE key = 'galon_liters');
    RAISE NOTICE '   → packaging_settings: tambo = % L',
        (SELECT value FROM public.packaging_settings WHERE key = 'drum_liters');
END $$;
