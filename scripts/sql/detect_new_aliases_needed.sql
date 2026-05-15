-- Script para detectar NUEVOS aliases que falten en las tablas
-- Ejecuta este script regularmente cuando integres ofertas de nuevos portales
-- para identificar qué variantes nuevas de brand/model hay que agregar

-- ================================================================
-- PASO 1: Detectar nuevas variantes de MARCA que no están en aliases
-- ================================================================
-- Marcas en ofertas que NO tienen canonical en la tabla de aliases
SELECT DISTINCT
  o.brand,
  COUNT(*) as offer_count,
  STRING_AGG(DISTINCT o.portal, ', ') as portals,
  'NEW_BRAND_CANDIDATE' as action
FROM moveadvisor_market_offers o
WHERE NOT EXISTS (
  SELECT 1 FROM moveadvisor_brand_aliases ba
  WHERE ba.alias_key = normalize_alias_token(lower(o.brand))
    AND ba.is_active = TRUE
)
  AND o.brand IS NOT NULL 
  AND o.brand != ''
  AND TRIM(o.brand) != ''
GROUP BY o.brand
ORDER BY offer_count DESC, o.brand ASC;

-- ================================================================
-- PASO 2: Detectar posibles DUPLICADOS de marca (variantes no mapeadas)
-- ================================================================
-- Ofertas cuya marca normalizada NO coincide exactamente con catálogo
-- pero probablemente sea la misma
SELECT 
  o.brand as offer_brand,
  vb.name as catalog_brand,
  COUNT(o.id) as matches,
  'POTENTIAL_ALIAS_PAIR' as action
FROM moveadvisor_market_offers o
LEFT JOIN moveadvisor_vehicle_brands vb ON 
  LOWER(UNACCENT(vb.name)) = LOWER(UNACCENT(o.brand))
WHERE LOWER(UNACCENT(vb.name)) != LOWER(UNACCENT(o.brand))
  AND vb.is_active = TRUE
  AND vb.name IS NOT NULL
GROUP BY o.brand, vb.name
HAVING COUNT(o.id) > 2
ORDER BY matches DESC
LIMIT 50;

-- ================================================================
-- PASO 3: Detectar nuevas variantes de MODELO
-- ================================================================
-- Modelos en ofertas que NO tienen alias activo para su brand
SELECT 
  o.brand,
  o.model,
  COUNT(*) as offer_count,
  STRING_AGG(DISTINCT o.portal, ', ') as portals,
  'NEW_MODEL_CANDIDATE' as action
FROM moveadvisor_market_offers o
WHERE o.brand IS NOT NULL 
  AND o.model IS NOT NULL
  AND o.brand != ''
  AND o.model != ''
  AND NOT EXISTS (
    SELECT 1 FROM moveadvisor_model_aliases ma
    WHERE ma.brand_key = normalize_alias_token(lower(o.brand))
      AND ma.alias_key = normalize_alias_token(lower(o.model))
      AND ma.is_active = TRUE
  )
GROUP BY o.brand, o.model
ORDER BY offer_count DESC, o.brand ASC, o.model ASC
LIMIT 100;

-- ================================================================
-- PASO 4: Resumen ejecutivo
-- ================================================================
SELECT 
  'Nuevas marcas sin alias' as category,
  COUNT(DISTINCT o.brand) as count
FROM moveadvisor_market_offers o
WHERE NOT EXISTS (
  SELECT 1 FROM moveadvisor_brand_aliases ba
  WHERE ba.alias_key = normalize_alias_token(lower(o.brand))
    AND ba.is_active = TRUE
)
  AND o.brand IS NOT NULL AND o.brand != '' AND TRIM(o.brand) != ''
UNION ALL
SELECT 
  'Nuevos modelos sin alias',
  COUNT(DISTINCT (o.brand || '|' || o.model))
FROM moveadvisor_market_offers o
WHERE o.brand IS NOT NULL 
  AND o.model IS NOT NULL
  AND o.brand != ''
  AND o.model != ''
  AND NOT EXISTS (
    SELECT 1 FROM moveadvisor_model_aliases ma
    WHERE ma.brand_key = normalize_alias_token(lower(o.brand))
      AND ma.alias_key = normalize_alias_token(lower(o.model))
      AND ma.is_active = TRUE
  )
UNION ALL
SELECT 
  'Total ofertas sin brand alias',
  COUNT(*)
FROM moveadvisor_market_offers o
WHERE NOT EXISTS (
  SELECT 1 FROM moveadvisor_brand_aliases ba
  WHERE ba.alias_key = normalize_alias_token(lower(o.brand))
    AND ba.is_active = TRUE
)
  AND o.brand IS NOT NULL AND o.brand != '' AND TRIM(o.brand) != '';
