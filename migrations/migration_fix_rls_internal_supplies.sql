-- Fix RLS for internal_supplies
ALTER TABLE public.internal_supplies ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting or restrictive policies
DROP POLICY IF EXISTS "Total access internal_supplies" ON public.internal_supplies;
DROP POLICY IF EXISTS "Enable All for Auth" ON public.internal_supplies;
DROP POLICY IF EXISTS "Allow All" ON public.internal_supplies;

-- Create a clear, permissive policy for authenticated users
CREATE POLICY "Enable All for Auth" ON public.internal_supplies
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
