-- Add renting_prices_json JSONB column to store full km/year × months price matrix
ALTER TABLE moveadvisor_marketplace_vo_offers
  ADD COLUMN IF NOT EXISTS renting_prices_json JSONB;
