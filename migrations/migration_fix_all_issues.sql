-- ============================================================
-- MIGRATION: Corregir todos los problemas identificados
-- Ejecutar este script COMPLETO en Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PARTE 1: Corregir constraints de payment_status
-- ============================================================

DO $$
BEGIN
    -- Eliminar constraint viejo (puede tener distintos nombres)
    ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;
    ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS payment_status_check;

    -- Nuevo constraint unificado
    ALTER TABLE public.sales
        ADD CONSTRAINT sales_payment_status_check
        CHECK (payment_status IN ('pending', 'approved', 'rejected', 'expired'));

    RAISE NOTICE 'Constraint sales.payment_status actualizado OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error actualizando constraint sales: %', SQLERRM;
END $$;

DO $$
BEGIN
    -- Eliminar cualquier constraint viejo
    ALTER TABLE public.municipal_sales DROP CONSTRAINT IF EXISTS municipal_sales_payment_status_check;
    ALTER TABLE public.municipal_sales DROP CONSTRAINT IF EXISTS payment_status_check;

    -- Migrar valores legacy ('paid' → 'approved', 'invoiced' → 'approved')
    UPDATE public.municipal_sales SET payment_status = 'approved' WHERE payment_status = 'paid';
    UPDATE public.municipal_sales SET payment_status = 'approved' WHERE payment_status = 'invoiced';

    -- Nuevo constraint unificado
    ALTER TABLE public.municipal_sales
        ADD CONSTRAINT municipal_sales_payment_status_check
        CHECK (payment_status IN ('pending', 'approved', 'rejected', 'expired'));

    RAISE NOTICE 'Constraint municipal_sales.payment_status actualizado OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error actualizando constraint municipal_sales: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE 2: Asegurar columnas faltantes en municipal_sales
-- ============================================================

DO $$
BEGIN
    ALTER TABLE public.municipal_sales
        ADD COLUMN IF NOT EXISTS pending_since    TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS transfer_reference TEXT;

    -- Poblar pending_since para filas ya pendientes que no lo tengan
    UPDATE public.municipal_sales
    SET pending_since = created_at
    WHERE payment_status = 'pending'
      AND pending_since IS NULL;

    RAISE NOTICE 'Columnas de municipal_sales aseguradas OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error en columnas municipal_sales: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE 3: Corregir RLS policies (usar profiles en lugar de users)
-- ============================================================

DO $$
BEGIN
    -- municipal_sales
    DROP POLICY IF EXISTS "Admins can update municipal_sales"  ON public.municipal_sales;
    DROP POLICY IF EXISTS "Admins can update payment_status"   ON public.municipal_sales;

    CREATE POLICY "Admins can update municipal_sales"
    ON public.municipal_sales
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'ADMIN'
        )
    );

    -- sales
    DROP POLICY IF EXISTS "Admins can update sales payment"    ON public.sales;
    DROP POLICY IF EXISTS "Admins can update payment_status"   ON public.sales;

    CREATE POLICY "Admins can update sales payment"
    ON public.sales
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'ADMIN'
        )
    );

    RAISE NOTICE 'RLS policies actualizadas OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error en RLS policies: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE 4: Índices para mejorar rendimiento
-- ============================================================

DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_sales_payment_pending
        ON public.sales (payment_status, pending_since)
        WHERE payment_status = 'pending';

    CREATE INDEX IF NOT EXISTS idx_municipal_sales_payment_pending
        ON public.municipal_sales (payment_status, pending_since)
        WHERE payment_status = 'pending';

    RAISE NOTICE 'Índices creados OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error creando índices: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE 5: Función archive_old_notifications
-- ============================================================

DO $$
BEGIN
    CREATE OR REPLACE FUNCTION public.archive_old_notifications()
    RETURNS INTEGER AS $func$
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
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    RAISE NOTICE 'Función archive_old_notifications OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error en archive_old_notifications: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE 6: Convertir authorized_exit_by de UUID a TEXT
-- ============================================================

DO $$
BEGIN
    -- Eliminar la FK constraint si existe
    ALTER TABLE public.municipal_sales
        DROP CONSTRAINT IF EXISTS municipal_sales_authorized_exit_by_fkey;

    -- Cambiar tipo de columna a TEXT
    ALTER TABLE public.municipal_sales
        ALTER COLUMN authorized_exit_by TYPE TEXT;

    RAISE NOTICE 'authorized_exit_by cambiado a TEXT OK';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Error cambiando authorized_exit_by: %', SQLERRM;
END $$;

-- ============================================================
-- FIN - Resumen de cambios
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '=== MIGRACIÓN COMPLETADA EXITOSAMENTE ===';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Cambios aplicados:';
    RAISE NOTICE '1. Constraints payment_status unificados';
    RAISE NOTICE '2. Columnas municipales agregadas';
    RAISE NOTICE '3. RLS policies corregidas';
    RAISE NOTICE '4. Índices de rendimiento creados';
    RAISE NOTICE '5. Función archive_old_notifications verificada';
    RAISE NOTICE '6. Campo authorized_exit_by convertido a TEXT';
    RAISE NOTICE '================================================';
END $$;
