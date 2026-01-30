-- 1. Limpieza total para evitar conflictos de tipos y funciones duplicadas
DROP TABLE IF EXISTS internal_consumption CASCADE;
DROP FUNCTION IF EXISTS process_internal_consumption(UUID, UUID, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS process_internal_consumption(UUID, TEXT, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS process_internal_consumption(UUID, TEXT, TEXT, INTEGER, TEXT);

-- 2. Crear Tabla con tipos compatibles (Soportamos IDs de texto para usuarios de prueba)
CREATE TABLE internal_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- TEXT para aceptar '4829' o UUIDs reales
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT NOT NULL,
    cost_at_time DECIMAL(12,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Función RPC corregida
CREATE OR REPLACE FUNCTION process_internal_consumption(
    p_product_id UUID,
    p_branch_id TEXT,
    p_user_id TEXT,
    p_quantity INTEGER,
    p_reason TEXT
) RETURNS VOID AS $$
DECLARE
    v_current_stock INTEGER;
    v_cost_price DECIMAL(12,2);
BEGIN
    -- 1. Obtener stock actual y precio de costo
    SELECT stock INTO v_current_stock 
    FROM inventory 
    WHERE product_id = p_product_id AND branch_id = p_branch_id;

    SELECT cost_price INTO v_cost_price
    FROM products
    WHERE id = p_product_id;

    -- 2. Validar stock
    IF v_current_stock IS NULL THEN
        RAISE EXCEPTION 'El producto no existe en esta sucursal.';
    END IF;

    IF v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Stock insuficiente (Disponible: %, Requerido: %)', v_current_stock, p_quantity;
    END IF;

    -- 3. Actualizar Inventario
    UPDATE inventory 
    SET stock = stock - p_quantity,
        updated_at = now()
    WHERE product_id = p_product_id AND branch_id = p_branch_id;

    -- 4. Registrar Consumo
    INSERT INTO internal_consumption (
        product_id, 
        branch_id, 
        user_id, 
        quantity, 
        reason,
        cost_at_time
    ) VALUES (
        p_product_id, 
        p_branch_id, 
        p_user_id, 
        p_quantity, 
        p_reason,
        v_cost_price
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
