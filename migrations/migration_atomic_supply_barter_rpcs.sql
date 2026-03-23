-- ============================================================
-- Migración: RPCs atómicos para recepción de suministros y trueque
-- Corrige: Lost Update en inventario (loop) y estado inconsistente en trueque
-- ============================================================

-- PREREQUISITO: Verificar que inventory tiene UNIQUE (branch_id, product_id)
-- Si no existe, ejecutar primero:
--   ALTER TABLE inventory ADD CONSTRAINT inventory_branch_product_unique UNIQUE (branch_id, product_id);

-- DROP previo para permitir cambio de firma/tipo de retorno
DROP FUNCTION IF EXISTS public.confirm_supply_order_arrival(UUID, JSONB);
DROP FUNCTION IF EXISTS public.accept_barter_counter_offer(UUID);

-- ---------------------------------------------------------------
-- RPC 1: confirm_supply_order_arrival
-- Reemplaza el loop TypeScript de N SELECT+UPDATE por un UPSERT
-- atómico que suma el delta directamente en PostgreSQL.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_supply_order_arrival(
    p_order_id  UUID,
    p_items     JSONB DEFAULT NULL
    -- p_items: [{"id":"uuid","product_id":"uuid","status":"received_full",
    --            "received_quantity":5,"notes":"opcional"}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order         supply_orders%ROWTYPE;
    v_has_incidents BOOLEAN;
    v_final_status  TEXT;
BEGIN
    -- 1. Bloquear orden para prevenir recepciones duplicadas concurrentes
    SELECT * INTO v_order
    FROM supply_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido de suministro no encontrado: %', p_order_id;
    END IF;

    IF v_order.status <> 'shipped' THEN
        RAISE EXCEPTION 'El pedido no está en estado Enviado. Estado actual: %', v_order.status;
    END IF;

    -- 2. Actualizar supply_order_items y detectar incidencias
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN

        -- Detectar incidencias sin loop
        v_has_incidents := EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_items) AS elem
            WHERE elem->>'status' <> 'received_full'
        );

        -- Bulk UPDATE de todos los items en una sola operación (sin loop)
        UPDATE supply_order_items AS soi
        SET
            status            = items.status,
            received_quantity = items.received_quantity,
            notes             = items.notes
        FROM (
            SELECT
                (elem->>'id')::UUID                    AS id,
                elem->>'status'                         AS status,
                (elem->>'received_quantity')::NUMERIC   AS received_quantity,
                elem->>'notes'                          AS notes
            FROM jsonb_array_elements(p_items) AS elem
        ) AS items
        WHERE soi.id = items.id;

    ELSE
        -- Recepción completa por defecto (flujo legacy / retrocompatibilidad)
        v_has_incidents := FALSE;

        UPDATE supply_order_items
        SET status = 'received_full'
        WHERE order_id = p_order_id;
    END IF;

    -- 3. Actualizar estado de la orden
    v_final_status := CASE WHEN v_has_incidents
                           THEN 'received_with_incidents'
                           ELSE 'received'
                      END;

    UPDATE supply_orders
    SET status     = v_final_status,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. UPSERT de inventario — atómico, sin loop, sin read-then-write
    --    EXCLUDED.stock es el delta; PostgreSQL suma internamente
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN

        INSERT INTO inventory (branch_id, product_id, stock)
        SELECT
            v_order.branch_id,
            (elem->>'product_id')::UUID,
            (elem->>'received_quantity')::NUMERIC
        FROM jsonb_array_elements(p_items) AS elem
        WHERE (elem->>'received_quantity')::NUMERIC > 0
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET
            stock      = inventory.stock + EXCLUDED.stock,
            updated_at = NOW();

    ELSE
        -- Recepción completa: sumar la quantity original de cada ítem
        INSERT INTO inventory (branch_id, product_id, stock)
        SELECT
            v_order.branch_id,
            soi.product_id,
            soi.quantity
        FROM supply_order_items soi
        WHERE soi.order_id = p_order_id
          AND soi.quantity > 0
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET
            stock      = inventory.stock + EXCLUDED.stock,
            updated_at = NOW();
    END IF;

    RETURN jsonb_build_object(
        'status',        v_final_status,
        'has_incidents', v_has_incidents
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_supply_order_arrival TO anon;


-- ---------------------------------------------------------------
-- RPC 2: accept_barter_counter_offer
-- Envuelve 3 llamadas separadas (SELECT + INSERT + UPDATE) en una
-- sola transacción atómica con bloqueo de fila.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_barter_counter_offer(
    p_barter_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_barter     barter_transfers%ROWTYPE;
    v_item_count INT;
BEGIN
    -- 1. Bloquear el trueque para prevenir doble procesamiento concurrente
    SELECT * INTO v_barter
    FROM barter_transfers
    WHERE id = p_barter_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trueque no encontrado: %', p_barter_id;
    END IF;

    IF v_barter.status <> 'counter_proposed' THEN
        RAISE EXCEPTION 'El trueque no está en estado counter_proposed. Estado actual: %',
            v_barter.status;
    END IF;

    -- 2. Copiar counter_offers → barter_received_items (INSERT directo desde SELECT)
    INSERT INTO barter_received_items (barter_id, product_id, quantity)
    SELECT barter_id, product_id, quantity
    FROM barter_counter_offers
    WHERE barter_id = p_barter_id;

    GET DIAGNOSTICS v_item_count = ROW_COUNT;

    -- 3. Actualizar estado del trueque
    UPDATE barter_transfers
    SET status     = 'pending_approval',
        updated_at = NOW()
    WHERE id = p_barter_id;

    RETURN jsonb_build_object('inserted_items', v_item_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_barter_counter_offer TO anon;
