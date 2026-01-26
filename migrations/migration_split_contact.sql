-- MIGRAR PROVEEDORES A CAMPOS SEPARADOS
ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- (Opcional) Migrar datos existentes si fuera crítico, pero asumimos data nueva o manual migration
-- UPDATE public.suppliers SET contact_name = contact_info; 
