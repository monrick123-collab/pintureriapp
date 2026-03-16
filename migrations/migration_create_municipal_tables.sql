-- MIGRACIÓN: CREACIÓN DE TABLAS MUNICIPALES
-- Este script crea las tablas necesarias para el sistema de ventas municipales

-- 1. Tabla de ventas municipales
CREATE TABLE IF NOT EXISTS public.municipal_sales (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    folio SERIAL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id),
    municipality TEXT NOT NULL,
    department TEXT,
    contact_name TEXT,
    social_reason TEXT,
    rfc TEXT,
    invoice_number TEXT,
    authorized_exit_by TEXT NOT NULL,
    delivery_receiver TEXT NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('contado', 'credito')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'check')),
    credit_days INTEGER DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    iva DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    notes TEXT,
    transfer_reference TEXT,
    payment_status TEXT DEFAULT 'approved' CHECK (payment_status IN ('pending', 'approved', 'rejected')),
    pending_since TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de items de ventas municipales
CREATE TABLE IF NOT EXISTS public.municipal_sale_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    municipal_sale_id UUID NOT NULL REFERENCES public.municipal_sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla de cuentas municipales (crédito)
CREATE TABLE IF NOT EXISTS public.municipal_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES public.branches(id),
    municipality TEXT NOT NULL UNIQUE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    credit_limit DECIMAL(10,2) DEFAULT 10000.00,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla de pagos municipales (historial)
CREATE TABLE IF NOT EXISTS public.municipal_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    municipal_account_id UUID NOT NULL REFERENCES public.municipal_accounts(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('abono', 'pago_completo')),
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_municipal_sales_branch ON public.municipal_sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_municipal_sales_municipality ON public.municipal_sales(municipality);
CREATE INDEX IF NOT EXISTS idx_municipal_sales_created_at ON public.municipal_sales(created_at);
CREATE INDEX IF NOT EXISTS idx_municipal_sale_items_sale ON public.municipal_sale_items(municipal_sale_id);
CREATE INDEX IF NOT EXISTS idx_municipal_accounts_branch ON public.municipal_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_municipal_payments_account ON public.municipal_payments(municipal_account_id);

-- 6. Políticas RLS (Row Level Security)
-- Nota: Estas políticas deben ajustarse según los permisos reales de la aplicación
ALTER TABLE public.municipal_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_payments ENABLE ROW LEVEL SECURITY;

-- 7. Políticas básicas (ajustar según necesidades)
-- Ventas municipales: todos los usuarios pueden ver las ventas de su sucursal
CREATE POLICY "Users can view municipal sales from their branch" ON public.municipal_sales
    FOR SELECT USING (branch_id = current_setting('app.current_branch_id', true) OR current_user = 'authenticated');

-- Cuentas municipales: todos los usuarios pueden ver las cuentas de su sucursal
CREATE POLICY "Users can view municipal accounts from their branch" ON public.municipal_accounts
    FOR SELECT USING (branch_id = current_setting('app.current_branch_id', true) OR current_user = 'authenticated');

-- 8. Comentarios descriptivos
COMMENT ON TABLE public.municipal_sales IS 'Registro de ventas a municipios';
COMMENT ON TABLE public.municipal_sale_items IS 'Items de ventas municipales';
COMMENT ON TABLE public.municipal_accounts IS 'Cuentas de crédito para municipios';
COMMENT ON TABLE public.municipal_payments IS 'Historial de pagos de cuentas municipales';

-- 9. Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_municipal_sales_updated_at BEFORE UPDATE ON public.municipal_sales
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_municipal_accounts_updated_at BEFORE UPDATE ON public.municipal_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();