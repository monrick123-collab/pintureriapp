-- =============================================================================
-- Migration: packaging_v2
-- Soporte de tambos parciales, auto-inventario al completar, devoluciones con destino
-- =============================================================================

-- 1. packaging_requests: campos para litros parciales, producto destino y paquetes producidos
ALTER TABLE public.packaging_requests
  ADD COLUMN IF NOT EXISTS liters_requested INTEGER,
  ADD COLUMN IF NOT EXISTS target_product_id UUID REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS packages_produced INTEGER;

-- Retrocompatibilidad: registros anteriores usaban quantity_drum * 200 siempre
UPDATE public.packaging_requests
  SET liters_requested = quantity_drum * 200
  WHERE liters_requested IS NULL;

-- 2. returns: campo para guardar la sucursal/bodega destino elegida al autorizar
ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS destination_branch_id TEXT REFERENCES public.branches(id);

-- =============================================================================
-- 3. RPC complete_packaging
--    - Descuenta litros del tambo en inventario de la sucursal
--    - Agrega las botellas producidas al inventario de la sucursal
--    - Actualiza el packaging_request con packages_produced y status='completed'
-- =============================================================================
DROP FUNCTION IF EXISTS complete_packaging(UUID, TEXT);

CREATE OR REPLACE FUNCTION complete_packaging(
    p_request_id UUID,
    p_user_id    TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request           RECORD;
    v_liters_per_pkg    NUMERIC;
    v_liters_to_consume INTEGER;
    v_packages          INTEGER;
BEGIN
    SELECT * INTO v_request
    FROM public.packaging_requests
    WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Packaging request not found: %', p_request_id;
    END IF;

    IF v_request.target_product_id IS NULL THEN
        RAISE EXCEPTION 'Sin producto destino en la solicitud de envasado (id: %)', p_request_id;
    END IF;

    v_liters_per_pkg := CASE v_request.target_package_type
        WHEN 'cuarto_litro' THEN 0.25
        WHEN 'medio_litro'  THEN 0.5
        WHEN 'litro'        THEN 1.0
        WHEN 'galon'        THEN 3.8
        ELSE 0
    END;

    IF v_liters_per_pkg = 0 THEN
        RAISE EXCEPTION 'Tipo de envase desconocido: %', v_request.target_package_type;
    END IF;

    v_liters_to_consume := COALESCE(v_request.liters_requested, v_request.quantity_drum * 200);
    v_packages          := FLOOR(v_liters_to_consume::NUMERIC / v_liters_per_pkg);

    -- Descontar litros del tambo usando la función existente (valida stock)
    PERFORM process_internal_consumption(
        v_request.bulk_product_id,
        v_request.branch_id,
        p_user_id,
        v_liters_to_consume,
        'Envasado ' || v_request.target_package_type || ' (' || v_liters_per_pkg || 'L c/u)'
    );

    -- Agregar botellas al inventario de la sucursal
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (v_request.target_product_id, v_request.branch_id, v_packages, NOW())
    ON CONFLICT (product_id, branch_id)
    DO UPDATE SET
        stock      = public.inventory.stock + EXCLUDED.stock,
        updated_at = NOW();

    -- Marcar solicitud como completada
    UPDATE public.packaging_requests SET
        packages_produced = v_packages,
        status            = 'completed',
        completed_at      = NOW(),
        updated_at        = NOW()
    WHERE id = p_request_id;
END;
$$;

-- =============================================================================
-- 4. RPC process_return
--    - Descuenta stock del producto en la sucursal origen
--    - Agrega stock en la sucursal/bodega destino elegida por el Admin
--    - Actualiza el return con destination_branch_id y status='received_at_warehouse'
-- =============================================================================
DROP FUNCTION IF EXISTS process_return(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS process_return(UUID);

CREATE OR REPLACE FUNCTION process_return(
    p_return_id             UUID,
    p_user_id               TEXT,
    p_destination_branch_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return RECORD;
BEGIN
    SELECT * INTO v_return FROM public.returns WHERE id = p_return_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Devolución no encontrada: %', p_return_id;
    END IF;

    IF v_return.status != 'approved' THEN
        RAISE EXCEPTION 'La devolución no está aprobada (estado actual: %)', v_return.status;
    END IF;

    -- Descontar del inventario en la sucursal origen
    UPDATE public.inventory
    SET stock      = GREATEST(0, stock - v_return.quantity),
        updated_at = NOW()
    WHERE product_id = v_return.product_id
      AND branch_id  = v_return.branch_id;

    -- Agregar al inventario en la sucursal/bodega destino
    INSERT INTO public.inventory (product_id, branch_id, stock, updated_at)
    VALUES (v_return.product_id, p_destination_branch_id, v_return.quantity, NOW())
    ON CONFLICT (product_id, branch_id)
    DO UPDATE SET
        stock      = public.inventory.stock + EXCLUDED.stock,
        updated_at = NOW();

    -- Cerrar la devolución
    UPDATE public.returns SET
        destination_branch_id = p_destination_branch_id,
        status                = 'received_at_warehouse',
        updated_at            = NOW()
    WHERE id = p_return_id;
END;
$$;
