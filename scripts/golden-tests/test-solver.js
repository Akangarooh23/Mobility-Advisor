"use strict";
// Unit tests for solveOLS2x2 and computeUsageImpact guardrails.
// Zero drift: no DB, no real data, no fixtures touched.
// Run: node scripts/golden-tests/test-solver.js

const { solveOLS2x2, computeUsageImpact, USAGE_DEFAULTS } = require("../../lib/inventoryStore");
const { BRAND_TIERS } = require("../../lib/sellReportGenerator");

let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else       { console.error(`  FAIL  ${label}`); failed++; }
}

function near(a, b, eps = 0.001) {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= eps;
}

// ── Bloque ortogonal 2×2 ×5 (n=20) ──────────────────────────────────────────
// Km ∈ {30000, 70000}, year ∈ {2018, 2022}.
// percentile(0.5) de [30k×10, 70k×10] = (30k+70k)/2 = 50000
// percentile(0.5) de [2018×10, 2022×10] = (2018+2022)/2 = 2020
// b = sum(x1·x2) = 0 (ortogonal) → OLS desacoplado → recuperación exacta.
function makeOffers(slopeKm, slopeYear, base = 20000) {
  const corners = [[30000, 2018], [70000, 2018], [30000, 2022], [70000, 2022]];
  const offers = [];
  for (let i = 0; i < 5; i++) {
    for (const [km, year] of corners) {
      offers.push({
        mileage: km,
        year,
        price: base + slopeKm * (km - 50000) + slopeYear * (year - 2020),
      });
    }
  }
  return offers;
}

// Bloque ortogonal 3×4 corners + 3 center (n=15). medianKm=50k, medianYear=2020.
// Center points (x1=x2=0): no aportan a slopes, mueven median a 50k/2020.
function make15Offers(slopeKm = -0.07, slopeYear = 800, base = 20000) {
  const corners = [[30000, 2018], [70000, 2018], [30000, 2022], [70000, 2022]];
  const offers = [];
  for (let i = 0; i < 3; i++) {
    for (const [km, year] of corners) {
      offers.push({ mileage: km, year, price: base + slopeKm*(km-50000) + slopeYear*(year-2020) });
    }
  }
  for (let i = 0; i < 3; i++) offers.push({ mileage: 50000, year: 2020, price: base });
  return offers; // n=15
}

// Diseño colineal: km = 50000 + 10000*(year−2020) → x1 = 10000·x2 → singular
function makeCollinearOffers() {
  const offers = [];
  for (const year of [2018, 2019, 2020, 2021, 2022]) {
    const km = 50000 + 10000 * (year - 2020);
    for (let i = 0; i < 4; i++) offers.push({ mileage: km, year, price: 20000 });
  }
  return offers;
}

const BRAND = "Volkswagen"; // segmento mainstream: kmCap=0.12, slopeKm=-0.07, slopeYear=800
const MED_PRICE = 20000;

// ── Suite 1: solveOLS2x2 directo ─────────────────────────────────────────────
console.log("\n── solveOLS2x2 ──");

{
  // Singular: x1 = x2 → det=0 → d2=0 en el solver → [NaN, NaN]
  const [s1, s2] = solveOLS2x2([1,2,3,4,5], [1,2,3,4,5], [100,90,80,70,60]);
  assert(isNaN(s1) && isNaN(s2), "T1a: matriz singular → [NaN, NaN]");
}

{
  // Respuesta conocida (sin pivoteo): b=0, sistema desacoplado.
  // x1=[-20k,20k,-20k,20k] x2=[-2,-2,2,2] → a=1.6e9, d=16, e=-112e6, f=12800
  // → beta1=-0.07, beta2=800
  const x1s = [-20000,  20000, -20000,  20000];
  const x2s = [    -2,     -2,      2,      2];
  const ys  = [ 19800,  17000,  23000,  20200];
  const [sk, sy] = solveOLS2x2(x1s, x2s, ys);
  assert(
    near(sk, -0.07, 1e-6) && near(sy, 800, 1e-4),
    `T1b: respuesta conocida (sin swap) → slopeKm=${sk?.toFixed(5)}, slopeYear=${sy?.toFixed(2)} (esperado -0.07, 800)`,
  );
}

{
  // Pivoteo parcial: |a|=6 < |b|=10 → swap de filas.
  // Diseño verificado analíticamente: sum(x1)=sum(x2)=0, slopeKm=-1, slopeYear=10.
  // a=6, b=10, d=150, e=94, f=1490.
  // Sin fix: devuelve [slopeYear, slopeKm] = [10, -1]. Con fix: [-1, 10].
  const x1s = [ 1,  1, -1, -1,  1, -1];
  const x2s = [ 5,  5, -5, -5, -5,  5];
  const ys  = [1049, 1049, 951, 951, 949, 1051];
  const [sk, sy] = solveOLS2x2(x1s, x2s, ys);
  assert(
    near(sk, -1, 0.001) && near(sy, 10, 0.001),
    `T1c: pivoteo parcial → slopeKm=${sk}, slopeYear=${sy} (esperado -1, 10)`,
  );
}

// ── Suite 2: computeUsageImpact guardarraíles ─────────────────────────────────
console.log("\n── computeUsageImpact guardarraíles ──");

{
  // Guardarraíl 1 — finitud: datos colineales → OLS singular → slopeKm=NaN → usedDefault
  const r = computeUsageImpact(makeCollinearOffers(), 50000, 2020, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === true, "T2a: G1 finitud — colineal → usedDefault=true");
}

{
  // Guardarraíl 2 — signo km: slopeKm=+0.2 > 0 → usedDefault
  const r = computeUsageImpact(makeOffers(0.2, 100), 50000, 2020, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === true, "T2b: G2 signo km — slopeKm>0 → usedDefault=true");
}

{
  // Guardarraíl 2 — signo year: slopeYear=-500 < 0 → usedDefault
  const r = computeUsageImpact(makeOffers(-0.05, -500), 50000, 2020, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === true, "T2c: G2 signo year — slopeYear<0 → usedDefault=true");
}

{
  // Guardarraíl 3 — magnitud km: slopeKm=-0.5 < -0.30 → usedDefault
  const r = computeUsageImpact(makeOffers(-0.5, 500), 50000, 2020, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === true, "T2d: G3 magnitud km — slopeKm<-0.30 → usedDefault=true");
}

{
  // Guardarraíl 3 — magnitud year: slopeYear=5000 > 3000 → usedDefault
  const r = computeUsageImpact(makeOffers(-0.07, 5000), 50000, 2020, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === true, "T2e: G3 magnitud year — slopeYear>3000 → usedDefault=true");
}

{
  // Caso limpio: slopeKm=-0.07, slopeYear=800 (todos los guardarraíles pasan)
  // userKm=60k, userYear=2019 → rawImpact = -0.07*(60k-50k) + 800*(2019-2020) = -700-800 = -1500
  // cap = 20000*0.12 = 2400 → usageImpact = -1500 (sin cap)
  const r = computeUsageImpact(makeOffers(-0.07, 800), 60000, 2019, MED_PRICE, "price", BRAND);
  assert(
    r.usedDefault === false &&
    near(r.slopeKm, -0.07, 1e-5) &&
    near(r.slopeYear, 800, 0.01) &&
    r.usageImpact === -1500,
    `T2f: caso limpio → usedDefault=${r.usedDefault}, slopeKm=${r.slopeKm?.toFixed(5)}, slopeYear=${r.slopeYear?.toFixed(1)}, usageImpact=${r.usageImpact} (esperado false/-0.07/800/-1500)`,
  );
}

// ── Suite 3: umbral n<15 ──────────────────────────────────────────────────────
console.log("\n── umbral n<15 ──");

{
  // n=14: pairs.length < 15 → early return → usedDefault=true, slopeKm=null
  const offers14 = Array.from({length: 14}, (_, i) => ({
    mileage: 40000 + i * 2000, year: 2017 + (i % 7), price: 20000,
  }));
  const r = computeUsageImpact(offers14, 50000, 2020, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === true && r.slopeKm === null, "T3a: n=14 → early return (usedDefault=true, slopeKm=null)");
}

{
  // n=15: OLS se intenta; con datos limpios pasa guardarraíles → usedDefault=false
  // make15Offers: 12 corners + 3 center, medianKm=50k, medianYear=2020
  // userKm=60k, userYear=2019 → usageImpact=-1500 (igual que T2f)
  const r = computeUsageImpact(make15Offers(), 60000, 2019, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === false && r.usageImpact === -1500,
    `T3b: n=15 → OLS activo (usedDefault=${r.usedDefault}, usageImpact=${r.usageImpact})`);
}

// ── Suite 4: bordes exactos de guardarraíles (desigualdades estrictas) ────────
console.log("\n── bordes de guardarraíles ──");

{
  // slopeKm=-0.30: condición G3 es slopeKm < -0.30 (estricto) → -0.30 PASA
  const r = computeUsageImpact(makeOffers(-0.30, 800), 60000, 2019, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === false, "T4a: slopeKm=-0.30 (borde G3 km) → pasa, usedDefault=false");
}

{
  // slopeYear=3000: condición G3 es slopeYear > 3000 (estricto) → 3000 PASA
  const r = computeUsageImpact(makeOffers(-0.07, 3000), 60000, 2019, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === false, "T4b: slopeYear=3000 (borde G3 year) → pasa, usedDefault=false");
}

{
  // slopeKm=0: condición G2 es slopeKm > 0 (estricto) → 0 PASA (infraajuste conservador)
  const r = computeUsageImpact(makeOffers(0, 800), 60000, 2019, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === false, "T4c: slopeKm=0 (borde G2 km) → pasa, usedDefault=false");
}

{
  // slopeYear=0: condición G2 es slopeYear < 0 (estricto) → 0 PASA
  const r = computeUsageImpact(makeOffers(-0.07, 0), 60000, 2019, MED_PRICE, "price", BRAND);
  assert(r.usedDefault === false, "T4d: slopeYear=0 (borde G2 year) → pasa, usedDefault=false");
}

// ── Suite 5: cap ──────────────────────────────────────────────────────────────
console.log("\n── cap ──");

{
  // userKm=90k, userYear=2019: rawImpact = -0.07*(90k-50k)+800*(2019-2020) = -2800-800 = -3600
  // cap = 20000*0.12 = 2400 → capped a -2400
  // Cuando el cap cambie en Ola 2, este test driftará y documentará la decisión.
  const r = computeUsageImpact(makeOffers(-0.07, 800), 90000, 2019, MED_PRICE, "price", BRAND);
  assert(
    r.usedDefault === false && r.usageImpact === -2400,
    `T5a: cap aplicado → usageImpact=${r.usageImpact} (raw=-3600, cap=${MED_PRICE*0.12})`,
  );
}

// ── Suite 6: sincronía BRAND_TIERS ↔ USAGE_DEFAULTS ──────────────────────────
console.log("\n── sincronía BRAND_TIERS ↔ USAGE_DEFAULTS ──");

{
  // Cada tier de BRAND_TIERS debe tener entrada en USAGE_DEFAULTS con los tres campos.
  for (const { tier } of BRAND_TIERS) {
    const seg = USAGE_DEFAULTS[tier];
    assert(
      seg !== undefined &&
      typeof seg.slopeKm === "number" &&
      typeof seg.slopeYear === "number" &&
      typeof seg.kmCap === "number",
      `T6a: BRAND_TIERS.${tier} → USAGE_DEFAULTS[${tier}] existe con slopeKm/slopeYear/kmCap`,
    );
  }
}

{
  // Marca desconocida: cae a mainstream (fallback explícito, no NaN).
  const r = computeUsageImpact(makeOffers(-0.07, 800), 60000, 2019, MED_PRICE, "price", "XYZUNK999");
  assert(
    typeof r.usageImpact === "number" && Number.isFinite(r.usageImpact),
    `T6b: marca desconocida → fallback a mainstream, usageImpact=${r.usageImpact} (no NaN)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n  Resultado: ${passed} PASS, ${failed} FAIL\n`);
if (failed) process.exit(1);
