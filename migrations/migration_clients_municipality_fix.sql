-- MIGRACIÓN PARA CORREGIR REGISTRO DE CLIENTES MUNICIPIO
-- 1. Asegurar columnas necesarias
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS is_municipality BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS extra_percentage DECIMAL(5,2) DEFAULT 0.00;

-- 2. Actualizar restricción de tipo de cuenta
-- Primero eliminamos la anterior (si tiene un nombre estándar o la buscamos)
-- Intentamos encontrar el nombre de la restricción de tipo
DO $$ 
DECLARE 
    constr_name TEXT;
BEGIN 
    SELECT constraint_name INTO constr_name
    FROM information_schema.table_constraints 
    WHERE table_name='clients' AND constraint_type='CHECK' AND constraint_name LIKE '%type%';
    
    IF constr_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.clients DROP CONSTRAINT %I', constr_name);
    END IF;
END $$;

-- 3. Crear nueva restricción que incluya 'Municipio'
ALTER TABLE public.clients 
ADD CONSTRAINT clients_type_check 
CHECK (type IN ('Individual', 'Empresa', 'Municipio'));

-- 4. Comentarios descriptivos
COMMENT ON COLUMN public.clients.type IS 'Tipo de cliente: Individual, Empresa o Municipio';
