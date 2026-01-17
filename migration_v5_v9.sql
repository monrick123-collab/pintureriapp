-- Migración para Requerimientos 4, 5, 6, 7, 8 y 9

-- ==========================================
-- 1. COTIZACIONES (Punto 5)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folio SERIAL, -- Empezará desde 1 por defecto de SQL, pero el requerimiento dice 0. 
                  -- Podemos ajustar el valor inicial después si es crítico.
    client_id UUID REFERENCES public.clients(id),
    client_name TEXT, -- En caso de que se borre el cliente o para búsqueda rápida
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    iva DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    branch_id TEXT REFERENCES public.branches(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ajustar folio para empezar desde 0 si es posible (aunque SERIAL suele ser 1+)
-- Alternativamente, se maneja el 0 en el frontend o se reinicia la secuencia.
SELECT setval('quotations_folio_seq', 0, false);

-- ==========================================
-- 2. DEVOLUCIONES (Punto 6)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT NOT NULL, -- 'uso_tienda', 'demostracion', 'defecto', etc.
    status TEXT CHECK (status IN ('pending_authorization', 'approved', 'rejected')) DEFAULT 'pending_authorization',
    authorized_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 3. SUMINISTROS (Punto 7)
-- ==========================================
-- Registro de gastos de limpieza y papelería surtidos por bodega
CREATE TABLE IF NOT EXISTS public.internal_supplies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id), -- Sucursal que recibe
    description TEXT NOT NULL,
    amount DECIMAL(12,2) DEFAULT 0, -- Precio sin cargo a sucursal pero para orden de gastos
    category TEXT CHECK (category IN ('limpieza', 'papeleria')) DEFAULT 'limpieza',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 4. ENVASADO / LITREADOS (Punto 8)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.packaging_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    bulk_product_id UUID REFERENCES public.products(id), -- El tambo de 200L
    target_package_type TEXT CHECK (package_type IN ('litro', 'galon')),
    quantity_drum INTEGER DEFAULT 1, -- Cuantos tambos se enviaron
    status TEXT CHECK (status IN ('sent_to_branch', 'processing', 'completed', 'cancelled')) DEFAULT 'sent_to_branch',
    branch_id TEXT REFERENCES public.branches(id), -- Sucursal que envasa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 5. MEJORAS EN CLIENTES (Punto 9)
-- ==========================================
-- Agregar campos de ubicación y crédito a clientes
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS municipality TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS locality TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_active_credit BOOLEAN DEFAULT FALSE;

-- Tabla de Pagos de Clientes (Mayoreo/Crédito)
CREATE TABLE IF NOT EXISTS public.client_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'transfer')) NOT NULL,
    received_by_admin_id UUID REFERENCES auth.users(id), -- Quien de los admin recibió si es efectivo
    authorized_by_admin_id UUID REFERENCES auth.users(id), -- Quien autorizó si es transferencia
    transfer_reference TEXT, -- Nombre de quien si es por transferencia
    payment_status TEXT CHECK (payment_status IN ('on_time', 'late')) DEFAULT 'on_time',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabla para Historial de Publicidad/Marketing por Cliente
CREATE TABLE IF NOT EXISTS public.client_marketing_spend (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ==========================================
-- 6. SOLICITUD DE PRECIOS (Punto 4 continuación)
-- ==========================================
-- Ya existe price_requests pero vamos a asegurarnos que esté vinculado correctamente 
-- si es necesario o agregar campos adicionales.
-- Por ahora la estructura en migration_bodega_points_2_3_4.sql parece suficiente.

-- ==========================================
-- POLÍTICAS DE RLS (Habilitar acceso general para desarrollo)
-- ==========================================
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packaging_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Total access quotations" ON public.quotations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Total access returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Total access internal_supplies" ON public.internal_supplies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Total access packaging_requests" ON public.packaging_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Total access client_payments" ON public.client_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Total access marketing_spend" ON public.client_marketing_spend FOR ALL USING (true) WITH CHECK (true);
