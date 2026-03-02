-- FIX: Add missing columns to the `sales` table
-- These columns are required by the `process_sale` RPC for wholesale and credit sales
-- but they were missing from the initial database schema.

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS billing_bank TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS billing_social_reason TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS billing_invoice_number TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS delivery_receiver_name TEXT;
