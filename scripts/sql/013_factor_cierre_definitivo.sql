-- TARGET: PostgreSQL (Neon) — NO ejecutar contra MSSQL.
-- Factor de cierre definitivo (Ola 3) — solo Flexicar.
--
-- RESULTADO PARCIAL (2026-07-27): banda preliminar ejecutada sobre subconjunto limpio.
--
-- Workflow verificado: el verificador ya escribe last_seen_at = NOW() en cada
-- confirmación de vida. El bulk del 2026-05-15 fue el backfill de la columna.
-- El verificador lleva operativo desde 2026-07-02 (~3 semanas de acumulación real).
--
-- Corte limpio: AND last_seen_at >= '2026-05-17' en FILTER de inactivos.
-- 436 bajas limpias, 13 días distintos.
--
-- Resultados Query B-preliminar (last_seen_at >= '2026-05-17', Flexicar):
--   economy    (<12k): n=121, factor=0.954 → cableable como preliminar
--   mainstream (12k-20k): n=218, factor=0.969 → cableable como preliminar
--   premium    (20k-35k): n=88,  factor=1.001 → descartado (sesgo domina)
--   global:    n=436, factor=0.882 → NO cablear (mezcla composición entre tramos)
--
-- REGLA: factor >= 1.0 = sesgo de composición domina → descartar ese tramo.
-- REGLA: nunca cablear el global (mezcla efectos de composición entre tramos).
--
-- Banda cableable: "el cierre queda ~3-6% por debajo del anuncio" (economy/mainstream).
-- El descuento real es mayor (sesgo de composición + desfase discovery apilan hacia arriba).
--
-- Bloque A (factor por modelo): ~20 semanas más al ritmo actual (~33 bajas/día).
-- Bloque C: EXPLORACIÓN, ver advertencias en la query.
-- Para absorción/listed_at: bloqueado, listed_at NULL en el 100% de la tabla.
--
-- Ejecutar en orden: A → B → C (B ya ejecutada en versión preliminar, ver arriba)
--
-- Sobre la comparación temporal (Query C):
--   NO existe tabla de snapshots históricos en este esquema. La única aproximación
--   computacionalmente viable es controlar por año y km — reduce el sesgo de
--   composición al comparar grupos más homogéneos, sin inventar datos que no hay.
--   El sesgo residual (activos = los no vendidos) persiste pero queda acotado.
--
-- Orden: A → B → C
--   A. Factor por modelo con etiqueta de calidad
--   B. Fallback por rango de precio (provisional; cruza segmentos — ver nota)
--   C. Sesgo de composición controlado por año+km (sustituto honesto al temporal)


-- ── A. Factor definitivo por modelo ──────────────────────────────────────────
-- Modelos usables: factor IN [0.80, 0.98], n_inactive >= 30.
-- calidad = 'sesgo_composicion': usar fallback de Query B para ese modelo.
-- calidad = 'descuento_alto':    revisar n y outliers antes de aceptar.

SELECT
  brand,
  model,
  n_inactive,
  n_active,
  median_active,
  median_inactive,
  discount_factor,
  CASE
    WHEN discount_factor BETWEEN 0.80 AND 0.98 THEN 'usable'
    WHEN discount_factor < 0.80               THEN 'descuento_alto — revisar n'
    ELSE                                           'sesgo_composicion — fallback segmento'
  END AS calidad
FROM (
  SELECT
    brand,
    model,
    COUNT(*) FILTER (WHERE is_active = FALSE)                                 AS n_inactive,
    COUNT(*) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)                  AS n_active,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
      FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)::numeric, 0)           AS median_active,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
      FILTER (WHERE is_active = FALSE)::numeric, 0)                          AS median_inactive,
    ROUND((
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
      / NULLIF(
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
          0
        )
    )::numeric, 3)                                                            AS discount_factor
  FROM moveadvisor_market_offers
  WHERE price BETWEEN 1000 AND 200000
    AND portal = 'flexicar'
  GROUP BY brand, model
  HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 30
) sub
ORDER BY discount_factor ASC;


-- ── B. Fallback por rango de precio ──────────────────────────────────────────
-- Agrega modelos USABLES (factor ya filtrado a [0.80, 0.98] en la subquery).
-- El filtro se aplica ANTES de agregar — modelos con sesgo de composición
-- quedan excluidos del promedio, no capados ni promediados con el sesgo.
--
-- NOTA: rango de precio cruza segmentos (utilitario premium ≈ familiar generalista).
-- Válido para comunicar la banda al cliente; provisional como fallback fino.
-- Sustituir por agrupación real de segmento cuando estén poblados los aliases.

SELECT
  CASE
    WHEN median_active < 12000 THEN 'economy    (<12k)'
    WHEN median_active < 20000 THEN 'mainstream (12k-20k)'
    WHEN median_active < 35000 THEN 'premium    (20k-35k)'
    ELSE                            'luxury     (>35k)'
  END                                                                         AS price_segment,
  COUNT(*)                                                                    AS n_models,
  SUM(n_inactive)                                                             AS total_n_inactive,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY discount_factor)::numeric, 3) AS factor_p50,
  ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY discount_factor)::numeric, 3) AS factor_p25,
  ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY discount_factor)::numeric, 3) AS factor_p75,
  ROUND(AVG(discount_factor)::numeric, 3)                                     AS factor_mean
FROM (
  -- Banda aplicada aquí, antes de agregar
  SELECT
    brand,
    model,
    COUNT(*) FILTER (WHERE is_active = FALSE)                                 AS n_inactive,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
      FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)::numeric, 0)           AS median_active,
    ROUND((
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
      / NULLIF(
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
          0
        )
    )::numeric, 3)                                                            AS discount_factor
  FROM moveadvisor_market_offers
  WHERE price BETWEEN 1000 AND 200000
    AND portal = 'flexicar'
  GROUP BY brand, model
  HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 30
    AND (
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
      / NULLIF(
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
          0
        )
    ) BETWEEN 0.80 AND 0.98
) sub
GROUP BY price_segment
ORDER BY price_segment;


-- ── C. Cota del sesgo de composición (año+km) ────────────────────────────────
-- EXPLORACIÓN, no validación. Leer con estas advertencias:
--
--   (1) El sesgo residual persiste dentro de cada celda: los activos de
--       marca+modelo+año+km siguen siendo los no vendidos (precio más alto).
--       median_active sigue sesgada al alza incluso en la celda.
--
--   (2) C ≈ A no demuestra que el sesgo era pequeño — demuestra que
--       los dos métodos comparten el mismo sesgo residual. La concordancia
--       es circular, no una validación.
--
--   (3) Cobertura esperada baja: 12.788 inactivos / (114 modelos × 8 años
--       × 8 buckets 40k) ≈ 1-2 por celda media. Solo los modelos de mayor
--       volumen (Peugeot 2008, Nissan Qashqai, Seat Arona) darán celdas
--       con n suficiente.
--
-- Uso legítimo: C da una COTA más estrecha que A, no una medición del sesgo.
-- La cifra comunicable al cliente (banda 5-10%) viene de B + margen prudente
-- por el sesgo residual que existe pero no es cuantificable sin snapshots.
--
-- km_bucket: 40.000 km. Reduce fragmentación sin perder la variable de control.

SELECT
  brand,
  model,
  year,
  (FLOOR(mileage / 40000) * 40000)::integer                                   AS km_bucket_desde,
  ((FLOOR(mileage / 40000) + 1) * 40000)::integer                            AS km_bucket_hasta,
  COUNT(*) FILTER (WHERE is_active = FALSE)                                   AS n_inactive,
  COUNT(*) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)                    AS n_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)::numeric, 0)             AS median_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE is_active = FALSE)::numeric, 0)                            AS median_inactive,
  ROUND((
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
    / NULLIF(
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
        0
      )
  )::numeric, 3)                                                              AS factor_controlado
FROM moveadvisor_market_offers
WHERE price BETWEEN 1000 AND 200000
  AND portal = 'flexicar'
  AND mileage BETWEEN 0 AND 300000
  AND year BETWEEN 2015 AND 2024
GROUP BY brand, model, year, FLOOR(mileage / 40000)
HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 5
  AND COUNT(*) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE) >= 5
ORDER BY brand, model, year, km_bucket_desde;
