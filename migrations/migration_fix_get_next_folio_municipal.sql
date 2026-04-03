-- =====================================================
-- FIX: Restaurar caso 'municipal' en get_next_folio
--
-- La migración migration_barter_full_system.sql sobreescribió
-- get_next_folio con CREATE OR REPLACE sin incluir el caso
-- 'municipal' que había sido agregado en migration_municipal_sales.sql.
--
-- Resultado: get_next_folio('X', 'municipal') retornaba NULL sin
-- excepción, el bloque EXCEPTION WHEN OTHERS en process_municipal_sale
-- no se activaba, y el INSERT fallaba con:
-- "null value in column 'folio' violates not-null constraint"
-- =====================================================

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
    ELSIF p_folio_type = 'barter' THEN
        UPDATE public.branch_folios SET last_barter_folio = last_barter_folio + 1 WHERE branch_id = p_branch_id RETURNING last_barter_folio INTO v_folio;
    ELSIF p_folio_type = 'municipal' THEN
        UPDATE public.branch_folios SET last_municipal_folio = last_municipal_folio + 1 WHERE branch_id = p_branch_id RETURNING last_municipal_folio INTO v_folio;
    END IF;

    RETURN v_folio;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_next_folio(TEXT, TEXT) TO anon;
