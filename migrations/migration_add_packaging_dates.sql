-- Agregar columnas de fecha de inicio y terminado al envasado
-- para poder filtrar por rango de fechas y tener mejor control.

ALTER TABLE public.packaging_requests
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
