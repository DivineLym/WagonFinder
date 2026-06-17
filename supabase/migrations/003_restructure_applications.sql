-- ============================================================
-- Replace applications with pending_applications + rejected_applications
-- ============================================================

drop table if exists public.applications cascade;

create table public.pending_applications (
  id              uuid primary key default uuid_generate_v4(),
  gu12_order_id   uuid not null references public.gu12_orders(id) on delete cascade,
  wagon_owner_id  uuid not null references public.profiles(id) on delete cascade,
  wagon_id        uuid not null references public.wagons(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'accepted')),
  message         text,
  created_at      timestamptz not null default now(),
  unique(gu12_order_id, wagon_id)
);

create table public.rejected_applications (
  id              uuid primary key default uuid_generate_v4(),
  gu12_order_id   uuid not null references public.gu12_orders(id) on delete cascade,
  wagon_owner_id  uuid not null references public.profiles(id) on delete cascade,
  wagon_id        uuid not null references public.wagons(id) on delete cascade,
  rejection_reason text,
  message         text,
  created_at      timestamptz not null -- original submission time
);

-- RLS
alter table public.pending_applications enable row level security;
alter table public.rejected_applications enable row level security;

-- pending_applications policies
create policy "Wagon owners can view own pending apps"
  on public.pending_applications for select
  using (auth.uid() = wagon_owner_id);

create policy "Wagon owners can insert pending apps"
  on public.pending_applications for insert
  with check (auth.uid() = wagon_owner_id);

create policy "Wagon owners can delete own pending apps"
  on public.pending_applications for delete
  using (auth.uid() = wagon_owner_id);

create policy "Shippers can view pending apps for their orders"
  on public.pending_applications for select
  using (
    exists (
      select 1 from public.gu12_orders o
      where o.id = gu12_order_id and o.shipper_id = auth.uid()
    )
  );

create policy "Shippers can update status of pending apps for their orders"
  on public.pending_applications for update
  using (
    exists (
      select 1 from public.gu12_orders o
      where o.id = gu12_order_id and o.shipper_id = auth.uid()
    )
  );

create policy "Shippers can delete pending apps for their orders"
  on public.pending_applications for delete
  using (
    exists (
      select 1 from public.gu12_orders o
      where o.id = gu12_order_id and o.shipper_id = auth.uid()
    )
  );

-- rejected_applications policies
create policy "Wagon owners can view own rejected apps"
  on public.rejected_applications for select
  using (auth.uid() = wagon_owner_id);

create policy "Shippers can insert rejected apps"
  on public.rejected_applications for insert
  with check (
    exists (
      select 1 from public.gu12_orders o
      where o.id = gu12_order_id and o.shipper_id = auth.uid()
    )
  );

create policy "Shippers can view rejected apps for their orders"
  on public.rejected_applications for select
  using (
    exists (
      select 1 from public.gu12_orders o
      where o.id = gu12_order_id and o.shipper_id = auth.uid()
    )
  );

-- Indexes
create index idx_pending_apps_order   on public.pending_applications(gu12_order_id);
create index idx_pending_apps_owner   on public.pending_applications(wagon_owner_id);
create index idx_pending_apps_wagon   on public.pending_applications(wagon_id);
create index idx_rejected_apps_order  on public.rejected_applications(gu12_order_id);
create index idx_rejected_apps_owner  on public.rejected_applications(wagon_owner_id);
