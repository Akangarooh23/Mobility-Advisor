'use strict';
/**
 * Genera un fixture sintético que ejercita isFuelCompatible para sujeto "gas" (GNC/GLP).
 *
 * El bug "gas ⊂ gasolina" se manifestaba en dos direcciones bajo el código viejo:
 *
 *   A) Gasolina contaminando pool GNC:
 *      'gasolina'.includes('gas') = true → ofertas gasolina pasaban para sujeto 'gas' (BUG)
 *
 *   B) GNC excluido de pool GNC:
 *      'gnc'.includes('gas') = false → ofertas GNC eran excluidas del propio pool gas (BUG INVERSO)
 *
 * Bajo el código nuevo con FUEL_COMPAT['gas'] = ['gas', 'gnc', 'glp']:
 *   A) Gasolina → isFuelCompatible('gasolina', 'gas') = false → EXCLUIDA ✓
 *   B) GNC     → isFuelCompatible('gnc', 'gas') = true  → PASA ✓
 *
 * Composición del pool (30 ofertas):
 *   - 15 fuel='Gas'      → pasan (bajo ambos)
 *   - 6  fuel='GNC'      → pasan (nuevo) / excluidas (viejo) ← bug inverso demostrado
 *   - 4  fuel='Gasolina' → excluidas (nuevo) / pasaban (viejo) ← bug A demostrado
 *   - 3  fuel=''         → sin dato = pasa (bajo ambos)
 *   - 2  fuel='Diesel'   → excluidas (bajo ambos)
 *
 * Bajo código nuevo: 15 + 6 + 3 = 24 pasan.
 * Si isFuelCompatible regresa (bug): 15 + 4 + 3 = 22 pasan (GNC pierde, Gasolina gana) → DRIFT.
 *
 * Uso: node scripts/golden-tests/generate-gas-compat-fixture.js
 */

const fs   = require('fs');
const path = require('path');

const { computeUsageImpact }     = require('../../lib/inventoryStore');
const { buildReportData }        = require('../../lib/sellReportGenerator');
const { selectBalancedPool }     = require('../../lib/poolProximity');
const { inferFuelFromVersion, isFuelCompatible } = require('../../lib/inferFuelFromVersion');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TARGET_ID    = 'bug-gas-seat-leon-gnc';

function normalizeToken(v) {
  return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function makeOffer(idx, fuel, version, year, mileage, price) {
  return { _rank: idx, fuel, version, year, mileage, price,
           brand: 'Seat', model: 'Leon', portal: 'test', listingType: 'dealer' };
}

let idx = 0;
const preFilterPool = [
  // ── 15 fuel='Gas' → pasan bajo ambas versiones del código
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 Style',       2022, 18000, 22500),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 Advance',     2022, 24000, 21200),
  makeOffer(idx++, 'Gas', 'Leon 1.4 TGI GNC 110 Reference',   2021, 30000, 19800),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 FR',          2021, 35000, 21000),
  makeOffer(idx++, 'Gas', 'Leon 1.4 TGI GNC 110 Style',       2021, 40000, 18900),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 Xcellence',   2020, 45000, 20100),
  makeOffer(idx++, 'Gas', 'Leon 1.4 TGI GNC 110 Advance',     2020, 52000, 17800),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 Style',       2020, 55000, 20800),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 FR',          2020, 60000, 19500),
  makeOffer(idx++, 'Gas', 'Leon 1.4 TGI GNC 110 Reference',   2020, 68000, 17000),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 Advance',     2019, 72000, 17800),
  makeOffer(idx++, 'Gas', 'Leon 1.4 TGI GNC 110 Style',       2019, 80000, 15900),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 Xcellence',   2019, 85000, 17200),
  makeOffer(idx++, 'Gas', 'Leon 1.4 TGI GNC 110 Advance',     2018, 95000, 14800),
  makeOffer(idx++, 'Gas', 'Leon 1.5 TGI GNC 130 FR',          2018,102000, 15600),

  // ── 6 fuel='GNC' → pasan bajo código nuevo; bajo viejo eran excluidas ('gnc'.includes('gas')=false)
  makeOffer(idx++, 'GNC', 'Leon 1.5 TGI 130 Style GNC',       2022, 22000, 21800),
  makeOffer(idx++, 'GNC', 'Leon 1.5 TGI 130 FR GNC',          2021, 38000, 19900),
  makeOffer(idx++, 'GNC', 'Leon 1.4 TGI 110 GNC Reference',   2021, 42000, 18500),
  makeOffer(idx++, 'GNC', 'Leon 1.5 TGI 130 Advance GNC',     2020, 58000, 18200),
  makeOffer(idx++, 'GNC', 'Leon 1.5 TGI 130 Xcellence GNC',   2020, 63000, 19000),
  makeOffer(idx++, 'GNC', 'Leon 1.4 TGI 110 Style GNC',       2019, 78000, 15400),

  // ── 4 fuel='Gasolina' → excluidas bajo código nuevo; bajo viejo pasaban ('gasolina'.includes('gas')=true)
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 FR',              2021, 41000, 24100),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 110 Style',           2020, 56000, 20800),
  makeOffer(idx++, 'Gasolina', '1.5 TSI 150 Xcellence',       2020, 65000, 22900),
  makeOffer(idx++, 'Gasolina', '1.0 TSI 115 Advance',         2019, 90000, 17500),

  // ── 3 fuel='' → sin dato = pasa bajo ambas versiones
  makeOffer(idx++, '', 'Leon 1.5 GNC Advance 130',            2021, 33000, 20200),
  makeOffer(idx++, '', 'Leon TGI 1.5 Style',                  2020, 57000, 18700),
  makeOffer(idx++, '', 'Leon 115 CV GNC Reference',           2019, 88000, 15800),

  // ── 2 fuel='Diesel' → excluidas bajo ambas versiones
  makeOffer(idx++, 'Diesel', '2.0 TDI 150 FR',               2021, 39000, 24300),
  makeOffer(idx++, 'Diesel', '1.6 TDI 115 Advance',          2020, 62000, 19100),
];

// ── Aplicar filtro (igual que run.js y listInventoryOffers) ──────────────────
const vehicleFuel    = 'Gas';
const normalizedFuel = normalizeToken(vehicleFuel);
const filteredPool   = preFilterPool.filter(offer => {
  const offerFuelToken =
    normalizeToken(offer.fuel) ||
    ((normalizedFuel === 'gasolina' || normalizedFuel === 'diesel')
      ? inferFuelFromVersion(offer.version)
      : null);
  return !(offerFuelToken && !isFuelCompatible(offerFuelToken, normalizedFuel));
});

const expectedPassCount = 15 + 6 + 3;  // Gas + GNC + sin dato
if (filteredPool.length !== expectedPassCount) {
  console.error(`ERROR: pool filtrado tiene ${filteredPool.length} ofertas, esperado ${expectedPassCount}`);
  preFilterPool.forEach(o => {
    const tok = normalizeToken(o.fuel) || ((normalizedFuel === 'gasolina' || normalizedFuel === 'diesel') ? inferFuelFromVersion(o.version) : null);
    const compat = tok ? isFuelCompatible(tok, normalizedFuel) : true;
    const passes = !(tok && !compat);
    console.error(`  ${passes ? 'PASS' : 'EXCL'} fuel="${o.fuel}" → tok=${tok} compat=${compat}`);
  });
  process.exit(1);
}
console.log(`Pool pre-filtro: ${preFilterPool.length} → tras filtro: ${filteredPool.length} (esperado ${expectedPassCount}) ✓`);
console.log(`  Breakdown: 15 Gas + 6 GNC + 3 sin-dato = ${expectedPassCount}`);
console.log(`  Excluidas: 4 Gasolina (bug A) + 2 Diesel = 6`);
console.log(`  Bug B verificado: GNC pasan (viejo las excluía porque 'gnc'.includes('gas')=false)`);

// ── Balance + usageImpact ────────────────────────────────────────────────────
const vehicle     = { brand: 'Seat', model: 'Leon', version: '1.5 TGI GNC 130', year: 2020,
                      mileage: 50000, fuel: vehicleFuel, transmission: 'Manual', powerCv: 130 };
const medianPrice = filteredPool.map(o => o.price).sort((a, b) => a - b)[Math.floor(filteredPool.length / 2)];

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
  _preFilterPool: preFilterPool,
  _pool:          null,
  market: {
    mean:               Math.round(filteredPool.reduce((s, o) => s + o.price, 0) / filteredPool.length),
    median:             medianPrice,
    p25:                filteredPool.map(o => o.price).sort((a, b) => a - b)[Math.floor(filteredPool.length * 0.25)],
    p75:                filteredPool.map(o => o.price).sort((a, b) => a - b)[Math.floor(filteredPool.length * 0.75)],
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
    `Pool sintético ${preFilterPool.length} ofertas: 15 Gas + 6 GNC + 4 Gasolina (excluidas) + 3 sin-dato + 2 Diesel (excluidas).`,
    `Demuestra el bug "gas ⊂ gasolina" en ambas direcciones:`,
    `  A) 4 ofertas Gasolina que pasaban bajo viejo código ('gasolina'.includes('gas')=true) → excluidas con isFuelCompatible.`,
    `  B) 6 ofertas GNC que eran excluidas bajo viejo código ('gnc'.includes('gas')=false) → pasan con FUEL_COMPAT[gas]=[gas,gnc,glp].`,
    `DRIFT al regresar: comparables cambia de 24 a 22 (GNC pierde, Gasolina gana).`,
    'Para regenerar: node scripts/golden-tests/generate-gas-compat-fixture.js',
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
console.log(`\nVerifica con: node scripts/golden-tests/run.js --id ${TARGET_ID}`);
