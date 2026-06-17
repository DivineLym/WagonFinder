-- ============================================================
-- WagonFinder Railway Logistics Module — Initial Schema
-- KTZ (Kazakhstan Temir Zholy) MVP
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  role          text not null check (role in ('shipper', 'wagon_owner')),
  bin           text check (bin ~ '^\d{12}$'),           -- Business ID number, 12 digits
  ktz_payer_code text check (ktz_payer_code ~ '^\d{7}$'), -- KTZ payer code, 7 digits
  company_name  text,
  phone         text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- WAGONS
-- ============================================================
create table public.wagons (
  id            uuid primary key default uuid_generate_v4(),
  number        text not null unique check (number ~ '^\d{8}$'), -- 8-digit wagon number
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  is_verified   boolean not null default false,

  -- Tech Passport
  wagon_type    text not null check (wagon_type in ('tank', 'hopper', 'flatcar', 'boxcar', 'gondola', 'refrigerator')),
  payload_capacity_tons numeric(8,2),
  volume_m3     numeric(8,2),
  model_number  text,
  tare_weight_tons numeric(8,2),

  -- Maintenance
  last_repair_date  date,
  next_repair_date  date,
  remaining_mileage_km integer,

  -- Status
  status        text not null default 'active'
    check (status in ('active', 'in_repair', 'booked')),

  -- Live tracking (cached from KTZ API)
  current_esr_code  text,   -- 5-digit ESR station code
  last_operation    text,
  last_tracked_at   timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.wagons enable row level security;

create policy "Wagon owners can manage their wagons"
  on public.wagons for all
  using (auth.uid() = owner_id);

create policy "Shippers can view verified active wagons"
  on public.wagons for select
  using (is_verified = true and status = 'active');

-- ============================================================
-- GU-12 ORDERS (The Plan — import from KTZ ASOUP)
-- ============================================================
create table public.gu12_orders (
  id                  uuid primary key default uuid_generate_v4(),
  shipper_id          uuid not null references public.profiles(id) on delete cascade,
  gu12_number         text not null,                 -- Official GU-12 document number
  cargo_etsng_code    text not null,                 -- ETSNG cargo classification code
  cargo_name          text,                          -- Human-readable cargo name
  departure_esr_code  text not null check (departure_esr_code ~ '^\d{5}$'), -- 5-digit ESR
  arrival_esr_code    text not null check (arrival_esr_code ~ '^\d{5}$'),
  departure_station_name text,
  arrival_station_name   text,
  quantity_planned    integer not null,              -- Number of wagons planned
  quantity_fulfilled  integer not null default 0,
  period_start        date not null,
  period_end          date not null,
  wagon_type_required text check (wagon_type_required in ('tank', 'hopper', 'flatcar', 'boxcar', 'gondola', 'refrigerator')),
  status              text not null default 'active'
    check (status in ('active', 'partially_fulfilled', 'fulfilled', 'cancelled')),
  created_at          timestamptz not null default now()
);

alter table public.gu12_orders enable row level security;

create policy "Shippers can manage own GU-12 orders"
  on public.gu12_orders for all
  using (auth.uid() = shipper_id);

create policy "Wagon owners can view active GU-12 orders"
  on public.gu12_orders for select
  using (status = 'active' or status = 'partially_fulfilled');

-- ============================================================
-- SHIPMENTS (The Deal — links a GU-12 order to a wagon)
-- ============================================================
create table public.shipments (
  id              uuid primary key default uuid_generate_v4(),
  gu12_id         uuid not null references public.gu12_orders(id) on delete restrict,
  wagon_id        uuid not null references public.wagons(id) on delete restrict,
  shipper_id      uuid not null references public.profiles(id),
  wagon_owner_id  uuid not null references public.profiles(id),
  contract_number text,
  status          text not null default 'pending'
    check (status in ('pending', 'loading', 'in_transit', 'unloaded', 'cancelled')),
  shipper_eds_signed_at   timestamptz,  -- Mock EDS signature timestamp
  owner_eds_signed_at     timestamptz,
  eds_signed_at           timestamptz,  -- Both parties signed
  departure_actual_at     timestamptz,
  arrival_actual_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.shipments enable row level security;

create policy "Shippers can view own shipments"
  on public.shipments for select
  using (auth.uid() = shipper_id);

create policy "Shippers can create shipments"
  on public.shipments for insert
  with check (auth.uid() = shipper_id);

create policy "Shippers can update own shipments"
  on public.shipments for update
  using (auth.uid() = shipper_id);

create policy "Wagon owners can view shipments for their wagons"
  on public.shipments for select
  using (auth.uid() = wagon_owner_id);

create policy "Wagon owners can update shipments for their wagons"
  on public.shipments for update
  using (auth.uid() = wagon_owner_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger wagons_updated_at before update on public.wagons
  for each row execute function public.handle_updated_at();

create trigger shipments_updated_at before update on public.shipments
  for each row execute function public.handle_updated_at();

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role, bin, ktz_payer_code, company_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'shipper'),
    new.raw_user_meta_data->>'bin',
    new.raw_user_meta_data->>'ktz_payer_code',
    new.raw_user_meta_data->>'company_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ESR STATION REFERENCE (lookup table for station codes)
-- ============================================================
create table public.esr_stations (
  code  text primary key check (code ~ '^\d{5}$'),
  name  text not null,
  country text not null default 'KZ'
);

insert into public.esr_stations (code, name) values
  ('67010', 'Алматы-1'),
  ('67012', 'Алматы-2'),
  ('67030', 'Алматы-Товарная'),
  ('65010', 'Нур-Султан (Астана)'),
  ('65020', 'Астана-Товарная'),
  ('63100', 'Шымкент'),
  ('62100', 'Актобе'),
  ('66100', 'Семей'),
  ('60100', 'Актау-Морской'),
  ('60110', 'Бейнеу'),
  ('61100', 'Атырау'),
  ('64100', 'Павлодар'),
  ('63200', 'Тараз'),
  ('62200', 'Кандыагаш'),
  ('65300', 'Экибастуз'),
  ('67500', 'Капчагай'),
  ('63500', 'Арысь'),
  ('65400', 'Кокшетау'),
  ('66200', 'Усть-Каменогорск'),
  ('61200', 'Уральск');

alter table public.esr_stations enable row level security;
create policy "Anyone can read stations" on public.esr_stations for select using (true);

-- ============================================================
-- ETSNG CARGO REFERENCE
-- ============================================================
create table public.etsng_cargos (
  code  text primary key,
  name  text not null,
  wagon_type_required text
);

insert into public.etsng_cargos (code, name, wagon_type_required) values
  ('411062', 'Нефть сырая', 'tank'),
  ('411001', 'Нефтепродукты светлые', 'tank'),
  ('411082', 'Мазут', 'tank'),
  ('223001', 'Уголь каменный', 'gondola'),
  ('161002', 'Зерно пшеница', 'hopper'),
  ('161021', 'Ячмень', 'hopper'),
  ('161043', 'Кукуруза', 'hopper'),
  ('421001', 'Удобрения минеральные', 'hopper'),
  ('011001', 'Черные металлы', 'flatcar'),
  ('311001', 'Лесные грузы', 'flatcar'),
  ('891001', 'Контейнеры 20 фут', 'flatcar'),
  ('891002', 'Контейнеры 40 фут', 'flatcar'),
  ('331001', 'Цемент', 'hopper'),
  ('711001', 'Мука', 'hopper'),
  ('124001', 'Руда железная', 'gondola');

alter table public.etsng_cargos enable row level security;
create policy "Anyone can read cargos" on public.etsng_cargos for select using (true);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_wagons_owner on public.wagons(owner_id);
create index idx_wagons_status on public.wagons(status, is_verified);
create index idx_gu12_shipper on public.gu12_orders(shipper_id);
create index idx_gu12_status on public.gu12_orders(status);
create index idx_shipments_shipper on public.shipments(shipper_id);
create index idx_shipments_owner on public.shipments(wagon_owner_id);
create index idx_shipments_status on public.shipments(status);
