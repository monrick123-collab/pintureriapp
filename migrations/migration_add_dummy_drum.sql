-- Migration to add a dummy "Tambo" product for Packaging testing

-- 1. Insert the dummy product
INSERT INTO products (
    sku,
    name,
    category,
    description,
    price,
    status,
    wholesale_price,
    wholesale_min_qty,
    cost_price,
    package_type,
    unit_measure,
    min_stock,
    max_stock
) VALUES (
    'TAMBO-TEST-001',
    'Tambo de Prueba 200L',
    'Industrial',
    'Producto de prueba para envasado (Tambo)',
    8500.00,
    'available',
    8000.00,
    1,
    6000.00,
    'complemento', -- Using a valid enum value, though the filter uses description/sku
    'pza',
    1,
    100
)
ON CONFLICT (sku) DO NOTHING;

-- 2. Initialize inventory for this product in all branches
-- We use a DO block to get the product ID and iterate branches
DO $$
DECLARE
    v_product_id uuid;
BEGIN
    -- Get the ID of the product we just inserted/ensured exists
    SELECT id INTO v_product_id FROM products WHERE sku = 'TAMBO-TEST-001';

    IF v_product_id IS NOT NULL THEN
        -- Insert or Update inventory for ALL branches to have 10 units
        INSERT INTO inventory (branch_id, product_id, stock)
        SELECT id, v_product_id, 10
        FROM branches
        ON CONFLICT (branch_id, product_id) 
        DO UPDATE SET stock = 10; -- Reset to 10 for testing purposes
    END IF;
END $$;
