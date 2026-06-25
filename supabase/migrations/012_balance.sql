-- ============================================================
-- Balance & Commission System
-- ============================================================

-- Add balance to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance_kzt numeric(14,2) NOT NULL DEFAULT 0
    CHECK (balance_kzt >= 0);

-- Balance transaction ledger
CREATE TABLE IF NOT EXISTS public.balance_transactions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_kzt  numeric(14,2) NOT NULL,          -- positive = credit, negative = debit
  type        text NOT NULL CHECK (type IN ('top_up', 'commission', 'refund')),
  description text,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.balance_transactions FOR SELECT
  USING (auth.uid() = profile_id);

-- Only backend (service role) inserts transactions; users cannot self-insert
CREATE POLICY "Service role can insert transactions"
  ON public.balance_transactions FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Function: top up balance atomically
CREATE OR REPLACE FUNCTION public.topup_balance(p_profile_id uuid, p_amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.profiles SET balance_kzt = balance_kzt + p_amount WHERE id = p_profile_id;
  INSERT INTO public.balance_transactions(profile_id, amount_kzt, type, description)
    VALUES (p_profile_id, p_amount, 'top_up', 'Пополнение баланса');
END;
$$;

-- Function: deduct commission atomically (returns false if insufficient funds)
CREATE OR REPLACE FUNCTION public.deduct_commission(
  p_profile_id uuid,
  p_amount     numeric,
  p_contract_id uuid,
  p_description text DEFAULT 'Комиссия платформы'
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_balance numeric;
BEGIN
  SELECT balance_kzt INTO v_balance FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_balance < p_amount THEN RETURN false; END IF;
  UPDATE public.profiles SET balance_kzt = balance_kzt - p_amount WHERE id = p_profile_id;
  INSERT INTO public.balance_transactions(profile_id, amount_kzt, type, description, contract_id)
    VALUES (p_profile_id, -p_amount, 'commission', p_description, p_contract_id);
  RETURN true;
END;
$$;
