-- Add created_by column to packaging_requests
ALTER TABLE public.packaging_requests
    ADD COLUMN IF NOT EXISTS created_by TEXT;
