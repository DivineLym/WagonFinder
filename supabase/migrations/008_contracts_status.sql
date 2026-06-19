-- 1. Add status to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_signature'
  CHECK (status IN ('pending_signature', 'signed'));

-- 2. Remove status from pending request tables (only pending rows live there now)
ALTER TABLE public.wagon_owner_pending_requests DROP COLUMN IF EXISTS status;
ALTER TABLE public.shipper_pending_requests     DROP COLUMN IF EXISTS status;

-- 3. Fix RLS on contracts (idempotent)
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view own contracts"            ON public.contracts;
DROP POLICY IF EXISTS "Users can update own contracts"         ON public.contracts;

CREATE POLICY "Authenticated users can insert contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can view own contracts"
  ON public.contracts FOR SELECT
  USING (
    executor_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
    OR
    customer_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own contracts"
  ON public.contracts FOR UPDATE
  USING (
    executor_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
    OR
    customer_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
  );
