-- MIGRACIÓN PARA CORREGIR DISCREPANCIA DE UUID EN VENTAS MUNICIPALES
-- Cambia las columnas de UUID a TEXT para que coincidan con la tabla profiles (que usa IDs manuales como 'ADM-001')

-- 1. Manejar authorized_exit_by en municipal_sales
-- Primero eliminamos la restricción de llave foránea que causa el error de incompatibilidad
ALTER TABLE public.municipal_sales 
DROP CONSTRAINT IF EXISTS municipal_sales_authorized_exit_by_fkey;

-- Ahora cambiamos el tipo de la columna a TEXT
ALTER TABLE public.municipal_sales 
ALTER COLUMN authorized_exit_by TYPE TEXT;

-- 2. Manejar registered_by en municipal_payments (si existe)
DO $$ 
BEGIN 
    -- Eliminar restricción si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='municipal_payments_registered_by_fkey'
    ) THEN
        ALTER TABLE public.municipal_payments DROP CONSTRAINT municipal_payments_registered_by_fkey;
    END IF;

    -- Cambiar tipo si la columna existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='municipal_payments' AND column_name='registered_by'
    ) THEN
        ALTER TABLE public.municipal_payments ALTER COLUMN registered_by TYPE TEXT;
    END IF;
END $$;

-- 3. También revisamos si hay otras tablas municipales con este problema
-- En municipal_payments (según migración previa), se usa registered_by
-- En municipal_sale_items se usa sale_id que es UUID y apunta a municipal_sales(id), eso está bien porque ambos son UUID.
