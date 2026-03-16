-- MIGRATION: Asegurar que administradores puedan actualizar payment_status en municipal_sales

-- 1. Verificar si existe la política para administradores
DO $$ 
BEGIN
    -- Eliminar política existente si hay problemas
    DROP POLICY IF EXISTS "Admins can update municipal_sales" ON public.municipal_sales;
    
    -- Crear política para que administradores puedan actualizar payment_status
    CREATE POLICY "Admins can update municipal_sales" 
    ON public.municipal_sales
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'ADMIN'
        )
    );
    
    RAISE NOTICE 'Política para administradores creada/actualizada en municipal_sales';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creando política: %', SQLERRM;
END $$;

-- 2. También asegurar permisos para ventas normales
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can update sales payment_status" ON public.sales;
    
    CREATE POLICY "Admins can update sales payment_status" 
    ON public.sales
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'ADMIN'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role = 'ADMIN'
        )
    );
    
    RAISE NOTICE 'Política para administradores creada/actualizada en sales';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error creando política: %', SQLERRM;
END $$;

-- 3. Asegurar que los campos nuevos sean actualizables
COMMENT ON COLUMN public.municipal_sales.payment_status IS 'Estado de aprobación del pago: pending, approved, rejected, expired. Administradores pueden actualizar.';
COMMENT ON COLUMN public.municipal_sales.rejection_reason IS 'Razón del rechazo (si aplica). Administradores pueden actualizar.';
COMMENT ON COLUMN public.municipal_sales.pending_since IS 'Fecha/hora cuando el pago quedó pendiente. Se limpia al aprobar/rechazar.';

COMMENT ON COLUMN public.sales.payment_status IS 'Estado de aprobación del pago: pending, approved, rejected, expired. Administradores pueden actualizar.';
COMMENT ON COLUMN public.sales.rejection_reason IS 'Razón del rechazo (si aplica). Administradores pueden actualizar.';
COMMENT ON COLUMN public.sales.pending_since IS 'Fecha/hora cuando el pago quedó pendiente. Se limpia al aprobar/rechazar.';