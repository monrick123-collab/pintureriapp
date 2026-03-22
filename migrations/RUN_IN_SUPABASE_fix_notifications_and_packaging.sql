-- =============================================================================
-- EJECUTAR ESTE SCRIPT EN SUPABASE SQL EDITOR
-- Soluciona:
--   1. Notificaciones (campanitas) no aparecen en ningún perfil
--   2. "Finalizar Envasado" no actualiza inventario ni notifica al Admin
-- =============================================================================


-- =============================================================================
-- PARTE 1: NOTIFICACIONES — política RLS para anon
-- Sin esto: INSERT falla silencioso, SELECT devuelve vacío
-- =============================================================================

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own or role notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.notifications;

CREATE POLICY "Enable All for Anon" ON public.notifications
    FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON public.notifications TO anon;

-- Columna de filtro por sucursal (idempotente)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS target_branch_id TEXT;

DO $$
BEGIN
    BEGIN
        ALTER TABLE public.notifications
            ADD CONSTRAINT notifications_target_branch_id_fkey
            FOREIGN KEY (target_branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_target_branch
    ON public.notifications(target_branch_id);

-- PRUEBA: si ves "Test Notificaciones" en las campanitas, la parte 1 funciona.
-- Bórrala después con: DELETE FROM public.notifications WHERE title = 'Test Notificaciones';
INSERT INTO public.notifications (target_role, title, message, action_url, is_read)
VALUES ('ALL', 'Test Notificaciones', 'Si ves esto en todos los perfiles, las notificaciones funcionan correctamente.', '/', false);


-- =============================================================================
-- PARTE 2: ENVASADO v3 — tablas + RPC complete_packaging_v2
-- Sin esto: "Finalizar Envasado" falla en silencio y revierte el estado
-- =============================================================================

-- 2a. packaging_settings
CREATE TABLE IF NOT EXISTS public.packaging_settings (
    key         TEXT        PRIMARY KEY,
    value       NUMERIC     NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.packaging_settings (key, value, description)
VALUES
    ('galon_liters', 3.785, 'Litros por galón americano estándar'),
    ('drum_liters',  200,   'Litros por tambo (capacidad estándar)')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.packaging_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_settings;
CREATE POLICY "Enable All for Anon" ON public.packaging_settings
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_settings TO anon;


-- 2b. packaging_order_lines
CREATE TABLE IF NOT EXISTS public.packaging_order_lines (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID          NOT NULL
                                      REFERENCES public.packaging_requests(id) ON DELETE CASCADE,
    package_type        TEXT          NOT NULL
                                      CHECK (package_type IN ('cuarto_litro', 'medio_litro', 'litro', 'galon')),
    target_product_id   UUID          NOT NULL REFERENCES public.products(id),
    quantity_requested  INT           NOT NULL CHECK (quantity_requested > 0),
    liters_per_unit     NUMERIC(10,4) NOT NULL CHECK (liters_per_unit > 0),
    liters_subtotal     NUMERIC(10,4) GENERATED ALWAYS AS (quantity_requested * liters_per_unit) STORED,
    quantity_produced   INT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.packaging_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_order_lines;
CREATE POLICY "Enable All for Anon" ON public.packaging_order_lines
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_order_lines TO anon;

CREATE INDEX IF NOT EXISTS idx_packaging_order_lines_order_id
    ON public.packaging_order_lines(order_id);


-- 2c. packaging_waste
CREATE TABLE IF NOT EXISTS public.packaging_waste (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID          NOT NULL REFERENCES public.packaging_requests(id),
    waste_liters  NUMERIC(10,4) NOT NULL CHECK (waste_liters >= 0),
    notes         TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.packaging_waste ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_waste;
CREATE POLICY "Enable All for Anon" ON public.packaging_waste
    FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_waste TO anon;

CREATE INDEX IF NOT EXISTS idx_packaging_waste_order_id
    ON public.packaging_waste(order_id);


-- 2d. ALTER packaging_requests (campos extra, idempotente)
ALTER TABLE public.packaging_requests
    ADD COLUMN IF NOT EXISTS total_liters_used NUMERIC(10,4);

ALTER TABLE public.packaging_requests
    ADD COLUMN IF NOT EXISTS waste_liters NUMERIC(10,4);

ALTER TABLE public.packaging_requests
    ALTER COLUMN target_package_type DROP NOT NULL;

ALTER TABLE public.packaging_requests
    DROP CONSTRAINT IF EXISTS packaging_requests_target_package_type_check;

ALTER TABLE public.packaging_requests
    ADD CONSTRAINT packaging_requests_target_package_type_check
    CHECK (
        target_package_type IS NULL
        OR target_package_type IN ('cuarto_litro', 'medio_litro', 'litro', 'galon')
    );


-- 2e. RPC complete_packaging_v2 (SECURITY DEFINER = no depende de RLS)
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

    SELECT value INTO v_drum_liters
    FROM public.packaging_settings
    WHERE key = 'drum_liters';

    v_drum_liters    := COALESCE(v_drum_liters, 200);
    v_total_capacity := v_order.quantity_drum * v_drum_liters;

    FOR v_line IN
        SELECT * FROM public.packaging_order_lines
        WHERE order_id = p_order_id
        FOR UPDATE
    LOOP
        v_total_liters := v_total_liters + v_line.liters_subtotal;
        v_lines_count  := v_lines_count + 1;

        INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
        VALUES (v_line.target_product_id, v_order.branch_id, v_line.quantity_requested, NOW())
        ON CONFLICT (product_id, branch_id)
        DO UPDATE SET
            stock      = public.inventory.stock + EXCLUDED.stock,
            updated_at = NOW();

        UPDATE public.packaging_order_lines
        SET quantity_produced = quantity_requested
        WHERE id = v_line.id;
    END LOOP;

    IF v_lines_count = 0 THEN
        RAISE EXCEPTION
            'La orden no tiene líneas de producción. Agrega al menos una presentación.';
    END IF;

    IF v_total_liters > v_total_capacity THEN
        RAISE EXCEPTION
            'Los litros totales (%.4f L) superan la capacidad del tambo (%.0f L).',
            v_total_liters, v_total_capacity;
    END IF;

    v_waste_liters := v_total_capacity - v_total_liters;

    INSERT INTO public.packaging_waste (order_id, waste_liters, notes)
    VALUES (p_order_id, v_waste_liters, 'Merma calculada al finalizar. Usuario: ' || p_user_id);

    UPDATE public.inventory
    SET
        stock      = GREATEST(0, stock - v_order.quantity_drum),
        updated_at = NOW()
    WHERE product_id = v_order.bulk_product_id
      AND branch_id  = v_order.branch_id;

    UPDATE public.packaging_requests SET
        status            = 'completed',
        total_liters_used = v_total_liters,
        waste_liters      = v_waste_liters,
        completed_at      = NOW(),
        updated_at        = NOW()
    WHERE id = p_order_id;

    RETURN json_build_object(
        'total_liters_used', v_total_liters,
        'waste_liters',      v_waste_liters,
        'total_capacity',    v_total_capacity,
        'lines_count',       v_lines_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_packaging_v2(UUID, TEXT) TO anon;


-- =============================================================================
-- VERIFICACIÓN FINAL
-- Corre esto para confirmar que todo quedó bien:
-- =============================================================================
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'notifications';
-- SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'packaging_order_lines';
-- SELECT proname FROM pg_proc WHERE proname = 'complete_packaging_v2';
