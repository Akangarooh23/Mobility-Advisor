-- TARGET: PostgreSQL (Neon) — NO ejecutar contra MSSQL.
-- Validación offline del factor de descuento (Ola 3).
--
-- Objetivo: medir si is_active=FALSE es un proxy válido de precio de cierre,
-- y cuantificar el sesgo de supervivencia (anuncios caros permanecen más tiempo).
--
-- Contaminación conocida por portal:
--   flexicar    → verificación por URL visita real → alta fiabilidad
--   autoscout24 → umbral 30d anti-bot (no visita URL) → contaminado
--   wallapop    → umbral 7d → fiabilidad media
--   autohero    → verificar comportamiento en Query 1 antes de incluir
--
-- NO cablear el factor al PDF hasta:
--   (a) Query 1 confirme que la contaminación del portal elegido es asumible
--   (b) Query 2 muestre factor estable con n_inactive >= 30 en >= 5 marcas
--   (c) Query 3 confirme que el sesgo existe y su magnitud está en banda [0.88, 0.96]
--
-- Orden de ejecución: 1 → 3 → 2
--   1. Contaminación por portal  (decide qué portales incluir en 2 y 3)
--   3. Sesgo global              (confirma que el proxy vale la pena)
--   2. Factor por marca+modelo   (granularidad para calibrar)
--
-- Filtro de recencia opcional: añadir
--   AND last_seen_at >= NOW() - INTERVAL '12 months'
-- a las queries de inactivos si el volumen histórico introduce drift de mercado.
--
-- NOTA: listed_at es NULL en el 100% de la tabla (todos los portales, verificado).
-- COALESCE(listed_at, scraped_at) siempre cae a scraped_at. days_alive mide
-- desde primera visión del scraper, no desde publicación en portal.
-- La duración es una COTA INFERIOR de la estancia real en mercado.
--
-- NOTA: updated_at para inactivos es un bulk de migración (07:54:48–07:54:49,
-- 12.788 filas en 1 segundo). NO usar como señal temporal. Campo correcto: last_seen_at.


-- ── 1. Calidad de señal por portal ───────────────────────────────────────────
-- CRITERIO CORRECTO para last_seen_at (distinto del criterio anterior con updated_at):
--   - Con updated_at buscábamos "sin spike en 7/30d". Con last_seen_at la lógica cambia:
--     last_seen_at es la última confirmación de vida, no la duración de vida.
--     Un anuncio dado de baja sano tiene su last_seen_at en el pasado, no hoy.
--
-- Tres grupos de columnas, tres criterios de admisión:
--
--   (1) Cobertura: pct_null_lsa ~ 0%
--       Filas sin last_seen_at caen silenciosamente del cálculo. Si son muchas,
--       los agregados reflejan solo el subconjunto que sí se pobló.
--
--   (2) Dispersión temporal: distinct_days en decenas; days_to_today > 0
--       bulk_write → 1-2 distinct_days, last_seen_max = hoy o ayer
--       señal real → decenas de días distintos, max claramente en el pasado
--
--   (3) Señal económica: global_factor en [0.80, 0.98] y < 1.00
--       Factor >= 1 → inactivos más caros que activos → contaminación o bulk
--       Factor fuera de banda → revisar antes de cablear
--
-- Un portal que pasa los tres es candidato; uno que falla en cualquiera se descarta.
-- Añadir un portal por volumen solo (autohero: 5.586 filas) contamina el factor
-- si su last_seen_at resulta ser bulk-escrito como lo era su updated_at.

SELECT
  COALESCE(portal, 'sin_portal')                                                AS portal,
  -- (1) cobertura
  COUNT(*) FILTER (WHERE is_active = FALSE)                                     AS n_inactive,
  COUNT(*) FILTER (WHERE is_active = FALSE AND last_seen_at IS NULL)            AS n_null_lsa,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_active = FALSE AND last_seen_at IS NULL)
    / NULLIF(COUNT(*) FILTER (WHERE is_active = FALSE), 0), 1)                 AS pct_null_lsa,
  -- (2) dispersión temporal
  COUNT(DISTINCT DATE(last_seen_at)) FILTER (WHERE is_active = FALSE)           AS distinct_days,
  (MAX(last_seen_at) FILTER (WHERE is_active = FALSE))::date                   AS last_seen_max,
  CURRENT_DATE - (MAX(last_seen_at) FILTER (WHERE is_active = FALSE))::date    AS days_to_today,
  -- (3) señal económica
  COUNT(*) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)                      AS n_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE is_active = FALSE)::numeric, 0)                               AS median_inactive,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)::numeric, 0)               AS median_active,
  ROUND((
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
    / NULLIF(
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
          FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
        0
      )
  )::numeric, 3)                                                               AS global_factor
FROM moveadvisor_market_offers
WHERE price BETWEEN 1000 AND 200000
GROUP BY portal
HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 30
ORDER BY n_inactive DESC;


-- ── 2. Factor de descuento por marca+modelo ───────────────────────────────────
-- factor = median(inactivos) / median(activos)
-- factor < 1.00 → publicados sobreestiman el cierre (sesgo de supervivencia esperado)
-- factor > 1.00 → improbable; indica contaminación (retiradas con precio inflado)
--
-- Ajustar portal = 'flexicar' según resultados de Query 1.
-- Para ampliar a más portales: WHERE portal IN ('flexicar', 'autohero')
-- n_inactive >= 30 es el umbral mínimo de estabilidad de mediana.

SELECT
  brand,
  model,
  COUNT(*) FILTER (WHERE is_active = FALSE)                                   AS n_inactive,
  COUNT(*) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)                    AS n_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)::numeric, 0)             AS median_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE is_active = FALSE)::numeric, 0)                            AS median_inactive,
  ROUND((
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
    /
    NULLIF(
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
      0
    )
  )::numeric, 3)                                                              AS discount_factor
FROM moveadvisor_market_offers
WHERE price BETWEEN 1000 AND 200000
  AND portal = 'flexicar'
GROUP BY brand, model
HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 30
ORDER BY discount_factor ASC;


-- ── 3. Sesgo de supervivencia global por portal ───────────────────────────────
-- Confirma si el sesgo existe y su magnitud antes de ir al detalle por marca.
-- Si median_inactive < median_active de forma consistente → el proxy vale.
-- global_factor en banda [0.88, 0.96] → cablear con descuento moderado.
-- global_factor ≈ 1.00 → no hay sesgo medible → el factor no aporta valor.
--
-- Ejecutar esto antes de Query 2 para decidir si merece la pena el detalle.

SELECT
  COALESCE(portal, 'sin_portal')                                              AS portal,
  COUNT(*) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)                    AS n_active,
  COUNT(*) FILTER (WHERE is_active = FALSE)                                   AS n_inactive,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE COALESCE(is_active, TRUE) = TRUE)::numeric, 0)             AS median_active,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)
    FILTER (WHERE is_active = FALSE)::numeric, 0)                            AS median_inactive,
  ROUND((
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE is_active = FALSE)
    /
    NULLIF(
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) FILTER (WHERE COALESCE(is_active, TRUE) = TRUE),
      0
    )
  )::numeric, 3)                                                              AS global_factor
FROM moveadvisor_market_offers
WHERE price BETWEEN 1000 AND 200000
GROUP BY portal
HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 30
ORDER BY n_inactive DESC;
