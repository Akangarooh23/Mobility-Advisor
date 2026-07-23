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

const { buildReportData } = require("../../lib/sellReportGenerator");

const VEHICLES_FILE = path.join(__dirname, "vehicles.json");
const FIXTURES_DIR  = path.join(__dirname, "fixtures");

const PRICE_TOLERANCE = 1; // €, margen por redondeo de enteros

function pickKeyFields(rd, national) {
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
    const actual         = pickKeyFields(
      buildReportData(fixture.vehicle, fixture.national, null, referenceDate),
      fixture.national,
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
