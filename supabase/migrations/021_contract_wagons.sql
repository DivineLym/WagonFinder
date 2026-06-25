-- ============================================================
-- Refactor contracts: one contract per owner per GU-12 order
-- ============================================================

-- 1. Add grouping columns to contracts
alter table public.contracts
  add column if not exists gu12_order_id uuid references public.gu12_orders(id),
  add column if not exists executor_id    uuid references public.profiles(id),
  add column if not exists customer_id    uuid references public.profiles(id);

-- 2. Make single-wagon columns optional (data moves to contract_wagons)
alter table public.contracts
  alter column wagon_number drop not null,
  alter column wagon_type   drop not null;

-- 3. Unique: one contract per (order, executor, customer)
alter table public.contracts
  drop constraint if exists contracts_gu12_executor_customer_unique;
alter table public.contracts
  add constraint contracts_gu12_executor_customer_unique
  unique (gu12_order_id, executor_bin, customer_bin);

-- 4. New table: one row per wagon in a contract
create table if not exists public.contract_wagons (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid not null references public.contracts(id) on delete cascade,
  wagon_id       uuid references public.wagons(id),
  wagon_number   text not null,
  wagon_type     text not null,
  application_id uuid,
  created_at     timestamptz default now()
);

-- 5. RLS for contract_wagons
alter table public.contract_wagons enable row level security;

create policy "Contract parties can view contract wagons"
  on public.contract_wagons for select
  using (
    exists (
      select 1 from public.contracts c
      where c.id = contract_id
        and (
          c.executor_bin in (select bin from public.profiles where id = auth.uid())
          or c.customer_bin in (select bin from public.profiles where id = auth.uid())
        )
    )
  );

create policy "Authenticated users can insert contract wagons"
  on public.contract_wagons for insert
  with check (auth.role() = 'authenticated');
