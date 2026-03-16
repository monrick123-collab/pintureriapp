-- MIGRATION: Agregar columna updated_at a tablas sales y municipal_sales si no existe
-- Esto es necesario para el sistema de aprobación de pagos

-- 1. Agregar updated_at a sales si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.sales 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
        
        RAISE NOTICE 'Columna updated_at agregada a tabla sales';
    ELSE
        RAISE NOTICE 'Columna updated_at ya existe en tabla sales';
    END IF;
END $$;

-- 2. Agregar updated_at a municipal_sales si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'municipal_sales' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.municipal_sales 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
        
        RAISE NOTICE 'Columna updated_at agregada a tabla municipal_sales';
    ELSE
        RAISE NOTICE 'Columna updated_at ya existe en tabla municipal_sales';
    END IF;
END $$;

-- 3. Crear trigger para actualizar automáticamente updated_at en sales
CREATE OR REPLACE FUNCTION public.update_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sales_updated_at_trigger ON public.sales;
CREATE TRIGGER update_sales_updated_at_trigger
    BEFORE UPDATE ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sales_updated_at();

-- 4. Crear trigger para actualizar automáticamente updated_at en municipal_sales
CREATE OR REPLACE FUNCTION public.update_municipal_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_municipal_sales_updated_at_trigger ON public.municipal_sales;
CREATE TRIGGER update_municipal_sales_updated_at_trigger
    BEFORE UPDATE ON public.municipal_sales
    FOR EACH ROW
    EXECUTE FUNCTION public.update_municipal_sales_updated_at();

-- 5. Actualizar valores existentes
UPDATE public.sales SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.municipal_sales SET updated_at = created_at WHERE updated_at IS NULL;

-- 6. Comentarios para documentación
COMMENT ON COLUMN public.sales.updated_at IS 'Fecha/hora de última actualización. Se actualiza automáticamente con trigger.';
COMMENT ON COLUMN public.municipal_sales.updated_at IS 'Fecha/hora de última actualización. Se actualiza automáticamente con trigger.';

DO $$ 
BEGIN
    RAISE NOTICE 'Migración completada: columnas updated_at agregadas y triggers creados.';
END $$;