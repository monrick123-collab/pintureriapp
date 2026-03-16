-- ============================================================
-- MIGRATION: Sistema de Cuentas de Crédito para Mayoreo
-- ============================================================

-- 1. Tabla de cuentas de crédito para clientes de mayoreo
CREATE TABLE IF NOT EXISTS public.wholesale_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id TEXT NOT NULL REFERENCES public.branches(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    client_name TEXT NOT NULL,
    balance DECIMAL(12,2) DEFAULT 0.00,
    credit_limit DECIMAL(12,2) DEFAULT 10000.00,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, client_id)
);

-- 2. Tabla de pagos/historial para cuentas de mayoreo
CREATE TABLE IF NOT EXISTS public.wholesale_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wholesale_account_id UUID NOT NULL REFERENCES public.wholesale_accounts(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('cargo', 'abono', 'pago_completo')),
    sale_id UUID REFERENCES public.sales(id),
    notes TEXT,
    registered_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_wholesale_accounts_branch ON public.wholesale_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_accounts_client ON public.wholesale_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_payments_account ON public.wholesale_payments(wholesale_account_id);

-- 4. Habilitar RLS
ALTER TABLE public.wholesale_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_payments ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
DROP POLICY IF EXISTS "Full access wholesale_accounts" ON public.wholesale_accounts;
CREATE POLICY "Full access wholesale_accounts" ON public.wholesale_accounts 
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access wholesale_payments" ON public.wholesale_payments;
CREATE POLICY "Full access wholesale_payments" ON public.wholesale_payments 
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_wholesale_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_wholesale_accounts_updated_at ON public.wholesale_accounts;
CREATE TRIGGER update_wholesale_accounts_updated_at 
    BEFORE UPDATE ON public.wholesale_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_wholesale_updated_at();

-- 7. Agregar campo isActiveCredit a clients si no existe
ALTER TABLE public.clients 
    ADD COLUMN IF NOT EXISTS is_active_credit BOOLEAN DEFAULT false;

-- 8. Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Sistema de cuentas de crédito para mayoreo creado';
    RAISE NOTICE '================================================';
END $$;
