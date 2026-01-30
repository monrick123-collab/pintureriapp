-- MIGRACIÓN PARA FUNCIONES CONTABLES
-- 1. Añadir Precio de Costo a Productos (para calcular utilidad)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2) DEFAULT 0;

COMMENT ON COLUMN public.products.cost_price IS 'Precio de compra al proveedor';

-- 2. Tabla de Gastos Operativos
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  category TEXT CHECK (category IN ('renta', 'servicios', 'salarios', 'suministros', 'otros')) DEFAULT 'otros',
  branch_id TEXT REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. RLS para Gastos
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total a gastos" ON public.expenses;
CREATE POLICY "Acceso total a gastos" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

-- 4. Actualizar algunos costos iniciales (Opcional, basado en seed data)
UPDATE public.products SET cost_price = price * 0.6 WHERE cost_price = 0;
