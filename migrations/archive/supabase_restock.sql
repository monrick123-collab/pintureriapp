-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE
-- VERSION 3.0: FLUJO AVANZADO DE SURTIDO (RESTOCK)

-- 1. Tabla de Solicitudes de Surtido
create table if not exists public.restock_requests (
  id uuid default uuid_generate_v4() primary key,
  branch_id text references public.branches(id),
  product_id uuid references public.products(id),
  quantity integer not null check (quantity > 0),
  status text check (status in ('pending_admin', 'approved_warehouse', 'shipped', 'completed', 'rejected')) default 'pending_admin',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  approved_at timestamp with time zone,
  shipped_at timestamp with time zone,
  received_at timestamp with time zone
);

-- RLS
alter table public.restock_requests enable row level security;
drop policy if exists "Acceso total a solicitudes" on public.restock_requests;
create policy "Acceso total a solicitudes" on public.restock_requests for all using (true) with check (true);


-- 2. FUNCIÓN MAESTRA: Confirmar Recepción y Mover Stock
-- Esta funcion hace 2 cosas al mismo tiempo (atómicamente):
--  a) Marca la solicitud como "completada"
--  b) Resta el stock a la Bodega (BR-MAIN)
--  c) Suma el stock a la Sucursal solicitante
create or replace function confirm_restock_arrival(
  p_request_id uuid
) returns void as $$
declare
  v_req record;
begin
  -- 1. Obtener datos de la solicitud
  select * into v_req from public.restock_requests where id = p_request_id;

  if v_req is null then
    raise exception 'Solicitud no encontrada';
  end if;

  if v_req.status != 'shipped' then
    raise exception 'Solo se pueden recibir pedidos que ya fueron enviados (shipped)';
  end if;

  -- 2. Mover Inventario
  -- a) Restar de Bodega (BR-MAIN)
  -- Nota: Si no existe registro en bodega, asumimos 0 y podría quedar negativo si no hay validación previa.
  -- Idealmente la bodega tiene stock.
  update public.inventory 
  set stock = stock - v_req.quantity,
      updated_at = now()
  where product_id = v_req.product_id and branch_id = 'BR-MAIN';

  -- b) Sumar a Sucursal
  -- Usamos UPSERT por si la sucursal nunca había tenido este producto
  insert into public.inventory (product_id, branch_id, stock)
  values (v_req.product_id, v_req.branch_id, v_req.quantity)
  on conflict (product_id, branch_id) do update
  set stock = inventory.stock + excluded.stock,
      updated_at = now();

  -- 3. Actualizar Estado de Solicitud
  update public.restock_requests
  set status = 'completed',
      received_at = now()
  where id = p_request_id;

end;
$$ language plpgsql;

-- 3. FUNCIÓN AUXILIAR: Obtener Detalle de Solicitudes
-- Hace un Join simple para devolver nombres de branches y productos
-- (Aunque Supabase JS Client lo hace, a veces es útil tener vistas o funciones)
-- Por ahora usaremos el cliente de JS con .select('*, products(*), branches(*)')
