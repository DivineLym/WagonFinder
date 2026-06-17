-- ============================================================
-- Rename existing tables
-- ============================================================
alter table public.pending_applications  rename to wagon_owner_pending_requests;
alter table public.rejected_applications rename to wagon_owner_rejected_requests;

-- Rename indexes
alter index idx_pending_apps_order  rename to idx_wo_pending_order;
alter index idx_pending_apps_owner  rename to idx_wo_pending_owner;
alter index idx_pending_apps_wagon  rename to idx_wo_pending_wagon;
alter index idx_rejected_apps_order rename to idx_wo_rejected_order;
alter index idx_rejected_apps_owner rename to idx_wo_rejected_owner;

-- ============================================================
-- Shipper-initiated requests (грузоотправитель → вагоновладелец)
-- ============================================================
create table public.shipper_pending_requests (
  id              uuid primary key default uuid_generate_v4(),
  gu12_order_id   uuid not null references public.gu12_orders(id) on delete cascade,
  shipper_id      uuid not null references public.profiles(id) on delete cascade,
  wagon_id        uuid not null references public.wagons(id) on delete cascade,
  wagon_owner_id  uuid not null references public.profiles(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'accepted')),
  message         text,
  created_at      timestamptz not null default now(),
  unique(gu12_order_id, wagon_id)
);

create table public.shipper_rejected_requests (
  id              uuid primary key default uuid_generate_v4(),
  gu12_order_id   uuid not null references public.gu12_orders(id) on delete cascade,
  shipper_id      uuid not null references public.profiles(id) on delete cascade,
  wagon_id        uuid not null references public.wagons(id) on delete cascade,
  wagon_owner_id  uuid not null references public.profiles(id) on delete cascade,
  rejection_reason text,
  message         text,
  created_at      timestamptz not null
);

-- RLS
alter table public.shipper_pending_requests  enable row level security;
alter table public.shipper_rejected_requests enable row level security;

-- shipper_pending_requests policies
create policy "Shippers can view own pending requests"
  on public.shipper_pending_requests for select
  using (auth.uid() = shipper_id);

create policy "Shippers can insert pending requests"
  on public.shipper_pending_requests for insert
  with check (auth.uid() = shipper_id);

create policy "Shippers can delete own pending requests"
  on public.shipper_pending_requests for delete
  using (auth.uid() = shipper_id);

create policy "Wagon owners can view requests for their wagons"
  on public.shipper_pending_requests for select
  using (auth.uid() = wagon_owner_id);

create policy "Wagon owners can update status of requests for their wagons"
  on public.shipper_pending_requests for update
  using (auth.uid() = wagon_owner_id);

create policy "Wagon owners can delete requests for their wagons"
  on public.shipper_pending_requests for delete
  using (auth.uid() = wagon_owner_id);

-- shipper_rejected_requests policies
create policy "Shippers can view own rejected requests"
  on public.shipper_rejected_requests for select
  using (auth.uid() = shipper_id);

create policy "Wagon owners can insert rejected requests"
  on public.shipper_rejected_requests for insert
  with check (auth.uid() = wagon_owner_id);

create policy "Wagon owners can view rejected requests for their wagons"
  on public.shipper_rejected_requests for select
  using (auth.uid() = wagon_owner_id);

-- Indexes
create index idx_shipper_pending_order  on public.shipper_pending_requests(gu12_order_id);
create index idx_shipper_pending_shipper on public.shipper_pending_requests(shipper_id);
create index idx_shipper_pending_owner  on public.shipper_pending_requests(wagon_owner_id);
create index idx_shipper_rejected_order on public.shipper_rejected_requests(gu12_order_id);
create index idx_shipper_rejected_owner on public.shipper_rejected_requests(wagon_owner_id);
