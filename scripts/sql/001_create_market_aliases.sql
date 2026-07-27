BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION normalize_alias_token(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT regexp_replace(
           lower(unaccent(trim(COALESCE(input_text, '')))),
           '[^a-z0-9]+',
           '',
           'g'
         );
$$;

CREATE TABLE IF NOT EXISTS moveadvisor_brand_aliases (
  id BIGSERIAL PRIMARY KEY,
  alias_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  alias_key TEXT GENERATED ALWAYS AS (normalize_alias_token(alias_name)) STORED,
  canonical_key TEXT GENERATED ALWAYS AS (normalize_alias_token(canonical_name)) STORED,
  source TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_moveadvisor_brand_aliases_alias_key UNIQUE (alias_key)
);

CREATE TABLE IF NOT EXISTS moveadvisor_model_aliases (
  id BIGSERIAL PRIMARY KEY,
  brand_canonical_name TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  brand_key TEXT GENERATED ALWAYS AS (normalize_alias_token(brand_canonical_name)) STORED,
  canonical_key TEXT GENERATED ALWAYS AS (normalize_alias_token(canonical_name)) STORED,
  alias_key TEXT GENERATED ALWAYS AS (normalize_alias_token(alias_name)) STORED,
  source TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_moveadvisor_model_aliases_brand_alias UNIQUE (brand_key, alias_key)
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_brand_aliases_canonical_key
ON moveadvisor_brand_aliases (canonical_key);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_model_aliases_brand_canonical_key
ON moveadvisor_model_aliases (brand_key, canonical_key);

INSERT INTO moveadvisor_brand_aliases (alias_name, canonical_name, source, is_active)
SELECT DISTINCT b.name, b.name, 'catalog-self', TRUE
FROM moveadvisor_vehicle_brands b
WHERE b.is_active = TRUE
  AND trim(COALESCE(b.name, '')) <> ''
ON CONFLICT (alias_key) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    source = EXCLUDED.source,
    is_active = TRUE,
    updated_at = now();

WITH catalog_brands AS (
  SELECT DISTINCT trim(b.name) AS canonical_name
  FROM moveadvisor_vehicle_brands b
  WHERE b.is_active = TRUE
    AND trim(COALESCE(b.name, '')) <> ''
),
offer_brands AS (
  SELECT DISTINCT trim(o.brand) AS alias_name
  FROM moveadvisor_market_offers o
  WHERE trim(COALESCE(o.brand, '')) <> ''
),
pairs AS (
  SELECT ob.alias_name, cb.canonical_name
  FROM offer_brands ob
  JOIN catalog_brands cb
    ON normalize_alias_token(ob.alias_name) = normalize_alias_token(cb.canonical_name)
  WHERE lower(trim(ob.alias_name)) <> lower(trim(cb.canonical_name))
)
INSERT INTO moveadvisor_brand_aliases (alias_name, canonical_name, source, is_active)
SELECT p.alias_name, p.canonical_name, 'auto-offers-vs-catalog', TRUE
FROM pairs p
ON CONFLICT (alias_key) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    source = EXCLUDED.source,
    is_active = TRUE,
    updated_at = now();

WITH resolved_ds AS (
  SELECT COALESCE(
           (SELECT name FROM moveadvisor_vehicle_brands WHERE is_active = TRUE AND normalize_alias_token(name) = normalize_alias_token('DS') LIMIT 1),
           (SELECT name FROM moveadvisor_vehicle_brands WHERE is_active = TRUE AND normalize_alias_token(name) = normalize_alias_token('DS Automobiles') LIMIT 1),
           'DS'
         ) AS canonical_name
),
resolved_citroen AS (
  SELECT COALESCE(
           (SELECT name FROM moveadvisor_vehicle_brands WHERE is_active = TRUE AND normalize_alias_token(name) = normalize_alias_token('Citroen') LIMIT 1),
           (SELECT name FROM moveadvisor_vehicle_brands WHERE is_active = TRUE AND normalize_alias_token(name) = normalize_alias_token('Citroën') LIMIT 1),
           'Citroen'
         ) AS canonical_name
)
INSERT INTO moveadvisor_brand_aliases (alias_name, canonical_name, source, is_active)
SELECT v.alias_name, v.canonical_name, 'manual-critical', TRUE
FROM (
  SELECT 'DS'::TEXT AS alias_name, (SELECT canonical_name FROM resolved_ds) AS canonical_name
  UNION ALL
  SELECT 'DS Automobiles', (SELECT canonical_name FROM resolved_ds)
  UNION ALL
  SELECT 'Citroen', (SELECT canonical_name FROM resolved_citroen)
  UNION ALL
  SELECT 'Citroën', (SELECT canonical_name FROM resolved_citroen)
  UNION ALL
  SELECT 'Mercedes-Benz', 'Mercedes-Benz'
  UNION ALL
  SELECT 'Mercedes Benz', 'Mercedes-Benz'
  UNION ALL
  SELECT 'Land Rover', 'Land Rover'
  UNION ALL
  SELECT 'Land-Rover', 'Land Rover'
) v
ON CONFLICT (alias_key) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    source = EXCLUDED.source,
    is_active = TRUE,
    updated_at = now();

INSERT INTO moveadvisor_model_aliases (brand_canonical_name, canonical_name, alias_name, source, is_active)
SELECT DISTINCT b.name, m.name, m.name, 'catalog-self', TRUE
FROM moveadvisor_vehicle_models m
JOIN moveadvisor_vehicle_brands b ON b.id = m.brand_id
WHERE b.is_active = TRUE
  AND m.is_active = TRUE
  AND trim(COALESCE(b.name, '')) <> ''
  AND trim(COALESCE(m.name, '')) <> ''
ON CONFLICT (brand_key, alias_key) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    source = EXCLUDED.source,
    is_active = TRUE,
    updated_at = now();

WITH offers_raw AS (
  SELECT DISTINCT trim(o.brand) AS offer_brand, trim(o.model) AS offer_model
  FROM moveadvisor_market_offers o
  WHERE trim(COALESCE(o.brand, '')) <> ''
    AND trim(COALESCE(o.model, '')) <> ''
),
offers_resolved_brand AS (
  SELECT
    o.offer_brand,
    o.offer_model,
    COALESCE(ba.canonical_name, o.offer_brand) AS canonical_brand
  FROM offers_raw o
  LEFT JOIN moveadvisor_brand_aliases ba
    ON ba.alias_key = normalize_alias_token(o.offer_brand)
   AND ba.is_active = TRUE
),
catalog_models AS (
  SELECT DISTINCT trim(b.name) AS canonical_brand, trim(m.name) AS canonical_model
  FROM moveadvisor_vehicle_models m
  JOIN moveadvisor_vehicle_brands b ON b.id = m.brand_id
  WHERE b.is_active = TRUE
    AND m.is_active = TRUE
    AND trim(COALESCE(b.name, '')) <> ''
    AND trim(COALESCE(m.name, '')) <> ''
),
pairs AS (
  SELECT
    orb.canonical_brand AS brand_canonical_name,
    orb.offer_model AS alias_name,
    cm.canonical_model AS canonical_name
  FROM offers_resolved_brand orb
  JOIN catalog_models cm
    ON normalize_alias_token(cm.canonical_brand) = normalize_alias_token(orb.canonical_brand)
   AND normalize_alias_token(cm.canonical_model) = normalize_alias_token(orb.offer_model)
  WHERE lower(trim(orb.offer_model)) <> lower(trim(cm.canonical_model))
)
INSERT INTO moveadvisor_model_aliases (brand_canonical_name, canonical_name, alias_name, source, is_active)
SELECT p.brand_canonical_name, p.canonical_name, p.alias_name, 'auto-offers-vs-catalog', TRUE
FROM pairs p
ON CONFLICT (brand_key, alias_key) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    source = EXCLUDED.source,
    is_active = TRUE,
    updated_at = now();

INSERT INTO moveadvisor_model_aliases (brand_canonical_name, canonical_name, alias_name, source, is_active)
SELECT v.brand_canonical_name, v.canonical_name, v.alias_name, 'manual-critical', TRUE
FROM (
  VALUES
    ('Citroen', 'C3', 'C 3'),
    ('Citroen', 'C-Elysée', 'C-Elysee'),
    ('Toyota', 'RAV4', 'RAV 4'),
    ('Kia', 'cee''d', 'ceed'),
    ('Kia', 'pro_cee''d', 'pro ceed'),
    ('Kia', 'pro_cee''d', 'pro_ceed'),
    ('Volkswagen', 'T-Cross', 'TCross'),
    ('Volkswagen', 'T-Roc', 'TRoc')
) AS v(brand_canonical_name, canonical_name, alias_name)
ON CONFLICT (brand_key, alias_key) DO UPDATE
SET canonical_name = EXCLUDED.canonical_name,
    source = EXCLUDED.source,
    is_active = TRUE,
    updated_at = now();

COMMIT;
