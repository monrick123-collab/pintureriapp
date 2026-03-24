-- Agrega columna de auditoría a municipal_sales para registrar qué porcentaje extra se aplicó
ALTER TABLE public.municipal_sales
ADD COLUMN IF NOT EXISTS applied_extra_pct NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN public.municipal_sales.applied_extra_pct IS
    'Porcentaje extra del cliente municipio que se aplicó a los precios en esta venta (0 = sin porcentaje)';
