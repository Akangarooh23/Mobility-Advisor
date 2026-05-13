-- sqlfluff:dialect:postgres
-- dialect: postgresql
-- MoveAdvisor ERP catalog schema for Neon / Vercel Postgres
-- Run once to provision the ERP catalog tables in PostgreSQL.

CREATE TABLE IF NOT EXISTS moveadvisor_erp_brands (
  id BIGINT PRIMARY KEY,
  name VARCHAR(120) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_brands_name
  ON moveadvisor_erp_brands (name);

CREATE TABLE IF NOT EXISTS moveadvisor_erp_models (
  id BIGINT PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES moveadvisor_erp_brands(id),
  name VARCHAR(160) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_moveadvisor_erp_models_brand_name
  ON moveadvisor_erp_models (brand_id, name);

CREATE TABLE IF NOT EXISTS moveadvisor_erp_versions (
  codversion VARCHAR(128) PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES moveadvisor_erp_brands(id),
  model_id BIGINT NOT NULL REFERENCES moveadvisor_erp_models(id),
  label VARCHAR(200) NOT NULL,
  fuel VARCHAR(80) NOT NULL DEFAULT '',
  body_type VARCHAR(80) NOT NULL DEFAULT '',
  cv VARCHAR(40) NOT NULL DEFAULT '',
  doors VARCHAR(20) NOT NULL DEFAULT '',
  seats VARCHAR(20) NOT NULL DEFAULT '',
  co2 VARCHAR(40) NOT NULL DEFAULT '',
  transmision VARCHAR(80) NOT NULL DEFAULT '',
  consumption VARCHAR(80) NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_brand_model
  ON moveadvisor_erp_versions (brand_id, model_id);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_model
  ON moveadvisor_erp_versions (model_id);

CREATE INDEX IF NOT EXISTS ix_moveadvisor_erp_versions_label
  ON moveadvisor_erp_versions (label);

-- Optional helper view aligned with API output naming
CREATE OR REPLACE VIEW moveadvisor_erp_versions_enriched AS
SELECT
  codversion,
  NULLIF(TRIM(fuel), '') AS fuel,
  NULLIF(TRIM(body_type), '') AS body_type,
  NULLIF(TRIM(cv), '') AS cv,
  NULLIF(TRIM(doors), '') AS doors,
  NULLIF(TRIM(seats), '') AS seats,
  NULLIF(TRIM(co2), '') AS co2,
  NULLIF(TRIM(transmision), '') AS transmision,
  NULLIF(TRIM(consumption), '') AS consumption
FROM moveadvisor_erp_versions;
