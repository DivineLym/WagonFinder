-- Wagon availability is no longer gated by a manual verification flag.
drop policy if exists "Shippers can view verified active wagons" on public.wagons;
drop policy if exists "Shippers can view active wagons" on public.wagons;

create policy "Shippers can view active wagons"
  on public.wagons for select
  using (status = 'active');

drop index if exists public.idx_wagons_status;
create index if not exists idx_wagons_status on public.wagons(status);

alter table public.wagons
  drop column if exists is_verified;
