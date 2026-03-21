-- FIX: GRANT anon a tabla coupons
-- La tabla existe con RLS habilitado y política de acceso, pero faltaba el GRANT
-- explícito para el rol anon. Sin el GRANT, Supabase rechaza consultas con clave anon.

GRANT ALL ON public.coupons TO anon;
