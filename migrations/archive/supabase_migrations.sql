-- MIGRACIÓN FINANZAS (Proveedores, Cuentas por Pagar, Arrendamientos)

-- 1. Tabla de Proveedores
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT, -- RFC field
    contact_info TEXT,
    payment_terms_days INTEGER DEFAULT 0, -- Días de crédito
    commercial_conditions JSONB DEFAULT '{}'::jsonb, -- Descuentos, acuerdos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Facturas de Proveedores (Cuentas por Pagar)
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    supplier_id UUID REFERENCES public.suppliers(id),
    invoice_folio TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT CHECK (status IN ('received', 'verified', 'authorized', 'paid', 'rejected')) DEFAULT 'received',
    issue_date DATE NOT NULL,
    due_date DATE, -- Calculado o manual
    pdf_url TEXT,
    xml_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Tabla de Pagos a Proveedores
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id UUID REFERENCES public.supplier_invoices(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('transfer', 'check', 'cash')) DEFAULT 'transfer',
    reference TEXT, -- Numero de transferencia o cheque
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id)
);

-- 4. Tabla de Arrendamientos (Contratos de Renta)
CREATE TABLE IF NOT EXISTS public.leases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    property_name TEXT NOT NULL, -- Ej: "Sucursal Centro"
    landlord_name TEXT NOT NULL, -- Arrendador
    monthly_amount DECIMAL(12,2) NOT NULL,
    payment_day INTEGER DEFAULT 1, -- Día del mes que se paga
    contract_start DATE,
    contract_end DATE,
    active BOOLEAN DEFAULT TRUE,
    branch_id TEXT REFERENCES public.branches(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tabla para el historial de pagos de renta
CREATE TABLE IF NOT EXISTS public.lease_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lease_id UUID REFERENCES public.leases(id),
    amount DECIMAL(12,2) NOT NULL,
    payment_date DATE NOT NULL, -- Mes que cubre
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    receipt_url TEXT, -- Comprobante
    notes TEXT
);

-- 5. Tabla de Listas de Precios (Para manejo avanzado de precios)
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL, -- Ej: "Alvamex Lista 1"
    brand TEXT, -- "Alvamex", "Sayer", etc.
    margin_percentage DECIMAL(5,2) DEFAULT 0, -- Margen ganancia base
    is_active BOOLEAN DEFAULT TRUE
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

-- Políticas de Acceso (Simplificadas para ADMIN y FINANCE por ahora, o acceso total para desarrollo)
CREATE POLICY "Acceso total suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total supplier_invoices" ON public.supplier_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total supplier_payments" ON public.supplier_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total leases" ON public.leases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total lease_payments" ON public.lease_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso total price_lists" ON public.price_lists FOR ALL USING (true) WITH CHECK (true);
