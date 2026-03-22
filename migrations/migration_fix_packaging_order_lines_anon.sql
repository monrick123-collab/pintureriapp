-- Fix RLS: add anon policy to packaging_order_lines
ALTER TABLE IF EXISTS public.packaging_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.packaging_order_lines;
CREATE POLICY "Enable All for Anon" ON public.packaging_order_lines FOR ALL TO anon USING (true) WITH CHECK (true);
GRANT ALL ON public.packaging_order_lines TO anon;
