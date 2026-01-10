-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE

-- 1. Agregar package_type a products
-- Tipos: Cubetas (19 lts), Galones (4 lts), Litros (1 lto), Medios (1/2 lto), cuartos, Aerosoles, Complementos
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS package_type text check (package_type in ('cubeta', 'galon', 'litro', 'medio', 'cuarto', 'aerosol', 'complemento'));

-- 2. Crear tabla restock_sheets (Hojas de Resurtido / Notas)
CREATE TABLE IF NOT EXISTS public.restock_sheets (
  id uuid default uuid_generate_v4() primary key,
  branch_id text references public.branches(id),
  folio integer not null,
  total_amount numeric(10, 2) default 0,
  created_by uuid, -- ID del usuario que crea la nota
  created_at timestamp with time zone default timezone('utc'::text, now()),
  status text check (status in ('pending', 'completed', 'cancelled')) default 'pending'
);

-- 3. Vincular restock_requests a las hojas y guardar precios históricos
ALTER TABLE public.restock_requests
ADD COLUMN IF NOT EXISTS sheet_id uuid references public.restock_sheets(id);

ALTER TABLE public.restock_requests
ADD COLUMN IF NOT EXISTS unit_price numeric(10, 2);

ALTER TABLE public.restock_requests
ADD COLUMN IF NOT EXISTS total_price numeric(10, 2);

-- 4. Función para calcular el siguiente folio POR SUCURSAL
CREATE OR REPLACE FUNCTION public.get_next_restock_folio(p_branch_id text)
RETURNS integer AS $$
DECLARE
    next_val integer;
BEGIN
    SELECT COALESCE(MAX(folio), -1) + 1 INTO next_val
    FROM public.restock_sheets
    WHERE branch_id = p_branch_id;
    RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS (Políticas de Seguridad)
ALTER TABLE public.restock_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a restock_sheets" ON public.restock_sheets;
CREATE POLICY "Acceso total a restock_sheets" ON public.restock_sheets FOR ALL USING (true) WITH CHECK (true);
