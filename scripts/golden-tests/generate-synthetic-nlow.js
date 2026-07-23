'use strict';
/**
 * Genera un fixture sintético con _pool truncado a 8 ofertas para mantener
 * cobertura permanente de la rama n_low (3 ≤ n < 15).
 *
 * Por qué sintético: un fixture real migra fuera de n_low cuando el mercado
 * gana oferta. La rama que gobierna producción (usageUsedDefault=true → USAGE_DEFAULTS)
 * no puede quedar huérfana en silencio porque un modelo concreto dejó de ser escaso.
 *
 * Cómo se eligen las 8 ofertas:
 *   Se ordena el _pool del fixture fuente por precio y se toma 1 de cada k = floor(n/8).
 *   Esto preserva dispersión real (rango completo de precios, años y km variados)
 *   y evita CV≈0 que dispararía el bonus de confianza +5pp por pool homogéneo.
 *   NO se toman los 8 primeros por _rank: estarían sesgados hacia updated_at reciente.
 *
 * El fixture resultante tiene _synthetic: true → capture.js lo salta en recapturas.
 *
 * Uso:
 *   node scripts/golden-tests/generate-synthetic-nlow.js
 *   node scripts/golden-tests/generate-synthetic-nlow.js --source common-vw-golf --target nlow-synthetic-golf
 *
 * Verificar después:
 *   node scripts/golden-tests/run.js --id <target>   → debe salir PASS
 *   Comprobar que expected.actualBranch === "n_low"
 */

const fs   = require('fs');
const path = require('path');

const { computeUsageImpact } = require('../../lib/inventoryStore');
const { buildReportData }    = require('../../lib/sellReportGenerator');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const N_SYNTHETIC  = 8;  // centro de la banda [3,15], lejos de ambas fronteras

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : null;
}

const sourceId = arg('--source') || 'common-vw-golf';
const targetId = arg('--target') || 'nlow-synthetic-golf';

// ── Cargar fixture fuente ────────────────────────────────────────────────────
const sourcePath = path.join(FIXTURES_DIR, `${sourceId}.json`);
if (!fs.existsSync(sourcePath)) {
  console.error(`Fixture fuente no encontrado: ${sourcePath}`);
  process.exit(1);
}
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const rawPool = source.national?._pool;
if (!Array.isArray(rawPool) || rawPool.length < N_SYNTHETIC * 2) {
  console.error(`Fixture ${sourceId} necesita _pool con al menos ${N_SYNTHETIC * 2} ofertas (tiene ${rawPool?.length ?? 0})`);
  process.exit(1);
}

// ── Seleccionar 8 ofertas con dispersión de precio ───────────────────────────
const sorted = rawPool
  .filter(o => Number.isFinite(o.price) && o.price > 0 && o.mileage >= 500 && Number.isFinite(o.year))
  .sort((a, b) => a.price - b.price);

if (sorted.length < N_SYNTHETIC) {
  console.error(`Pool filtrado insuficiente: ${sorted.length} ofertas válidas`);
  process.exit(1);
}

const k = Math.floor(sorted.length / N_SYNTHETIC);
const syntheticPool = Array.from({ length: N_SYNTHETIC }, (_, i) => ({
  ...sorted[i * k],
  _rank: i,   // orden determinista para el replay en run.js
}));

console.log(`Fuente: ${sourceId} (${rawPool.length} ofertas → pool filtrado ${sorted.length})`);
console.log(`Paso k=${k}, tomando 1 de cada ${k} por precio`);
console.log(`Precios seleccionados: ${syntheticPool.map(o => o.price).join(', ')}`);
console.log(`Años: ${syntheticPool.map(o => o.year).join(', ')}`);

// ── Recomputar usageImpact sobre el pool sintético ───────────────────────────
const medianPrice = source.national.market?.median ?? 0;
const { usageImpact, usedDefault: usageUsedDefault, slopeKm, slopeYear } =
  computeUsageImpact(
    syntheticPool,
    source.vehicle.mileage,
    source.vehicle.year,
    medianPrice,
    'price',
    source.vehicle.brand,
  );

console.log(`\nusageUsedDefault: ${usageUsedDefault} | usageImpact: ${usageImpact}`);
console.log(`slopeKm: ${slopeKm} | slopeYear: ${slopeYear}`);

// ── Construir national sintético ─────────────────────────────────────────────
// comparables y rawComparables deben reflejar el n real del pool sintético para
// que buildReportData calcule el branch correcto (< 15 → n_low).
const syntheticNational = {
  ...source.national,
  comparables:    N_SYNTHETIC,
  rawComparables: N_SYNTHETIC,
  totalUniverse:  N_SYNTHETIC,
  _pool: syntheticPool,
  market: {
    ...source.national.market,
    usageImpact,
    usageUsedDefault,
    slopeKm,
    slopeYear,
  },
};

// ── Calcular expected vía buildReportData ────────────────────────────────────
const referenceDate  = new Date(source.referenceDate);
const reportData     = buildReportData(source.vehicle, syntheticNational, null, referenceDate);

// Replica pickKeyFields + branchFromResult de capture.js
const cr = syntheticNational.cascadeRelaxed || {};
function actualBranchOf(rd) {
  if (rd.usedFallback || (rd.comparables ?? 0) < 3)  return 'fallback';
  if ((rd.comparables ?? 0) < 15)                     return 'n_low';
  if (cr.power || cr.transmission || cr.fuel || cr.year) return 'cascade_relaxed';
  return 'common';
}
const actualBranch = actualBranchOf(reportData);

const expected = {
  priceOptimal:     reportData.priceOptimal     ?? null,
  priceLow:         reportData.priceLow         ?? null,
  priceHigh:        reportData.priceHigh        ?? null,
  confidence:       reportData.confidence       ?? null,
  comparables:      reportData.comparables      ?? null,
  usedFallback:     reportData.usedFallback     ?? null,
  damageFactor:     reportData.damageFactor     ?? null,
  usageImpact:      reportData.usageImpact      ?? null,
  usageUsedDefault: reportData.usageUsedDefault ?? null,
  colorAdjFactor:   reportData.colorAdj?.factor ?? null,
  colorAdjPct:      reportData.colorAdj?.pct    ?? null,
  ownerAdjFactor:   reportData.ownerAdj?.factor ?? null,
  ownerAdjPct:      reportData.ownerAdj?.pct    ?? null,
  combinedFactor:   (reportData.colorAdj?.factor ?? 1) * (reportData.ownerAdj?.factor ?? 1),
  cascadeRelaxed:   syntheticNational.cascadeRelaxed ?? { power: false, transmission: false, fuel: false, year: false },
  actualBranch,
};

// ── Escribir fixture ─────────────────────────────────────────────────────────
const fixture = {
  _capturedAt:    new Date().toISOString(),
  _synthetic:     true,
  _syntheticNote: [
    `Pool truncado a ${N_SYNTHETIC} ofertas (1 de cada ${k} del fixture '${sourceId}' ordenado por precio).`,
    'NO se recaptura con capture.js (_synthetic: true → skipped).',
    'Mantiene cobertura de la rama n_low independientemente del mercado.',
    'Para regenerar: node scripts/golden-tests/generate-synthetic-nlow.js',
  ].join(' '),
  _branch:       'n_low',
  _actualBranch: actualBranch,
  vehicle:       source.vehicle,
  national:      syntheticNational,
  referenceDate: source.referenceDate,
  expected,
};

if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
fs.writeFileSync(path.join(FIXTURES_DIR, `${targetId}.json`), JSON.stringify(fixture, null, 2));

console.log(`\n✓ Fixture escrito: scripts/golden-tests/fixtures/${targetId}.json`);
console.log(`  branch real: ${actualBranch} (esperado: n_low)`);
console.log(`  priceOptimal: ${reportData.priceOptimal}  confidence: ${reportData.confidence}`);
if (actualBranch !== 'n_low') {
  console.warn(`\n⚠  branch='${actualBranch}', no 'n_low'. Ajusta los parámetros del vehículo o el fixture fuente.`);
}
console.log(`\nVerifica con: node scripts/golden-tests/run.js --id ${targetId}`);
