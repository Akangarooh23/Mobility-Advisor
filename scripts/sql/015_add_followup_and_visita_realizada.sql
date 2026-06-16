ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- Allow 'Visita realizada' as a valid status value (no constraint change needed if using VARCHAR)
-- This comment documents the new status added to the application flow.
