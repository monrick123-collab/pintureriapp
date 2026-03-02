-- FIX: Correcting the timezone double-shift bug in get_daily_cash_cut_data.
-- The previous AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City' was incorrect 
-- for a timestamptz column, accidentally pushing afternoon sales into the next day.
-- The correct way to get a local date from timestamptz is simply: 
-- (column AT TIME ZONE 'America/Mexico_City')::DATE

CREATE OR REPLACE FUNCTION public.get_daily_cash_cut_data(p_branch_id TEXT, p_date DATE)
RETURNS JSONB AS $$
DECLARE
    v_sales JSONB;
    v_expenses JSONB;
    v_coupons JSONB;
BEGIN
    -- 1. Get Sales for the specific date in local timezone
    SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::jsonb)
    INTO v_sales
    FROM public.sales s
    WHERE s.branch_id = p_branch_id
      AND (s.created_at AT TIME ZONE 'America/Mexico_City')::DATE = p_date;

    -- 2. Get Expenses for the specific date
    SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
    INTO v_expenses
    FROM public.expenses e
    WHERE e.branch_id = p_branch_id
      AND (e.created_at AT TIME ZONE 'America/Mexico_City')::DATE = p_date;

    -- 3. Get Redeemed Coupons
    SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
    INTO v_coupons
    FROM public.coupons c
    WHERE c.branch_id = p_branch_id
      AND c.status = 'redeemed'
      AND (c.redeemed_at AT TIME ZONE 'America/Mexico_City')::DATE = p_date;

    RETURN jsonb_build_object(
        'sales', v_sales,
        'expenses', v_expenses,
        'coupons', v_coupons
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
