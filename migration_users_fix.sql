
-- MIGRACIÓN PARA CORREGIR PERFILES Y SOPORTAR MOCKS
-- Permite que el ID sea TEXT para usar IDs manuales como 'ADM-001'

-- 1. Quitar referencia a auth.users para permitir Mocks
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Cambiar tipo de id a TEXT
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT;

-- 3. Insertar usuarios Mock si no existen para pruebas
INSERT INTO public.profiles (id, email, full_name, role)
VALUES 
('ADM-001', 'admin@pintamax.com', 'Admin Principal', 'ADMIN'),
('WH-001', 'bodega@pintamax.com', 'Jefe de Bodega', 'WAREHOUSE'),
('ACC-001', 'contador@pintamax.com', 'Contador Central', 'FINANCE')
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- 4. Asegurar RLS permisivo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access profiles" ON public.profiles;
CREATE POLICY "Public access profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
