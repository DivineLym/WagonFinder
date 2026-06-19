-- Fix contracts RLS policies
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can view own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON public.contracts;

-- Insert: any authenticated user
CREATE POLICY "Authenticated users can insert contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Select: executor or customer matched by BIN
CREATE POLICY "Users can view own contracts"
  ON public.contracts FOR SELECT
  USING (
    executor_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
    OR
    customer_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
  );

-- Update: for signing
CREATE POLICY "Users can update own contracts"
  ON public.contracts FOR UPDATE
  USING (
    executor_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
    OR
    customer_bin IN (SELECT bin FROM public.profiles WHERE id = auth.uid())
  );
