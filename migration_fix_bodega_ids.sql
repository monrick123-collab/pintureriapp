-- Corrección de tipos de datos para IDs de usuario (Soporte para Mocks)

-- Eliminar restricciones de llave foránea que apuntan a auth.users para permitir IDs de texto/mock
ALTER TABLE public.supply_orders DROP CONSTRAINT IF EXISTS supply_orders_created_by_fkey;
ALTER TABLE public.supply_orders DROP CONSTRAINT IF EXISTS supply_orders_assigned_admin_id_fkey;
ALTER TABLE public.price_requests DROP CONSTRAINT IF EXISTS price_requests_requester_id_fkey;
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_departure_admin_id_fkey;

-- Cambiar tipos de datos de UUID a TEXT para aceptar IDs como 'WH-001', 'ACC-001', etc.
ALTER TABLE public.supply_orders ALTER COLUMN created_by TYPE TEXT;
ALTER TABLE public.supply_orders ALTER COLUMN assigned_admin_id TYPE TEXT;
ALTER TABLE public.price_requests ALTER COLUMN requester_id TYPE TEXT;
ALTER TABLE public.sales ALTER COLUMN departure_admin_id TYPE TEXT;

-- (Opcional) Habilitar RLS básico para price_requests si no estaba habilitado
ALTER TABLE public.price_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Price requests are viewable by everyone" ON public.price_requests FOR SELECT USING (true);
CREATE POLICY "Everyone can create price requests" ON public.price_requests FOR INSERT WITH CHECK (true);
