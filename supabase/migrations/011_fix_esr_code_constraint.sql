-- Fix ESR code constraints: KTZ station codes are 6 digits, not 5
ALTER TABLE public.gu12_orders
  DROP CONSTRAINT IF EXISTS gu12_orders_departure_esr_code_check,
  DROP CONSTRAINT IF EXISTS gu12_orders_arrival_esr_code_check,
  ADD CONSTRAINT gu12_orders_departure_esr_code_check CHECK (departure_esr_code ~ '^\d{5,6}$'),
  ADD CONSTRAINT gu12_orders_arrival_esr_code_check    CHECK (arrival_esr_code    ~ '^\d{5,6}$');

-- Fix the same on wagons table if present
ALTER TABLE public.wagons
  DROP CONSTRAINT IF EXISTS wagons_current_esr_code_check;
