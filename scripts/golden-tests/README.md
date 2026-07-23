# Golden Tests — Motor de Tasación

Red de seguridad para el motor de cálculo de precios (`buildReportData`).
Congela el output del modelo en un momento dado y detecta cualquier drift de cálculo en cambios futuros.

## Uso rápido

```bash
# 1. Capturar la línea base (requiere .env.local con conexión a BD)
node scripts/golden-tests/capture.js

# 2. Verificar que todos pasan (hermético, sin BD ni Gemini)
node scripts/golden-tests/run.js

# 3. Commitear los fixtures como línea base
git add scripts/golden-tests/fixtures/
git commit -m "chore: golden tests — línea base Ola 0"
```

## Qué se protege

| Campo | Qué detecta si cambia |
|-------|----------------------|
| `priceOptimal/Low/High` | Cualquier cambio en la cifra final |
| `confidence` | Cambios en el scoring de confianza |
| `comparables` | Cambios en los filtros de búsqueda |
| `usedFallback` | Un vehículo que cambia de rama (mercado→depreciación o viceversa) |
| `damageFactor` | Cambios en la tabla de daños hardcoded |
| `kmImpact / ageImpact` | Cambios en las regresiones univariadas |
| `colorAdjFactor / ownerAdjFactor` | Cambios en los factores de ajuste |
| `cascadeRelaxed` | Qué filtros se relajaron para llegar al sample |

## Ramas de cobertura (las 5 deben estar presentes)

| Rama | Descripción |
|------|-------------|
| `common` | ≥40 comparables, cascade sin relajar |
| `cascade_relaxed` | cascade relajó ≥1 filtro (potencia, transmisión, combustible o año) |
| `damage` | `damageLevel` declarado → damageFactor < 1.00 |
| `n_low` | 3-14 comparables — regresión no fiable, usa slope por defecto |
| `fallback` | <3 comparables — usa depreciación estándar, no mercado real |

## Limitación importante — ruta Gemini

`run.js` llama a `buildReportData` con `damageFactor=null`, lo que activa
la **tabla hardcoded** (`getDamageFactor`), no Gemini.

Esto es intencional: Gemini es no determinista y `run.js` debe ser hermético.

Consecuencia: **run.js detecta cambios en la tabla de daños, no en Gemini.**
Cuando Ola 2 cambie Gemini a categorías discretas, los golden tests no lo detectarán.
La validación de Gemini se hace aparte comparando manualmente el factor congelado
(p.ej. 0.91 para "moderado") contra lo que la nueva categoría mapee.

## Hermeticidad

`run.js` no abre la BD, no llama a Gemini, no lee el reloj del sistema.
- La **fecha** se congela en `fixture.referenceDate` al capturar y se reinyecta en cada ejecución. Cambiar la fecha del sistema no rompe los tests.
- Los **datos de mercado** se congelan en `fixture.national`. Los tests miden la lógica de cálculo, no el mercado.

## Actualizar la línea base (cambio intencional)

1. Aplica el cambio de cálculo
2. Corre `run.js` — verás los campos que driftan y sus valores
3. Si el drift es el esperado: `node scripts/golden-tests/capture.js` para actualizar
4. Commitea los fixtures junto al cambio con una frase explicando qué y por qué cambió

Si el drift es inesperado: revisa el cambio antes de capturar.
