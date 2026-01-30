-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE
-- VERSION 2.1 (CORREGIDA)

-- 1. Tabla de CLIENTES (Faltaba)
create table if not exists public.clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  email text,
  phone text,
  tax_id text, -- RFC
  address text,
  type text check (type in ('Individual', 'Empresa')) default 'Individual',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Tablas de VENTAS (Para reemplazar localStorage)
create table if not exists public.sales (
  id uuid default uuid_generate_v4() primary key,
  branch_id text references public.branches(id),
  seller_id uuid references auth.users(id),
  client_id uuid references public.clients(id),
  total numeric(10, 2) not null,
  payment_method text check (payment_method in ('cash', 'card', 'transfer')) default 'cash',
  status text check (status in ('completed', 'cancelled')) default 'completed',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  total numeric(10, 2) generated always as (quantity * unit_price) stored
);

-- 3. Habilitar Seguridad (RLS)
alter table public.clients enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- CORRECCIÓN: Borrar políticas anteriores para evitar errores al re-ejecutar
drop policy if exists "Acceso total a clientes" on public.clients;
drop policy if exists "Acceso total a ventas" on public.sales;
drop policy if exists "Acceso total a items de venta" on public.sale_items;

-- Crear políticas
create policy "Acceso total a clientes" on public.clients for all using (true) with check (true);
create policy "Acceso total a ventas" on public.sales for all using (true) with check (true);
create policy "Acceso total a items de venta" on public.sale_items for all using (true) with check (true);

-- 4. RPC (Función para procesar venta y descontar stock atómicamente)
create or replace function process_sale(
  p_branch_id text,
  p_total numeric,
  p_payment_method text,
  p_items jsonb
) returns uuid as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_current_stock int;
begin
  -- 1. Crear Venta
  insert into public.sales (branch_id, total, payment_method)
  values (p_branch_id, p_total, p_payment_method)
  returning id into v_sale_id;

  -- 2. Procesar Items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    -- Verificar Stock
    select stock into v_current_stock 
    from public.inventory 
    where product_id = (v_item->>'product_id')::uuid and branch_id = p_branch_id;

    if v_current_stock < (v_item->>'quantity')::int then
      raise exception 'Stock insuficiente para el producto %', (v_item->>'product_name');
    end if;

    -- Descontar Inventario
    update public.inventory 
    set stock = stock - (v_item->>'quantity')::int,
        updated_at = now()
    where product_id = (v_item->>'product_id')::uuid and branch_id = p_branch_id;

    -- Registrar Item de Venta
    insert into public.sale_items (sale_id, product_id, product_name, quantity, unit_price)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'product_name'),
      (v_item->>'quantity')::int,
      (v_item->>'price')::numeric
    );
  end loop;

  return v_sale_id;
end;
$$ language plpgsql;
