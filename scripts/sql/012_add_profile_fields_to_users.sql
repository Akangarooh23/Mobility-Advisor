-- Add billing profile fields to moveadvisor_users
ALTER TABLE moveadvisor_users
  ADD COLUMN IF NOT EXISTS company_name   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_id         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS billing_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS iban           TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ;
