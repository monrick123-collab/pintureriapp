-- Revised migration to fix ID types and RLS policies
-- Run this in Supabase SQL Editor

-- 1. Drop existing table if it was created with wrong types
DROP TABLE IF EXISTS discount_requests;

-- 2. Create table with TEXT for IDs to allow mock/custom IDs
CREATE TABLE public.discount_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id TEXT, -- Changed from UUID to allow mock IDs like '4829'
    requester_name TEXT,
    branch_id TEXT REFERENCES public.branches(id),
    amount FLOAT NOT NULL,
    type TEXT CHECK (type IN ('percentage', 'fixed')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE discount_requests;

-- 4. Enable RLS and add public access (similar to other tables in this project)
ALTER TABLE public.discount_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public handle all" ON public.discount_requests FOR ALL USING (true) WITH CHECK (true);
