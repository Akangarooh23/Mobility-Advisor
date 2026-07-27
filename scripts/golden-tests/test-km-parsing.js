"use strict";
// Unit tests for Spanish km format parsing.
// The bug: Number("30.000") === 30 in JS (period = decimal separator).
// The fix: strip dots before Number(), converting "30.000" → 30000.
//
// This logic lives in two places:
//   - billing-webhook-handler.js ~line 536/611 (Stripe metadata path)
//   - sellReportGenerator.js ~line 1065 (baseOptions normalization)
//
// Run: node scripts/golden-tests/test-km-parsing.js

function parseSpanishKm(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(String(raw).replace(/\./g, "").replace(/,/g, "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`  PASS  ${label}`); passed++; }
  else       { console.error(`  FAIL  ${label}`); failed++; }
}

// ── Reproduce el bug sin el fix ───────────────────────────────────────────────
console.log("\n── Verificación del bug original ──");
assert(Number("30.000") === 30, "BUG: Number('30.000') === 30 (el bug existía)");
assert(Number("30.000") !== 30000, "BUG: Number('30.000') !== 30000 (sin fix, falla)");

// ── Fix: strip dots before Number() ──────────────────────────────────────────
console.log("\n── Fix: formato español miles con punto ──");
assert(parseSpanishKm("30.000") === 30000, "P1: '30.000' → 30000 (30k km)");
assert(parseSpanishKm("150.000") === 150000, "P2: '150.000' → 150000 (150k km)");
assert(parseSpanishKm("1.000") === 1000,  "P3: '1.000' → 1000 (1k km)");
assert(parseSpanishKm("200.000") === 200000, "P4: '200.000' → 200000 (200k km)");

// ── Números sin separador (caso más común en BD) ──────────────────────────────
console.log("\n── Números sin separador ──");
assert(parseSpanishKm("30000") === 30000, "P5: '30000' → 30000");
assert(parseSpanishKm(30000) === 30000,   "P6: 30000 (número) → 30000");
assert(parseSpanishKm("0") === null,      "P7: '0' → null (0 km no es válido)");
assert(parseSpanishKm(0) === null,        "P8: 0 (número) → null");

// ── Nulos y vacíos ────────────────────────────────────────────────────────────
console.log("\n── Nulos y vacíos ──");
assert(parseSpanishKm(null) === null,      "P9: null → null");
assert(parseSpanishKm(undefined) === null, "P10: undefined → null");
assert(parseSpanishKm("") === null,        "P11: '' → null");

// ── Caso límite: el T-Roc 8888LXR reportado ──────────────────────────────────
// El webhook recibió meta.veh_mileage = "30.000"; Number("30.000") = 30;
// con el fix parseSpanishKm("30.000") = 30000.
console.log("\n── Caso T-Roc 8888LXR ──");
{
  const raw = "30.000";
  const broken = Number(raw);
  const fixed  = parseSpanishKm(raw);
  assert(broken === 30,    `T-Roc: sin fix → ${broken} (incorrecto)`);
  assert(fixed === 30000,  `T-Roc: con fix → ${fixed} (correcto)`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n  Resultado: ${passed} PASS, ${failed} FAIL\n`);
if (failed) process.exit(1);
