/**
 * Gate ola3a — verifica strip de cierre + borde inverso de B (km alto, sin frase de ventaja).
 *
 * Genera un PDF sin llamar a Gemini: buildReportData(null) + buildPdf directo.
 * Usa un Seat Leon 2017 diesel con 120k km → priceOptimal esperado < 20k€.
 *
 * Valida:
 *   1. rd.priceClose != null  → strip de cierre se pintará
 *   2. rd.closeTranche        → 'economy' o 'mainstream'
 *   3. rd.kmAdvantagePct <= 40 → frase "menos km que el X%" NO aparece (borde inverso de B)
 *   4. PDF se genera sin crash
 *
 * Uso:
 *   node scripts/golden-tests/test-gate-ola3a.js
 *   node scripts/golden-tests/test-gate-ola3a.js --out /ruta/custom.pdf
 *
 * Salida: EXIT 1 si alguna aserción falla o el PDF no se genera.
 */

"use strict";
require("dotenv").config({ path: ".env.local" });

const fs   = require("fs");
const path = require("path");

const { getMarketPriceSnapshot } = require("../../lib/inventoryStore");
const { buildReportData, buildPdf } = require("../../lib/sellReportGenerator");

const outArg = process.argv.indexOf("--out");
const OUT_FILE = outArg !== -1 ? process.argv[outArg + 1] : path.join(__dirname, "gate-ola3a-output.pdf");

// Coche de tramo mainstream bajo: Leon 2017 diesel 120k km.
// priceOptimal esperado ~12.000-16.000€ → strip de cierre activo.
// km alto en su pool → kmAdvantagePct esperado ~20-40% → sin frase de ventaja km.
const VEHICLE = {
  brand: "Seat", model: "Leon", version: "FR",
  year: 2017, mileage: 120000, fuel: "Diesel",
  transmission: "Manual", powerCv: null,
  color: "negro", owners: "2", serviceHistory: "parcial",
  damageLevel: "", damageDescription: "", itvStatus: "",
};

let pass = 0, fail = 0;
function ok(cond, label, detail) {
  if (cond) { console.log("  PASS", label); pass++; }
  else       { console.error("  FAIL", label, detail != null ? `(got: ${detail})` : ""); fail++; }
}

async function main() {
  console.log("\n── Gate ola3a: strip de cierre + borde inverso kmAdvantagePct ──\n");

  const national = await getMarketPriceSnapshot({
    brand: VEHICLE.brand, model: VEHICLE.model,
    year: VEHICLE.year, mileage: VEHICLE.mileage,
    fuel: VEHICLE.fuel, transmission: VEHICLE.transmission,
    powerCv: VEHICLE.powerCv,
  });

  const rd = buildReportData(VEHICLE, national, null); // null → tabla hardcoded, sin Gemini
  rd.aiAnalysis    = null;
  rd.aiDamageFactor = null;

  console.log("  priceOptimal :", rd.priceOptimal, "€");
  console.log("  priceClose   :", rd.priceClose,   "€");
  console.log("  closeTranche :", rd.closeTranche);
  console.log("  kmAdvantagePct:", rd.kmAdvantagePct, "%");
  console.log("  comparables  :", rd.comparables);
  console.log();

  ok(rd.priceOptimal < 20000, "priceOptimal < 20.000 → strip de cierre activado", rd.priceOptimal);
  ok(rd.priceClose != null,   "priceClose != null (factor aplicado)");
  ok(rd.closeTranche === "economy" || rd.closeTranche === "mainstream",
     "closeTranche es economy o mainstream", rd.closeTranche);
  ok(rd.kmAdvantagePct == null || rd.kmAdvantagePct <= 60,
     "kmAdvantagePct ≤ 60 → frase de ventaja km NO se muestra en el informe", rd.kmAdvantagePct);

  // Genera el PDF (ejercita la ruta de renderizado completa, incluido el strip de cierre)
  let pdfBytes;
  try {
    pdfBytes = await buildPdf(rd);
    ok(pdfBytes && pdfBytes.length > 10000, "PDF generado sin crash (" + pdfBytes.length + " bytes)");
  } catch (e) {
    console.error("  FAIL PDF generation threw:", e.message);
    fail++;
  }

  if (pdfBytes) {
    fs.writeFileSync(OUT_FILE, pdfBytes);
    console.log("\n  PDF guardado en:", OUT_FILE);
  }

  console.log(`\n  Resultado: ${pass} PASS, ${fail} FAIL\n`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
