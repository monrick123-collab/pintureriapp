-- Migration V10: Add credit_days to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 0;
