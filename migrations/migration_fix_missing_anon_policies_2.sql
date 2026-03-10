-- MIGRACIÓN DE URGENCIA: Habilitar el rol "anon" para tablas clave
-- Debido a que la aplicación no usa autenticación de Supabase (las sesiones son manejadas en localStorage),
-- todas las consultas llegan al backend como el rol "anon".
-- Las políticas previas (migration_security_rls_strict) restringían la mayoría a "authenticated".
-- Esto causaba que la vista de Ventas Mayoreo en el perfil de Bodega no pudiera cargar clientes, administradores, sucursales e inventario.

-- 1. CLIENTES
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.clients;
CREATE POLICY "Enable All for Anon" ON public.clients FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. PERFILES (Para getAdmins y asignación de responsables)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.profiles;
CREATE POLICY "Enable All for Anon" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. INVENTARIO (Para consultar stock y actualizar al procesar la venta)
ALTER TABLE IF EXISTS public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.inventory;
CREATE POLICY "Enable All for Anon" ON public.inventory FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. SUCURSALES (branches)
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.branches;
CREATE POLICY "Enable All for Anon" ON public.branches FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. PRODUCTOS (catálogo)
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.products;
CREATE POLICY "Enable All for Anon" ON public.products FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. CUENTAS Y PAGOS MUNICIPALES (Ya que también forman parte del proceso de Venta Mayoreo / Municipio)
ALTER TABLE IF EXISTS public.municipal_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.municipal_accounts;
CREATE POLICY "Enable All for Anon" ON public.municipal_accounts FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.municipal_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable All for Anon" ON public.municipal_payments;
CREATE POLICY "Enable All for Anon" ON public.municipal_payments FOR ALL TO anon USING (true) WITH CHECK (true);
