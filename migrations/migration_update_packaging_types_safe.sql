-- Migración SEGURA para actualizar tipos de envasado
-- Agrega cuarto_litro, medio_litro, mantiene litro y galon (3.8L)

-- Paso 1: Primero, agregar una columna temporal con los nuevos valores permitidos
-- Esto nos permite verificar que no haya datos inválidos
DO $$ 
BEGIN
    -- Verificar si hay datos que no sean 'litro' o 'galon' (los únicos valores actuales)
    IF EXISTS (
        SELECT 1 FROM public.packaging_requests 
        WHERE target_package_type NOT IN ('litro', 'galon')
    ) THEN
        RAISE EXCEPTION 'Existen datos con target_package_type no válidos. Revisar antes de migrar.';
    END IF;
    
    -- Si llegamos aquí, todos los datos son 'litro' o 'galon', que siguen siendo válidos
    RAISE NOTICE 'Todos los datos existentes son válidos (litro o galon). Procediendo con migración...';
END $$;

-- Paso 2: Eliminar el constraint existente
ALTER TABLE public.packaging_requests 
DROP CONSTRAINT IF EXISTS packaging_requests_target_package_type_check;

-- Paso 3: Agregar el nuevo constraint con los tipos actualizados
ALTER TABLE public.packaging_requests 
ADD CONSTRAINT packaging_requests_target_package_type_check 
CHECK (target_package_type IN ('cuarto_litro', 'medio_litro', 'litro', 'galon'));

-- Paso 4: Verificar que la migración fue exitosa
DO $$
BEGIN
    -- Verificar que el constraint existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'packaging_requests_target_package_type_check'
        AND table_name = 'packaging_requests'
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'El nuevo constraint no se creó correctamente';
    END IF;
    
    RAISE NOTICE 'Migración completada exitosamente. Los nuevos tipos permitidos son:';
    RAISE NOTICE '  - cuarto_litro (0.25 litros)';
    RAISE NOTICE '  - medio_litro (0.5 litros)';
    RAISE NOTICE '  - litro (1 litro)';
    RAISE NOTICE '  - galon (3.8 litros)';
END $$;