-- =================================================================
-- MIGRACIÓN: Sincronización de Folios Municipales
-- =================================================================

-- 1. Actualizar los valores por defecto a 0 para evitar el problema del -1
ALTER TABLE public.branch_folios 
    ALTER COLUMN last_municipal_folio SET DEFAULT 0,
    ALTER COLUMN last_restock_folio SET DEFAULT 0,
    ALTER COLUMN last_transfer_folio SET DEFAULT 0,
    ALTER COLUMN last_quotation_folio SET DEFAULT 0,
    ALTER COLUMN last_return_folio SET DEFAULT 0;

-- 2. Sincronizar los contadores con el máximo actual encontrado en la tabla de ventas
DO $$
DECLARE
    r RECORD;
    v_max_folio INTEGER;
BEGIN
    -- Para cada sucursal que tenga ventas municipales
    FOR r IN (SELECT DISTINCT id FROM public.branches) LOOP
        -- Obtener el máximo folio actual para esta sucursal
        SELECT COALESCE(MAX(folio), 0) INTO v_max_folio 
        FROM public.municipal_sales 
        WHERE branch_id = r.id;

        -- Actualizar el contador en branch_folios
        UPDATE public.branch_folios
        SET last_municipal_folio = v_max_folio
        WHERE branch_id = r.id;

        -- Si no existe la fila para la sucursal, la creamos con el folio actual
        IF NOT FOUND THEN
            INSERT INTO public.branch_folios (branch_id, last_municipal_folio)
            VALUES (r.id, v_max_folio);
        END IF;
    END LOOP;
END $$;

-- 3. (Opcional) Asegurar que no haya nulos
UPDATE public.branch_folios SET last_municipal_folio = 0 WHERE last_municipal_folio IS NULL;
