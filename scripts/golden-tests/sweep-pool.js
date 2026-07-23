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
 * Filas del barrido (label):
 *   prod      — producción: 400 más recientes (sort _rank + slice 400). Referencia actual.
 *   mkt-full  — mercado completo: los n0 candidatos sin truncar, sin kernel ni cuota.
 *               DIAGNÓSTICO CLAVE: si yrPct ≈ 0.50 aquí, el sesgo lo producía el LIMIT,
 *               no el mercado — y ningún mecanismo de ponderación es necesario.
 *               Si yrPct ≈ 0.05 también aquí, el mercado sí está sesgado y la cuota ayuda.
 *   ker-0.5   — solo kernel 0.5, sin cuota: "truncar por proximidad en vez de por recencia".
 *   ker-1.0   — solo kernel 1.0, sin cuota.
 *   bal       — solo cuota (balance=true), sin kernel: mecanismo puro de centrado.
 *   k0.5+bal  — kernel 0.5 + cuota.
 *   k1.0+bal  — kernel 1.0 + cuota.
 *   k2.0+bal  — kernel 2.0 + cuota (agresivo: vigilar caída de kmIqr / yrSpread).
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

const COL = { lbl:10, alpha:6, bal:8, n:5, medKm:8, medYr:7, kmPct:7, yrPct:7, r:7, kappa:6, iqr:8, spr:6, rlx:5 };
const hdr = [
  'label'.padEnd(COL.lbl), 'alpha'.padStart(COL.alpha), 'balance'.padStart(COL.bal),
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

  // sort(_rank) → orden de BD (updated_at DESC), igual que producción.
  // La fila base hace slice(0, 400) sobre este array → replica el pool real.
  // Filas con alpha/balance reordenan por score: el orden de entrada no importa.
  const candidatesForSweep = [...pool].sort((a, b) => (a._rank ?? 0) - (b._rank ?? 0));

  // _label se propaga por sweepDiagnostics hasta el row; poolProximity lo ignora.
  // targetSize en mkt-full: n0 (todos los candidatos, sin truncar).
  const CONFIGS = [
    { _label: 'prod    ', alpha: 0,   balance: false },
    { _label: 'mkt-full', alpha: 0,   balance: false, targetSize: n0 },
    { _label: 'ker-0.5 ', alpha: 0.5, balance: false },
    { _label: 'ker-1.0 ', alpha: 1,   balance: false },
    { _label: 'bal     ', alpha: 0,   balance: true  },
    { _label: 'k0.5+bal', alpha: 0.5, balance: true  },
    { _label: 'k1.0+bal', alpha: 1,   balance: true  },
    { _label: 'k2.0+bal', alpha: 2,   balance: true  },
  ];

  const rows = sweepDiagnostics(candidatesForSweep, { km: v.mileage, year: v.year }, CONFIGS, {
    kmKey: 'mileage', yearKey: 'year',
  });

  for (const row of rows) {
    console.log([
      (row._label ?? '?').padEnd(COL.lbl),
      fmt(row.alpha,    1,    COL.alpha),
      fmt(row.balance,  null, COL.bal),
      fmt(row.n,        0,    COL.n),
      fmt(row.medKm,    0,    COL.medKm),
      fmt(row.medYr,    1,    COL.medYr),
      fmt(row.kmPct,    2,    COL.kmPct),
      fmt(row.yrPct,    2,    COL.yrPct),
      fmt(row.r,        3,    COL.r),
      fmt(row.kappa,    1,    COL.kappa),
      fmt(row.kmIqr,    0,    COL.iqr),
      fmt(row.yrSpread, 0,    COL.spr),
      fmt(row.relaxed,  null, COL.rlx),
    ].join('  '));
  }
}
console.log('');
