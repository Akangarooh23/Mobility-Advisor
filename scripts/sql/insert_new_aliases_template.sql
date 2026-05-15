-- Template para insertar NUEVOS aliases cuando se detecten nuevas variantes
-- Uso: Reemplaza los valores DENTRO de VALUES y ejecuta en Neon editor

-- ================================================================
-- INSERTAR NUEVO ALIAS DE MARCA
-- ================================================================
-- Sintaxis: INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name, source, is_active)
-- El alias_key se genera automáticamente usando GENERATED ALWAYS

INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name, source, is_active)
VALUES
  ('nueva_marca_variante1', 'Canonical Brand Name', 'manual-new-portal', TRUE),
  ('nueva_marca_variante2', 'Canonical Brand Name', 'manual-new-portal', TRUE)
ON CONFLICT (alias_key) 
DO UPDATE SET is_active = TRUE, updated_at = NOW()
WHERE EXCLUDED.brand_key IS NOT NULL;

-- ================================================================
-- INSERTAR NUEVO ALIAS DE MODELO
-- ================================================================
-- Sintaxis: INSERT INTO moveadvisor_model_aliases (brand_key, model_key, canonical_name, source, is_active)
-- brand_key DEBE ser el alias_key normalizado de la marca canonical

INSERT INTO moveadvisor_model_aliases (brand_key, model_key, canonical_name, source, is_active)
VALUES
  ('brandnamekey', 'model_variant1', 'Canonical Model Name', 'manual-new-portal', TRUE),
  ('brandnamekey', 'model_variant2', 'Canonical Model Name', 'manual-new-portal', TRUE)
ON CONFLICT (alias_key, brand_key) 
DO UPDATE SET is_active = TRUE, updated_at = NOW()
WHERE EXCLUDED.model_key IS NOT NULL;

-- ================================================================
-- EJEMPLO PRÁCTICO: Nuevo portal con variante "BMW i3 électrique"
-- ================================================================
-- Primer: Insertar el alias de marca (si no existe)
INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name, source, is_active)
VALUES ('bmw', 'BMW', 'manual-flexicar-portal', TRUE)
ON CONFLICT (alias_key) DO NOTHING;

-- Luego: Insertar el alias de modelo
INSERT INTO moveadvisor_model_aliases (brand_key, model_key, canonical_name, source, is_active)
VALUES ('bmw', 'i3electrique', 'i3', 'manual-flexicar-portal', TRUE)
ON CONFLICT (alias_key, brand_key) 
DO UPDATE SET is_active = TRUE, updated_at = NOW();

-- Verificar insertado:
SELECT * FROM moveadvisor_model_aliases 
WHERE brand_key = 'bmw' AND canonical_name = 'i3'
ORDER BY source DESC;
