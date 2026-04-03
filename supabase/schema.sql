-- ============================================================
-- Edificio 12 — Schema
-- Paste in Supabase SQL Editor and run
-- ============================================================

-- Units (departments)
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null
);

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin', 'resident')),
  unit_id uuid references units(id)
);

-- Monthly fees
create table if not exists monthly_fees (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  amount numeric(10,2) not null
);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id),
  amount numeric(10,2) not null,
  method text not null check (method in ('efectivo', 'transferencia')),
  date date not null default current_date,
  month text not null,
  receipt_url text,
  notes text,
  created_at timestamptz default now()
);

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null,
  date date not null default current_date,
  category text not null,
  created_at timestamptz default now()
);

-- Documents
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_url text not null,
  type text not null,
  created_at timestamptz default now()
);

-- Announcements
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- ── RLS ──────────────────────────────────────────────────────
alter table units enable row level security;
alter table profiles enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table documents enable row level security;
alter table announcements enable row level security;
alter table monthly_fees enable row level security;

-- All authenticated users can read shared tables
create policy "authenticated_read" on units for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on expenses for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on documents for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on announcements for select using (auth.role() = 'authenticated');
create policy "authenticated_read" on monthly_fees for select using (auth.role() = 'authenticated');

-- Profiles: users see their own row (admin queries use service key)
create policy "own_profile" on profiles for select using (auth.uid() = id);

-- Payments: residents see only their unit's payments
create policy "own_unit_payments" on payments for select
  using (unit_id = (select unit_id from profiles where id = auth.uid()));

-- ── Trigger: auto-create profile on signup ───────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', 'resident');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Seed: 12 units ───────────────────────────────────────────
insert into units (name, owner_name) values
  ('PB A', 'Por asignar'),
  ('PB B', 'Por asignar'),
  ('1 A',  'Por asignar'),
  ('1 B',  'Por asignar'),
  ('2 A',  'Por asignar'),
  ('2 B',  'Por asignar'),
  ('3 A',  'Por asignar'),
  ('3 B',  'Por asignar'),
  ('4 A',  'Por asignar'),
  ('4 B',  'Por asignar'),
  ('5 A',  'Por asignar'),
  ('5 B',  'Por asignar')
on conflict do nothing;
