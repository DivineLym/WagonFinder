alter table public.wagon_owner_pending_requests
  add column if not exists offered_price numeric(14,2);

alter table public.shipper_pending_requests
  add column if not exists offered_price numeric(14,2);
