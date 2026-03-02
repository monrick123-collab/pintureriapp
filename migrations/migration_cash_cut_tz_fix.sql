-- FIX: Create RPC for reliable Cash Cut Data retrieval ignoring browser Timezones
-- JavaScript Date.toISOString() shifts local dates into UTC, which causes Sales from late afternoon
-- (in Mexico) to spill over into the next day's UTC date, breaking the Cash Cut report.
-- This function extracts the exact DATE component using the Mexico City timezone.

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
      AND (s.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::DATE = p_date;

    -- 2. Get Expenses for the specific date
    SELECT COALESCE(jsonb_agg(row_to_json(e)), '[]'::jsonb)
    INTO v_expenses
    FROM public.expenses e
    WHERE e.branch_id = p_branch_id
      AND (e.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::DATE = p_date;

    -- 3. Get Redeemed Coupons
    SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::jsonb)
    INTO v_coupons
    FROM public.coupons c
    WHERE c.branch_id = p_branch_id
      AND c.status = 'redeemed'
      AND (c.redeemed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City')::DATE = p_date;

    RETURN jsonb_build_object(
        'sales', v_sales,
        'expenses', v_expenses,
        'coupons', v_coupons
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
