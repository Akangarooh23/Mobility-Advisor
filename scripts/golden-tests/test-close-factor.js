"use strict";
// Unit tests for getClosingFactor — tranche assignment and factor application.
// Zero drift: no DB, no fixtures, no PDF generation.
// Run: node scripts/golden-tests/test-close-factor.js
//
// Validates:
//   (1) Tranche boundaries match Query B cuts exactly (12k / 20k).
//   (2) Factor is read from CLOSE_FACTORS, not from brand segment.
//   (3) null returned for premium (>= 20k) — no invented figure.
//   (4) Applied price (priceOptimal × factor) is in the right order of magnitude.

const { getClosingFactor, CLOSE_FACTORS } = require("../../lib/sellReportGenerator");

let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else       { console.error(`  FAIL  ${label}`); failed++; }
}

// ── Suite 1: tramo economy ────────────────────────────────────────────────────
console.log("\n── economy (<12k) ──");

{
  const r = getClosingFactor(11900);
  assert(r !== null && r.tranche === "economy", "T1a: 11.900 → tranche=economy");
  assert(r !== null && r.factor === CLOSE_FACTORS.economy, `T1b: 11.900 → factor=${r?.factor} (esperado ${CLOSE_FACTORS.economy})`);
}

{
  // Borde superior: 11.999 aún es economy
  const r = getClosingFactor(11999);
  assert(r !== null && r.tranche === "economy", "T1c: 11.999 (borde) → tranche=economy");
}

// ── Suite 2: tramo mainstream ─────────────────────────────────────────────────
console.log("\n── mainstream (12k-20k) ──");

{
  const r = getClosingFactor(15000);
  assert(r !== null && r.tranche === "mainstream", "T2a: 15.000 → tranche=mainstream");
  assert(r !== null && r.factor === CLOSE_FACTORS.mainstream, `T2b: 15.000 → factor=${r?.factor} (esperado ${CLOSE_FACTORS.mainstream})`);
}

{
  // Borde inferior: 12.000 ya es mainstream (no economy)
  const r = getClosingFactor(12000);
  assert(r !== null && r.tranche === "mainstream", "T2c: 12.000 (borde inferior) → tranche=mainstream");
}

{
  // Borde superior: 19.999 aún es mainstream
  const r = getClosingFactor(19999);
  assert(r !== null && r.tranche === "mainstream", "T2d: 19.999 (borde superior) → tranche=mainstream");
}

// ── Suite 3: sin factor (premium y luxury) ────────────────────────────────────
console.log("\n── sin factor (>= 20k) ──");

{
  // Borde: 20.000 ya no tiene factor
  const r = getClosingFactor(20000);
  assert(r === null, "T3a: 20.000 (borde premium) → null");
}

{
  const r = getClosingFactor(25000);
  assert(r === null, "T3b: 25.000 (premium) → null");
}

{
  const r = getClosingFactor(45000);
  assert(r === null, "T3c: 45.000 (luxury) → null");
}

// ── Suite 4: orden de magnitud del precio de cierre ───────────────────────────
// Comprueba que el factor aplicado da un número razonable,
// no que se aplique dos veces ni que se ignore.
console.log("\n── orden de magnitud del precio aplicado ──");

{
  // Economy: 9.900 × 0.954 ≈ 9.445 (~5% descuento)
  const r = getClosingFactor(9900);
  const close = r ? Math.round(9900 * r.factor) : null;
  assert(close !== null && close > 9000 && close < 9900, `T4a: economy 9.900 → cierre=${close} (esperado ~9.445, rango 9k-9.9k)`);
}

{
  // Mainstream: 15.000 × 0.969 = 14.535 (~3% descuento)
  const r = getClosingFactor(15000);
  const close = r ? Math.round(15000 * r.factor) : null;
  assert(close !== null && close > 14000 && close < 15000, `T4b: mainstream 15.000 → cierre=${close} (esperado ~14.535, rango 14k-15k)`);
  // Sanity numérico exacto
  assert(close === 14535, `T4c: mainstream 15.000 → cierre exacto=${close} (esperado 14535)`);
}

{
  // Premium: sin factor → null, no se aplica nada
  const r = getClosingFactor(28000);
  assert(r === null, "T4d: premium 28.000 → null (no se aplica factor)");
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n  Resultado: ${passed} PASS, ${failed} FAIL\n`);
if (failed) process.exit(1);
