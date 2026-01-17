-- Migration to add WAREHOUSE_SUB to allowed roles
-- This fixes the "profiles_role_check" violation

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADMIN', 'SELLER', 'WAREHOUSE', 'WAREHOUSE_SUB', 'FINANCE'));
