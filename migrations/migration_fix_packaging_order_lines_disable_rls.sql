-- Disable RLS on packaging_order_lines to bypass PostgREST schema cache issues.
-- The app uses anon key with permissive policies, so RLS adds no security value here.
ALTER TABLE public.packaging_order_lines DISABLE ROW LEVEL SECURITY;
