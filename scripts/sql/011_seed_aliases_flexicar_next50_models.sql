-- Auto-generated next model alias seed after batch 010
-- Generated on: 2026-05-15T14:25:26.419Z
-- Review before executing in production.

-- Summary
-- Model candidates (next top): 4

INSERT INTO moveadvisor_model_aliases (brand_canonical_name, canonical_name, alias_name, source, is_active)
VALUES
  ('Volkswagen', 'Grand California', 'Grand California', 'auto-flexicar-candidate-011', TRUE), -- offers=1; portals=flexicar
  ('Volkswagen', 'Jetta', 'Jetta', 'auto-flexicar-candidate-011', TRUE), -- offers=1; portals=autohero
  ('Volkswagen', 'T7 Multivan', 'T7 Multivan', 'auto-flexicar-candidate-011', TRUE), -- offers=1; portals=autohero
  ('Volkswagen', 'Taigo 95', 'Taigo 95', 'auto-flexicar-candidate-011', TRUE) -- offers=1; portals=coches.com
ON CONFLICT (alias_key, brand_key)
DO UPDATE SET
  canonical_name = EXCLUDED.canonical_name,
  is_active = TRUE,
  updated_at = NOW();

-- Quick validation for this batch
SELECT 'model_aliases' AS table_name, source, COUNT(*) AS rows_count
FROM moveadvisor_model_aliases
WHERE source = 'auto-flexicar-candidate-011'
GROUP BY source;