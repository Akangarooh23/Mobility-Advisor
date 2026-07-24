-- Telemetría por informe de tasación de venta.
-- Permite medir:
--   1. ratio market_median / depreciation_estimate (sesgo del estimador)
--   2. frecuencia de used_fallback (cuándo el cascade no llega a muestra)
--
-- INSERT con await + timeout corto (250 ms) — no fire-and-forget, para que
-- funcione en entornos serverless donde el proceso se suspende al devolver resp.
-- cascade_relaxed se guarda como JSONB: {power, transmission, fuel, year}.
-- usage_segment + segment_matched: separa sesgo real del estimador de la falta
-- de clasificación de marca (148/193 marcas usan mainstream por defecto).
-- model_version: constante de régimen — permite separar datos pre/post §1h,
-- §1g_combustible.2, etc. al agregar ratios.

CREATE TABLE IF NOT EXISTS sell_report_telemetry (
  id                    BIGSERIAL         PRIMARY KEY,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT now(),
  brand                 TEXT,
  model                 TEXT,
  slope_km              DOUBLE PRECISION,
  slope_year            DOUBLE PRECISION,
  usage_used_default    BOOLEAN,
  usage_impact          INTEGER,
  raw_usage_impact      INTEGER,
  med_km                INTEGER,
  med_yr                INTEGER,
  n                     INTEGER,
  used_fallback         BOOLEAN,
  cascade_relaxed       JSONB,
  damage_factor         DOUBLE PRECISION,
  effective_factor      DOUBLE PRECISION,
  market_median         INTEGER,
  depreciation_estimate INTEGER,
  usage_segment         TEXT,
  segment_matched       BOOLEAN,
  model_version         TEXT              NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_srt_brand_model      ON sell_report_telemetry (brand, model);
CREATE INDEX IF NOT EXISTS idx_srt_used_fallback    ON sell_report_telemetry (used_fallback);
CREATE INDEX IF NOT EXISTS idx_srt_created_at       ON sell_report_telemetry (created_at);
CREATE INDEX IF NOT EXISTS idx_srt_model_version    ON sell_report_telemetry (model_version);
