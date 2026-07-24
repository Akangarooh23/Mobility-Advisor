-- TARGET: PostgreSQL (Neon) — NO ejecutar contra MSSQL.
-- El linter del IDE puede marcar '::' y PERCENTILE_CONT...WITHIN GROUP como
-- errores; son falsos positivos del parser de T-SQL. La sintaxis es válida en PG 14+.
--
-- ── VERSIÓN ACTIVA ─────────────────────────────────────────────────────────────
-- Punto único. Exactamente UNA ocurrencia del literal de versión en este fichero.
-- Cambiar solo esta línea al subir de versión.
SET "sell_report.v_desde" = 'ola2b';
--
-- Las queries usan model_version >= v_desde (rango, no igualdad) para acumular
-- muestra entre versiones comparables. La comparabilidad es por segmento, no global:
--
--   ratio estimador  → comparable entre versiones que no cambien el refPrice del
--                      segmento analizado. Un lote de aliases que solo toque
--                      luxury no invalida las filas de mainstream del mismo rango.
--   used_fallback    → comparable entre todas las versiones >= v_desde
--   cascade_relaxed  → comparable entre todas las versiones >= v_desde
--
-- ⚠ Riesgo lexicográfico: 'ola10' < 'ola2' en orden de texto (1 < 2).
--   Si el número de sub-versiones supera 9, migrar scheme a entero monótono o
--   fecha ISO (p. ej. '20260801') para que el orden refleje la secuencia real.
--
-- Orden de ejecución recomendado: 1c → 1a → 1b → 2 → 2b
-- ───────────────────────────────────────────────────────────────────────────────


-- ── 1a. Distribución del ratio market_median / depreciation_estimate ──────────
-- Filtros:
--   segment_matched = true  → excluye las 148+ marcas sin clasificar (usan mainstream por defecto)
--   NOT used_fallback        → solo informes con mercado real
--   n >= 15                  → calidad mínima de pool (medianas de 4 comparables = ruido)
--   HAVING COUNT(*) >= 50   → umbral de convergencia por segmento
--
-- ratio_p50 > 1 → el estimador es conservador (mercado supera a la estimación).
-- ratio_p50 < 1 → el estimador infla (precio de mercado por debajo).

SELECT
  usage_segment,
  COUNT(*)                                                                        AS n,
  ROUND(
    AVG(market_median::float / NULLIF(depreciation_estimate, 0))::numeric, 3
  )                                                                               AS ratio_mean,
  ROUND(
    PERCENTILE_CONT(0.25) WITHIN GROUP (
      ORDER BY market_median::float / NULLIF(depreciation_estimate, 0)
    )::numeric, 3
  )                                                                               AS ratio_p25,
  ROUND(
    PERCENTILE_CONT(0.50) WITHIN GROUP (
      ORDER BY market_median::float / NULLIF(depreciation_estimate, 0)
    )::numeric, 3
  )                                                                               AS ratio_p50,
  ROUND(
    PERCENTILE_CONT(0.75) WITHIN GROUP (
      ORDER BY market_median::float / NULLIF(depreciation_estimate, 0)
    )::numeric, 3
  )                                                                               AS ratio_p75
FROM sell_report_telemetry
WHERE NOT used_fallback
  AND market_median         > 0
  AND depreciation_estimate > 0
  AND segment_matched       = true
  AND n                     >= 15
  AND model_version         >= current_setting('sell_report.v_desde')
GROUP BY usage_segment
HAVING COUNT(*) >= 50
ORDER BY ratio_p50 DESC;


-- ── 1b. Ratio por marca (diagnóstico fino, una vez 1a converge) ───────────────

SELECT
  brand,
  usage_segment,
  COUNT(*)                                                                        AS n,
  ROUND(
    PERCENTILE_CONT(0.50) WITHIN GROUP (
      ORDER BY market_median::float / NULLIF(depreciation_estimate, 0)
    )::numeric, 3
  )                                                                               AS ratio_p50
FROM sell_report_telemetry
WHERE NOT used_fallback
  AND market_median         > 0
  AND depreciation_estimate > 0
  AND segment_matched       = true
  AND n                     >= 15
  AND model_version         >= current_setting('sell_report.v_desde')
GROUP BY brand, usage_segment
HAVING COUNT(*) >= 20
ORDER BY ratio_p50 DESC;


-- ── 1c. Volumen acumulado por segmento (¿estamos listos para analizar?) ────────
-- Ejecutar antes de 1a para saber en qué segmentos hay suficientes datos.

SELECT
  usage_segment,
  COUNT(*)                                                                        AS n_total,
  SUM(CASE WHEN NOT used_fallback AND n >= 15 AND segment_matched THEN 1 ELSE 0 END) AS n_apto_ratio,
  MAX(created_at)                                                                 AS ultimo_informe
FROM sell_report_telemetry
WHERE model_version >= current_setting('sell_report.v_desde')
GROUP BY usage_segment
ORDER BY n_apto_ratio DESC;


-- ── 2. Frecuencia de used_fallback por marca ──────────────────────────────────
-- fallback_pct alto → cascade no llega a muestra → §1e menos relevante para esa marca.

SELECT
  brand,
  usage_segment,
  segment_matched,
  COUNT(*)                                                                        AS total,
  SUM(CASE WHEN used_fallback THEN 1 ELSE 0 END)                                 AS fallback_n,
  ROUND(
    100.0 * SUM(CASE WHEN used_fallback THEN 1 ELSE 0 END) / COUNT(*), 1
  )                                                                               AS fallback_pct
FROM sell_report_telemetry
WHERE model_version >= current_setting('sell_report.v_desde')
GROUP BY brand, usage_segment, segment_matched
ORDER BY fallback_pct DESC, total DESC;


-- ── 2b. Resumen global por régimen ────────────────────────────────────────────
-- Sin filtro de versión — muestra acumulación por régimen para decidir
-- qué rangos son comparables entre sí.

SELECT
  model_version,
  COUNT(*)                                                                        AS total_reports,
  SUM(CASE WHEN used_fallback THEN 1 ELSE 0 END)                                 AS fallback_n,
  ROUND(
    100.0 * SUM(CASE WHEN used_fallback THEN 1 ELSE 0 END) / COUNT(*), 1
  )                                                                               AS fallback_pct_overall
FROM sell_report_telemetry
GROUP BY model_version
ORDER BY model_version;
