-- ============================================================
-- Migración: RPCs atómicos para cargos y pagos de crédito
-- Corrige: Lost Update en saldos de wholesale_accounts y municipal_accounts
-- ============================================================

-- ---------------------------------------------------------------
-- RPC 1: add_wholesale_charge
-- Registra un cargo (venta a crédito) en una cuenta mayoreo.
-- Bloquea la fila con FOR UPDATE para evitar Lost Update concurrente.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_wholesale_charge(
    p_account_id  UUID,
    p_amount      NUMERIC,
    p_sale_id     UUID    DEFAULT NULL,
    p_notes       TEXT    DEFAULT NULL,
    p_user_id     TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account     wholesale_accounts%ROWTYPE;
    v_new_balance NUMERIC;
BEGIN
    -- Bloquear fila para prevenir concurrencia (Lost Update)
    SELECT * INTO v_account
    FROM wholesale_accounts
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta mayoreo no encontrada: %', p_account_id;
    END IF;

    v_new_balance := COALESCE(v_account.balance, 0) + p_amount;

    IF v_new_balance > v_account.credit_limit THEN
        RAISE EXCEPTION 'El cargo excede el límite de crédito. Límite: %, Saldo actual: %, Cargo: %',
            v_account.credit_limit, v_account.balance, p_amount;
    END IF;

    UPDATE wholesale_accounts
    SET balance    = v_new_balance,
        updated_at = NOW()
    WHERE id = p_account_id;

    INSERT INTO wholesale_payments (
        wholesale_account_id, amount, payment_type, sale_id, notes, registered_by
    ) VALUES (
        p_account_id, p_amount, 'cargo', p_sale_id, p_notes, p_user_id
    );

    RETURN jsonb_build_object('new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_wholesale_charge TO anon;


-- ---------------------------------------------------------------
-- RPC 2: add_wholesale_payment
-- Registra un abono o pago completo en una cuenta mayoreo.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_wholesale_payment(
    p_account_id   UUID,
    p_payment_type TEXT,     -- 'abono' | 'pago_completo'
    p_amount       NUMERIC,
    p_notes        TEXT    DEFAULT NULL,
    p_user_id      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account     wholesale_accounts%ROWTYPE;
    v_new_balance NUMERIC;
BEGIN
    SELECT * INTO v_account
    FROM wholesale_accounts
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta mayoreo no encontrada: %', p_account_id;
    END IF;

    IF p_payment_type = 'pago_completo' THEN
        v_new_balance := 0;
    ELSE
        v_new_balance := GREATEST(0, COALESCE(v_account.balance, 0) - p_amount);
    END IF;

    UPDATE wholesale_accounts
    SET balance           = v_new_balance,
        last_payment_date = NOW(),
        updated_at        = NOW()
    WHERE id = p_account_id;

    INSERT INTO wholesale_payments (
        wholesale_account_id, amount, payment_type, notes, registered_by
    ) VALUES (
        p_account_id, p_amount, p_payment_type, p_notes, p_user_id
    );

    RETURN jsonb_build_object('new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_wholesale_payment TO anon;


-- ---------------------------------------------------------------
-- RPC 3: add_municipal_payment
-- Registra un abono o pago completo en una cuenta municipal.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_municipal_payment(
    p_account_id   UUID,
    p_payment_type TEXT,     -- 'abono' | 'pago_completo'
    p_amount       NUMERIC,
    p_notes        TEXT    DEFAULT NULL,
    p_user_id      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account     municipal_accounts%ROWTYPE;
    v_new_balance NUMERIC;
BEGIN
    SELECT * INTO v_account
    FROM municipal_accounts
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cuenta municipal no encontrada: %', p_account_id;
    END IF;

    IF p_payment_type = 'pago_completo' THEN
        v_new_balance := 0;
    ELSE
        v_new_balance := GREATEST(0, COALESCE(v_account.balance, 0) - p_amount);
    END IF;

    UPDATE municipal_accounts
    SET balance    = v_new_balance,
        updated_at = NOW()
    WHERE id = p_account_id;

    INSERT INTO municipal_payments (
        account_id, amount, type, notes, registered_by, created_at
    ) VALUES (
        p_account_id, p_amount, p_payment_type, p_notes, p_user_id, NOW()
    );

    RETURN jsonb_build_object('new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_municipal_payment TO anon;
