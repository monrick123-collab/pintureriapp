-- =============================================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Fix Bug: El inventario no se actualiza al confirmar recepción de resurtido
--
-- CAUSA RAÍZ: El RPC confirm_restock_with_differences usa UPDATE simple.
-- Si no existe fila en inventory para ese product_id+branch_id, el UPDATE
-- no hace match con ninguna fila y silenciosamente no hace nada.
-- FIX: Cambiar a UPSERT (INSERT...ON CONFLICT) igual que confirm_restock_arrival.
-- =============================================================================


-- 1. Columnas necesarias en restock_sheets (si no existen)
ALTER TABLE public.restock_sheets
    ADD COLUMN IF NOT EXISTS departure_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMP WITH TIME ZONE;

-- 2. Columnas en restock_items para diferencias (si no existen)
ALTER TABLE public.restock_items
    ADD COLUMN IF NOT EXISTS received_quantity INTEGER,
    ADD COLUMN IF NOT EXISTS difference_reason TEXT;

-- 3. Tabla de incidencias de resurtido (si no existe)
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

CREATE INDEX IF NOT EXISTS idx_restock_incidents_sheet ON public.restock_incidents(restock_sheet_id);
CREATE INDEX IF NOT EXISTS idx_restock_incidents_status ON public.restock_incidents(status);

-- 4. RLS anon para restock_incidents
ALTER TABLE public.restock_incidents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'restock_incidents' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.restock_incidents', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Enable All for Anon" ON public.restock_incidents
    FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON public.restock_incidents TO anon;


-- 5. RECREAR el RPC con UPSERT en vez de UPDATE
--    ANTES: UPDATE inventory SET stock = stock + v_received WHERE ...  (silencioso si no hay fila)
--    AHORA: INSERT ... ON CONFLICT DO UPDATE (crea la fila si no existe)
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
    -- Obtener branch_id de la hoja de resurtido
    SELECT branch_id INTO v_branch_id FROM public.restock_sheets WHERE id = p_restock_sheet_id;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró la hoja de resurtido con id %', p_restock_sheet_id;
    END IF;

    -- Procesar cada item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'productId')::uuid;
        v_expected := (v_item->>'expectedQuantity')::integer;
        v_received := (v_item->>'receivedQuantity')::integer;
        v_difference := v_received - v_expected;

        -- Actualizar cantidades recibidas en restock_items
        UPDATE public.restock_items
        SET received_quantity = v_received,
            difference_reason = v_item->>'reason'
        WHERE sheet_id = p_restock_sheet_id AND product_id = v_product_id;

        -- UPSERT en inventory: incrementa si ya existe, crea fila si no existe
        INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
        VALUES (v_product_id, v_branch_id, v_received, NOW())
        ON CONFLICT (product_id, branch_id) DO UPDATE
            SET stock = public.inventory.stock + EXCLUDED.stock,
                updated_at = NOW();

        -- Registrar incidencia si hay diferencia
        IF v_difference <> 0 THEN
            INSERT INTO public.restock_incidents (
                restock_sheet_id, product_id, product_name,
                expected_quantity, received_quantity,
                incident_type, notes, created_by
            ) VALUES (
                p_restock_sheet_id, v_product_id, v_item->>'productName',
                v_expected, v_received,
                CASE WHEN v_difference < 0 THEN 'missing' ELSE 'extra' END,
                v_item->>'reason',
                p_confirmed_by
            );
        END IF;
    END LOOP;

    -- Marcar hoja de resurtido como completada
    UPDATE public.restock_sheets
    SET status = 'completed',
        arrival_time = NOW(),
        updated_at = NOW()
    WHERE id = p_restock_sheet_id;
END;
$$ LANGUAGE plpgsql;


-- 6. GRANT EXECUTE al rol anon
GRANT EXECUTE ON FUNCTION public.confirm_restock_with_differences(UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_restock_incident(UUID, TEXT, DECIMAL, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_pending_restock_incidents() TO anon;


-- =============================================================================
-- VERIFICACIÓN — Ejecutar después para confirmar que quedó bien:
-- =============================================================================

-- El RPC debe existir:
SELECT routine_name, routine_type FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'confirm_restock_with_differences';

-- La tabla restock_sheets debe tener departure_time y arrival_time:
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'restock_sheets'
AND column_name IN ('departure_time', 'arrival_time');

-- restock_incidents debe tener política anon:
SELECT policyname, roles FROM pg_policies WHERE tablename = 'restock_incidents';
