-- MIGRACIÓN: SISTEMA DE APROBACIÓN DE PAGOS Y CLIENTES MUNICIPIO
-- Este script agrega campos para aprobación de pagos y características de municipios

-- 1. Campos para aprobación de pagos en ventas normales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'approved' 
CHECK (payment_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS transfer_reference TEXT;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Campos para aprobación de pagos en ventas municipales
ALTER TABLE public.municipal_sales 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'approved'
CHECK (payment_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.municipal_sales 
ADD COLUMN IF NOT EXISTS transfer_reference TEXT;

ALTER TABLE public.municipal_sales 
ADD COLUMN IF NOT EXISTS pending_since TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.municipal_sales 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Campos para clientes municipio
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS is_municipality BOOLEAN DEFAULT false;

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS extra_percentage DECIMAL(5,2) DEFAULT 0.00;

-- 4. Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON public.sales(payment_status, branch_id);
CREATE INDEX IF NOT EXISTS idx_municipal_sales_payment_status ON public.municipal_sales(payment_status, branch_id);
CREATE INDEX IF NOT EXISTS idx_clients_is_municipality ON public.clients(is_municipality, id);

-- 5. Función para archivar notificaciones antiguas (15 días)
CREATE OR REPLACE FUNCTION public.archive_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    WITH archived AS (
        DELETE FROM public.notifications 
        WHERE created_at < NOW() - INTERVAL '15 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO archived_count FROM archived;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Política para auto-archivar notificaciones (ejecutar diariamente)
COMMENT ON FUNCTION public.archive_old_notifications IS 'Archiva notificaciones con más de 15 días de antigüedad';

-- 7. Actualizar función process_sale para incluir payment_status
-- Nota: La función process_sale ya existe, pero si necesita modificación se hará aparte

-- 8. Comentarios descriptivos
COMMENT ON COLUMN public.sales.payment_status IS 'Estado de aprobación del pago: pending, approved, rejected';
COMMENT ON COLUMN public.sales.transfer_reference IS 'Referencia de transferencia bancaria';
COMMENT ON COLUMN public.sales.pending_since IS 'Fecha/hora en que el pago quedó pendiente';
COMMENT ON COLUMN public.sales.rejection_reason IS 'Motivo de rechazo del pago';

COMMENT ON COLUMN public.municipal_sales.payment_status IS 'Estado de aprobación del pago: pending, approved, rejected';
COMMENT ON COLUMN public.municipal_sales.transfer_reference IS 'Referencia de transferencia bancaria';
COMMENT ON COLUMN public.municipal_sales.pending_since IS 'Fecha/hora en que el pago quedó pendiente';
COMMENT ON COLUMN public.municipal_sales.rejection_reason IS 'Motivo de rechazo del pago';

COMMENT ON COLUMN public.clients.is_municipality IS 'Indica si el cliente es un municipio';
COMMENT ON COLUMN public.clients.extra_percentage IS 'Porcentaje extra a aplicar a productos para municipios';

-- 9. Actualizar registros existentes para mantener compatibilidad
UPDATE public.sales SET payment_status = 'approved' WHERE payment_status IS NULL;
UPDATE public.municipal_sales SET payment_status = 'approved' WHERE payment_status IS NULL;