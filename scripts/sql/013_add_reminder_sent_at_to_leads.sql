ALTER TABLE moveadvisor_market_leads
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
