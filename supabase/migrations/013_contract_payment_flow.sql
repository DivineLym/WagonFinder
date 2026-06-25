-- ============================================================
-- Move payment flow from pending_requests → contracts
-- ============================================================

-- 1. Add pending_payment status to contracts
ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('pending_payment', 'pending_signature', 'signed'));

-- Change default so new contracts start at pending_payment
ALTER TABLE public.contracts ALTER COLUMN status SET DEFAULT 'pending_payment';

-- 2. Add per-party payment tracking to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS executor_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_paid_at timestamptz;

-- 3. Remove payment columns from request tables (no longer used)
ALTER TABLE public.wagon_owner_pending_requests
  DROP COLUMN IF EXISTS shipper_paid_at,
  DROP COLUMN IF EXISTS wagon_owner_paid_at;

ALTER TABLE public.shipper_pending_requests
  DROP COLUMN IF EXISTS shipper_paid_at,
  DROP COLUMN IF EXISTS wagon_owner_paid_at;
