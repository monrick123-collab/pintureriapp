-- Corregir roles y nombres de los nuevos perfiles
UPDATE public.profiles SET full_name = 'Jefe de Bodega', role = 'WAREHOUSE'
WHERE id = 'c072d9f8-e6f9-4e0d-b80a-8ab4117dc916';

UPDATE public.profiles SET full_name = 'Encargado de Tienda', role = 'STORE_MANAGER'
WHERE id = 'a9ba81db-eccd-4f2f-a114-59d5dc39c1aa';

UPDATE public.profiles SET full_name = 'Subencargado', role = 'WAREHOUSE_SUB'
WHERE id = '5a998a7e-8814-482e-ae82-4da3decfaf48';

UPDATE public.profiles SET full_name = 'Vendedor', role = 'SELLER'
WHERE id = 'b22368f1-b862-4912-b6d9-dcd7c56d9d7f';

-- Eliminar perfiles viejos con IDs no válidos y duplicados
DELETE FROM public.profiles WHERE id IN ('WH-001', 'ACC-001', 'SBD-001');
DELETE FROM public.profiles WHERE id = '6a29426c-91c5-4b3a-b6b5-6cae64eb9e11';

-- Verificar resultado final
SELECT id, email, full_name, role, branch_id FROM public.profiles;
