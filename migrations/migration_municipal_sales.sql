-- =================================================================
-- MIGRACIÓN: Venta a Municipio
-- =================================================================

-- 1. Tipo de folio en branch_folios (ya existe la columna en la tabla)
--    → Se usa last_return_folio como base o se agrega columna nueva
ALTER TABLE public.branch_folios
    ADD COLUMN IF NOT EXISTS last_municipal_folio INTEGER DEFAULT -1;

-- 2. Tabla principal de ventas a municipio
CREATE TABLE IF NOT EXISTS public.municipal_sales (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id           TEXT REFERENCES public.branches(id),
    folio               INTEGER NOT NULL DEFAULT 0,

    -- Datos del municipio
    municipality        TEXT NOT NULL,
    department          TEXT,                          -- Dependencia / Área
    contact_name        TEXT,                          -- Nombre del contacto

    -- Datos fiscales
    social_reason       TEXT,                          -- Razón social
    rfc                 TEXT,                          -- RFC del municipio
    invoice_number      TEXT,                          -- Folio de factura oficial

    -- Logística
    authorized_exit_by  UUID REFERENCES auth.users(id), -- Admin que autoriza
    delivery_receiver   TEXT,                          -- Quién recibe físicamente

    -- Pago
    payment_type        TEXT CHECK (payment_type IN ('contado', 'credito')) DEFAULT 'contado',
    payment_method      TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'check')) DEFAULT 'cash',
    credit_days         INTEGER DEFAULT 0,
    payment_status      TEXT CHECK (payment_status IN ('pending', 'invoiced', 'paid')) DEFAULT 'pending',

    -- Totales
    subtotal            DECIMAL(12,2) DEFAULT 0,
    discount_amount     DECIMAL(12,2) DEFAULT 0,
    iva                 DECIMAL(12,2) DEFAULT 0,
    total               DECIMAL(12,2) NOT NULL,

    -- Extras
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),

    UNIQUE(branch_id, folio)
);

-- 3. Ítems de la venta
CREATE TABLE IF NOT EXISTS public.municipal_sale_items (
    id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sale_id         UUID REFERENCES public.municipal_sales(id) ON DELETE CASCADE,
    product_id      UUID REFERENCES public.products(id),
    product_name    TEXT,
    quantity        INTEGER NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_price     DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Soporte en get_next_folio para tipo 'municipal'
CREATE OR REPLACE FUNCTION public.get_next_folio(p_branch_id TEXT, p_folio_type TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_folio INTEGER;
BEGIN
    IF p_folio_type = 'restock' THEN
        UPDATE public.branch_folios SET last_restock_folio = last_restock_folio + 1 WHERE branch_id = p_branch_id RETURNING last_restock_folio INTO v_folio;
    ELSIF p_folio_type = 'transfer' THEN
        UPDATE public.branch_folios SET last_transfer_folio = last_transfer_folio + 1 WHERE branch_id = p_branch_id RETURNING last_transfer_folio INTO v_folio;
    ELSIF p_folio_type = 'quotation' THEN
        UPDATE public.branch_folios SET last_quotation_folio = last_quotation_folio + 1 WHERE branch_id = p_branch_id RETURNING last_quotation_folio INTO v_folio;
    ELSIF p_folio_type = 'return' THEN
        UPDATE public.branch_folios SET last_return_folio = last_return_folio + 1 WHERE branch_id = p_branch_id RETURNING last_return_folio INTO v_folio;
    ELSIF p_folio_type = 'coin_change' THEN
        UPDATE public.branch_folios SET last_coin_change_folio = last_coin_change_folio + 1 WHERE branch_id = p_branch_id RETURNING last_coin_change_folio INTO v_folio;
    ELSIF p_folio_type = 'municipal' THEN
        UPDATE public.branch_folios SET last_municipal_folio = last_municipal_folio + 1 WHERE branch_id = p_branch_id RETURNING last_municipal_folio INTO v_folio;
    END IF;

    RETURN v_folio;
END;
$$ LANGUAGE plpgsql;

-- 5. RLS
ALTER TABLE public.municipal_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access municipal_sales" ON public.municipal_sales;
CREATE POLICY "Full access municipal_sales" ON public.municipal_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access municipal_sale_items" ON public.municipal_sale_items;
CREATE POLICY "Full access municipal_sale_items" ON public.municipal_sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Cuentas y Pagos Municipales
CREATE TABLE IF NOT EXISTS public.municipal_accounts (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    branch_id           TEXT REFERENCES public.branches(id),
    municipality        TEXT NOT NULL,
    balance             DECIMAL(12,2) DEFAULT 0,
    credit_limit        DECIMAL(12,2) DEFAULT 0,
    is_blocked          BOOLEAN DEFAULT false,
    block_reason        TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(branch_id, municipality)
);

CREATE TABLE IF NOT EXISTS public.municipal_payments (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    account_id          UUID REFERENCES public.municipal_accounts(id) ON DELETE CASCADE,
    sale_id             UUID REFERENCES public.municipal_sales(id),
    type                TEXT CHECK (type IN ('cargo', 'abono', 'pago_completo')),
    amount              DECIMAL(12,2) NOT NULL,
    notes               TEXT,
    registered_by       UUID REFERENCES auth.users(id),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.municipal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Full access municipal_accounts" ON public.municipal_accounts;
CREATE POLICY "Full access municipal_accounts" ON public.municipal_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Full access municipal_payments" ON public.municipal_payments;
CREATE POLICY "Full access municipal_payments" ON public.municipal_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
