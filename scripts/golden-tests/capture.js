/**
 * Golden test capture — congela el estado actual del motor de tasación.
 *
 * Para cada vehículo en vehicles.json:
 *   1. Llama getMarketPriceSnapshot (query real a la BD)
 *   2. Llama buildReportData con ese snapshot + fecha fija (sin Gemini)
 *   3. Guarda fixtures/{id}.json con { vehicle, national, referenceDate, expected }
 *
 * NOTA — damageFactor:
 *   buildReportData se llama con damageFactor=null, lo que activa la tabla
 *   hardcoded (getDamageFactor → 0.91 para "moderado", siempre). Esto mantiene
 *   run.js hermético. Los casos de rama "damage" prueban la ruta por-tabla, no
 *   la ruta Gemini. La ruta Gemini se validará aparte en Ola 2.
 *   Si cambias la tabla en Ola 1, run.js lo detectará. Si cambias Gemini en Ola 2,
 *   run.js NO lo detectará — eso es intencional.
 *
 * Uso:
 *   node scripts/golden-tests/capture.js
 *   node scripts/golden-tests/capture.js --id common-vw-golf   # solo uno
 *
 * Los fixtures se commitean como línea base. Para actualizar tras un cambio
 * intencional de cálculo, vuelve a ejecutar y commitea la diff con justificación.
 */

require("dotenv").config({ path: ".env.local" });

const fs   = require("fs");
const path = require("path");

const { getMarketPriceSnapshot } = require("../../lib/inventoryStore");
const { buildReportData }        = require("../../lib/sellReportGenerator");

const VEHICLES_FILE = path.join(__dirname, "vehicles.json");
const FIXTURES_DIR  = path.join(__dirname, "fixtures");

const KEY_FIELDS = [
  "priceOptimal", "priceLow", "priceHigh",
  "confidence", "comparables", "usedFallback",
  "damageFactor", "usageImpact", "usageUsedDefault",
];
// confidence is deliberately included: the unresolved_brand bug shows n≈400 with
// confidence 88% — the most visible signal of the failure mode.
// usageImpact replaces kmImpact + ageImpact (joint OLS from Ola 1 onwards).

function pickKeyFields(rd, national) {
  const out = {};
  for (const k of KEY_FIELDS) out[k] = rd[k] ?? null;
  out.colorAdjFactor  = rd.colorAdj?.factor  ?? null;
  out.colorAdjPct     = rd.colorAdj?.pct     ?? null;
  out.ownerAdjFactor  = rd.ownerAdj?.factor  ?? null;
  out.ownerAdjPct     = rd.ownerAdj?.pct     ?? null;
  out.combinedFactor  = (rd.colorAdj?.factor ?? 1) * (rd.ownerAdj?.factor ?? 1);
  // Path assertions — what filters were relaxed to reach this sample
  out.cascadeRelaxed  = national.cascadeRelaxed ?? { power: false, transmission: false, fuel: false, year: false };
  return out;
}

function branchFromResult(rd, national, entry) {
  // "damage" branch is validated by damageFactor < 1.00, not by market path
  // A damage vehicle can land in any market branch
  if (entry.branch === "damage") {
    return rd.damageFactor < 1.00 ? "damage" : "damage_factor_wrong";
  }
  // "unresolved_brand" documents the bug: brand not in aliases →
  // arbitrary pool → high n + high confidence on garbage data.
  // Branch always passes to allow freezing the broken baseline.
  // After the fix: this fixture will DRIFT from n≈400 confidence≈88% to n=0 confidence≈35%.
  if (entry.branch === "unresolved_brand") return "unresolved_brand";
  if (rd.usedFallback || rd.comparables < 3)     return "fallback";
  if (rd.comparables < 15)                        return "n_low";
  const cr = national.cascadeRelaxed || {};
  if (cr.power || cr.transmission || cr.fuel || cr.year) return "cascade_relaxed";
  return "common";
}

async function captureOne(entry) {
  const { id, vehicle } = entry;

  // Fixtures sintéticos tienen _pool fijo por construcción — no se recapturan.
  const fixturePath0 = path.join(FIXTURES_DIR, `${id}.json`);
  if (fs.existsSync(fixturePath0)) {
    const existing = JSON.parse(fs.readFileSync(fixturePath0, 'utf8'));
    if (existing._synthetic) {
      console.log(`  ⏭  ${id.padEnd(28)} — sintético, skip (regenera con generate-synthetic-nlow.js)`);
      return;
    }
  }

  const baseOptions = {
    desiredType:  "compra",
    brand:        String(vehicle.brand        || ""),
    model:        String(vehicle.model        || ""),
    version:      String(vehicle.version      || ""),
    fuel:         String(vehicle.fuel         || ""),
    transmission: String(vehicle.transmission || ""),
    year:         vehicle.year    ? Number(vehicle.year)    : null,
    mileage:      vehicle.mileage ? Number(vehicle.mileage) : null,
    powerCv:      vehicle.powerCv ? Number(vehicle.powerCv) : null,
  };

  const national       = await getMarketPriceSnapshot(baseOptions);
  const referenceDate  = new Date();
  const reportData     = buildReportData(vehicle, national, null, referenceDate);

  const fixture = {
    _capturedAt:   referenceDate.toISOString(),
    _branch:       entry.branch,
    _actualBranch: branchFromResult(reportData, national, entry),
    vehicle,
    national,
    referenceDate: referenceDate.toISOString(),   // reinyectada en run.js
    expected:      { ...pickKeyFields(reportData, national), actualBranch: branchFromResult(reportData, national, entry) },
  };

  if (!fs.existsSync(FIXTURES_DIR)) fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.writeFileSync(path.join(FIXTURES_DIR, `${id}.json`), JSON.stringify(fixture, null, 2));

  const branchOk = fixture._branch === fixture._actualBranch || fixture._branch === "cascade_relaxed" && fixture._actualBranch === "cascade_relaxed";
  const branchWarn = !branchOk
    ? `  ⚠  rama esperada="${fixture._branch}", real="${fixture._actualBranch}" — ajusta el vehículo`
    : "";

  const cr = national.cascadeRelaxed || {};
  const relaxedList = Object.entries(cr).filter(([, v]) => v).map(([k]) => k).join(",") || "–";
  console.log(`  ✓ ${id.padEnd(28)} n=${reportData.comparables} fallback=${reportData.usedFallback} dmg=${reportData.damageFactor.toFixed(2)} cascade=[${relaxedList}] price=${reportData.priceOptimal}${branchWarn}`);
}

async function main() {
  const singleId = process.argv.find((a, i) => process.argv[i - 1] === "--id");
  const { vehicles } = JSON.parse(fs.readFileSync(VEHICLES_FILE, "utf8"));
  const targets = singleId ? vehicles.filter((v) => v.id === singleId) : vehicles;

  if (!targets.length) {
    console.error(`No se encontró vehículo con id="${singleId}"`);
    process.exit(1);
  }

  console.log(`\nCapturando ${targets.length} fixture(s)...\n`);

  const branchCoverage = new Set();
  for (const entry of targets) {
    try {
      await captureOne(entry);
      branchCoverage.add(entry.branch);
    } catch (err) {
      console.error(`  ✗ ${entry.id}: ${err.message}`);
    }
  }

  const REQUIRED_BRANCHES = ["common", "cascade_relaxed", "damage", "n_low", "fallback", "unresolved_brand"];
  const missing = REQUIRED_BRANCHES.filter((b) => !branchCoverage.has(b));
  if (missing.length) {
    console.warn(`\n⚠  Ramas sin cobertura: ${missing.join(", ")}`);
    console.warn("   Añade vehículos a vehicles.json hasta cubrir las 6 ramas.\n");
  } else {
    console.log("\n✓ Las 6 ramas están cubiertas.\n");
  }

  console.log("Verificación manual recomendada antes del commit:");
  console.log("  1. Comprueba que los 2 fixtures de rama 'damage' muestran damageFactor < 1.00");
  console.log("  2. Comprueba que los 2 de 'cascade_relaxed' tienen cascade != [–]");
  console.log("  3. Corre run.js +30 días (o edita referenceDate) para confirmar que no hay drift de fecha\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
