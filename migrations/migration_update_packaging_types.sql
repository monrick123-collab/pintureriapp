-- Migración para actualizar tipos de envasado
-- Agrega cuarto_litro, medio_litro, litro, galon (3.8L)

-- Primero, necesitamos eliminar el constraint existente y crear uno nuevo
-- Nota: Esto requiere que no haya datos que violen el nuevo constraint

-- Paso 1: Verificar si hay datos que no cumplirán con el nuevo constraint
-- (En este caso, todos los datos existentes tienen 'litro' o 'galon', que siguen siendo válidos)

-- Paso 2: Eliminar el constraint existente
ALTER TABLE public.packaging_requests 
DROP CONSTRAINT IF EXISTS packaging_requests_target_package_type_check;

-- Paso 3: Agregar el nuevo constraint con los tipos actualizados
ALTER TABLE public.packaging_requests 
ADD CONSTRAINT packaging_requests_target_package_type_check 
CHECK (target_package_type IN ('cuarto_litro', 'medio_litro', 'litro', 'galon'));

-- Paso 4: Actualizar los datos existentes si es necesario
-- (Opcional) Si queremos mantener compatibilidad, podríamos actualizar 'litro' a 'litro' (igual) y 'galon' a 'galon' (igual)
-- Pero en este caso los tipos antiguos ya están incluidos en los nuevos, así que no hay problema

-- Nota: También necesitamos actualizar el tipo en la tabla products si existe un campo relacionado
-- Verificamos si el campo package_type en products necesita actualización
-- (Esto es opcional, depende de si usas este campo para algo relacionado)

-- Información para el equipo:
-- Los nuevos tipos son:
--   'cuarto_litro' = 0.25 litros
--   'medio_litro'  = 0.5 litros  
--   'litro'        = 1 litro
--   'galon'        = 3.8 litros

-- Cada tambo es de 200 litros, por lo que:
--   - 1 tambo produce 800 cuartos de litro (200 / 0.25)
--   - 1 tambo produce 400 medios litro (200 / 0.5)
--   - 1 tambo produce 200 litros (200 / 1)
--   - 1 tambo produce ~52 galones (200 / 3.8 ≈ 52.63)