-- Add billing details to sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS billing_bank TEXT,
ADD COLUMN IF NOT EXISTS billing_social_reason TEXT,
ADD COLUMN IF NOT EXISTS billing_invoice_number TEXT,
ADD COLUMN IF NOT EXISTS delivery_receiver_name TEXT;

-- Add timing tracking to restock_sheets
ALTER TABLE restock_sheets
ADD COLUMN IF NOT EXISTS departure_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS arrival_time TIMESTAMP WITH TIME ZONE;

-- Add breakdown details to coin_change_requests
ALTER TABLE coin_change_requests
ADD COLUMN IF NOT EXISTS breakdown_details JSONB;

-- Add released flag to packaging_requests
ALTER TABLE packaging_requests
ADD COLUMN IF NOT EXISTS stock_released BOOLEAN DEFAULT FALSE;
