-- Create table for storing daily cash cuts
CREATE TABLE IF NOT EXISTS cash_cuts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_card NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_transfer NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expenses_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    calculated_total NUMERIC(15, 2) NOT NULL DEFAULT 0, -- (cash + card + transfer) - expenses
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by TEXT, -- User ID of the admin who approved
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one cut per branch per day (optional, but good for consistency)
    UNIQUE(branch_id, date)
);

-- Policy to allow authenticated users to insert (Store Managers)
CREATE POLICY "Enable insert for authenticated users" ON cash_cuts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy to allow viewing
CREATE POLICY "Enable select for authenticated users" ON cash_cuts
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy to allow updates (Admin approval)
CREATE POLICY "Enable update for admins" ON cash_cuts
    FOR UPDATE USING (auth.role() = 'authenticated');
