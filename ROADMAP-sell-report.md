# Roadmap — Motor de Tasación de Venta

Fuente de verdad del estado de las mejoras al motor de pricing (`lib/sellReportGenerator.js` + `lib/inventoryStore.js`).
El commit que incluye los fixtures de golden tests es el que cierra cada ola, no el código.

---

## Principios

- **Golden tests primero**: `run.js` antes de tocar cualquier cálculo. El diff de fixtures es la evidencia del cambio.
- **No cambiar la misma cifra visible dos veces en poco tiempo**: espaciar con narrativa ("nuevo modelo", no "corrección").

---

## OLA 0 — Renombrado + infraestructura de tests

**Estado: CERRADA** — commit 2026-07-23, 11 golden tests verdes

### Cambios aplicados

| Archivo | Cambio |
|---------|--------|
| `lib/sellReportGenerator.js` | `PRECIO OPTIMO DE VENTA` → `PRECIO DE PUBLICACION RECOMENDADO` |
| `lib/sellReportGenerator.js` | Anotaciones barra e histograma renombradas |
| `lib/sellReportGenerator.js` | Nota sesgo de supervivencia en sección de tendencia |
| `lib/sellReportGenerator.js` | `buildReportData` exportada; acepta `referenceDate` como 4º param |
| `lib/sellReportGenerator.js` | `estimatePriceByDepreciation` ya no lee `new Date()` — recibe `referenceDate` |
| `lib/inventoryStore.js` | `getMarketPriceSnapshot` devuelve `cascadeRelaxed: { power, transmission, fuel, year }` |
| `scripts/golden-tests/` | `vehicles.json`, `capture.js`, `run.js`, `README.md` |

### Verificaciones completadas

- [x] `run.js` con `referenceDate` del fixture → PASS; con `referenceDate +365` → DRIFT en fallback-dodge (`9340 → 8208`) — fuga del reloj tapada e inyección conectada
- [x] Fixture restaurado a fecha original
- [x] `node scripts/golden-tests/capture.js` → `dmg=0.91` en damage-golf-moderado, `dmg=0.97` en damage-leon-leve, `cascade=[power,transmission]` en cascade-*
- [x] `node scripts/golden-tests/run.js` → **11 PASS, 0 DRIFT, 0 MISSING**
- [x] **Commit** con fixtures incluidos

---

## OLA 1 — Módulo de regresión completo + fix unresolved-brand

**Estado: CERRADA** — 2026-07-23, 12 golden tests verdes, 6 ramas

Prerrequisito: Ola 0 cerrada ✓ + baseline del bug congelada ✓ (commit 55948bc).

### Cambios planificados (en el mismo commit)

#### Fix — unresolved-brand (dos mecanismos complementarios)

**Mecanismo 1 — fail-closed en resolución de marca** (`getMarketPriceSnapshot`):
Si la marca no resuelve a ningún alias conocido Y no existe en `moveadvisor_market_offers` → devolver snapshot vacío (`comparables=0, source="unresolved-brand"`) → rama fallback con 35% de confianza. Ataja el modo de fallo: 0 entradas Postgres → JSON local → pool sin filtrar.

**Mecanismo 2 — cross-check depreciación/mercado** (aplicado siempre, no solo en unresolved):
Después de construir el pool: calcular `estimatePriceByDepreciation` como control cruzado. Si `medianMercado / estimadoDepreciación` cae fuera de la banda `[0.40, 2.50]` → pool no corresponde al vehículo → forzar `comparables=0`. Ataja el modo de fallo complementario (Lamborghini Huracan: 1 entrada Postgres real pero "huracan" token casa con 338 coches más).

**Script de prevención** (en el mismo commit, en `scripts/`):
`check-catalog-alias-gap.js` — diffeea vehicle-catalog.json vs aliases y lista las marcas sin cobertura. 20 líneas. Se corre antes de tocar el catálogo.

- **OLS múltiple km+año** en lugar de dos regresiones univariadas — devuelto como factor único "ajuste por uso" (evita que dos filas con la misma correlación bailen entre informes)
- **Umbral n≥15** para usar la regresión; por debajo: slope por defecto calibrado por segmento (`BRAND_TIERS`)
- **Solver robusto** (centrado en medianas + pivoteo parcial + tres guardarraíles en orden):
  1. `Number.isFinite(slopeKm) && Number.isFinite(slopeYear)` — NaN/Infinity → default
  2. `slopeKm <= 0 && slopeYear >= 0` — signo correcto
  3. `slopeKm >= -0.30 && slopeYear <= 3000` — magnitud plausible (cota asimétrica, ver nota)
  - Si cualquier guardarraíl falla → slope de segmento, `usedDefault = true`
- **Nota sobre la cota de magnitud**: asimétrica a propósito. Protege contra sobreajuste (slope absurdamente grande) pero no contra infraajuste (slope casi cero). El infraajuste es un error conservador — produce usageImpact ≈ 0, que subestima el ajuste pero no genera precios absurdos. Anotar `usedDefault` en el log permite detectarlo en producción.
- **Reordenamiento de df**: el nuevo esquema aplica `effectiveFactor = df × color × owner` sobre `(base + usageImpact)` completo. En el esquema viejo, df encogía el base pero no usageImpact. **El drift por este reordenamiento es proporcional a `|usageImpact| × (1 − df)`**: un premium con usageImpact = −8.000€ y df = 0.91 drifta ~720€, no ~60€. Esto es correcto y esperado — el nuevo orden es más limpio.
- **Cap factor combinado** `damageFactor × colorFactor × ownerFactor` mínimo 0.72
- **Cap dinámico de km** por segmento: economy ±10%, mainstream ±12%, premium_entry ±20%, premium ±25%
- **Logging de tupla** desde el primer commit: `{ brand, model, slopeKm, slopeYear, n, usedDefault, usedFallback, cascadeRelaxed, combinedFactor }`

### Predicción de drift al correr run.js

| Caso | Fuente del drift |
|------|-----------------|
| common sin daño (df=1.00) | solo OLS vs suma de dos regresiones univariadas (<3-5%) |
| common con daño leve (df=0.97) | OLS + reordenamiento de df; escala con \|usageImpact\| |
| damage/fallback con factor combinado < 0.72 | cap 0.72 sube precio (~+7%) |
| fallback sin daño | ninguno |
| n_low con n<15 | slope de segmento vs regresión frágil anterior |

El drift por reordenamiento de df crece con el segmento y el kilometraje. No es un error — es el comportamiento correcto del nuevo esquema.

### Flujo de trabajo

1. `run.js` → 12 PASS (ya verificado, prerrequisito ✓)
2. `inventoryStore.js`: fail-closed en `getMarketPriceSnapshot` + cross-check depreciación en `computeUsageImpact`
3. `inventoryStore.js`: `solveOLS2x2` + `computeUsageImpact` reemplaza `computeKmImpact` + `computeAgeImpact`
4. `sellReportGenerator.js`: reordenamiento `base+usageImpact)*effectiveFactor` + cap 0.72
5. PDF pág. 3: fusionar "Kilometraje" / "Antigüedad" → "Ajuste por uso"
6. `generateSellReport`: logging de tupla diagnóstica
7. `scripts/check-catalog-alias-gap.js`: script de prevención
8. `run.js` → leer drift (tabla de predicción + DRIFT espectacular en unresolved-brand)
9. `capture.js` → reasentar línea base (unresolved-brand: de n=351/81% a n=0/35%)
10. Commit con bloque "drift aceptado" + "unresolved-brand: fix verificado"

---

## OLA 2 — Cascade e IA

**Estado: PENDIENTE**

Prerrequisito: Ola 1 cerrada.

### Cambios planificados

- Umbrales cascade consistentes (todos en `< 10`, eliminar los `=== 0`)
- Combustible siempre el último en relajarse; `confidence -= 20` cuando ocurre, nota visible en PDF
- Potencia: relajación condicional — cae pronto **salvo** modelo con variante de prestaciones
  - Guardarraíl temporal: IQR con n≥5 pre-relajación (caza el 340i en la muestra del 320d)
  - Solución definitiva: normalización de versión por tier (base/mid/performance) vía Gemini
- **Gemini → categorías discretas** de daño (`sin_daños/cosmético/leve/moderado/grave/muy_grave`) mapeadas a factor fijo — elimina varianza del float; mantiene evaluación semántica

> Nota: los golden tests **no detectan** cambios en la ruta Gemini (ejercitan la tabla hardcoded). La validación del nuevo mapeo de categorías se hace comparando manualmente el factor congelado (ej. 0.91 para "moderado") contra lo que la categoría nueva mapee.

---

## OLA 3 — Factor de descuento real con datos propios

**Estado: PENDIENTE (requiere validación offline previa)**

Prerrequisito: Ola 2 cerrada + análisis offline del factor de descuento.

### Señal disponible

- `is_active = FALSE` + `last_seen_at` en `moveadvisor_market_offers`
- Señal = vendido O retirado O URL cambiada O fallo scraper → contaminada; validar antes de usar
- Flexicar: señal más limpia (visita la ficha directamente, ventana 3 días)
- AutoScout24: señal media (ventana 9 días, anuncios pueden reaparecer)

### Query de análisis offline

```sql
SELECT brand, model,
  COUNT(*) FILTER (WHERE is_active = FALSE) AS vendidos,
  AVG(price) FILTER (WHERE is_active = FALSE)  AS precio_medio_cierre,
  AVG(price) FILTER (WHERE is_active = TRUE)   AS precio_medio_activo,
  AVG(price) FILTER (WHERE is_active = FALSE) /
    NULLIF(AVG(price) FILTER (WHERE is_active = TRUE), 0) AS factor_descuento
FROM moveadvisor_market_offers
WHERE last_seen_at > NOW() - INTERVAL '90 days'
GROUP BY brand, model
HAVING COUNT(*) FILTER (WHERE is_active = FALSE) >= 20;
```

### Criterio de validación del factor

- **Banda sana**: 0.88 – 0.96 (universal al inicio, por segmento cuando haya n≥30)
- **Fuera de banda**: señal contaminada → usar factor estático de segmento como fallback
- Solo cablear al PDF cuando factor sea estable con n≥30 y banda validada
- Hasta entonces: el informe solo dice "precio de publicación recomendado", sin cifra de cierre

### Métricas que desbloquea

- Factor de descuento publicación→cierre por modelo (real, no estático)
- Absorción real (vendidos/activos 30d)
- Corrección de sesgo de supervivencia en la tendencia de precios

---

## COLA (bajo impacto relativo)

- Ajuste de color reducido a -1%/-2% máx + exención marcas deportivas (Porsche, BMW M, Audi RS)
- Curvas de depreciación con pendiente por segmento (requiere histórico de bajas)
