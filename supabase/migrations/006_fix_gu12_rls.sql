-- Fix RLS for gu12_orders: add explicit INSERT policy with WITH CHECK
-- The FOR ALL policy with only USING sometimes fails for INSERT in PostgreSQL

DROP POLICY IF EXISTS "Shippers can manage own GU-12 orders" ON public.gu12_orders;

CREATE POLICY "Shippers can select own GU-12 orders"
  ON public.gu12_orders FOR SELECT
  USING (auth.uid() = shipper_id);

CREATE POLICY "Shippers can insert own GU-12 orders"
  ON public.gu12_orders FOR INSERT
  WITH CHECK (auth.uid() = shipper_id);

CREATE POLICY "Shippers can update own GU-12 orders"
  ON public.gu12_orders FOR UPDATE
  USING (auth.uid() = shipper_id)
  WITH CHECK (auth.uid() = shipper_id);

CREATE POLICY "Shippers can delete own GU-12 orders"
  ON public.gu12_orders FOR DELETE
  USING (auth.uid() = shipper_id);
