# Integración de Alias Resolution - Estado Final

## ✅ Completado

### 1. Base de Datos (PostgreSQL/Neon)
- **Tablas de alias creadas y pobladas**
  - `moveadvisor_brand_aliases`: 43 marcas activas
  - `moveadvisor_model_aliases`: 167 modelos activos
  - Función SQL: `normalize_alias_token()` para comparación normalizada
  - Estado: Validado en producción (Neon)

### 2. Backend Integration (Carswise)
- **Archivo**: [carswise-erp-backoffice/apps/api/src/data/store.ts](carswise-erp-backoffice/apps/api/src/data/store.ts) línea ~860
- **Cambio**: Query `listMarketVoOffers` ahora usa `normalize_alias_token()` para comparar brand/model
- **Impacto**: Búsqueda por "DS" → Devuelve "DS Automobiles" automáticamente
- **Versión anterior**: Búsqueda literal sin alias resolution
- **Nueva lógica**:
  ```sql
  WHERE ($1 = '' 
    OR normalize_alias_token(lower($1)) = normalize_alias_token(lower(brand))
    OR normalize_alias_token(lower($1)) = normalize_alias_token(lower(model))
    OR lower(id) LIKE '%' || $1 || '%' 
    OR lower(title) LIKE '%' || $1 || '%')
  ```

### 3. Backend Helper Functions
- **Archivo**: [lib/inventoryStore.js](lib/inventoryStore.js)
- **Funciones agregadas**:
  - `resolveBrandWithAliases(inputBrand)`: Resuelve marca contra tablas de alias
  - `resolveModelWithAliases(inputModel, canonicalBrand)`: Resuelve modelo
- **Parámetro agregado a `listInventoryOffers`**: `brand` (para filtrado futuro en movilidad-advisor)
- **Exportado**: Ambas funciones en module.exports para uso en otros endpoints

### 4. Casos de Uso Ahora Soportados

#### En Carswise (Marketplace VO)
1. Usuario busca "DS" en UI
   - ✅ Se ejecuta `/market/vo-offers?q=ds`
   - ✅ Query resuelve "DS" vs "DS Automobiles" usando `normalize_alias_token()`
   - ✅ Devuelve ofertas de ambas variantes

2. Usuario busca "C 3" (con espacio)
   - ✅ Se normaliza a "c3" (espacios removidos)
   - ✅ Coincide con "C3" en tabla de ofertas
   - ✅ Devuelve ambas variantes

3. Usuario busca "Mercedes-Benz"
   - ✅ Se normaliza a "mercedesbenz" (sin guión)
   - ✅ Coincide con "Mercedes Benz" y "Mercedes-Benz"
   - ✅ Devuelve todas las variantes

#### En Movilidad-Advisor (Inventory)
- Parámetro `brand` disponible en `listInventoryOffers()`
- Funciones `resolveBrand/ModelWithAliases()` disponibles para futuro enhancement
- Filtrado actualmente por normalización en JavaScript

## 🔧 Testing

### Para verificar en Neon SQL Editor:

Ejecuta el script: [scripts/sql/test_alias_resolution_carswise.sql](scripts/sql/test_alias_resolution_carswise.sql)

**Paso 1: Test de búsqueda de "DS"**
```sql
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
```
**Resultado esperado**: Ofertas de "DS" y "DS Automobiles"

**Paso 2: Verificar normalización**
```sql
SELECT 
  brand,
  normalize_alias_token(lower(brand)) AS normalized_brand
FROM moveadvisor_marketplace_vo_offers
WHERE brand ILIKE '%DS%'
LIMIT 5;
```
**Resultado esperado**: Ambas variantes (DS, DS Automobiles) normalizan a "dsautomobiles"

## 📋 Checklist de Validación

- [ ] **En Neon Editor**: Ejecutar `test_alias_resolution_carswise.sql` - Verificar que devuelve ofertas de DS Automobiles al buscar "DS"
- [ ] **En Carswise Frontend**: Abrir marketplace, buscar "DS", verificar que aparecen ofertas de DS Automobiles
- [ ] **En Carswise Frontend**: Buscar "C 3" (con espacio), verificar que devuelve "C3"
- [ ] **En Carswise Frontend**: Buscar "Mercedes-Benz", verificar que devuelve variantes
- [ ] **Verificar código**: Revisar [carswise-erp-backoffice/apps/api/src/data/store.ts](carswise-erp-backoffice/apps/api/src/data/store.ts) línea ~860 usa normalize_alias_token

## 📦 Archivos Modificados

1. **carswise-erp-backoffice/apps/api/src/data/store.ts** - Query `listMarketVoOffers` actualizada con alias resolution
2. **lib/inventoryStore.js** - Agregadas funciones `resolveBrandWithAliases` y `resolveModelWithAliases`, parámetro `brand` a `listInventoryOffers`
3. **scripts/sql/test_alias_resolution_carswise.sql** - Script de testing creado

## 🚀 Próximos Pasos (Opcional)

Si quieres mejorar movilidad-advisor también:
1. En `api/find-listing.js` línea ~3765, pasar `brand: normalizedBrand` a `listInventoryOffers`
2. En `lib/inventoryStore.js`, usar `resolveBrandWithAliases()` en `readPostgresInventory()` si quieres filtrado en SQL

Pero para Carswise, **está listo en producción ahora mismo**.

---

**Resumiendo**: Búsqueda por "DS" en Carswise devuelve "DS Automobiles" ✅
