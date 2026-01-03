-- COPIA Y PEGA ESTO EN EL "SQL EDITOR" DE SUPABASE (LUEGO DE HABER CORRIDO EL SETUP ANTERIOR)

-- 1. Tabla de PERFILES DE USUARIO (Extiende la tabla auth.users de Supabase)
-- Se vincula automáticamente cuando un usuario se registra/crea.
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text check (role in ('ADMIN', 'SELLER', 'WAREHOUSE', 'FINANCE')) default 'SELLER',
  branch_id text references public.branches(id),
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Tabla de CLIENTES
create table public.clients (
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

-- 3. Tabla de AUDITORÍA (Historial de movimientos importantes)
create table public.audit_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id),
  action text not null, -- Ej: 'CREATE_PRODUCT', 'APPROVE_RESTOCK', 'LOGIN'
  details jsonb, -- Detalles en formato JSON (Ej: { "product": "Pintura", "qty": 5 })
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. POLÍTICAS DE SEGURIDAD (RLS)
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.audit_logs enable row level security;

-- Políticas permisivas para desarrollo (Luego se pueden restringir)
create policy "Public profiles access" on public.profiles for all using (true) with check (true);
create policy "Public clients access" on public.clients for all using (true) with check (true);
create policy "Public audit access" on public.audit_logs for all using (true) with check (true);

-- 5. TRIGGER AUTOMÁTICO PARA CREAR PERFIL
-- Cada vez que se crea un usuario en Auth, se crea una entrada en public.profiles
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'SELLER');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
