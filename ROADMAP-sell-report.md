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

**Estado: CERRADA** — 2026-07-23, 12 golden tests verdes, 6 ramas. Línea base validada (ver post-mortem).

Prerrequisito: Ola 0 cerrada ✓ + baseline del bug congelada ✓ (commit 55948bc).

### Post-mortem — Contradicción del drift de damage (RESUELTA)

El drift damage-golf-moderado −14,2% (22.352→19.185€) parecía contradecir tres efectos previstos que apuntaban al alza. La investigación reveló que **no hay bug**: las fórmulas antiguas tenían un error de signo económico, la nueva es correcta.

**Causa raíz:**
- `listInventoryOffers` entrega a `computeUsageImpact` los **395 Golf mejor puntuados** (no un pool histórico crudo). Esa muestra está dominada por Golf 1.5 TSI 2022-2023 con ~37k km — el mercado real actual.
- `medianKm=37.029`, `medianYear=2023` en el pool puntuado (vs 102.500/2020 en el SQL crudo sin filtrar).
- El Golf del usuario (2020/50k km) queda **por encima de km mediano y debajo de año mediano** → doble penalización, económicamente correcta.

**El error histórico:**
Las fórmulas antiguas `computeKmImpact` / `computeAgeImpact` usaban `slope × (xMean − userValue)` en lugar de `slope × (userValue − xMean)`:
- km alto vs mercado → daban **prima** (en lugar de penalización)
- año más antiguo que mercado → daban **prima** (en lugar de penalización)
El precio de 22.352€ era inflación sistemática. El 19.185€ nuevo es correcto.

**Verificación aritmética con datos reales:**
`raw = −0.07×(50000−37029) + 800×(2020−2023) = −908 − 2400 = −3308` → capped a −2673
`effectiveFactor = max(0.72, 0.91×1.0×1.07) = 0.9737` (cap 0.72 no activa)
`priceOptimal = (22390−2673)×0.9737 = 19185€` ✓

**nlow-maserati-ghibli:** fixture nacido en Ola 1 (nlow-lincoln fail-closea). No existe drift antes/después para esta rama — la línea base nace en commit e3b9928.

**Shadow ratio Lincoln 29.31:** medido sobre el fixture PRE-fix (pre-fail-closed). En código actual Lincoln fail-closea → n=0 → shadow check no ejecuta. No es un false positive nuevo.

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

## OLA 2 — Pool + motor de uso

**Estado: PENDIENTE**

Prerrequisito: Ola 1 cerrada ✓

### Diagnóstico heredado de Ola 1

**OLS decorativo (verificado, 2026-07-23):** 10 de 10 fixtures con comparables tienen `usageUsedDefault=true`. Los 2 que dan false son puro fallback (n=0). El OLS nunca corre en producción. El modelo real es una tabla de segmentos con cap — resultado legítimo, pero hay que saberlo y decidirlo conscientemente.

**Causa raíz:** `listInventoryOffers` puntúa por relevancia léxica, no por cercanía al vehículo del usuario. Para Golf 1.5 TSI 2020/50k, el pool retorna medKm=37.029 y medYr=2023 — tres años por delante del sujeto. El usuario cae en la cola de la distribución. Con tan poca varianza en año y colinealidad fuerte con km, el OLS extrapola y los slopes se vuelven sin sentido (slopeYear=−602 con n=395). El problema no es el solver — es el pool.

**USAGE_DEFAULTS es el modelo, no un fallback.** Los 12 slopes (6 segmentos × slopeKm + slopeYear) se anotaron como "punto de partida a calibrar en Ola 3 contra transacciones reales". Pero como el OLS nunca corre, esos doce números provisionales escritos a mano son el 100% del ajuste de uso de todas las tasaciones actuales. Si Ola 3 se retrasa, eso sigue siendo el motor. Cambia su importancia: de red de seguridad a modelo en producción.

**Los tres guardarraíles del solver tienen cobertura cero en golden tests.** El guardarraíl 2 (signo) disparó una vez en el Golf durante la investigación del drift, pero los otros dos (finitud y magnitud) nunca han ejecutado. Añadir un test unitario directo sobre `solveOLS2x2` con matrices sintéticas: una singular → NaN, una con slopeYear<0 → guardarraíl 2, una con slopeKm<−0.30 → guardarraíl 3. Veinte minutos, cubre lo que los fixtures no pueden.

**Corrección estructural de la frontera de test (2026-07-23):** `getMarketPriceSnapshot` congela `usageImpact` en el snapshot antes de que `run.js` lo lea. Toda la lógica de regresión — `computeUsageImpact`, `solveOLS2x2`, guardarraíles, `USAGE_DEFAULTS`, caps — vive aguas arriba de la frontera. Por tanto: (1) el fix de pivoteo y la estandarización jamás se ejecutaron en run.js; (2) el censo de `usedDefault` "re-confirmado" era comparar un valor consigo mismo; (3) cualquier cambio a inventoryStore.js habría dado 0 DRIFT por construcción, no por ser inocuo. Causa de fondo: en Ola 0 la frontera se puso en buildReportData (función pura del momento); en Ola 1 la regresión se metió en inventoryStore.js aguas arriba sin mover la frontera. La frontera tiene que estar por encima de lo que se está cambiando. Fix: (a) `getMarketPriceSnapshot` almacena `_pool` en el fixture; (b) `run.js` re-ejecuta `computeUsageImpact(_pool, ...)` e inyecta el resultado en national antes de llamar a `buildReportData`. Backward-compatible: fixtures sin `_pool` siguen usando el valor congelado. La cobertura real del módulo de regresión la da `test-solver.js`; run.js lo cubrirá end-to-end tras la recaptura.

**Tests unitarios añadidos (commit 01fca9f, 2026-07-23):** 23 tests en `scripts/golden-tests/test-solver.js` cubriendo: guardarraíles G1/G2/G3, bordes exactos de las desigualdades, umbral n=14 vs n=15, pivoteo parcial (T1c), cap 12% pinado (T5a) y sincronía BRAND_TIERS↔USAGE_DEFAULTS (T6a/T6b). El mismo commit corrige el bug de pivoteo (retorno transpuesto) y exporta `USAGE_DEFAULTS` y `BRAND_TIERS`.

**Census reconfirmado con solver arreglado (2026-07-23):** `run.js` re-ejecuta `computeUsageImpact` sobre el pool capturado en cada fixture — no compara la llamada almacenada, recomputa. 12 PASS 0 DRIFT con el solver corregido = el bug de pivoteo no contaminó la tasa de `usedDefault=true`. Razón geométrica: con variables centradas, `a11 = Σ(km−med)² ≈ n × (20.000)² ≈ 10⁸` frente a `|b| ≈ n × 20.000 × 2 ≈ 10⁴`. Cuatro órdenes de magnitud. El pivoteo es una rama sintéticamente testeable (T1c) pero inalcanzable con datos reales de km/año.

**Typo "alfa romano" → "alfa romeo" (commit 01fca9f): producción-neutral, pero expone un defecto de fondo recurrente.** `getUsageSegment` usa `b.includes(n) || n.includes(b)`. `"alfa romeo".includes("alfa")` → `true` → la entrada bare `"alfa"` ya resolvía a `premium_entry` antes del fix. El typo nunca afectó a ningún coche Alfa Romeo real — nos salvó la laxitud del matching. Confirmado: zero drift en `cascade-alfa-stelvio` (usageImpact=−4680 = cap exacto de premium_entry con medianPrice≈23.400€). **Tercera aparición del mismo defecto de fondo (matching sin resolución exacta):** (1) Lamborghini Huracán sobre pool arbitrario, (2) fail-closed en Ola 1, (3) typo salvado por subcadena accidental. El mismo `check-catalog-alias-gap.js` podría extenderse para detectar colisiones de subcadena entre claves de tier (e.g. si "alfa" es subcadena de "alfa romeo" dentro del mismo segment dict, y la búsqueda es bidireccional, el orden de iteración decide el tier — silencioso).

**Estandarización de predictores implementada (2026-07-23):** antes de llamar a `solveOLS2x2`, `computeUsageImpact` divide cada predictor centrado por su RMS (desviación típica con media cero). Número de condición pasa de ~10⁸ a κ = (1+|r|)/(1−|r|) — crece con colinealidad alta, no con la baja (r=0 → κ=1 óptimo; r=0.95 → κ≈39, todavía manejable). Matemáticamente equivalente — las slopes se descalan después. El pivoteo queda como código muerto en producción (`a_std = n ≥ |b_std| = n·|r|` siempre); T1c lo cubre como test de primitiva. **Consecuencia práctica:** tras estandarizar, el único riesgo numérico que queda es r. Loguear r junto a los slopes en shadow mode — si el pool re-centrado sube la correlación km-año, el condicionamiento empeora y los slopes se vuelven inestables; hay que distinguir eso de un problema de composición.

---

### Cambios planificados, por orden de prioridad

#### 0. Recaptura de fixtures — PENDIENTE (prerequisito para todo lo demás)

Tras la corrección de frontera, los fixtures actuales cubren `buildReportData` pero no el módulo de regresión. La recaptura almacenará `_pool` y moverá la frontera.

**Protocolo:**
1. Correr `capture.js` → nuevos fixtures con `_pool`
2. Correr `capture.js` de nuevo sobre los mismos fixtures → verificar determinismo del pool (el conjunto de ofertas debe ser idéntico entre capturas; el orden da igual)
3. Correr `run.js` → nuevo DRIFT en usageImpact (mezcla: mercado actual + estandarización + fix pivoteo)
4. **NO intentar atribuir el drift** — el pool de las capturas anteriores no existe. Marcar en el commit: "baseline reset, no comparable con la línea base anterior; el pool nunca se almacenó"
5. Tras aceptar: correr `sweep-pool.js` sobre los nuevos fixtures → tabla real de 395+ ofertas por config
6. Elegir config de poolProximity con datos del sweep, no a ojo

**Consecuencia positiva:** a partir de esa recaptura, todos los cambios del módulo de regresión producirán drift legible en run.js.

#### 1. Ponderación del pool por cercanía al vehículo (`listInventoryOffers`)

Añadir factor de proximidad al scoring: `scoreSimilarity = 1 / (1 + |userKm − offerKm| / 20000 + |userYear − offerYear|)`. Combinar con el score léxico actual (producto o suma ponderada). El objetivo es que la mediana del pool refleje vehículos realmente comparables, no solo del mismo modelo.

**Validar con:** antes/después de medKm y medYr para los 12 fixtures. Si medKm/medYr convergen hacia los valores del usuario, el OLS tendrá varianza útil y los slopes pasarán los guardarraíles. Capturar nuevos fixtures solo si la mediana drifta >5%.

**Métricas de éxito:** reducir de 10/10 a <5/10 el `usageUsedDefault=true` en los golden tests. Si baja pero no llega, el umbral n≥15 o los guardarraíles son demasiado estrictos — ajustar secundariamente.

**Protocolo de activación del OLS (obligatorio):** cuando el pool ponderado esté listo, **no activar el OLS directamente**. Ponerlo primero en shadow mode: calcular `slopeKm` y `slopeYear` reales, loggearlos junto al slope de segmento que se está aplicando, y no cambiar el precio. Validar en producción que los slopes reales pasan los guardarraíles y que la diferencia de precio vs. segmento por defecto es plausible. Solo entonces activar. Razonamiento: cuando el OLS empiece a sobrevivir los 12 fixtures driftarán a la vez — el drift más grande del proyecto, causa única. Encender pool + OLS en el mismo paso impide saber cuál causa qué. El patrón shadow-first ya funcionó con el shadow ratio en Ola 1.

#### 2. Decisión explícita sobre el cap del ajuste unificado

**Retrato del modelo actual:** el ajuste por uso es `min(slopeSegmento × (user − median), capSegmento)`. Ni el OLS ni los datos de mercado participan en ningún punto — el modelo completo es una tabla de slopes + una tabla de caps, ambas escritas a mano. El cap es la segunda mitad del modelo real, a la altura de USAGE_DEFAULTS. En dos fixtures el cap está mordiendo con exactitud: Golf −2.673 ≈ 12% de su mediana (cap mainstream exacto), Alfa Stelvio −4.680 = 23.400 × 0.20 (cap premium_entry exacto).

**La decisión del cap debe tomarse DESPUÉS del pool re-centrado, no antes.** Con el pool mal centrado, userKm/userYear caen en la cola de la distribución y el impacto crudo es grande — por eso los caps muerden. Con el pool re-centrado alrededor del sujeto, (userKm − medKm) se encoge y el impacto crudo probablemente quede bajo los caps. Si los caps dejan de morder, la decisión puede desaparecer o simplificarse. Si siguen mordiendo con el pool corregido, la señal es genuina y merece una decisión consciente.

**Opciones a evaluar cuando el pool esté listo:**
- ±12% por variable × 2 = ±24% total — preserva el rango del esquema viejo
- Cap dinámico por segmento (ya existe vía `kmCap`) — escalar a varianza típica del segmento
- Cap fijo 20% para todos — compromiso simple

**Prerequisito:** Prioridad 1 (ponderación del pool) cerrada y en producción.

#### 3. Calibrar el estimador de depreciación

Todos los falsos positivos del shadow ratio son unidireccionales >1 (Porsche Macan 3.29, Abarth 595 2.65). El estimador subestima sistemáticamente. Desde Ola 1, la depreciación es la ruta de 161 marcas sin alias — coches reales que la gente tasa, no exóticos de cola.

Investigar: ¿los refPrice de BRAND_TIERS son precios de venta, no de publicación? ¿La curva de depreciación usa tasas medias del sector en lugar de tasas observadas? Verificar contra precios de mercado actuales para Porsche Macan, Abarth 595 y 2-3 marcas más del tier premium.

#### 4. Cuantificar el alcance del signo invertido (incidente de producción)

Las fórmulas `computeKmImpact` / `computeAgeImpact` tenían el signo económico invertido desde siempre (corregido en e3b9928). Todos los informes emitidos antes de ese commit llevan el ajuste de uso al revés: coches con km alto o más antiguos que su pool, sobrevalorados (~14% en el Golf); coches con km bajo y recientes, infravalorados.

**Tarea:** query sobre logs de `generateSellReport` (o tabla de informes si existe) para contar informes históricos y clasificar por posición del sujeto respecto a la mediana del pool (userKm vs medKm, userYear vs medYear). Producir estimación del sesgo medio y distribución. No es necesariamente una notificación externa, pero la explicación tiene que estar escrita con números antes de que llegue un cliente con un PDF de hace tres meses.

#### 5. Hypercar → valoración manual

Para el tier hypercar (Koenigsegg, Pagani, Bugatti…) y luxury con n<3, sustituir el precio calculado (789.393€ para un Jesko real de ~3M€) por mensaje explícito: _"Mercado insuficiente para tasación automática. Se requiere valoración manual."_ El número con cuatro cifras significativas sin datos es peor producto que la ausencia de número.

#### 6. Nota de trazabilidad: nlow-maserati sin baseline anterior

El fixture `nlow-maserati-ghibli` nació en Ola 1 (reemplazó a `nlow-lincoln`, que fail-closea). No existe comparación antes/después para la rama n_low. Si en el futuro se observa drift en ese fixture, no hay referencia previa — el primer valor capturado es la línea base.

---

### Cambios de cascade e IA (sin prioridad de regresión, pero en esta ola)

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
