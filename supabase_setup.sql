-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE
-- 1. Habilitar extensión para generar IDs únicos
create extension if not exists "uuid-ossp";

-- 2. Tabla de SUCURSALES
create table public.branches (
  id text primary key, -- Ej: 'BR-MAIN', 'BR-CENTRO'
  name text not null,
  address text,
  manager text,
  phone text,
  status text check (status in ('active', 'inactive')) default 'active',
  type text check (type in ('warehouse', 'store')) default 'store',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Tabla de PRODUCTOS (Catálogo)
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  sku text unique not null,
  name text not null,
  category text,
  description text,
  price numeric(10, 2) default 0,
  image text,
  status text check (status in ('available', 'low', 'out', 'expired')) default 'available',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Tabla de INVENTARIO (Relación Muchos a Muchos: Producto <-> Sucursal)
create table public.inventory (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade,
  branch_id text references public.branches(id) on delete cascade,
  stock integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  unique(product_id, branch_id)
);

-- 5. Tabla de SOLICITUDES DE RESURTIDO
create table public.restock_requests (
  id uuid default uuid_generate_v4() primary key,
  branch_id text references public.branches(id),
  product_id uuid references public.products(id),
  quantity integer not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. POLÍTICAS DE SEGURIDAD (RLS) - Permite acceso público por ahora (Simplificado para desarrollo)
alter table public.branches enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.restock_requests enable row level security;

create policy "Acceso total público" on public.branches for all using (true) with check (true);
create policy "Acceso total público" on public.products for all using (true) with check (true);
create policy "Acceso total público" on public.inventory for all using (true) with check (true);
create policy "Acceso total público" on public.restock_requests for all using (true) with check (true);

-- 7. DATOS INICIALES (SEED) - Para que no empiece vacío
insert into public.branches (id, name, address, manager, phone, type) values
('BR-MAIN', 'Bodega Principal (Hub)', 'Zona Industrial Vallejo', 'Ing. Roberto Maya', '555-1000', 'warehouse'),
('BR-CENTRO', 'Sucursal Centro', 'Av. Juárez 45, Col. Centro', 'Marta Sánchez', '555-2000', 'store'),
('BR-NORTE', 'Sucursal Norte', 'Plaza Satélite Local 12', 'Pedro Infante', '555-3000', 'store'),
('BR-SUR', 'Sucursal Sur', 'Perisur Nivel 2', 'Lucía Méndez', '555-4000', 'store');

-- Productos de ejemplo
DO $$
DECLARE
  v_prod_id uuid;
BEGIN
  -- Producto 1
  insert into public.products (sku, name, category, description, price, image, status)
  values ('VN-ADV-WH-01', 'Vinil Premium Blanca 4L', 'Interiores', 'Cubeta Plástica', 1200, 'https://lh3.googleusercontent.com/aida-public/AB6AXuBobmQqh7Oa-jCojPhZs2_OvCvYURSMCC234KOWH1jg7Y2v1JDVIkLDGS73_8Pw_MF5O9AFhzP5634IzRTi6751LKCFkTX8RMDSmuRt070NxV7uAJY_Y_lL8jQg9Cn3tb1FdapQ3ZlNw6RH0uBlW81TvAguAHYzgdgVRRDqAs2BbMA2ZvjrXHdMugbJtuNteTSUxpU3h4HJNM1cwjumKUUPA_NVh0K010111Qx4XQ47_techIsApQvH9qirTIEiIbERvz963hv16vc', 'available')
  returning id into v_prod_id;
  
  -- Inventario para Producto 1
  insert into public.inventory (product_id, branch_id, stock) values
  (v_prod_id, 'BR-MAIN', 150),
  (v_prod_id, 'BR-CENTRO', 25),
  (v_prod_id, 'BR-NORTE', 30),
  (v_prod_id, 'BR-SUR', 10);

  -- Producto 2
  insert into public.products (sku, name, category, description, price, image, status)
  values ('ES-RED-400', 'Esmalte Rojo Secado Rápido', 'Esmaltes', 'Aerosol 400ml', 150, 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5QR295XwP06xhH63Cjm_jPucbojbpEifsdY6GPRF3tnJT8RYGrKfgtCAXfcJf-Z6tMKBWOqynt_g2-RsxhnpaVz6usz87xBggEdqea3NDaPb0_JR2pqW36XdKrPcnKPG53sqvoHDo04t77Rx1wQexQffGyiMD8oRRETHDGh7x2diXpyEwM1TwioIQLKKoweCKHATUWp9PY6rcj7H6Q_jQMkjQHZiwOjrpVtY_OmSI-N381n3h3dD7zRFJXBJiUNmdj4tGHVDXnUI', 'low')
  returning id into v_prod_id;

  -- Inventario para Producto 2
  insert into public.inventory (product_id, branch_id, stock) values
  (v_prod_id, 'BR-MAIN', 50),
  (v_prod_id, 'BR-CENTRO', 2);

END $$;
