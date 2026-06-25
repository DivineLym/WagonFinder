alter table public.contracts
  add column if not exists executor_phone text,
  add column if not exists executor_email text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text;
