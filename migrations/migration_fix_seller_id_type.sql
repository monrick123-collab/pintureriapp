-- 1. DROP políticas que dependen de seller_id
DROP POLICY IF EXISTS "Sales can be inserted by authenticated users" ON public.sales;
DROP POLICY IF EXISTS "Sales viewable by creator or admin" ON public.sales;

-- 2. DROP columna seller_id (UUID)
ALTER TABLE public.sales DROP COLUMN IF EXISTS seller_id;

-- 3. CREATE columna seller_id como TEXT
ALTER TABLE public.sales ADD COLUMN seller_id TEXT;

-- 4. Recrear políticas RLS exactamente como estaban
CREATE POLICY "Sales can be inserted by authenticated users" 
ON public.sales FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid()::text = seller_id);

CREATE POLICY "Sales viewable by creator or admin" 
ON public.sales FOR SELECT 
TO authenticated 
USING ((auth.uid()::text = seller_id) OR (get_auth_user_role() = 'ADMIN'));
