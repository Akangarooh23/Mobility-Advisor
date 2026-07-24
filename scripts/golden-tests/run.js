/**
 * Golden test runner — compara la salida actual del motor contra los fixtures.
 *
 * Hermeticidad: no abre BD, no llama a Gemini, no lee el reloj del sistema.
 *   - La fecha se lee del fixture (congelada en capture.js) y se reinyecta.
 *   - damageFactor=null → tabla hardcoded (determinista). Ver nota en capture.js.
 *   - cascadeRelaxed viene del national congelado, no se re-computa.
 *
 * Uso:
 *   node scripts/golden-tests/run.js
 *   node scripts/golden-tests/run.js --id common-vw-golf
 *
 * Salida: EXIT 1 si hay DRIFT o MISSING (útil para CI).
 */

const fs   = require("fs");
const path = require("path");

const { buildReportData }    = require("../../lib/sellReportGenerator");
const { computeUsageImpact } = require("../../lib/inventoryStore");
const { selectBalancedPool } = require("../../lib/poolProximity");
const { inferFuelFromVersion } = require("../../lib/inferFuelFromVersion");

// Inline normalizeToken (mirrors inventoryStore — kept local to avoid importing the full module).
function normalizeToken(v) {
  return String(v || '').replace(/\s+/g, ' ').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Applies the §1g_combustible.2 subject-conditional fuel filter.
// Used when a fixture has _preFilterPool to exercise the inferFuelFromVersion path.
function applyFuelFilter(preFilterPool, vehicleFuel) {
  const normalizedFuel = normalizeToken(vehicleFuel);
  if (!normalizedFuel) return preFilterPool;
  return preFilterPool.filter(offer => {
    const offerFuelToken =
      normalizeToken(offer.fuel) ||
      ((normalizedFuel === 'gasolina' || normalizedFuel === 'diesel')
        ? inferFuelFromVersion(offer.version)
        : null);
    return !(offerFuelToken && !offerFuelToken.includes(normalizedFuel));
  });
}

const VEHICLES_FILE = path.join(__dirname, "vehicles.json");
const FIXTURES_DIR  = path.join(__dirname, "fixtures");

const PRICE_TOLERANCE = 1; // €, margen por redondeo de enteros

function pickKeyFields(rd, national, entryBranch) {
  // Replica branchFromResult de capture.js (necesita entryBranch para damage/unresolved_brand).
  const cr = national.cascadeRelaxed || {};
  const actualBranch =
    entryBranch === "damage"           ? (rd.damageFactor < 1.00 ? "damage" : "damage_factor_wrong") :
    entryBranch === "unresolved_brand" ? "unresolved_brand" :
    (rd.usedFallback || (rd.comparables ?? 0) < 3) ? "fallback" :
    (rd.comparables ?? 0) < 15                      ? "n_low" :
    (cr.power || cr.transmission || cr.fuel || cr.year) ? "cascade_relaxed" :
    "common";

  return {
    priceOptimal:     rd.priceOptimal       ?? null,
    priceLow:         rd.priceLow           ?? null,
    priceHigh:        rd.priceHigh          ?? null,
    confidence:       rd.confidence         ?? null,
    comparables:      rd.comparables        ?? null,
    usedFallback:     rd.usedFallback       ?? null,
    damageFactor:     rd.damageFactor       ?? null,
    usageImpact:      rd.usageImpact        ?? null,
    usageUsedDefault: rd.usageUsedDefault   ?? null,
    colorAdjFactor:   rd.colorAdj?.factor   ?? null,
    colorAdjPct:      rd.colorAdj?.pct      ?? null,
    ownerAdjFactor:   rd.ownerAdj?.factor   ?? null,
    ownerAdjPct:      rd.ownerAdj?.pct      ?? null,
    combinedFactor:   (rd.colorAdj?.factor ?? 1) * (rd.ownerAdj?.factor ?? 1),
    cascadeRelaxed:   national.cascadeRelaxed ?? { power: false, transmission: false, fuel: false, year: false },
    actualBranch,
  };
}

const PRICE_KEYS = new Set(["priceOptimal", "priceLow", "priceHigh", "usageImpact"]);

function compare(id, expected, actual) {
  const drifts = [];
  for (const key of Object.keys(expected)) {
    const exp = expected[key];
    const act = actual[key] ?? null;

    // Deep compare for objects (cascadeRelaxed)
    if (typeof exp === "object" && exp !== null) {
      if (JSON.stringify(exp) !== JSON.stringify(act)) {
        drifts.push({ key, expected: exp, actual: act });
      }
      continue;
    }

    if (exp === act) continue;
    if (PRICE_KEYS.has(key) && typeof exp === "number" && typeof act === "number") {
      if (Math.abs(exp - act) <= PRICE_TOLERANCE) continue;
    }
    drifts.push({ key, expected: exp, actual: act });
  }
  return drifts;
}

function main() {
  const singleId = process.argv.find((a, i) => process.argv[i - 1] === "--id");
  const { vehicles } = JSON.parse(fs.readFileSync(VEHICLES_FILE, "utf8"));
  const targets = singleId ? vehicles.filter((v) => v.id === singleId) : vehicles;

  if (!targets.length) {
    console.error(`No se encontró vehículo con id="${singleId}"`);
    process.exit(1);
  }

  let passed = 0, failed = 0, missing = 0;
  console.log(`\nGolden tests — ${targets.length} vehículo(s)\n`);

  for (const entry of targets) {
    const fixturePath = path.join(FIXTURES_DIR, `${entry.id}.json`);
    if (!fs.existsSync(fixturePath)) {
      console.log(`  MISSING  ${entry.id} — ejecuta capture.js primero`);
      missing++;
      continue;
    }

    const fixture        = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const referenceDate  = new Date(fixture.referenceDate);   // fecha congelada, no now()

    // Frontera de test: re-ejecutar computeUsageImpact desde el pool almacenado.
    // Sin _pool (fixtures pre-Ola-2): se lee el valor congelado (comportamiento anterior).
    // Con _pool: la frontera sube a inventoryStore — el módulo de regresión ya está cubierto.
    // Con _preFilterPool: la frontera sube a inferFuelFromVersion — ejercita el path de inferencia.
    let national = fixture.national;
    if (Array.isArray(national._preFilterPool) && national._preFilterPool.length > 0) {
      const filteredPool = applyFuelFilter(national._preFilterPool, fixture.vehicle.fuel);
      national = {
        ...national,
        _pool: filteredPool,
        comparables:    filteredPool.length,
        rawComparables: filteredPool.length,
      };
    }
    if (Array.isArray(national._pool) && national._pool.length > 0) {
      const medianPrice = national.market?.median ?? 0;
      // §1h: reproducir balance por año (idéntico al path de producción).
      // _pool se almacena ordenado por price/mileage/year/_rank para diffs limpios.
      // Restaurar el orden original (_rank = posición en listInventoryOffers score-DESC)
      // antes de selectBalancedPool — useProximity=false hace el orden sensible al input.
      const candidates = national._pool
        .filter((o) => o.mileage >= 500 && Number.isFinite(o.year) && o.year > 0
                      && Number.isFinite(o.price) && o.price > 0)
        .sort((a, b) => (a._rank ?? 0) - (b._rank ?? 0));
      const { pool: replayPool } = selectBalancedPool(
        candidates,
        { km: fixture.vehicle.mileage, year: fixture.vehicle.year },
        { balance: true, kmKey: "mileage", yearKey: "year" }
      );
      const { usageImpact, usedDefault: usageUsedDefault, slopeKm, slopeYear } =
        computeUsageImpact(replayPool, fixture.vehicle.mileage, fixture.vehicle.year,
                           medianPrice, "price", fixture.vehicle.brand);
      national = { ...national, market: { ...national.market, usageImpact, usageUsedDefault, slopeKm, slopeYear } };
    }

    const actual         = pickKeyFields(
      buildReportData(fixture.vehicle, national, null, referenceDate),
      national,
      entry.branch,
    );
    const drifts = compare(entry.id, fixture.expected, actual);

    if (!drifts.length) {
      console.log(`  PASS     ${entry.id}`);
      passed++;
    } else {
      console.log(`  DRIFT    ${entry.id}`);
      for (const d of drifts) {
        const before = JSON.stringify(d.expected);
        const after  = JSON.stringify(d.actual);
        console.log(`             ${d.key.padEnd(20)} ${before.padEnd(14)} → ${after}`);
      }
      failed++;
    }
  }

  console.log(`\n  Resultado: ${passed} PASS, ${failed} DRIFT, ${missing} MISSING\n`);

  if (failed > 0 || missing > 0) {
    console.log("  Si el drift es intencional: ejecuta capture.js para actualizar la línea base.");
    console.log("  Si es inesperado: revisa el cambio de cálculo antes de mergear.\n");
    process.exit(1);
  }
}

main();
