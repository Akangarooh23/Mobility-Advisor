'use strict';
/**
 * Barrido de configuraciones de pool sobre los 12 fixtures.
 * NO modifica nada. Muestra qué pool saldría con cada config sin aplicar ninguna.
 *
 * Métricas clave:
 *   yrPct / kmPct  — percentil del sujeto dentro del pool. Objetivo ~0.50.
 *                    En Ola 1, Golf 2020 daba yrPct≈0.05 en un pool de 2023.
 *   r              — correlación km-año. Tras estandarizar, κ=(1+|r|)/(1-|r|).
 *                    Si al centrar sube, el condicionamiento empeora.
 *   kmIqr          — dispersión del pool en km. Si cae mucho → pool estrecho.
 *   yrSpread       — rango de años. Idem.
 *
 * Predicción (anotar antes de correr):
 *   {alpha:0, balance:true} arregla el centrado casi por completo.
 *   alpha añadirá poco más que estrechar (vigilar kmIqr / yrSpread).
 *
 * Uso:
 *   node scripts/golden-tests/sweep-pool.js
 *   node scripts/golden-tests/sweep-pool.js --id damage-golf-moderado
 */

const fs   = require('fs');
const path = require('path');
const { sweepDiagnostics } = require('../../lib/poolProximity');

const FIXTURES_DIR  = path.join(__dirname, 'fixtures');
const VEHICLES_FILE = path.join(__dirname, 'vehicles.json');

const { vehicles } = JSON.parse(fs.readFileSync(VEHICLES_FILE, 'utf8'));
const singleId = process.argv.find((a, i) => process.argv[i - 1] === '--id');
const targets = singleId ? vehicles.filter((v) => v.id === singleId) : vehicles;

const COL = { alpha:6, bal:8, n:5, medKm:8, medYr:7, kmPct:7, yrPct:7, r:7, kappa:6, iqr:8, spr:6, rlx:5 };
const hdr = [
  'alpha'.padStart(COL.alpha), 'balance'.padStart(COL.bal),
  'n'.padStart(COL.n), 'medKm'.padStart(COL.medKm), 'medYr'.padStart(COL.medYr),
  'kmPct'.padStart(COL.kmPct), 'yrPct'.padStart(COL.yrPct),
  'r'.padStart(COL.r), 'kappa'.padStart(COL.kappa),
  'kmIqr'.padStart(COL.iqr), 'yrSpr'.padStart(COL.spr), 'rlx'.padStart(COL.rlx),
].join('  ');

function fmt(v, d, w) {
  if (v == null) return ' n/a'.padStart(w);
  const s = typeof v === 'number' && d != null ? v.toFixed(d) : String(v);
  return s.padStart(w);
}

for (const entry of targets) {
  const fixturePath = path.join(FIXTURES_DIR, `${entry.id}.json`);
  if (!fs.existsSync(fixturePath)) {
    console.log(`\n=== ${entry.id} — sin fixture, ejecuta capture.js primero ===`);
    continue;
  }

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const v = fixture.vehicle;
  // _pool: pool completo usado por computeUsageImpact (almacenado desde Ola 2).
  // samples: solo 8 ofertas de display — no sirve para el sweep.
  const pool = fixture.national?._pool || [];

  const n0 = pool.length;
  if (n0 === 0) {
    const reason = fixture.national?._pool ? 'n=0 en pool' : 'sin _pool (recaptura pendiente)';
    console.log(`\n=== ${entry.id}  userKm=${v.mileage}  userYear=${v.year}  (${reason}) ===`);
    continue;
  }

  const prodN = Math.min(n0, 400);
  console.log(`\n=== ${entry.id}  userKm=${v.mileage}  userYear=${v.year}  stored=${n0}  prod=${prodN} ===`);
  console.log(hdr);
  console.log('-'.repeat(hdr.length));

  // La fila base {alpha:0, balance:false} hace candidates.slice(0, 400): necesita el array
  // en orden de BD (updated_at DESC = _rank ASC) para reproducir el pool de producción.
  // Las filas con alpha/balance reordenan por score, así que el orden de entrada no importa.
  const candidatesForSweep = [...pool].sort((a, b) => (a._rank ?? 0) - (b._rank ?? 0));

  const rows = sweepDiagnostics(candidatesForSweep, { km: v.mileage, year: v.year }, null, {
    kmKey: 'mileage', yearKey: 'year',
  });

  for (const row of rows) {
    console.log([
      fmt(row.alpha,   1, COL.alpha),
      fmt(row.balance, null, COL.bal),
      fmt(row.n,       0, COL.n),
      fmt(row.medKm,   0, COL.medKm),
      fmt(row.medYr,   1, COL.medYr),
      fmt(row.kmPct,   2, COL.kmPct),
      fmt(row.yrPct,   2, COL.yrPct),
      fmt(row.r,       3, COL.r),
      fmt(row.kappa,   1, COL.kappa),
      fmt(row.kmIqr,   0, COL.iqr),
      fmt(row.yrSpread,0, COL.spr),
      fmt(row.relaxed, null, COL.rlx),
    ].join('  '));
  }
}
console.log('');
