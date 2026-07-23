-- scripts/find-nlow-candidates.sql
--
-- Busca candidatos para el fixture de rama n_low (objetivo: n efectivo 7-10,
-- centro de la banda 3-15, lejos de ambas fronteras).
--
-- Herramienta permanente, no de un solo uso: los fixtures de esta rama ya han
-- migrado dos veces (nlow-lincoln -> fail-closed, nlow-maserati -> cruzó n>=15
-- al retirar el filtro de kilometraje). Volverá a pasar.
--
-- IMPORTANTE: n_raw es un PROXY. No reproduce el cascade progresivo, ni el
-- filtro de potencia ±25%, ni el balanceo del pool. Un grupo con n_raw=12
-- puede dar n_efectivo=8. Usa esta query para sacar 5-6 candidatos y verifica
-- cada uno con:  node scripts/golden-tests/capture.js --id <candidato>
--
-- NOTA: los nombres de columna de la tabla de aliases y el campo de tipo de
-- vendedor son suposiciones. Ajústalos al esquema real antes de ejecutar.

WITH grupos AS (
  SELECT
    o.brand,
    o.model,
    o.fuel,
    o.transmission,
    COUNT(*)                                                    AS n_raw,
    COUNT(DISTINCT o.year)                                      AS n_years,
    MIN(o.year)                                                 AS year_min,
    MAX(o.year)                                                 AS year_max,
    ROUND(AVG(o.price))                                         AS price_avg,
    ROUND(STDDEV_SAMP(o.price) / NULLIF(AVG(o.price), 0), 3)   AS cv,
    ROUND(AVG(o.mileage))                                       AS km_avg,
    COUNT(*) FILTER (WHERE o.seller_type = 'private')           AS n_particulares
  FROM moveadvisor_market_offers o
  WHERE o.is_active = TRUE
    AND o.price     > 0
    AND o.mileage   < 400000          -- alineado con la cota real de producción
    AND o.year BETWEEN 2017 AND 2025
    AND o.brand IS NOT NULL
    AND o.model IS NOT NULL
    -- CRÍTICO: solo marcas que resuelven en aliases.
    -- Sin este filtro, un candidato de marca no reconocida hace fail-closed
    -- y aterriza en la rama fallback, no en n_low. Es exactamente lo que
    -- ocurrió con nlow-lincoln.
    AND EXISTS (
      SELECT 1
      FROM moveadvisor_brand_aliases a
      WHERE lower(a.alias_name) = lower(o.brand)
         OR lower(a.canonical_name) = lower(o.brand)
    )
  GROUP BY o.brand, o.model, o.fuel, o.transmission
)
SELECT *
FROM grupos
WHERE n_raw BETWEEN 5 AND 18        -- margen amplio: el cascade reduce el n
  AND n_years >= 3                  -- el balanceo necesita ambos lados del sujeto
  AND cv BETWEEN 0.10 AND 0.35      -- fuera del bonus (+5) y de la penalización (-15)
  AND n_particulares NOT BETWEEN 4 AND 6   -- lejos de la frontera de los 5 particulares
ORDER BY n_raw ASC, brand, model
LIMIT 60;


-- ---------------------------------------------------------------------------
-- Si devuelve pocas filas, relaja en este orden:
--   1. quitar el filtro de n_particulares
--   2. ampliar cv a [0.08, 0.40]
--   3. bajar n_years a >= 2
-- No relajes nunca el EXISTS sobre aliases: un candidato sin alias no puede
-- cubrir la rama n_low por construcción.
--
-- Criterios para elegir entre los resultados:
--   - Escasez ESTRUCTURAL (combustible minoritario en ese modelo, versión
--     específica de un modelo popular), no coyuntural (stock que hoy está bajo).
--   - year_min / year_max con recorrido suficiente para que el sujeto quede
--     en el centro con comparables a ambos lados.
--   - price_avg en un rango donde el segmento esté bien clasificado en
--     BRAND_TIERS (si no lo está, cae a mainstream y el cap será el del
--     segmento equivocado).
