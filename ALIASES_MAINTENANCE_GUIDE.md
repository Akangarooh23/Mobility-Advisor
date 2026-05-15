# Mantenimiento de Aliases - Guía Operativa

## Propósito

A medida que integres ofertas de nuevos portales (FlexiCar, Kinto, Enovacar, etc.), aparecerán nuevas variantes de marcas y modelos que no están en las tablas de aliases. Este documento explica cómo detectarlas y mantenerlas.

## Flujo de Mantenimiento (Mensual/Trimestral)

### 1️⃣ DETECTAR NUEVAS VARIANTES

Ejecuta: [scripts/sql/detect_new_aliases_needed.sql](detect_new_aliases_needed.sql)

**Paso 1.1: Abre Neon SQL Editor y copia el script**
- Coloca el cursor en cualquier bloque (PASO 1, 2, 3 o 4)
- Ejecuta
- Verás resultados como:

```
offer_brand    | offer_count | portals         | action
===============+============+=================+==================
BMW eléctrico  | 124        | flexicar, kinto | NEW_BRAND_CANDIDATE
Tesla Modèle S | 45         | enovacar        | NEW_BRAND_CANDIDATE
```

**Paso 1.2: Analiza los resultados**
- `NEW_BRAND_CANDIDATE`: Nueva marca/variante no encontrada en aliases
- `POTENTIAL_ALIAS_PAIR`: Probablemente sea la misma marca que en catálogo, solo otra forma de escribirla
- `NEW_MODEL_CANDIDATE`: Nuevo modelo que falta en aliases

### 2️⃣ DECIDIR SI ES UN ALIAS NUEVO O MARCA GENUINA

**Caso A: Es un alias (variante de marca/modelo existente)**
```
Ejemplo: "DS" vs "DS Automobiles"
Acción: Crear alias que apunte al canonical existente
```

**Caso B: Es una marca genuina nueva**
```
Ejemplo: Aparece "BYD Song Plus DM-i" pero BYD ya existe en catálogo
Acción: Solo agregar modelo alias, no marca
```

**Caso C: Marca completamente nueva**
```
Ejemplo: "Ora" (marca China nueva en 2025)
Acción: Contactar con catálogo para agregar, luego crear alias si hay variantes
```

### 3️⃣ INSERTAR NUEVO ALIAS

Usa: [scripts/sql/insert_new_aliases_template.sql](insert_new_aliases_template.sql)

**Opción A: Nuevo alias de MARCA**

```sql
INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name, source, is_active)
VALUES 
  ('newbrandvariant', 'Canonical Brand Name', 'manual-newportal-portal', TRUE)
ON CONFLICT (alias_key) 
DO UPDATE SET is_active = TRUE
WHERE EXCLUDED.brand_key IS NOT NULL;
```

**Opción B: Nuevo alias de MODELO**

```sql
INSERT INTO moveadvisor_model_aliases (brand_key, model_key, canonical_name, source, is_active)
VALUES
  ('toyota', 'rav4phv', 'RAV4', 'manual-flexicar-portal', TRUE)
ON CONFLICT (alias_key, brand_key) 
DO UPDATE SET is_active = TRUE;
```

**Opción C: Múltiples aliases a la vez**

```sql
INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name, source, is_active)
VALUES 
  ('bmwelectric', 'BMW', 'manual-enovacar-portal', TRUE),
  ('bmwelektrisch', 'BMW', 'manual-enovacar-portal', TRUE),
  ('teslamodeles', 'Tesla', 'manual-enovacar-portal', TRUE)
ON CONFLICT (alias_key) 
DO UPDATE SET is_active = TRUE;

INSERT INTO moveadvisor_model_aliases (brand_key, model_key, canonical_name, source, is_active)
VALUES
  ('bmw', 'i7sedan', 'i7', 'manual-enovacar-portal', TRUE),
  ('bmw', 'ix50', 'iX50', 'manual-enovacar-portal', TRUE),
  ('tesla', 'model3longrange', 'Model 3', 'manual-enovacar-portal', TRUE)
ON CONFLICT (alias_key, brand_key) 
DO UPDATE SET is_active = TRUE;
```

### 4️⃣ VERIFICAR LA INSERCIÓN

```sql
-- Verificar que se insertó correctamente
SELECT canonical_name, alias_key, source, COUNT(*) as count
FROM moveadvisor_brand_aliases
WHERE source = 'manual-enovacar-portal'
GROUP BY canonical_name, alias_key, source
ORDER BY canonical_name;

-- Verificar matches de ofertas
SELECT COUNT(*) as matches
FROM moveadvisor_market_offers o
WHERE normalize_alias_token(lower(o.brand)) IN (
  SELECT alias_key FROM moveadvisor_brand_aliases 
  WHERE source = 'manual-enovacar-portal'
);
```

### 5️⃣ COMMIT Y DOCUMENTAR

```bash
git add scripts/sql/
git commit -m "chore: add aliases for new portal variants

- Added 3 brand aliases for Enovacar portal
- Added 5 model aliases for various brands
- Detects: BMW i7, Tesla Model 3 LR variants
- Source: manual-enovacar-portal"

git push origin main
```

---

## Checklist Rápido (Cada integración de portal)

- [ ] Ejecutar `detect_new_aliases_needed.sql` contra base de datos con nuevas ofertas
- [ ] Revisar resultados y clasificar en A/B/C (alias vs genuino)
- [ ] Copiar template desde `insert_new_aliases_template.sql`
- [ ] Reemplazar valores y ejecutar en Neon editor
- [ ] Verificar con query de validación
- [ ] Commit a GitHub con descripción de portal + cantidad de aliases
- [ ] Actualizar este documento con nuevos portales agregados

---

## Tabla de Portales Integrados

| Portal | Fecha | Marcas Nuevas | Modelos Nuevos | Aliases Creados |
|--------|-------|---------------|----------------|-----------------|
| Autohero | 2025-03-15 | 0 | 2 | 2 |
| CochesNet | 2025-03-20 | 1 | 12 | 13 |
| Enovacar | - | TBD | TBD | - |
| FlexiCar | - | TBD | TBD | - |
| Kinto | - | TBD | TBD | - |

---

## Problemas Comunes

### ❌ Error: "ON CONFLICT DO UPDATE command cannot affect row a second time"
**Causa**: Tienes dos aliases con la misma `alias_key` (normalización igual) pero diferentes `brand_key`

**Solución**: Usa `ROW_NUMBER() OVER (PARTITION BY alias_key)` en el INSERT:
```sql
INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name, source, is_active)
SELECT DISTINCT ON (alias_key)
  brand_key, canonical_name, source, TRUE
FROM (
  VALUES 
    ('variant1', 'Canon', 'src1', TRUE),
    ('variant1_alt', 'Canon', 'src1', TRUE)
) v(brand_key, canonical_name, source, is_active)
WHERE alias_key = normalize_alias_token(brand_key);
```

### ❌ Error: "alias_key does not match alias_key generated"
**Causa**: La columna `alias_key` es GENERATED ALWAYS, no puedes especificarla

**Solución**: No especifiques `alias_key`, solo `brand_key` o `model_key`

```sql
-- ❌ MAL
INSERT INTO moveadvisor_brand_aliases (alias_key, brand_key, canonical_name) VALUES ('dsautomobiles', 'DS Automobiles', 'DS');

-- ✅ BIEN
INSERT INTO moveadvisor_brand_aliases (brand_key, canonical_name) VALUES ('DS Automobiles', 'DS');
```

### ❌ Alias insertado pero búsqueda no devuelve resultados
**Causa**: El `alias_key` se generó diferente al esperado, probablemente por acentos/caracteres

**Solución**: Ejecuta esto para ver qué se generó:
```sql
SELECT brand_key, alias_key, canonical_name 
FROM moveadvisor_brand_aliases 
WHERE canonical_name = 'Tu Marca'
ORDER BY updated_at DESC;
```

---

## Para Automatizar (Futuro)

Si los aliases crecen mucho, podrías crear un cron job que:

1. Ejecute `detect_new_aliases_needed.sql` automáticamente
2. Alertas Slack cuando hay > 20 nuevos aliases detectados
3. Pre-fill un formulario web para revisión manual antes de insertar

Por ahora, **mantenimiento manual mensual** es suficiente.
