-- ============================================================
-- Auto-book wagons when added to a contract,
-- auto-release when contract_wagon is deleted (incl. cascade).
-- ============================================================

-- 1. Book wagon on contract_wagon INSERT
create or replace function public.fn_book_wagon()
returns trigger language plpgsql security definer as $$
begin
  update public.wagons
  set status = 'booked'
  where id = NEW.wagon_id
    and status = 'active';
  return NEW;
end;
$$;

create trigger trg_book_wagon
  after insert on public.contract_wagons
  for each row execute function public.fn_book_wagon();

-- 2. Release wagon on contract_wagon DELETE
--    Only release if no other active contract_wagons reference this wagon.
create or replace function public.fn_release_wagon()
returns trigger language plpgsql security definer as $$
begin
  if OLD.wagon_id is null then
    return OLD;
  end if;

  -- Check if the wagon is still referenced by any other contract_wagon
  if not exists (
    select 1 from public.contract_wagons
    where wagon_id = OLD.wagon_id
      and id != OLD.id
  ) then
    update public.wagons
    set status = 'active'
    where id = OLD.wagon_id
      and status = 'booked';
  end if;

  return OLD;
end;
$$;

create trigger trg_release_wagon
  after delete on public.contract_wagons
  for each row execute function public.fn_release_wagon();

-- 3. Also allow wagon owners and shippers to delete contracts
--    (needed so deletion cascades to contract_wagons and fires the trigger)
drop policy if exists "Users can delete own contracts" on public.contracts;
create policy "Users can delete own contracts"
  on public.contracts for delete
  using (
    executor_bin in (select bin from public.profiles where id = auth.uid())
    or customer_bin in (select bin from public.profiles where id = auth.uid())
  );
