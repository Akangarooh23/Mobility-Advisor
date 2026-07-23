"use strict";
// Unit tests for solveOLS2x2 and computeUsageImpact guardrails.
// Zero drift: no DB, no real data, no fixtures touched.
// Run: node scripts/golden-tests/test-solver.js

const { solveOLS2x2, computeUsageImpact } = require("../../lib/inventoryStore");

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
  // Respuesta conocida verificada analíticamente:
  // x1=[-20k,20k,-20k,20k] x2=[-2,-2,2,2] → b=0, a=1.6e9, d=16
  // e=-112e6, f=12800 → beta1=-0.07, beta2=800
  const x1s = [-20000,  20000, -20000,  20000];
  const x2s = [    -2,     -2,      2,      2];
  const ys  = [ 19800,  17000,  23000,  20200];
  const [sk, sy] = solveOLS2x2(x1s, x2s, ys);
  assert(
    near(sk, -0.07, 1e-6) && near(sy, 800, 1e-4),
    `T1b: respuesta conocida → slopeKm=${sk?.toFixed(5)}, slopeYear=${sy?.toFixed(2)} (esperado -0.07, 800)`,
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

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n  Resultado: ${passed} PASS, ${failed} FAIL\n`);
if (failed) process.exit(1);
