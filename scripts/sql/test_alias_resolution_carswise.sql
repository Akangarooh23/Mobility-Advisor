-- Test alias resolution in carswise marketplace vo offers query
-- This verifies that searching for "DS" returns "DS Automobiles" offers

-- Test 1: Search for "ds" and see resolved results
SELECT 'Test 1: Search for DS' AS test_name;
SELECT id, title, brand, model, price, portal
FROM moveadvisor_marketplace_vo_offers
WHERE ('ds' = '' 
  OR normalize_alias_token(lower('ds')) = normalize_alias_token(lower(brand))
  OR normalize_alias_token(lower('ds')) = normalize_alias_token(lower(model))
  OR lower(id) LIKE '%ds%' 
  OR lower(title) LIKE '%ds%')
  AND is_active = TRUE
ORDER BY portal_score DESC NULLS LAST, updated_at DESC NULLS LAST
LIMIT 10;

-- Test 2: Show normalized values to understand matching
SELECT 'Test 2: Debug normalization' AS test_name;
SELECT 
  brand,
  normalize_alias_token(lower(brand)) AS normalized_brand,
  normalize_alias_token(lower('ds')) AS normalized_search,
  (normalize_alias_token(lower('ds')) = normalize_alias_token(lower(brand))) AS is_match
FROM moveadvisor_marketplace_vo_offers
WHERE brand ILIKE '%DS%'
LIMIT 20;

-- Test 3: Verify alias table has DS entry
SELECT 'Test 3: Check alias tables' AS test_name;
SELECT canonical_name, alias_key, source, COUNT(*) as count
FROM moveadvisor_brand_aliases
WHERE canonical_name ILIKE '%DS%' OR alias_key LIKE '%ds%'
GROUP BY canonical_name, alias_key, source
ORDER BY canonical_name, source;

-- Test 4: Count total matches for "ds"
SELECT 'Test 4: Count matches for DS' AS test_name;
SELECT COUNT(*) as total_ds_matches
FROM moveadvisor_marketplace_vo_offers
WHERE ('ds' = '' 
  OR normalize_alias_token(lower('ds')) = normalize_alias_token(lower(brand))
  OR normalize_alias_token(lower('ds')) = normalize_alias_token(lower(model))
  OR lower(id) LIKE '%ds%' 
  OR lower(title) LIKE '%ds%')
  AND is_active = TRUE;
