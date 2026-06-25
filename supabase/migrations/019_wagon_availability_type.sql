-- Add availability_type to wagons: spot (one trip), lease (full lease), both
create type wagon_availability_type as enum ('spot', 'lease', 'both');

alter table wagons
  add column availability_type wagon_availability_type not null default 'both';
