-- Add vehicle_condition to differentiate VO (used), new (concesionario/importación) and km0
-- Values: 'usado' | 'nuevo' | 'km0'

ALTER TABLE moveadvisor_marketplace_vo_offers
  ADD COLUMN IF NOT EXISTS vehicle_condition TEXT NOT NULL DEFAULT 'usado'
    CHECK (vehicle_condition IN ('usado', 'nuevo', 'km0'));

-- Backfill: all existing rows are second-hand (VO)
UPDATE moveadvisor_marketplace_vo_offers
SET vehicle_condition = 'usado'
WHERE vehicle_condition IS NULL OR vehicle_condition = 'usado';

-- km0: mileage = 0 but has a matricula (registered but not driven)
UPDATE moveadvisor_marketplace_vo_offers
SET vehicle_condition = 'km0'
WHERE mileage = 0
  AND matricula IS NOT NULL
  AND matricula <> '';

-- Index for filtering by condition in marketplace queries
CREATE INDEX IF NOT EXISTS idx_vo_offers_vehicle_condition
  ON moveadvisor_marketplace_vo_offers (vehicle_condition);
