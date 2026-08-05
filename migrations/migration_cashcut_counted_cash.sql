-- ============================================================
-- FIX C2: Añadir columna counted_cash a la tabla cash_cuts
-- Permite el cuadre físico de efectivo (dinero real vs calculado)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = 'cash_cuts' AND column_name = 'counted_cash') THEN
    ALTER TABLE public.cash_cuts ADD COLUMN counted_cash NUMERIC DEFAULT 0;
    RAISE NOTICE 'Columna counted_cash añadida a cash_cuts';
  ELSE
    RAISE NOTICE 'Columna counted_cash ya existe en cash_cuts';
  END IF;
END $$;