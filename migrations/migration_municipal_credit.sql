-- =================================================================
-- MIGRACIÓN: Sistema de Crédito para Municipios
-- =================================================================

-- 1. Cuenta por municipio (una por nombre + sucursal)
CREATE TABLE IF NOT EXISTS public.municipal_accounts (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    municipality    TEXT NOT NULL,
    branch_id       TEXT REFERENCES public.branches(id),
    credit_limit    DECIMAL(12,2) DEFAULT 0,      -- 0 = sin límite
    balance         DECIMAL(12,2) DEFAULT 0,       -- saldo pendiente acumulado
    is_blocked      BOOLEAN DEFAULT false,
    block_reason    TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(municipality, branch_id)
);

-- 2. Log de movimientos (cargos y abonos)
CREATE TABLE IF NOT EXISTS public.municipal_payments (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id      UUID REFERENCES public.municipal_accounts(id) ON DELETE CASCADE,
    sale_id         UUID REFERENCES public.municipal_sales(id) ON DELETE SET NULL,
    type            TEXT CHECK (type IN ('cargo', 'abono', 'pago_completo')) NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    notes           TEXT,
    registered_by   UUID REFERENCES auth.users(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. RLS
ALTER TABLE public.municipal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access municipal_accounts" ON public.municipal_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Full access municipal_payments" ON public.municipal_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
