-- FIX: Update RLS policies for stock_transfers and stock_transfer_items to allow inserts
-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfers;
DROP POLICY IF EXISTS "Enable All for Auth stock_transfers" ON public.stock_transfers;

-- Create comprehensive policy for stock_transfers
CREATE POLICY "Enable All for Auth stock_transfers" ON public.stock_transfers AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Enable All for Auth" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Enable All for Auth stock_transfer_items" ON public.stock_transfer_items;

-- Create comprehensive policy for stock_transfer_items
CREATE POLICY "Enable All for Auth stock_transfer_items" ON public.stock_transfer_items AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Ensure branch_folios is also fully accessible to avoid get_next_folio issues
DROP POLICY IF EXISTS "Enable All for Auth" ON public.branch_folios;
DROP POLICY IF EXISTS "Enable All for Auth branch_folios" ON public.branch_folios;
CREATE POLICY "Enable All for Auth branch_folios" ON public.branch_folios AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
