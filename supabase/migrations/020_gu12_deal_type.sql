create type deal_type as enum ('spot', 'lease');

alter table gu12_orders
  add column deal_type deal_type not null default 'spot';
