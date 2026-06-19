-- Add payment tracking to wagon_owner_pending_requests
ALTER TABLE public.wagon_owner_pending_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_acceptance',
  ADD COLUMN IF NOT EXISTS wagon_owner_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipper_paid_at timestamptz;

-- Add payment tracking to shipper_pending_requests
ALTER TABLE public.shipper_pending_requests
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_acceptance',
  ADD COLUMN IF NOT EXISTS shipper_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS wagon_owner_paid_at timestamptz;
