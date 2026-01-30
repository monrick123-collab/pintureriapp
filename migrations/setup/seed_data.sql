-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE
-- SEED DATA: PRODUCTOS Y EXISTENCIAS DE PRUEBA

DO $$
DECLARE
  v_prod1 uuid;
  v_prod2 uuid;
  v_prod3 uuid;
  v_prod4 uuid;
BEGIN
  -- 1. Insertar Productos Ficticios
  
  -- Producto A
  insert into public.products (sku, name, category, description, price, image, status)
  values ('PINT-VIN-BLA', 'Vinimex Total Blanco', 'Interiores', 'Cubeta 19L Alta Durabilidad', 2450.00, 'https://cdn-icons-png.flaticon.com/512/2679/2679261.png', 'available')
  returning id into v_prod1;

  -- Producto B
  insert into public.products (sku, name, category, description, price, image, status)
  values ('IMP-ROJO-5A', 'Impermeabilizante Rojo 5 Años', 'Exteriores', 'Cubeta 19L Fibratado', 1800.50, 'https://cdn-icons-png.flaticon.com/512/911/911409.png', 'available')
  returning id into v_prod2;

  -- Producto C
  insert into public.products (sku, name, category, description, price, image, status)
  values ('BROCHA-4IN', 'Brocha Éxito 4 Pulgadas', 'Accesorios', 'Cerdas naturales', 85.00, 'https://cdn-icons-png.flaticon.com/512/2800/2800209.png', 'available')
  returning id into v_prod3;

  -- Producto D
  insert into public.products (sku, name, category, description, price, image, status)
  values ('AERO-NEG-MATE', 'Aerosol Negro Mate', 'Esmaltes', 'Secado rápido 400ml', 120.00, 'https://cdn-icons-png.flaticon.com/512/3257/3257711.png', 'low')
  returning id into v_prod4;


  -- 2. Insertar Inventario Inicial (Bodega y Sucursales) forzando actualización si ya existe
  -- BR-MAIN (Bodega)
  insert into public.inventory (product_id, branch_id, stock) values (v_prod1, 'BR-MAIN', 100) on conflict(product_id, branch_id) do update set stock = 100;
  insert into public.inventory (product_id, branch_id, stock) values (v_prod2, 'BR-MAIN', 50) on conflict(product_id, branch_id) do update set stock = 50;
  insert into public.inventory (product_id, branch_id, stock) values (v_prod3, 'BR-MAIN', 200) on conflict(product_id, branch_id) do update set stock = 200;
  insert into public.inventory (product_id, branch_id, stock) values (v_prod4, 'BR-MAIN', 500) on conflict(product_id, branch_id) do update set stock = 500;

  -- BR-CENTRO (Sucursal Centro)
  insert into public.inventory (product_id, branch_id, stock) values (v_prod1, 'BR-CENTRO', 10) on conflict(product_id, branch_id) do update set stock = 10;
  insert into public.inventory (product_id, branch_id, stock) values (v_prod2, 'BR-CENTRO', 5) on conflict(product_id, branch_id) do update set stock = 5;
  insert into public.inventory (product_id, branch_id, stock) values (v_prod3, 'BR-CENTRO', 25) on conflict(product_id, branch_id) do update set stock = 25;
  
  -- BR-NORTE
  insert into public.inventory (product_id, branch_id, stock) values (v_prod1, 'BR-NORTE', 15) on conflict(product_id, branch_id) do update set stock = 15;

END $$;
