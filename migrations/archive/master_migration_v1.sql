-- ==========================================================
-- MASTER MIGRATION V1.0 - PINTURAMAX
-- Consolidado Integral de Base de Datos y Seguridad
-- ==========================================================

-- 1. CONFIGURACIÓN INICIAL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. INFRAESTRUCTURA BASE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY, -- Ej: 'BR-MAIN', 'BR-CENTRO' (Usamos TEXT para facilidad de Mocks y IDs legibles)
    name TEXT NOT NULL,
    address TEXT,
    manager TEXT,
    phone TEXT,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    type TEXT CHECK (type IN ('warehouse', 'store')) DEFAULT 'store',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    package_type TEXT CHECK (package_type IN ('cubeta', 'galon', 'litro', 'medio', 'cuarto', 'aerosol', 'complemento')),
    description TEXT,
    price DECIMAL(12,2) DEFAULT 0,
    wholesale_price DECIMAL(12,2) DEFAULT 0,
    wholesale_min_qty INTEGER DEFAULT 12,
    cost_price DECIMAL(12,2) DEFAULT 0, -- De migration_accounting.sql
    image TEXT,
    status TEXT CHECK (status IN ('available', 'low', 'out', 'expired')) DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    branch_id TEXT REFERENCES public.branches(id) ON DELETE CASCADE,
    stock INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(product_id, branch_id)
);

-- 3. IDENTIDAD Y CRM
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    role TEXT CHECK (role IN ('ADMIN', 'SELLER', 'WAREHOUSE', 'FINANCE')) DEFAULT 'SELLER',
    branch_id TEXT REFERENCES public.branches(id),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Unificamos 'clients' con todos los campos de las migraciones v1-v9
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_id TEXT, -- RFC / Tax Identifier
    address TEXT,
    municipality TEXT,
    locality TEXT,
    type TEXT CHECK (type IN ('Individual', 'Empresa')) DEFAULT 'Individual',
    credit_limit DECIMAL(12,2) DEFAULT 0,
    credit_days INTEGER DEFAULT 0,
    is_active_credit BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. OPERACIONES DE VENTA Y COTIZACIÓN
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    seller_id UUID REFERENCES auth.users(id),
    client_id UUID REFERENCES public.clients(id),
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    iva DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer')) DEFAULT 'cash',
    payment_type TEXT CHECK (payment_type IN ('contado', 'credito')) DEFAULT 'contado',
    is_wholesale BOOLEAN DEFAULT FALSE,
    departure_admin_id TEXT, -- Para autorización de salida de bodega
    status TEXT CHECK (status IN ('completed', 'cancelled')) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folio SERIAL,
    client_id UUID REFERENCES public.clients(id),
    client_name TEXT,
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
ALTER SEQUENCE quotations_folio_seq MINVALUE 0;
SELECT setval('quotations_folio_seq', 0, false); -- Iniciar folio en 0

-- 5. LOGÍSTICA Y CONTROL DE STOCK
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restock_sheets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    folio INTEGER NOT NULL,
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.restock_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sheet_id UUID REFERENCES public.restock_sheets(id),
    branch_id TEXT REFERENCES public.branches(id),
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2),
    total_price DECIMAL(12,2),
    status TEXT CHECK (status IN ('pending_admin', 'approved_warehouse', 'shipped', 'completed', 'rejected')) DEFAULT 'pending_admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    approved_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    received_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.returns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    product_id UUID REFERENCES public.products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reason TEXT NOT NULL, -- 'uso_tienda', 'demostracion', 'defecto'
    status TEXT CHECK (status IN ('pending_authorization', 'approved', 'rejected')) DEFAULT 'pending_authorization',
    authorized_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.packaging_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    bulk_product_id UUID REFERENCES public.products(id),
    target_package_type TEXT CHECK (target_package_type IN ('litro', 'galon')),
    quantity_drum INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('sent_to_branch', 'processing', 'completed', 'cancelled')) DEFAULT 'sent_to_branch',
    branch_id TEXT REFERENCES public.branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. GASTOS Y FINANZAS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.internal_supplies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id TEXT REFERENCES public.branches(id),
    description TEXT NOT NULL,
    amount DECIMAL(12,2) DEFAULT 0, -- Para control de gastos sin cargo sucursal
    category TEXT CHECK (category IN ('limpieza', 'papeleria')) DEFAULT 'limpieza',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.internal_consumption (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    branch_id TEXT REFERENCES public.branches(id),
    user_id UUID REFERENCES auth.users(id),
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.client_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'transfer')) NOT NULL,
    received_by_admin_id UUID REFERENCES auth.users(id),
    authorized_by_admin_id UUID REFERENCES auth.users(id),
    transfer_reference TEXT,
    payment_status TEXT CHECK (payment_status IN ('on_time', 'late')) DEFAULT 'on_time',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.client_marketing_spend (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id),
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. OTROS (Solicitudes de Precios, Pedidos Suministro, Auditoría)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id),
    requester_id UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'resolved')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.supply_orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    folio SERIAL,
    branch_id TEXT REFERENCES public.branches(id),
    created_by UUID REFERENCES auth.users(id),
    assigned_admin_id UUID REFERENCES auth.users(id),
    status TEXT CHECK (status IN ('pending', 'processing', 'shipped', 'received', 'cancelled')) DEFAULT 'pending',
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    total_amount DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. FUNCIONES RPC
-- ----------------------------------------------------------

-- Procesar Venta Atómicamente
CREATE OR REPLACE FUNCTION public.process_sale(
  p_branch_id TEXT,
  p_total DECIMAL,
  p_payment_method TEXT,
  p_items JSONB,
  p_subtotal DECIMAL DEFAULT 0,
  p_discount_amount DECIMAL DEFAULT 0,
  p_iva DECIMAL DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item JSONB;
  v_current_stock INT;
BEGIN
  INSERT INTO public.sales (branch_id, total, payment_method, subtotal, discount_amount, iva)
  VALUES (p_branch_id, p_total, p_payment_method, p_subtotal, p_discount_amount, p_iva)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT stock INTO v_current_stock FROM public.inventory 
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    IF v_current_stock < (v_item->>'quantity')::int THEN
      RAISE EXCEPTION 'Stock insuficiente para %', (v_item->>'product_name');
    END IF;

    UPDATE public.inventory SET stock = stock - (v_item->>'quantity')::int, updated_at = now()
    WHERE product_id = (v_item->>'product_id')::uuid AND branch_id = p_branch_id;

    INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    VALUES (v_sale_id, (v_item->>'product_id')::uuid, v_item->>'product_name', (v_item->>'quantity')::int, (v_item->>'price')::numeric);
  END LOOP;
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- Confirmar Recepción de Stock (Movimiento entre Bodega y Tienda)
CREATE OR REPLACE FUNCTION public.confirm_restock_arrival(p_request_id UUID) RETURNS VOID AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM public.restock_requests WHERE id = p_request_id;
  IF v_req.status != 'shipped' THEN RAISE EXCEPTION 'Pedido no enviado'; END IF;

  UPDATE public.inventory SET stock = stock - v_req.quantity, updated_at = now()
  WHERE product_id = v_req.product_id AND branch_id = 'BR-MAIN';

  INSERT INTO public.inventory (product_id, branch_id, stock)
  VALUES (v_req.product_id, v_req.branch_id, v_req.quantity)
  ON CONFLICT (product_id, branch_id) DO UPDATE SET stock = inventory.stock + excluded.stock, updated_at = now();

  UPDATE public.restock_requests SET status = 'completed', received_at = now() WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;

-- Folio de Resurtido
CREATE OR REPLACE FUNCTION public.get_next_restock_folio(p_branch_id TEXT) RETURNS INTEGER AS $$
DECLARE next_val INTEGER;
BEGIN
    SELECT COALESCE(MAX(folio), -1) + 1 INTO next_val FROM public.restock_sheets WHERE branch_id = p_branch_id;
    RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Trigger para perfiles
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'SELLER');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 9. SEGURIDAD AVANZADA (RLS)
-- ----------------------------------------------------------

-- Habilitar RLS en todas las tablas
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP; 
END $$;

-- POLÍTICAS BASDAS EN ROLES

-- Admin: Acceso total
DROP POLICY IF EXISTS "Admin All Access" ON public.profiles;
CREATE POLICY "Admin All Access" ON public.profiles FOR ALL TO authenticated USING (
    (SELECT role FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1) = 'ADMIN'
);
-- (Repetir para todas las tablas o simplificar con una función de chequeo de rol)

-- Ejemplo de política para Vendedores (Solo ven datos de su sucursal)
DROP POLICY IF EXISTS "Seller Store Isolation" ON public.inventory;
CREATE POLICY "Seller Store Isolation" ON public.inventory FOR SELECT TO authenticated USING (
    (SELECT branch_id FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1) = branch_id
    OR (SELECT role FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1) = 'ADMIN'
);

-- Política Pública para Perfiles (Para que el sistema de login y checkeo de ROLES funcione)
DROP POLICY IF EXISTS "Profiles readable by owner" ON public.profiles;
CREATE POLICY "Profiles readable by owner" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()::text = id::text);

-- Para desarrollo, dejamos políticas de lectura abiertas pero restringimos escritura a personal autenticado
-- [!] Recomendación: Ajustar después de la migración inicial.
DROP POLICY IF EXISTS "Public Read Access" ON public.products;
CREATE POLICY "Public Read Access" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated Insert" ON public.sales;
-- Políticas Generales para Desarrollo (Idempotentes)
-- Se otorga acceso total a usuarios autenticados para evitar ""Permission Denied"" en la App
-- En producción, estas deben restringirse por sucursal/rol.

DROP POLICY IF EXISTS "Auth Read Access" ON public.products;
CREATE POLICY "Auth Read Access" ON public.products FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth Insert Sales" ON public.sales;
CREATE POLICY "Auth Insert Sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Auth Select Sales" ON public.sales;
CREATE POLICY "Auth Select Sales" ON public.sales FOR SELECT TO authenticated USING (true);

-- Tablas Operativas: Acceso Autenticado Completo
DO $$ 
DECLARE 
    t text; 
    tables text[] := ARRAY[
        'quotations', 'returns', 'internal_supplies', 'packaging_requests', 
        'clients', 'sale_items', 'restock_sheets', 'restock_requests', 
        'expenses', 'internal_consumption', 'client_payments', 
        'client_marketing_spend', 'price_requests', 'supply_orders', 
        'audit_logs', 'branches'
    ]; 
BEGIN 
    FOREACH t IN ARRAY tables LOOP 
        EXECUTE format('DROP POLICY IF EXISTS "Enable All for Auth" ON public.%I', t); 
        EXECUTE format('CREATE POLICY "Enable All for Auth" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t); 
    END LOOP; 
END $$;

-- ----------------------------------------------------------
-- 10. SEED DATA (Básico)
-- ----------------------------------------------------------
INSERT INTO public.branches (id, name, address, manager, phone, type) VALUES
('BR-MAIN', 'Bodega Principal (Hub)', 'Zona Industrial Vallejo', 'Ing. Roberto Maya', '555-1000', 'warehouse'),
('BR-CENTRO', 'Sucursal Centro', 'Av. Juárez 45, Col. Centro', 'Marta Sánchez', '555-2000', 'store')
ON CONFLICT (id) DO NOTHING;
