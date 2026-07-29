-- ─────────────────────────────────────────────────────────────────────────────
-- 010 — Diagnóstico de campo de ubicación en moveadvisor_market_offers
--
-- Responde tres preguntas antes de decidir si el bloque de mercado local
-- tiene sentido como feature del informe de tasación:
--
--   Q1a  Cobertura: ¿qué % de filas tiene province/city no vacío?
--   Q1b  Formato: ¿province agrega (52 provincias limpias) o es texto libre?
--   Q2   Distribución por portal: ¿qué portales aportan ubicación?
--   Q3   Desviación precio local-nacional: ¿importa económicamente el dato?
--
-- Ejecutar en Neon — sin editar; copiar resultados de las 4 queries juntos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Q1a: COBERTURA de campos de ubicación ────────────────────────────────────
-- Muestra si province/city/location tienen dato útil o son cadena vacía.
SELECT
  COUNT(*)                                                    AS total_activos,
  COUNT(NULLIF(province, ''))                                 AS province_con_dato,
  ROUND(100.0 * COUNT(NULLIF(province, '')) / COUNT(*), 1)   AS province_pct,
  COUNT(NULLIF(city, ''))                                     AS city_con_dato,
  ROUND(100.0 * COUNT(NULLIF(city, '')) / COUNT(*), 1)       AS city_pct,
  COUNT(NULLIF(location, ''))                                 AS location_con_dato,
  ROUND(100.0 * COUNT(NULLIF(location, '')) / COUNT(*), 1)   AS location_pct
FROM moveadvisor_market_offers
WHERE is_active = TRUE;


-- ── Q1b: FORMATO de province — ¿agrega o texto libre? ───────────────────────
-- Si son 52 provincias limpias → agrega.
-- Si son 400 variantes de texto → no sirve sin normalización.
-- Límite 50 para ver el rabo (si la cola es larga, hay texto libre).
SELECT
  province,
  COUNT(*) AS n,
  COUNT(DISTINCT portal) AS portales
FROM moveadvisor_market_offers
WHERE is_active = TRUE
  AND province <> ''
GROUP BY province
ORDER BY n DESC
LIMIT 50;


-- ── Q2: COBERTURA POR PORTAL ─────────────────────────────────────────────────
-- Un portal puede tener el 100% de province y otro el 0%.
-- Saber cuál aporta qué define qué coches aparecerían en el bloque local.
SELECT
  portal,
  COUNT(*)                                                    AS total,
  COUNT(NULLIF(province, ''))                                 AS con_province,
  ROUND(100.0 * COUNT(NULLIF(province, '')) / COUNT(*), 1)   AS province_pct,
  COUNT(NULLIF(city, ''))                                     AS con_city,
  ROUND(100.0 * COUNT(NULLIF(city, '')) / COUNT(*), 1)       AS city_pct
FROM moveadvisor_market_offers
WHERE is_active = TRUE
GROUP BY portal
ORDER BY total DESC;


-- ── Q3a: COBERTURA de la cohorte controlada — leer ANTES que Q3b ─────────────
-- Cuántas provincias tienen muestra suficiente para mostrar precio sin engañar.
-- Leer primero este número: si son <5, la feature no es viable por cobertura
-- y Q3b no añade información relevante — la conclusión ya está aquí.
-- Cohorte: León 2020, km 40k-90k (composición homogénea).
SELECT
  COUNT(DISTINCT province)                      AS provincias_con_dato,
  SUM(COUNT(*)) OVER ()                         AS n_total_cohorte,
  COUNT(DISTINCT province)
    FILTER (WHERE cnt >= 8)                     AS provincias_n8,
  COUNT(DISTINCT province)
    FILTER (WHERE cnt >= 15)                    AS provincias_n15
FROM (
  SELECT province, COUNT(*) AS cnt
  FROM moveadvisor_market_offers
  WHERE is_active = TRUE
    AND brand ILIKE 'seat'
    AND model ILIKE '%leon%'
    AND year = 2020
    AND mileage BETWEEN 40000 AND 90000
    AND price BETWEEN 5000 AND 35000
    AND province <> ''
  GROUP BY province
) sub;


-- ── Q3b: DESVIACIÓN LOCAL vs. NACIONAL con IQR — leer solo si Q3a >= 5 ──────
-- Cohorte idéntica a Q3a: León 2020, km 40k-90k.
-- IQR (p25-p75) local indica si la mediana es estable o si dos coches la mueven.
-- Una desviación del ±5% con IQR de 4.000€ sobre n=8 es ruido, no señal.
-- Regla de lectura: desviacion_pct significativa = |pct| > 3 Y iqr_local < 3.000.
WITH national AS (
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS nat_median,
    COUNT(*) AS nat_n
  FROM moveadvisor_market_offers
  WHERE is_active = TRUE
    AND brand ILIKE 'seat'
    AND model ILIKE '%leon%'
    AND year = 2020
    AND mileage BETWEEN 40000 AND 90000
    AND price BETWEEN 5000 AND 35000
    AND province <> ''
)
SELECT
  o.province,
  COUNT(*)                                                                  AS n,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.price)::numeric, 0)  AS median_local,
  n.nat_median::int                                                         AS median_nacional,
  ROUND(
    (100.0 * (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.price) - n.nat_median)
    / n.nat_median)::numeric
  , 1)                                                                      AS desviacion_pct,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.price)::numeric, 0) AS p25_local,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.price)::numeric, 0) AS p75_local,
  ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY o.price)
       - PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY o.price))::numeric, 0) AS iqr_local,
  n.nat_n                                                                   AS n_nacional
FROM moveadvisor_market_offers o, national n
WHERE o.is_active = TRUE
  AND o.brand ILIKE 'seat'
  AND o.model ILIKE '%leon%'
  AND o.year = 2020
  AND o.mileage BETWEEN 40000 AND 90000
  AND o.price BETWEEN 5000 AND 35000
  AND o.province <> ''
GROUP BY o.province, n.nat_median, n.nat_n
HAVING COUNT(*) >= 8
ORDER BY COUNT(*) DESC;
