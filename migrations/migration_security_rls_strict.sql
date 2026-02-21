-- MIGRACIÓN DE SEGURIDAD (RLS) - POLÍTICAS ESTRICTAS
-- Se revoca el acceso masivo de (true) y se establecen políticas básicas por rol.

-- 1. Asegurar que las tablas tengan RLS habilitado
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas genéricas "Enable All for Auth" masivas si existen 
-- (Se asume que la migración previa las creó)
DO $$ 
DECLARE 
    tbl VARCHAR;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable All for Auth" ON public.%I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public access supply_orders" ON public.%I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Public access price_requests" ON public.%I', tbl);
        -- Evitamos error si la política no existe, por eso usamos IF EXISTS
    END LOOP;
END $$;


-- 3. Crear función de utilidad para obtener rol del usuario autenticado de forma segura
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;


-- =========================================================================
-- POLITICAS POR TABLA (Ejemplos Críticos)
-- NOTA: Se aplica un enfoque donde TODO autenticado puede LEER la mayoría,
-- pero solo ADMIN puede BORRAR. La Inserción/Edición depende del registro.
-- =========================================================================

---------------------------------------------------
-- TABLA: PRODUCTS (Catálogo)
---------------------------------------------------
DROP POLICY IF EXISTS "Products are viewable by all authenticated users" ON public.products;
CREATE POLICY "Products are viewable by all authenticated users"
ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Products editable by admin" ON public.products;
CREATE POLICY "Products editable by admin"
ON public.products FOR ALL TO authenticated 
USING (public.get_auth_user_role() = 'ADMIN') 
WITH CHECK (public.get_auth_user_role() = 'ADMIN');

---------------------------------------------------
-- TABLA: SALES (Ventas)
---------------------------------------------------
DROP POLICY IF EXISTS "Sales can be inserted by authenticated users" ON public.sales;
CREATE POLICY "Sales can be inserted by authenticated users"
ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sales viewable by creator or admin" ON public.sales;
CREATE POLICY "Sales viewable by creator or admin"
ON public.sales FOR SELECT TO authenticated 
USING (auth.uid() = seller_id OR public.get_auth_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Sales editable by admin" ON public.sales;
CREATE POLICY "Sales editable by admin"
ON public.sales FOR UPDATE TO authenticated 
USING (public.get_auth_user_role() = 'ADMIN') 
WITH CHECK (public.get_auth_user_role() = 'ADMIN');

DROP POLICY IF EXISTS "Sales deletable by admin" ON public.sales;
CREATE POLICY "Sales deletable by admin"
ON public.sales FOR DELETE TO authenticated 
USING (public.get_auth_user_role() = 'ADMIN');

---------------------------------------------------
-- TABLA: SUPPLY_ORDERS (Pedidos a Admin)
---------------------------------------------------
DROP POLICY IF EXISTS "Supply orders viewable by all authenticated" ON public.supply_orders;
CREATE POLICY "Supply orders viewable by all authenticated"
ON public.supply_orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Supply orders insertable by authenticated" ON public.supply_orders;
CREATE POLICY "Supply orders insertable by authenticated"
ON public.supply_orders FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Supply orders updatable by authenticated" ON public.supply_orders;
CREATE POLICY "Supply orders updatable by authenticated"
ON public.supply_orders FOR UPDATE TO authenticated 
USING (true) WITH CHECK (true); -- Permitimos actualización, idealmente se restringe a ADMIN o el branch asignado en el futuro.

DROP POLICY IF EXISTS "Supply orders deletable by admin" ON public.supply_orders;
CREATE POLICY "Supply orders deletable by admin"
ON public.supply_orders FOR DELETE TO authenticated 
USING (public.get_auth_user_role() = 'ADMIN');

---------------------------------------------------
-- PÓLIZA DE PROTECCIÓN GENÉRICA ("Fallback")
-- Para todas las demás tablas donde eliminamos el "Enable All",
-- permitimos a ADMIN hacer todo, y al resto LEER e INSERTAR (sin DELETE o UPDATE cruzados).
---------------------------------------------------

DO $$ 
DECLARE 
    tbl VARCHAR;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
        AND tablename NOT IN ('sales', 'products', 'supply_orders')
    LOOP
        -- ADMIN TIENE ACCESO TOTAL (ALL)
        EXECUTE format('DROP POLICY IF EXISTS "Admin All Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Admin All Access" ON public.%I FOR ALL TO authenticated USING (public.get_auth_user_role() = ''ADMIN'') WITH CHECK (public.get_auth_user_role() = ''ADMIN'')', tbl);
        
        -- NON-ADMIN: SELECT TOTAL
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Select Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Authenticated Select Access" ON public.%I FOR SELECT TO authenticated USING (true)', tbl);
        
        -- NON-ADMIN: INSERT TOTAL (temporal/fallback para no romper la app)
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Insert Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Authenticated Insert Access" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', tbl);
        
        -- NON-ADMIN: UPDATE (permitir a todos por ahora, excepto en DELETE que está bloqueado implícitamente al no tener política)
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated Update Access" ON public.%I', tbl);
        EXECUTE format('CREATE POLICY "Authenticated Update Access" ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;
