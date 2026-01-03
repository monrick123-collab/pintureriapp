-- Migration to add discount approval system

CREATE TABLE IF NOT EXISTS discount_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES auth.users(id),
    requester_name TEXT,
    branch_id TEXT REFERENCES branches(id),
    amount FLOAT NOT NULL,
    type TEXT CHECK (type IN ('percentage', 'fixed')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE discount_requests;
