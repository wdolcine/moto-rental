create table vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  type text not null check (type in ('moto','voiture')),
  brand text, model text, year int, plate text, vin text, color text, mileage int, notes text,
  created_at timestamptz default now()
);
create table drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  full_name text not null, phone text, address text, license_no text, id_doc text,
  guarantor text, notes text, created_at timestamptz default now()
);
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  vehicle_id uuid not null references vehicles on delete restrict,
  driver_id uuid not null references drivers on delete restrict,
  start_date date not null, end_date date not null,
  weekly_amount numeric not null, deposit numeric default 0, currency text default 'HTG',
  created_at timestamptz default now()
);
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users,
  contract_id uuid not null references contracts on delete cascade,
  week_no int not null, due_date date not null, amount numeric not null,
  paid_at date
);
create index on payments (contract_id, due_date);

-- Sécurité : chaque utilisateur ne voit que ses propres données
do $$ declare t text; begin
  foreach t in array array['vehicles','drivers','contracts','payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
