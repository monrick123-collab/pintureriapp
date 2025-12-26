
-- SOLUCIÓN AL ERROR DE CONSTRAINT DE STATUS
-- Ejecuta este script en el SQL Editor de Supabase para actualizar la tabla

-- 1. Eliminar la restricción antigua (que solo permitía pending, approved, rejected)
ALTER TABLE public.restock_requests DROP CONSTRAINT IF EXISTS restock_requests_status_check;

-- 2. Agregar la nueva restricción con los estados del flujo avanzado
ALTER TABLE public.restock_requests 
ADD CONSTRAINT restock_requests_status_check 
CHECK (status IN ('pending_admin', 'approved_warehouse', 'shipped', 'completed', 'rejected'));

-- 3. Agregar columnas faltantes para el seguimiento de fechas
ALTER TABLE public.restock_requests ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;
ALTER TABLE public.restock_requests ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone;
ALTER TABLE public.restock_requests ADD COLUMN IF NOT EXISTS received_at timestamp with time zone;
ALTER TABLE public.restock_requests ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 4. Actualizar registros viejos para que sean compatibles
UPDATE public.restock_requests SET status = 'pending_admin' WHERE status = 'pending';
UPDATE public.restock_requests SET status = 'approved_warehouse' WHERE status = 'approved';

-- 5. Re-crear función de confirmación por si acaso no existía o estaba obsoleta
create or replace function public.confirm_restock_arrival(p_request_id uuid)
returns void
language plpgsql
as $$
declare
    v_product_id uuid;
    v_branch_id text;
    v_quantity integer;
    v_warehouse_id text;
begin
    -- Get request details
    select product_id, branch_id, quantity
    into v_product_id, v_branch_id, v_quantity
    from public.restock_requests
    where id = p_request_id;

    -- Get warehouse branch ID (assuming 'BR-MAIN' is the warehouse)
    select id into v_warehouse_id from public.branches where type = 'warehouse' limit 1;
    -- Fallback explicit check
    if v_warehouse_id is null then
         v_warehouse_id := 'BR-MAIN';
    end if;

    -- Deduct from warehouse inventory
    update public.inventory
    set stock = stock - v_quantity
    where branch_id = v_warehouse_id and product_id = v_product_id;

    -- Add to destination branch inventory
    -- Upsert logic: insert if not exists, otherwise update
    insert into public.inventory (product_id, branch_id, stock)
    values (v_product_id, v_branch_id, v_quantity)
    on conflict (product_id, branch_id)
    do update set stock = public.inventory.stock + excluded.stock;

    -- Update restock request status
    update public.restock_requests
    set status = 'completed', received_at = now()
    where id = p_request_id;
end;
$$;
