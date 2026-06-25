-- Link gu12_orders ESR code columns → esr_stations.code
-- Remove denormalized station name columns

alter table public.gu12_orders
  drop column if exists departure_station_name,
  drop column if exists arrival_station_name;

alter table public.gu12_orders
  add constraint fk_gu12_departure_esr
  foreign key (departure_esr_code)
  references public.esr_stations(code)
  on update cascade
  deferrable initially deferred;

alter table public.gu12_orders
  add constraint fk_gu12_arrival_esr
  foreign key (arrival_esr_code)
  references public.esr_stations(code)
  on update cascade
  deferrable initially deferred;
