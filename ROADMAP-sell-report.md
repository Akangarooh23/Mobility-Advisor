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
2. **`git add scripts/golden-tests/fixtures/`** — fijar la línea base ahora, antes del segundo capture
3. Correr `capture.js` de nuevo → `git diff` del `_pool` debe ser vacío (o solo ruido de ofertas nuevas/retiradas en las ~horas de diferencia). Si hay diff estructural, el sort determinista o el límite 1500 no es estable — investigar antes de continuar
4. Correr `run.js` → **debe salir 0 DRIFT** (0 PASS, 0 DRIFT, 0 MISSING). Eso ES el test: capture.js almacena en `expected` lo que `computeUsageImpact` calculó en vivo; run.js lo recalcula desde `_pool` y compara. Si coinciden → la frontera es correcta. Si hay DRIFT → **hay un bug en la frontera, no un "baseline reset"**: la recaptura y el re-cálculo deben producir el mismo resultado o la cadena está rota
5. Tras verificar 0 DRIFT: correr `sweep-pool.js` → tabla con 8 filas por fixture (ver más abajo)
6. Leer primero `yrPct` de la fila `mkt-full` (n=1500, sin truncar, sin kernel ni cuota) — esa responde la pregunta del diagnóstico antes de cualquier otra

**Nota sobre determinismo de `_rank` y el scraper:**
`_rank` viene de `updated_at DESC`. Si el scraper está escribiendo entre las dos capturas, algunas ofertas cambian de posición y arrastran a las demás — el diff mostrará cambios de `_rank` aunque el conjunto sea el mismo. Para el chequeo de determinismo: si el conjunto de ofertas es idéntico (mismos precios, mismas urls, misma cantidad) y solo cambian los `_rank` → es escritura concurrente, aceptable. Si aparecen o desaparecen ofertas o cambian precios → es movimiento de mercado real, también aceptable. Lo que señalaría un bug sería que la misma oferta tenga distinto precio en dos capturas consecutivas sin que el scraper haya corrido. Preferiblemente: **correr las dos capturas con el scraper parado** (o fuera de su ventana habitual).

**Fila `mkt-full` — diagnóstico de causa raíz:**

Leer `yrPct` y `yrSpread` / `kmIqr` juntos: un centrado con yrSpread=15-20 años puede venir de coches 2010 en la cola del pool, no de comparables 2018-2022. El percentil se equilibra numéricamente con basura. Centrado con dispersión razonable = mercado sano truncado mal. Centrado con dispersión enorme = el filtro año ±4 deja entrar cosas que no comparan.

Regla de lectura (fijar antes de ver el número):
- `yrPct ≥ 0.40` → el culpable es el corte por recencia (`updated_at DESC LIMIT 400`). Las filas `ker-*` (solo kernel, sin cuota) deberían bastar.
- `yrPct ≤ 0.15` → el mercado tiene más coches recientes que antiguos; la cuota es necesaria. Leer filas `bal` / `k*+bal`.
- `0.15 < yrPct < 0.40` → ambas cosas contribuyen. La decisión la toma la comparación `ker-1.0` vs `bal`: la que más acerque `yrPct` a 0.50 sin hundir `kmIqr`.

Predicción revisada (post hallazgo `updated_at DESC`): menos confianza en "la cuota centra casi todo". Si el sesgo lo produce el truncado por recencia, `ker-*` puede centrar igual de bien con un mecanismo más simple — y sin necesidad de cuota ni parámetro nuevo.

6. Elegir config con datos de la tabla, leyendo `yrPct` + `yrSpread` juntos

**Consecuencia positiva:** a partir de esa recaptura, todos los cambios del módulo de regresión producirán drift legible en run.js.

#### 0.5 — Resultado del sweep + activación de `{alpha:0, balance:true}` (2026-07-23)

**Diagnóstico confirmado:** todos los `mkt-full` con yrPct ≤ 0.12 (corregido con rango medio; antes inflado por empates de año entero). El mercado tiene genuinamente más coches recientes que antiguos — el LIMIT no era el culpable. `ker-*` solos no mueven yrPct significativamente (Golf: 0.12→0.13); la cuota mueve 3-5× más (Golf: 0.12→0.35, Clio: 0.04→0.37, León: 0.14→0.46). `alpha` no añade nada sobre la cuota. Decisión: `{alpha:0, balance:true}`.

**Hallazgo de producción — filtro km estructural (no solo métrica):** `maxMileage: userKm` en `listInventoryOffers` garantiza que ninguna oferta del pool supera los km del sujeto. Consecuencia directa: `slopeKm × (userKm − medKm)` es siempre negativo (el guardarraíl 2 fuerza `slopeKm < 0`, y `medKm < userKm` por el filtro). El modelo no tiene forma de dar prima por km bajo — un coche bien conservado siempre recibe penalización.

Segundo efecto: el pool excluye los coches con muchos km (los baratos), infla la mediana y sube la base. Base inflada + término km que siempre resta = dos errores opuestos con cancelación parcial de magnitud variable. No es ruido limpio: en un coche el sesgo domina, en otro la penalización.

Interacción con `balance:true`: la cuota trae coches más antiguos del pool, pero el filtro solo deja pasar los que tienen ≤ userKm — coches viejos con km anormalmente bajo para su edad. Esto aplana o invierte la relación natural km-año dentro del pool (normalmente más viejo → más km; aquí los viejos son forzosamente de pocos km). Candidato probable al `slopeYear = −602` de Ola 1: un pool donde los coches antiguos son los mejor conservados no produce la pendiente esperable.

**Criterio de aceptación para balance=true:** correr censo de `usageUsedDefault` tras la activación. Si sigue en 12/12 true, la cuota centró el año pero el truncado km sigue bloqueando el OLS. Si algún fixture pasa a false, el pool empieza a producir fits válidos y el shadow del OLS tiene sentido.

**Asimetría residual esperada:** `bal` deja yrPct en 0.35-0.46, no en 0.50 — escasez de oferta antigua (la cuota toma `min(take, smaller × maxImbalance)` y no puede repartir lo que no existe). Vigilar `r` y `kappa` al activar.

**Giro de arquitectura — alpha recupera señal tras eliminar truncado km (2026-07-23):** La decisión `{alpha:0}` fue correcta en su contexto: el sweep se corrió con `maxMileage: userKm` activo. Con ese filtro, todos los dkm del kernel caían del mismo lado (≤ userKm) y eran pequeños — el kernel solo penalizaba distancia en año, y la cuota ya centraba el año. Alpha no tenía nada que aportar.

Al eliminar el truncado (8ab1c69, `Math.max(400_000, 3 × userKm)`), la dimensión km recupera rango real: la correlación natural km-año (más viejo → más km) reaparece con `r = −0.587` para Golf. El kernel pasa a operar en 2D con señal real. Nuevo sweep (c36ebe5) sobre el pool post-fix:

| label    | kmPct | yrPct |      r | kappa |
|----------|-------|-------|--------|-------|
| prod     |  0.19 |  0.43 | −0.587 |   3.8 |
| bal      |  0.16 |  0.50 | −0.529 |   3.2 |
| k0.5+bal |  0.18 |  0.50 | −0.031 |   1.1 |

`k0.5+bal` colapsa la correlación km-año a prácticamente cero (kappa 1.1). La cuota centra el año; el kernel selecciona 2D y rompe la colinealidad que desestabiliza el OLS. La decisión anterior `{alpha:0}` no era un error — era la correcta sobre el pool con el filtro km. La nueva decisión `{alpha:0.5}` es la correcta sobre el pool sin ese filtro.

**Cuadrantes — descartados (c36ebe5, 2026-07-23):** El cuadrante `old_lo` (older AND low-km respecto al sujeto) es estructuralmente vacío en todos los fixtures: Golf=32, Clio=7, Alfa=3, Macan=0, Abarth=0. Los coches más viejos que el sujeto casi siempre tienen más km — la correlación km-año es real, no un artefacto del pool. Ningún esquema de cuota 2D puede balancear en km sin quedarse sin oferta en ese cuadrante. En Abarth, la cuota 2D produce `kmPct=0.04` (peor que producción). Arquitectura descartada. El kernel opera en 2D de forma continua y sin cuadrantes vacíos.

**Forward: alpha=0.5 en su propio commit — ver § 1d.**

#### 1. Activar `{alpha:0, balance:true}` en POOL_CONFIG — ACTIVADO 2026-07-23

**Estado:** activo. Ver criterio de aceptación arriba.

#### 1b. Eliminar truncado de km — ACTIVADO 2026-07-23 (8ab1c69 + commits adyacentes)

**Fix aplicado:** `maxMileage: userKm` → `Math.max(400_000, 3 * mileage)`. Cota de saneamiento pura: excluye outliers extremos sin sesgar el pool hacia km inferiores al sujeto.

**Efectos observados:**
- `r` recupera el valor natural: Golf `−0.587` (con el pool truncado la correlación era artificial — los coches del pool tenían km ≤ userKm forzado → era candidato al `slopeYear=−602` de Ola 1)
- κ = (1+|r|)/(1−|r|) = 3.8 para Golf — medible, controlable, mejorable con kernel (§ 1d)
- OLS desbloqueado en Maserati: primer fit exitoso en producción (`slopeKm=−0.265 €/km, slopeYear=+2417 €/año`), aunque con n apenas encima de 15 — el régimen menos fiable
- `medKm` cruza por encima de `userKm` en todos los casos (balance trae coches más viejos, que en general tienen más km) → `kmPct` pasa de 1.00 a 0.19-0.34; el término km puede dar prima por primera vez
- `usageUsedDefault` semántica corregida: `null` = sin datos de mercado; `false` = OLS exitoso; `true` = USAGE_DEFAULTS aplicados
- `_actualBranch` en KEY_FIELDS (160f5b0): migraciones de rama emergen como DRIFT en run.js

**Reconciliación precio (2026-07-23):** identidad `priceOptimal = round((base + usageImpact) × effectiveFactor)` cierra a 0€ en los 9 fixtures con datos de mercado. La lectura de 8ab1c69 es sólida.

#### 1c. Fixture n_low real + sintético — CERRADA

**Estado:** 14 PASS, 0 DRIFT, 0 MISSING. Dos fixtures:

- `nlow-lexus-nx-hibrido` (real, n=7, cascade=[power,transmission]). Lexus NX 300h Híbrido 2019/80k km. Mercado cerrado: cambio de generación en 2022, la gen anterior no puede crecer hacia n=15. Cubre también la rama cascade (cuando entre §1e, driftará por penalización de confianza). Riesgo en el lado bajo: si cae por debajo de 3 → migra a fallback; el sintético ya cubre ese caso.
- `nlow-synthetic-golf` (sintético, _synthetic:true, 8 ofertas 8.200-22.690€, años 2016-2024). Pool truncado de `common-vw-golf` — 1 oferta por cuartil de precio para preservar dispersión real y evitar CV≈0 (que activaría el bonus +5pp). `capture.js` lo salta en recapturas; regenerar con `generate-synthetic-nlow.js`. N fijo por construcción.

**Candidatos descartados:** Mitsubishi ASX (n_raw=11 pero n_efectivo=397 — el filtro de año±4 expone el modelo completo 2010-2023), DS7 Crossback (n=19, sobre el umbral de n_low), CUPRA León Híbrido (n=375 — el cascade fusiona todo el León). Lección: `n_raw` de la query `GROUP BY marca+modelo+combustible+transmisión` es mal predictor de `n_efectivo` porque no reproduce el cascade (año±4, relajación progresiva, fusión de grupos). Siempre verificar con `capture.js --id`.

**Nota sobre la investigación de candidatos:** el intento de capturar BMW X2 Híbrido como candidato adicional reveló una anomalía de arquitectura (6→386) que documenta §1g.

#### 1d. Activar `alpha=0.5` en POOL_CONFIG — PENDIENTE (después de §1h)

**Prerrequisito:** §1c cerrada ✓. **Y §1h** — activar alpha antes de corregir la incoherencia base/referencia mide el efecto de alpha sobre una base incorrecta. Con la incoherencia, alpha cambia medYr del pool balanceado pero la base sigue siendo el mercado sin balancear; el drift en run.js refleja el cambio de penalización, no el cambio de precio de referencia. Después de §1h, alpha y base son coherentes y el drift es legible.

**Cambio de producción:** `{ alpha: 0, balance: true }` → `{ alpha: 0.5, balance: true }`. Modifica la selección del pool → afecta mediana, medKm, medYr, P25/P75 y usageImpact. Es un cambio de cálculo con drift esperado en la mayoría de fixtures, en su propio commit.

**Protocolo (obligatorio, mismo esquema que balance=true):**
1. Predicción escrita antes de correr: para Golf, kappa debe bajar de 3.2 (bal) a ~1.1 (k0.5+bal); kmPct ≈ 0.18; priceOptimal debería moverse poco si usageImpact se mueve en dirección correcta
2. `run.js` → leer drift real vs predicción; justificar cualquier desviación
3. Census de `usageUsedDefault`: si algún fixture pasa de `true` a `false`, el kernel desbloqueó el OLS — documentar cuál y por qué
4. Commit con bloque "drift aceptado" + lectura de `r` y `kappa` post-activación

**Por qué en commit propio:** alpha=0.5 modifica producción. Mezclarlo con cualquier otro cambio impide atribuir el drift. La separación no es ceremonial — es el mecanismo de diagnóstico.

#### 1e. Penalización de confianza por profundidad de cascade — DOBLEMENTE BLOQUEADA

**BLOQUEADA por §1g Y por §1h (año):**
- `cascadeRelaxed.fuel=true` nunca puede activarse mientras fuel no sea filtro duro (§1g)
- `cascadeRelaxed.year=true` nunca puede activarse mientras año±4 no sea filtro duro — el Nivel 5 del cascade (`targetYear: null`) solo elimina el +2 de score por año cercano, no baja n de 0 a algo. Si Nivel 5 se dispara, ya era porque n=0, no porque relajar año añadió comparables.
- Implementar §1e ahora añadiría dos ramas muertas de cuatro.

**Orden de desbloqueo:** §1h (incoherencia base/referencia) → §1g (filtro de combustible) → entonces §1e tiene señal real en fuel. La relajación de año±4 como filtro duro queda pendiente de decisión separada en §1g.

**Fix propuesto (post §1g + §1h):** en `buildReportData`, restar a `confidence` antes de fijar el tramo:
- `−5 pp` por relajación en `power`
- `−5 pp` por relajación en `transmission`
- `−8 pp` por relajación en `year` (pendiente de que año sea filtro duro)
- `−15 pp` por relajación en `fuel` (provisional; subirlo a 20pp en primera validación)
- Cap: `confidence` no puede bajar del umbral del tramo inferior por esta causa sola

**Cobertura (post §1g):** las dos `cascade-*` fixtures driftarán (power+transmission → −10 pp). Sin cambio de BD.

**Prerequisito:** §1h cerrada + §1g cerrada (filtro de combustible activo) + run.js verde.

#### 1g. Filtros duros vs blandos en `listInventoryOffers` — PENDIENTE

**Origen del hallazgo:** BMW X2 Híbrido da n=386 con `cascadeRelaxed={fuel:false}`. El cascade no relajó fuel — no pudo hacerlo porque fuel nunca fue filtro. Esto disparó la auditoría de todos los filtros del Level 1.

---

**Auditoría completa — 5 filtros del Level 1 en `getMarketPriceSnapshot`:**

`readPostgresInventory` (línea 514) aplica un único filtro SQL: `WHERE CONCAT(brand, model, version) LIKE '%token%'`. Fuel, transmission, año y powerCv no están en el WHERE. Todo el filtrado real ocurre en JS dentro de `listInventoryOffers`.

| Filtro | Línea | Tipo | "Sin dato" en oferta | Diagnóstico |
|--------|-------|------|----------------------|-------------|
| Marca (`brand`) | 1241 | **DURO** | = falla (vacío excluido) | Correcto |
| Transmisión | 1244 | **DURO** | = falla (vacío excluido) | Correcto |
| Potencia ±25% | 1335-1339 | **DURO** | = pasa (null/vacío incluido) | Diseño intencional |
| Combustible | 1355 | **BLANDO** (solo +2 score) | N/A — nunca excluye | **BUG** |
| Año ±4 (`targetYear`) | 1364-1370 | **BLANDO** (solo +2 score) | N/A — nunca excluye | **BUG** (menor) |
| Modelo | 1380 | BLANDO efectivo | N/A | Aceptable (respaldado por SQL pre-filtro + brand duro) |

Nota sobre `selectBalancedPool`: se llama **dentro de `computeUsageImpact`** (para el OLS), no sobre las estadísticas de mercado. La mediana, P25/P75 e histograma se calculan sobre `computeOffers = offers.slice(0, 400)` sin balancear. La cuota de año y el kernel solo afectan al ajuste de uso (usageImpact), no al precio de referencia del mercado.

---

**BUG principal — combustible (severidad: alta):**

Las diferencias estructurales entre combustibles del mismo modelo son 1.500-3.000€ (gasolina/diésel) y 3.000-8.000€ (híbrido/gasolina). Todas las tasaciones hasta hoy con `fuel` especificado se han calculado sobre pools que mezclan combustibles. El informe muestra n=386 con confianza alta y precio como si fueran comparables homogéneos — no avisa de nada.

`cascadeRelaxed.fuel=false` es técnicamente exacto ("el cascade no relajó fuel") pero engañoso ("el filtro estaba activo"). No estaba activo. El cascade Nivel 3 (`!offers.length && fuel`) tenía condición de cero resultados porque asumía que fuel sí filtraba. Con el fix, esa condición tendrá sentido por primera vez.

**BUG secundario — año ±4 (`targetYear`, severidad: baja):**

El año ±4 influye en el ranking (coches del año correcto puntúan más → más probables entre los top-400), pero no excluye. Un BMW X2 de 2010 en una búsqueda de 2019 pasa a través de todos los niveles del cascade sin obstáculo. El cascade Nivel 5 ("relax year", `targetYear: null`) nunca cambió nada: solo elimina el +2 de score por año cercano, lo que es irrelevante si el cascade ya lleva a n=386 desde el Nivel 1.

Severidad menor porque: (a) el scoring sí sesga el ranking hacia el año correcto, y el `slice(0, 400)` recoge los mejor puntuados; (b) `selectBalancedPool` dentro de OLS centra el año adicionalmente; (c) el mercado de coches usados tiene correlación natural precio-año, así que incluso sin filtro de año la señal existe en la mediana.

---

**Impacto sistémico (los tres defectos de la misma familia):**

Este es el tercer defecto sistemático en pool contaminado con apariencia de muestra abundante:
1. Signo invertido (Ola 1): ajuste de uso al revés — coche con km alto recibía prima
2. `maxMileage: userKm` (§1b): pool excluía coches con más km que el sujeto → mediana inflada
3. Fuel sin filtrar (§1g): pool mezcla combustibles → mediana incoherente por tipo

Los tres tenían en común que `run.js` no los detectaba: en los dos primeros porque los fixtures congelaban el resultado incorrecto; en el tercero porque el fix es aguas arriba de `_pool` → **run.js dará 0 DRIFT engañoso después del fix.** La evidencia solo aparece en el `git diff` de los fixtures tras recapturar.

---

**Distinción crítica en "sin dato = pasa":**

Hay dos lados del filtro que no son el mismo problema:
- **Lado sujeto** (el vehículo que se tasa): si el usuario no declara combustible, no podemos filtrar. "Sin dato = pasa" es inevitable aquí.
- **Lado oferta** (las ofertas del pool): una oferta con `fuel=""` es un comparable de combustible desconocido. "Sin dato = pasa" aquí introduce elementos no homogéneos en un pool que existe para ser homogéneo.

Para BMW X2 Híbrido: 6 ofertas con `fuel='Híbrido'` explícito + 506 con `fuel=""` (probablemente gasolina/diésel sin etiquetar). Incluir las 506 contamina el pool tanto como no filtrar por combustible.

---

**Opción intermedia — inferencia de combustible desde texto de versión:**

Antes de decidir entre "incluir empty-fuel" y "excluir empty-fuel", una opción más barata: inferir el combustible de la columna `version` cuando `fuel=""`:

```
TDI, HDi, dCi, CDTi, BlueHDi, Blue dCi         → Diesel
TSI, TFSI, THP, GTI, GTe (sin PHEV), Turbo      → Gasolina
PHEV, e-TSI, Plug-in, 300h, 450h, Hybrid, HEV   → Híbrido
BEV, EV, e-tron, i3, ID., ZOE, Leaf             → Eléctrico
```

Si el 30% de filas tiene `fuel=""`, la inferencia puede recuperar la mayoría y evitar elegir entre contaminación y pool famélico. Si el huecos es <5%, excluir y listo.

**Protocolo de decisión:**
1. Auditar `fuel=""` por portal: `SELECT portal, COUNT(*) FILTER (WHERE COALESCE(fuel,'')=''), COUNT(*) FROM moveadvisor_market_offers WHERE is_active GROUP BY portal`
2. Si huecos > 15%: implementar inferencia de combustible antes del fix de filtrado
3. Si huecos ≤ 15%: excluir `fuel=""` del pool (filtro estricto, sin "sin dato = pasa")

---

**Predicción del impacto al activar filtro de combustible:**

- Pools de modelos con datos buenos de combustible: n se divide aproximadamente en 2 (parque gasolina/diésel ~50/50 en España). Varios casos migran `common → n_low` o `n_low → fallback`.
- Pools con datos pobres (tipo BMW X2): n cae drásticamente solo si se excluye `fuel=""`.
- El cascade se disparará en producción por primera vez (hasta ahora Level 1 siempre devolvía n abundante artificialmente).
- `cascadeRelaxed.fuel=true` aparecerá en logs reales → §1e puede implementarse con señal real.

**Commit propio obligatorio. Predicción escrita antes de correr. Recapturar todos los fixtures después.**

---

**Fix propuesto — post-filtro en `getMarketPriceSnapshot`:**

No tocar `listInventoryOffers` (el comportamiento blando es correcto para la Comprar-page). Aplicar filtro duro de combustible dentro de `getMarketPriceSnapshot` tras cada llamada al cascade, antes de evaluar si n es suficiente para avanzar:

```js
// Solo aplica cuando hay fuel declarado en el sujeto.
// Excluye ofertas con combustible explícito distinto; incluye o no las de fuel="" según auditoría.
const nFuelToken = normalizeFilterToken(fuel);
offers = nFuelToken
  ? offers.filter(o => {
      const of = normalizeToken(o.fuel || '');
      return !of || of.includes(nFuelToken);  // sin dato = pasa (revisar tras auditoría)
    })
  : offers;
```

**Prerequisito:** auditoría de cobertura del campo `fuel` por portal (SQL arriba) antes de decidir si `!of` incluye o excluye. Sin esa cifra el fix puede partir pools en dos o dejarlos casi igual.

**Prioridad: alta.** Bloquea §1e y es el tercer defecto sistemático de pool contaminado.

#### 1h. Incoherencia base/referencia: pool balanceado ≠ pool de mercado — PENDIENTE (PRIORIDAD 1)

**Hallazgo (2026-07-23):** `priceOptimal = round((base + usageImpact) × effectiveFactor)`. `base` y `usageImpact` provienen de pools distintos. La inconsistencia sesga sistemáticamente hacia arriba todas las tasaciones de vehículos más antiguos que la mediana del mercado — que es casi cualquier sujeto real.

**Evidencia en código:**
- `marketMedian` (línea 1507): `percentile(prices, 0.5)` donde `prices` viene de `computeOffers = offers.slice(0, 400)` — pool sin balancear, dominado por `updated_at DESC` (coches más recientes)
- `marketMedian` se pasa como parámetro a `computeUsageImpact` (línea 1534)
- Dentro de `computeUsageImpact` (líneas 968-974): `selectBalancedPool(candidates, ...)` → `pairs` → `medianKm`/`medianYear` del pool balanceado
- `usageImpact = slopeKm × (userKm − medianKm) + slopeYear × (userYear − medianYear)` usa `medianKm`/`medianYear` del pool balanceado

`base` describe el mercado 2023. El punto de referencia del ajuste describe el pool 2021. Son preguntas distintas respondidas con datos distintos.

**Aritmética con el Golf (slopeYear≈600 €/año, medianYear pool sin bal.≈2023, medianYear bal.≈2021, userYear=2020):**
- Con la incoherencia actual: `usageImpact = 600 × (2020 − 2021) = −600€`. Base=22.390€ (mercado 2023)
- Ajuste correcto para bajar de 2023 a 2020: `600 × (2020 − 2023) = −1.800€`
- El modelo corrige un tercio de lo que debería. `priceOptimal` ≈ 21.790€ en vez de ≈ 20.590€. Error ~1.200€ en este caso.

**Evidencia directa en los datos del sweep:** al activar `balance:true`, todos los precios subieron — Golf +358€, Clio +2.021€, Alfa +2.650€, León +2.227€. La interpretación correcta: `balance:true` tiró `medianYear` del pool balanceado de ~2025 hacia ~2021, lo que redujo la penalización de año a cero (userYear≈medianYear), pero dejó `base` intacta en el mercado sin balancear. El precio subió porque desapareció la penalización sin que bajara la base. No es que el balanceo mejorara el precio — es que el modelo no puede mejorar y empeorar al mismo tiempo desde pools distintos.

**Dirección del sesgo:** cualquier vehículo más antiguo que la mediana del mercado sin balancear (que con el sesgo de recencia de `updated_at DESC` es casi todo sujeto real) recibe un `usageImpact` que corrige solo parcialmente la diferencia entre el mercado reciente y el año del sujeto. Sobrevalora sistemáticamente.

---

**Dos arquitecturas coherentes (hay que elegir una):**

**Opción A — Balanceado para precio, sin balancear para mercado:** medianPrice, P25/P75, medKm, medYr del pool balanceado (los valores que alimentan `priceOptimal`). Las cifras descriptivas del informe — byPortal, daysOnMarket, absorptionRate, histograma de precios, split particular/profesional — se quedan en el pool sin balancear. El pool balanceado responde «¿cuánto vale este coche?»; el pool de mercado responde «¿cómo es el mercado?». Mezclarlos en el histograma mostraría al cliente un mercado con representación forzada de coches antiguos que no verá si entra en Coches.net. `usageImpact` pasa a ser un ajuste fino residual dentro del pool balanceado — pequeño por construcción (medKm≈userKm, medYr≈userYear). Más robusto: no depende de pendientes sin calibrar.

**Opción B — Todo sin balancear:** base, P25/P75, medKm, medYr del pool sin balancear (mercado completo). `usageImpact` hace toda la corrección hedónica. Depende enteramente de que las pendientes sean correctas — hoy son doce números sin calibración.

**Recomendación: Opción A.** No depende de parámetros sin calibrar.

---

**Consecuencias de Opción A sobre los slopes — dos efectos distintos:**

**Término de año → colapsa (no sobrecorrige):** la cuota centra `medianYear` hacia `userYear` por construcción. `(userYear − medianYear) ≈ 0` → el término de año prácticamente desaparece. El slope no se aplica de más — deja de aplicarse. USAGE_DEFAULTS para año pierde relevancia por obsolescencia, no por error.

**Término de km → prima sistemática al alza:** la cuota equilibra solo el eje de año. Con kmPct en 0,19-0,34, el sujeto queda sistemáticamente por debajo de la mediana de km del pool balanceado (el pool importa coches más antiguos que, en general, tienen más km). `(userKm − medKm) < 0` → `slopeKm × negativo = prima`. Y esa prima se suma a una base que ya incorpora esos coches más rodados. Doble contabilidad: la base baja por incluirlos **y** el término de km sube por compararse contra su mediana de km. Bajo la arquitectura mixta anterior, esto era «varianza de extrapolación»; bajo Opción A es **sesgo sistemático al alza**.

Este sesgo de km es el argumento más fuerte para §1d (alpha=0.5). La cuota ya resuelve el eje de año; la contribución marginal del kernel es sobre el eje km, que es el que queda descentrado. Sin alpha, Opción A introduce prima sistemática. Alpha no es un refinamiento opcional — con Opción A activa, pasa a ser parte del arreglo.

---

**Implementación (Opción A):**

Mover `selectBalancedPool` fuera de `computeUsageImpact` y ejecutarlo en `getMarketPriceSnapshot` sobre `computeOffers`. Calcular `marketMedian`, `p25`, `p75`, `cv` del pool **balanceado** solamente — el resto de estadísticas (byPortal, daysOnMarket, absorptionRate, histograma) siguen sobre `computeOffers`. Pasar el pool balanceado a `computeUsageImpact` (que deja de llamar a `selectBalancedPool` internamente).

```
// getMarketPriceSnapshot — después de computeOffers = offers.slice(0, 400)
const computeCandidates = computeOffers.filter(o => o.mileage >= 500 && o.year > 0 && Number.isFinite(o[priceField]) && o[priceField] > 0);
const { pool: balancedOffers } = selectBalancedPool(
  computeCandidates, { km: mileage, year },
  { ...POOL_CONFIG, kmKey: 'mileage', yearKey: 'year' }
);

// Precio de referencia: del pool balanceado
const balancedPrices = removeOutliers(balancedOffers.map(o => o[priceField]).filter(...).sort(...));
const marketMedian = percentile(balancedPrices, 0.5);
const p25 = percentile(balancedPrices, 0.25);
const p75 = percentile(balancedPrices, 0.75);

// Estadísticas de mercado (descriptivas): del pool sin balancear
// byPortal, daysValues, absorptionRate, priceHistogram: siguen sobre computeOffers
// priceTrend: sigue sobre computeOffers

// computeUsageImpact recibe el pool balanceado; internamente ya no llama selectBalancedPool
const { usageImpact, ... } = computeUsageImpact(balancedOffers, mileage, year, marketMedian, ...);
```

**Alternativa mínima (Opción B):** computar `medianKm`/`medianYear` en `computeUsageImpact` desde el pool de entrada (sin `selectBalancedPool` interno), de forma que base y referencia vengan del mismo pool sin balancear. Coherente, pero depende de pendientes calibradas.

---

**Relación con §1g y §1d:**
- §1g (filtro de combustible): después de §1h. Con §1h, la reducción de pool que causará §1g es visible en base y referencia de forma coherente.
- §1d (alpha=0.5): después de §1h y necesario bajo Opción A — sin centrar km, Opción A introduce prima sistemática. Alpha es parte del fix.
- Orden correcto: **§1h → §1g → §1d → §1f → §1e**

**0 DRIFT engañoso:** el fix es aguas arriba de `_pool`. Run.js dará 0 DRIFT. Evidencia solo en `git diff` de fixtures tras recaptura.

**Radio del cambio:** alto. Afecta `base`, `priceLow`, `priceHigh`, `cv`, `usageImpact` y por tanto `priceOptimal` en todas las tasaciones con mercado. Commit propio. Predicción escrita antes de correr. Recapturar todos los fixtures.

#### 2. Ponderación del pool por cercanía al vehículo (`listInventoryOffers`)

Añadir factor de proximidad al scoring: `scoreSimilarity = 1 / (1 + |userKm − offerKm| / 20000 + |userYear − offerYear|)`. Combinar con el score léxico actual (producto o suma ponderada). El objetivo es que la mediana del pool refleje vehículos realmente comparables, no solo del mismo modelo.

**Validar con:** antes/después de medKm y medYr para los 12 fixtures. Si medKm/medYr convergen hacia los valores del usuario, el OLS tendrá varianza útil y los slopes pasarán los guardarraíles. Capturar nuevos fixtures solo si la mediana drifta >5%.

**Métricas de éxito:** reducir de 10/10 a <5/10 el `usageUsedDefault=true` en los golden tests. Si baja pero no llega, el umbral n≥15 o los guardarraíles son demasiado estrictos — ajustar secundariamente.

**Protocolo de activación del OLS (obligatorio):** cuando el pool ponderado esté listo, **no activar el OLS directamente**. Ponerlo primero en shadow mode: calcular `slopeKm` y `slopeYear` reales, loggearlos junto al slope de segmento que se está aplicando, y no cambiar el precio. Validar en producción que los slopes reales pasan los guardarraíles y que la diferencia de precio vs. segmento por defecto es plausible. Solo entonces activar. Razonamiento: cuando el OLS empiece a sobrevivir los 12 fixtures driftarán a la vez — el drift más grande del proyecto, causa única. Encender pool + OLS en el mismo paso impide saber cuál causa qué. El patrón shadow-first ya funcionó con el shadow ratio en Ola 1.

#### 1f. Decisión del cap del ajuste unificado — PENDIENTE

**Por qué tiene identificador propio:** el cap es la segunda mitad del modelo real, a la misma altura de USAGE_DEFAULTS. Sin identificador se cae de la lista con cada reordenación — ya ha pasado dos veces.

**Retrato del modelo actual:** el ajuste por uso es `min(slopeSegmento × (user − median), capSegmento)`. Ni el OLS ni los datos de mercado participan. El cap actual es 12% para mainstream — heredado de la era con dos caps separados (km 12% + edad 10% ≈ 22% combinados), colapsado a la mitad sin decisión explícita. En dos fixtures el cap muerde con exactitud: Golf −2.673 ≈ 12% de su mediana (cap mainstream exacto), Alfa Stelvio −4.680 = 23.400 × 0.20 (cap premium_entry exacto).

**La decisión debe tomarse después del pool re-centrado con alpha=0.5.** Con el pool mal centrado, (userKm − medKm) es grande y el cap muerde. Con el pool re-centrado, el término se encoge y puede que el cap deje de morder — en ese caso la decisión se simplifica o desaparece. Si sigue mordiendo, la señal es genuina y merece una decisión consciente.

**Opciones a evaluar:**
- 12% actual — mantener, documentar que es herencia
- ±12% por variable × 2 = ±24% total — preserva el rango del esquema original
- Cap dinámico por segmento (ya existe vía `kmCap`) — escalar a varianza típica
- Cap fijo 20% para todos — compromiso simple

**Prerequisito:** § 1d (alpha=0.5 activado y pool re-centrado).

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
