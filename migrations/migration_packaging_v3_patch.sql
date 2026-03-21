-- =============================================================================
-- PATCH: Ajustes finales al módulo de envasado v3
--
-- 1. Actualizar galón a 3.8 L (estándar comercial México)
-- 2. Agregar 'pending' como estado válido en packaging_requests
--    para las órdenes v3 que se crean antes de completarse
-- =============================================================================

-- 1. Actualizar galón de 3.785 → 3.8 L
UPDATE public.packaging_settings
SET value = 3.8, updated_at = NOW()
WHERE key = 'galon_liters';

-- Verificar
DO $$
BEGIN
    ASSERT (SELECT value FROM public.packaging_settings WHERE key = 'galon_liters') = 3.8,
        'ERROR: galon_liters no se actualizó a 3.8';
    RAISE NOTICE '✅ galón configurado en 3.8 L';
END $$;
