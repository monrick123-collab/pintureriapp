-- Migration to add STORE_MANAGER to allowed roles
-- This updates the "profiles_role_check" constraint

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADMIN', 'SELLER', 'WAREHOUSE', 'WAREHOUSE_SUB', 'FINANCE', 'STORE_MANAGER'));
