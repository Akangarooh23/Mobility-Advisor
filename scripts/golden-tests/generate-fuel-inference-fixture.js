'use strict';
/**
 * Genera un fixture sintético que ejercita el path de inferFuelFromVersion.
 *
 * El golden test actual (run.js) re-ejecuta computeUsageImpact sobre _pool, pero
 * _pool ya está filtrado — la inferencia nunca se ejecuta. Este fixture usa _preFilterPool:
 * run.js aplica el filtro JS (incluyendo inferFuelFromVersion) antes del balance step,
 * y el resultado queda cubierto por la red de regresión.
 *
 * Escenario: Golf Gasolina 2020, 50k km. Pool mezclado:
 *   - 15 ofertas fuel="Gasolina" explícito → pasan
 *   - 6  ofertas fuel="" + version TSI       → inferida gasolina → pasan
 *   - 4  ofertas fuel="" + version TDI       → inferida diesel   → excluidas
 *   - 3  ofertas fuel="" + sin token         → null, sin dato=pasa → pasan
 *   - 2  ofertas fuel="Diesel" explícito     → excluidas
 *
 * Pool pre-filter: 30 ofertas. Tras filtro: 15+6+3 = 24 ofertas.
 *
 * Si inferFuelFromVersion regresa (TDI no detectado), las 4 TDI unlabeled pasan,
 * el pool crece, el precio/usageImpact/comparables cambia → DRIFT detectado.
 *
 * Uso: node scripts/golden-tests/generate-fuel-inference-fixture.js
 */

const fs   = require('fs');
const path = require('path');

const { computeUsageImpact } = require('../../lib/inventoryStore');
const { buildReportData }    = require('../../lib/sellReportGenerator');
const { selectBalancedPool } = require('../../lib/poolProximity');
const { inferFuelFromVersion } = require('../../lib/inferFuelFromVersion');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TARGET_ID    = 'infer-fuel-vw-golf-gasolina';

function normalizeToken(v) {
  return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ── Pool sintético pre-filtro ─────────────────────────────────────────────────
// Los precios son realistas para Golf gasolina 2020 en el mercado ES.
// year, mileage y price con variación deliberada para que el balance y usageImpact
// sean no triviales (evitar CV≈0 y medKm=userKm exacto por falta de dispersión).
function makeOffer(idx, fuel, version, year, mileage, price) {
  return { _rank: idx, fuel, version, year, mileage, price,
           brand: 'Volkswagen', model: 'Golf', portal: 'test', listingType: 'dealer' };
}

let idx = 0;
const preFilterPool = [
  // ── 15 labeled Gasolina → pasan
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 Life',       2022, 18000, 26500),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 130 Advance',    2022, 24000, 24900),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 110 Trendline',  2021, 30000, 21800),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 Style',      2021, 35000, 23400),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 115 Comfortline',2021, 40000, 20900),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 Highline',   2020, 45000, 22100),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 110 Business',   2020, 52000, 19800),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 R-Line',     2020, 55000, 23800),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 130 Life DSG',   2020, 60000, 21500),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 115 Trendline',  2020, 68000, 18900),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 Advance',    2019, 72000, 19200),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 110 Comfortline',2019, 80000, 17400),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 Highline',   2019, 85000, 18600),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 115 Life',       2018, 95000, 15800),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 130 Style',      2018,102000, 16500),

  // ── 6 unlabeled fuel="" + version TSI → inferred gasolina → pasan
  makeOffer(idx++, '',         '1.0 TSI 110 Trendline',  2022, 22000, 23500),
  makeOffer(idx++, '',         '1.5 TSI 150 Life DSG',   2021, 38000, 22700),
  makeOffer(idx++, '',         '1.5 TSI 150 Advance',    2021, 42000, 21900),
  makeOffer(idx++, '',         '1.0 TSI 115 Comfortline',2020, 58000, 19600),
  makeOffer(idx++, '',         '1.5 TSI 130 Life',       2020, 63000, 20800),
  makeOffer(idx++, '',         '1.5 TSI 150 Style',      2019, 78000, 18100),

  // ── 4 unlabeled fuel="" + version TDI → inferred diesel → excluidas
  makeOffer(idx++, '',         '2.0 TDI 150 Life',       2021, 41000, 24100),
  makeOffer(idx++, '',         '2.0 TDI 115 Trendline',  2020, 56000, 21300),
  makeOffer(idx++, '',         '2.0 TDI 150 Highline',   2020, 65000, 22900),
  makeOffer(idx++, '',         '1.6 TDI 115 Business',   2019, 90000, 18700),

  // ── 3 unlabeled fuel="" + sin token → null, sin dato=pasa → pasan
  makeOffer(idx++, '',         'Comfortline 1.6',         2021, 33000, 21000),
  makeOffer(idx++, '',         'Golf Variant Advance',    2020, 57000, 19900),
  makeOffer(idx++, '',         '115 CV Highline',         2019, 88000, 17200),

  // ── 2 labeled Diesel → excluidas
  makeOffer(idx++, 'Diesel',   '2.0 TDI 150 Life',       2021, 39000, 24300),
  makeOffer(idx++, 'Diesel',   '2.0 TDI 115 Trendline',  2020, 62000, 21100),
];

// ── Aplicar filtro (igual que run.js y listInventoryOffers) ──────────────────
const vehicleFuel    = 'Gasolina';
const normalizedFuel = normalizeToken(vehicleFuel);
const filteredPool   = preFilterPool.filter(offer => {
  const offerFuelToken =
    normalizeToken(offer.fuel) ||
    ((normalizedFuel === 'gasolina' || normalizedFuel === 'diesel')
      ? inferFuelFromVersion(offer.version)
      : null);
  return !(offerFuelToken && !offerFuelToken.includes(normalizedFuel));
});

const expectedPassCount = 15 + 6 + 3;  // labeled-gas + inferred-gas + no-token
if (filteredPool.length !== expectedPassCount) {
  console.error(`ERROR: pool filtrado tiene ${filteredPool.length} ofertas, esperado ${expectedPassCount}`);
  console.error('Revisa los patrones de inferFuelFromVersion o la composición del pool');
  // Print which offers didn't behave as expected
  preFilterPool.forEach(o => {
    const tok = normalizeToken(o.fuel) || ((normalizedFuel === 'gasolina' || normalizedFuel === 'diesel') ? inferFuelFromVersion(o.version) : null);
    const passes = !(tok && !tok.includes(normalizedFuel));
    console.error(`  ${passes ? 'PASS' : 'EXCL'} fuel="${o.fuel}" version="${o.version}" → tok=${tok}`);
  });
  process.exit(1);
}
console.log(`Pool pre-filtro: ${preFilterPool.length} ofertas → tras filtro: ${filteredPool.length} (esperado ${expectedPassCount}) ✓`);

// ── Balance + usageImpact ────────────────────────────────────────────────────
const vehicle      = { brand: 'Volkswagen', model: 'Golf', version: '1.5 TSI 150', year: 2020,
                       mileage: 50000, fuel: vehicleFuel, transmission: 'Manual', powerCv: 150 };
const medianPrice  = filteredPool.map(o => o.price).sort((a,b) => a-b)[Math.floor(filteredPool.length/2)];

const candidates = filteredPool
  .filter(o => o.mileage >= 500 && Number.isFinite(o.year) && o.year > 0 && Number.isFinite(o.price) && o.price > 0)
  .sort((a, b) => (a._rank ?? 0) - (b._rank ?? 0));

const { pool: balancedPool } = selectBalancedPool(
  candidates,
  { km: vehicle.mileage, year: vehicle.year },
  { balance: true, kmKey: 'mileage', yearKey: 'year' }
);

const { usageImpact, usedDefault: usageUsedDefault, slopeKm, slopeYear } =
  computeUsageImpact(balancedPool, vehicle.mileage, vehicle.year, medianPrice, 'price', vehicle.brand);

// ── national sintético ───────────────────────────────────────────────────────
const national = {
  source:         'synthetic',
  totalUniverse:  filteredPool.length,
  comparables:    filteredPool.length,
  rawComparables: filteredPool.length,
  cascadeRelaxed: { power: false, transmission: false, fuel: false, year: false },
  _preFilterPool: preFilterPool,   // raw pool — run.js aplica el filtro aquí
  _pool:          null,            // intencionalmente null: se deriva de _preFilterPool en run.js
  market: {
    mean:               Math.round(filteredPool.reduce((s,o) => s+o.price, 0) / filteredPool.length),
    median:             medianPrice,
    p25:                filteredPool.map(o => o.price).sort((a,b) => a-b)[Math.floor(filteredPool.length*0.25)],
    p75:                filteredPool.map(o => o.price).sort((a,b) => a-b)[Math.floor(filteredPool.length*0.75)],
    daysOnMarketMedian: null,
    updatedAt:          '',
    cv:                 0,
    usageImpact,
    usageUsedDefault,
    slopeKm,
    slopeYear,
    rawUsageImpact:     null,
    usageMedianKm:      null,
    usageMedianYr:      null,
    priceTrend:         null,
    absorptionRate:     null,
    privateMedian:      null,
    privateP25:         null,
    privateP75:         null,
    privateCount:       0,
    dealerMedian:       medianPrice,
    dealerP25:          null,
    dealerP75:          null,
    dealerCount:        filteredPool.length,
  },
  byPortal: [],
};

// ── buildReportData ──────────────────────────────────────────────────────────
const referenceDate = new Date('2026-07-24T00:00:00.000Z');
const rd = buildReportData(vehicle, national, null, referenceDate);

const cr = national.cascadeRelaxed;
function branchOf(r) {
  if (r.usedFallback || (r.comparables ?? 0) < 3) return 'fallback';
  if ((r.comparables ?? 0) < 15)                   return 'n_low';
  if (cr.power || cr.transmission || cr.fuel || cr.year) return 'cascade_relaxed';
  return 'common';
}
const actualBranch = branchOf(rd);

const expected = {
  priceOptimal:     rd.priceOptimal     ?? null,
  priceLow:         rd.priceLow         ?? null,
  priceHigh:        rd.priceHigh        ?? null,
  confidence:       rd.confidence       ?? null,
  comparables:      rd.comparables      ?? null,
  usedFallback:     rd.usedFallback     ?? null,
  damageFactor:     rd.damageFactor     ?? null,
  usageImpact:      rd.usageImpact      ?? null,
  usageUsedDefault: rd.usageUsedDefault ?? null,
  colorAdjFactor:   rd.colorAdj?.factor ?? null,
  colorAdjPct:      rd.colorAdj?.pct    ?? null,
  ownerAdjFactor:   rd.ownerAdj?.factor ?? null,
  ownerAdjPct:      rd.ownerAdj?.pct    ?? null,
  combinedFactor:   (rd.colorAdj?.factor ?? 1) * (rd.ownerAdj?.factor ?? 1),
  cascadeRelaxed:   cr,
  actualBranch,
};

const fixture = {
  _capturedAt:    referenceDate.toISOString(),
  _synthetic:     true,
  _syntheticNote: [
    `Pool sintético con ${preFilterPool.length} ofertas mezcladas (gas etiquetado, TDI unlabeled, TSI unlabeled, sin token).`,
    `Tras filtro §1g_combustible.2: ${filteredPool.length} pasan (${expectedPassCount} esperados).`,
    'Testa el path inferFuelFromVersion via _preFilterPool — run.js aplica el filtro antes del balance.',
    'NO se recaptura con capture.js (_synthetic: true → skipped).',
    'Para regenerar: node scripts/golden-tests/generate-fuel-inference-fixture.js',
  ].join(' '),
  _branch:        actualBranch,
  _actualBranch:  actualBranch,
  vehicle,
  national,
  referenceDate:  referenceDate.toISOString(),
  expected,
};

if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
fs.writeFileSync(path.join(FIXTURES_DIR, `${TARGET_ID}.json`), JSON.stringify(fixture, null, 2));

console.log(`\n✓ Fixture escrito: scripts/golden-tests/fixtures/${TARGET_ID}.json`);
console.log(`  actualBranch: ${actualBranch}`);
console.log(`  comparables: ${rd.comparables}  priceOptimal: ${rd.priceOptimal}  confidence: ${rd.confidence}`);
console.log(`  usageImpact: ${rd.usageImpact}  usageUsedDefault: ${rd.usageUsedDefault}`);
console.log(`\n  Excluidas por inferencia: 4 TDI unlabeled + 2 Diesel labeled = 6`);
console.log(`  Pasan: ${filteredPool.length} (${expectedPassCount} esperados)`);
console.log(`\nVerifica con: node scripts/golden-tests/run.js --id ${TARGET_ID}`);
