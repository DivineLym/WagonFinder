-- Add deal_type to contracts for commission calculation without extra joins.
alter table public.contracts
  add column if not exists deal_type text check (deal_type in ('spot', 'lease')) default 'spot';
