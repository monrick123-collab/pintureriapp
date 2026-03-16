-- MIGRACIÓN PARA ACTUALIZAR TABLA DE CLIENTES Y SOPORTAR MUNICIPIOS
-- Agrega columnas necesarias para el porcentaje extra y actualiza las restricciones de tipo

DO $$ 
BEGIN
    -- 1. Agregar columna is_municipality si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='is_municipality') THEN
        ALTER TABLE public.clients ADD COLUMN is_municipality BOOLEAN DEFAULT FALSE;
    END IF;

    -- 2. Agregar columna extra_percentage si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='extra_percentage') THEN
        ALTER TABLE public.clients ADD COLUMN extra_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;

    -- 3. Actualizar la restricción CHECK de la columna type
    -- Primero eliminamos la anterior si existe (el nombre suele ser clients_type_check)
    ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_type_check;
    
    -- Agregamos la nueva restricción que permite 'Municipio'
    ALTER TABLE public.clients ADD CONSTRAINT clients_type_check 
    CHECK (type IN ('Individual', 'Empresa', 'Municipio'));

END $$;
