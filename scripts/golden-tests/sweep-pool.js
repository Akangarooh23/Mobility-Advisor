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
 *   quad      — cuota 2D: 4 cuadrantes (older/newer × high-km/low-km) respecto al sujeto.
 *               Pregunta: ¿centrar también en km mejora yrPct+kmPct sin dañar r?
 *               Columna "quad" muestra nl/nh/ol/oh = new_lo/new_hi/old_lo/old_hi en pool.
 *   quad-rlx  — igual pero redistribuye cuota no usada de cuadrantes vacíos a los demás.
 *
 * Uso:
 *   node scripts/golden-tests/sweep-pool.js
 *   node scripts/golden-tests/sweep-pool.js --id damage-golf-moderado
 */

const fs   = require('fs');
const path = require('path');
const { sweepDiagnostics, poolDiagnostics, selectBalancedPool } = require('../../lib/poolProximity');
const { USAGE_DEFAULTS } = require('../../lib/inventoryStore');

const FIXTURES_DIR  = path.join(__dirname, 'fixtures');
const VEHICLES_FILE = path.join(__dirname, 'vehicles.json');

const { vehicles } = JSON.parse(fs.readFileSync(VEHICLES_FILE, 'utf8'));
const singleId = process.argv.find((a, i) => process.argv[i - 1] === '--id');
const targets = singleId ? vehicles.filter((v) => v.id === singleId) : vehicles;

/**
 * Selección 2D: cuota por cuadrante (older/newer × high-km/low-km) respecto al sujeto.
 * relaxed=false → cuota estricta floor(budget/4) por cuadrante.
 * relaxed=true  → redistribuye cuota sobrante de cuadrantes pequeños a los mayores.
 * Devuelve la misma forma que una fila de sweepDiagnostics, más `pq` y `rawQ`.
 */
function computeQuadRow(label, candidates, user, targetSize, relaxed, options) {
  const { kmKey = 'mileage', yearKey = 'year' } = options;

  const q = { new_lo: [], new_hi: [], old_lo: [], old_hi: [], same: [] };
  for (const c of candidates) {
    const km = c[kmKey], yr = c[yearKey];
    if (!Number.isFinite(km) || !Number.isFinite(yr)) continue;
    const yrDiff = yr - user.year;
    const kmDiff = km - user.km;
    if (yrDiff === 0) { q.same.push(c); continue; }
    if (yrDiff > 0 && kmDiff <= 0)  q.new_lo.push(c);
    else if (yrDiff > 0)             q.new_hi.push(c);
    else if (yrDiff < 0 && kmDiff <= 0) q.old_lo.push(c);
    else                             q.old_hi.push(c);
  }

  const rawQ = {
    new_lo: q.new_lo.length, new_hi: q.new_hi.length,
    old_lo: q.old_lo.length, old_hi: q.old_hi.length,
  };

  const budget   = Math.max(0, targetSize - q.same.length);
  const baseQ    = Math.floor(budget / 4);
  const qKeys    = ['new_lo', 'new_hi', 'old_lo', 'old_hi'];
  const taken    = qKeys.map(k => Math.min(q[k].length, baseQ));

  if (relaxed) {
    // Redistribuye cuota no consumida a cuadrantes con más stock
    let unused = budget - taken.reduce((a, b) => a + b, 0);
    const byAvail = qKeys
      .map((k, i) => ({ i, avail: q[k].length - taken[i] }))
      .sort((a, b) => b.avail - a.avail);
    for (const { i } of byAvail) {
      if (unused <= 0) break;
      const extra = Math.min(unused, q[qKeys[i]].length - taken[i]);
      taken[i] += extra;
      unused   -= extra;
    }
  }

  let pool = [...q.same];
  qKeys.forEach((k, i) => pool.push(...q[k].slice(0, taken[i])));

  // Fill to minPool (15) si algún cuadrante era escaso
  if (pool.length < 15) {
    const chosen = new Set(pool);
    for (const c of candidates) {
      if (pool.length >= Math.min(targetSize, candidates.length)) break;
      if (!chosen.has(c)) { pool.push(c); chosen.add(c); }
    }
  }

  // Contar cuadrantes en el pool seleccionado
  const pq = { new_lo: 0, new_hi: 0, old_lo: 0, old_hi: 0 };
  for (const c of pool) {
    const km = c[kmKey], yr = c[yearKey];
    if (!Number.isFinite(km) || !Number.isFinite(yr)) continue;
    const yrDiff = yr - user.year;
    const kmDiff = km - user.km;
    if (yrDiff > 0 && kmDiff <= 0)      pq.new_lo++;
    else if (yrDiff > 0)                pq.new_hi++;
    else if (yrDiff < 0 && kmDiff <= 0) pq.old_lo++;
    else if (yrDiff < 0)                pq.old_hi++;
  }

  const diag = poolDiagnostics(pool, user, options);
  return { _label: label, alpha: 0, balance: false, ...diag, relaxed, pq, rawQ };
}

// ─── Opción-A shadow ──────────────────────────────────────────────────────────
// Simula §1h (base del pool balanceado) offline sobre _pool congelado, sin BD.
// Objetivo: medir priceBal antes de activar para decidir si §1d va en el mismo commit.
//
// Orden correcto: selectBalancedPool → Tukey sobre pool balanceado (no al revés).
// Si Tukey se aplicara antes, los límites reflejarían la distribución de recencia y
// podrían descartar justo los coches antiguos que la cuota importó.

function pctile(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function tukeyClean(sorted) {
  if (sorted.length < 4) return sorted;
  const q1 = pctile(sorted, 0.25), q3 = pctile(sorted, 0.75), iqr = q3 - q1;
  return sorted.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
}

function shadowSegment(brand) {
  const b = (brand || '').toLowerCase().trim();
  for (const seg of Object.values(USAGE_DEFAULTS)) {
    if (seg.brands.some(n => b.includes(n) || n.includes(b))) return seg;
  }
  return USAGE_DEFAULTS.mainstream;
}

// Dos configs: producción actual (α=0) y §1d pendiente (α=0.5).
// Con ambas se puede leer si alpha mueve priceBal lo suficiente para que §1d vaya junto a §1h.
const OPA_CONFIGS = [
  { label: 'opA  α=0  bal', alpha: 0,   balance: true },
  { label: 'opA α=0.5 bal', alpha: 0.5, balance: true },
];

function computeOpAShadow(fixture, candidatesForSweep) {
  const v   = fixture.vehicle;
  const exp = fixture.expected;
  if (!v || !exp) return [];

  // Replica computeOffers = offers.slice(0, 400), filtrado igual que computeUsageImpact
  const computeBase = candidatesForSweep.slice(0, 400).filter(
    o => o.mileage >= 500 && o.year > 0 && Number.isFinite(o.price) && o.price > 0
  );

  // effectiveFactor del fixture — el vehículo es el mismo, solo cambia el pool
  const df  = exp.damageFactor     ?? 1;
  const cf  = exp.colorAdjFactor   ?? 1;
  const of_ = exp.ownerAdjFactor   ?? 1;
  const effectiveFactor = Math.max(0.72, df * cf * of_);

  const seg = shadowSegment(v.brand);

  return OPA_CONFIGS.map(cfg => {
    const { pool: balPairs } = selectBalancedPool(
      computeBase,
      { km: v.mileage, year: v.year },
      { alpha: cfg.alpha, balance: cfg.balance, kmKey: 'mileage', yearKey: 'year' }
    );
    if (!balPairs.length) return { label: cfg.label, error: 'pool vacío' };

    // Tukey SOBRE el pool balanceado (no sobre computeBase)
    const rawPrices   = balPairs.map(o => o.price).sort((a, b) => a - b);
    const cleanPrices = tukeyClean(rawPrices);
    const baseBal     = pctile(cleanPrices, 0.5);
    if (!baseBal) return { label: cfg.label, error: 'precios vacíos tras Tukey' };

    const sortedKm = [...balPairs.map(o => o.mileage)].sort((a, b) => a - b);
    const sortedYr = [...balPairs.map(o => o.year)].sort((a, b) => a - b);
    const medKmBal = pctile(sortedKm, 0.5);
    const medYrBal = pctile(sortedYr, 0.5);
    const kmPctBal = balPairs.filter(o => o.mileage <= v.mileage).length / balPairs.length;
    const yrPctBal = balPairs.filter(o => o.year    <= v.year).length    / balPairs.length;

    // USAGE_DEFAULTS (producción usa este path porque OLS falla con n<15 o guardarraíles)
    const cap            = baseBal * seg.kmCap;
    const rawAdj         = seg.slopeKm * (v.mileage - medKmBal) + seg.slopeYear * (v.year - medYrBal);
    const usageImpactBal = Math.round(Math.max(-cap, Math.min(cap, rawAdj)));

    const priceBal = Math.max(0, Math.round((baseBal + usageImpactBal) * effectiveFactor));
    const delta    = exp.priceOptimal != null ? priceBal - exp.priceOptimal : null;

    return { label: cfg.label, n: balPairs.length, baseBal, medKmBal, medYrBal, kmPctBal, yrPctBal, usageImpactBal, priceBal, delta };
  });
}
// ─────────────────────────────────────────────────────────────────────────────

const COL = { lbl:10, alpha:6, bal:8, n:5, medKm:8, medYr:7, kmPct:7, yrPct:7, r:7, kappa:6, iqr:8, spr:6, rlx:5, quad:15 };
const hdr = [
  'label'.padEnd(COL.lbl), 'alpha'.padStart(COL.alpha), 'balance'.padStart(COL.bal),
  'n'.padStart(COL.n), 'medKm'.padStart(COL.medKm), 'medYr'.padStart(COL.medYr),
  'kmPct'.padStart(COL.kmPct), 'yrPct'.padStart(COL.yrPct),
  'r'.padStart(COL.r), 'kappa'.padStart(COL.kappa),
  'kmIqr'.padStart(COL.iqr), 'yrSpr'.padStart(COL.spr), 'rlx'.padStart(COL.rlx),
  'nl/nh/ol/oh'.padStart(COL.quad),
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

  const user    = { km: v.mileage, year: v.year };
  const quadOpts = { kmKey: 'mileage', yearKey: 'year' };
  const rows = [
    ...sweepDiagnostics(candidatesForSweep, user, CONFIGS, quadOpts),
    computeQuadRow('quad    ', candidatesForSweep, user, 400, false, quadOpts),
    computeQuadRow('quad-rlx', candidatesForSweep, user, 400, true,  quadOpts),
  ];

  for (const row of rows) {
    const quadStr = row.pq
      ? [row.pq.new_lo, row.pq.new_hi, row.pq.old_lo, row.pq.old_hi]
          .map(x => String(x).padStart(3)).join('/')
      : '';
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
      quadStr.padStart(COL.quad),
    ].join('  '));
  }

  // Distribución raw de cuadrantes en el pool completo (contexto para las filas quad)
  const rawQ = rows[rows.length - 1].rawQ;
  if (rawQ) {
    console.log(`  Q-raw (stored)  nl=${rawQ.new_lo}  nh=${rawQ.new_hi}  ol=${rawQ.old_lo}  oh=${rawQ.old_hi}`);
  }

  // opA-shadow: preview de Opción A antes de activarla.
  // base_now = marketMedian actual (del pool sin balancear).
  // priceBal = priceOptimal si base y referencia vinieran del pool balanceado.
  // Δ = priceBal − priceOptimal_actual → signo positivo = Opción A da precio más alto.
  const baseNow  = fixture.national?.market?.median ?? null;
  const priceNow = fixture.expected?.priceOptimal   ?? null;
  const shadows  = computeOpAShadow(fixture, candidatesForSweep);
  if (shadows.length) {
    console.log(`\n  opA-shadow  base_now=${baseNow != null ? Math.round(baseNow) : 'n/a'}  price_now=${priceNow ?? 'n/a'}`);
    for (const s of shadows) {
      if (s.error) {
        console.log(`    ${s.label.padEnd(16)}: ${s.error}`);
        continue;
      }
      const dSign = (s.delta ?? 0) >= 0 ? '+' : '';
      console.log(
        `    ${s.label.padEnd(16)}` +
        `  n=${String(s.n).padStart(3)}` +
        `  baseBal=${String(Math.round(s.baseBal)).padStart(6)}` +
        `  medKm=${String(Math.round(s.medKmBal)).padStart(6)}` +
        `  kmPct=${s.kmPctBal.toFixed(2)}  yrPct=${s.yrPctBal.toFixed(2)}` +
        `  usageAdj=${String(s.usageImpactBal).padStart(7)}` +
        `  priceBal=${String(s.priceBal).padStart(6)}` +
        `  Δ=${dSign}${s.delta ?? 'n/a'}`
      );
    }
  }
}
console.log('');
