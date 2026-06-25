-- Link gu12_orders.cargo_etsng_code → etsng_cargos.code
-- Remove denormalized cargo_name and wagon_type_required columns

alter table public.gu12_orders
  drop column if exists cargo_name,
  drop column if exists wagon_type_required;

alter table public.gu12_orders
  add constraint fk_gu12_etsng_code
  foreign key (cargo_etsng_code)
  references public.etsng_cargos(code)
  on update cascade
  deferrable initially deferred;
