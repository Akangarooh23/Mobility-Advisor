'use strict';
/**
 * Harness de validación para inferFuelFromVersion.
 *
 * Mide dos métricas bajo despliegue condicional (sujeto ∈ {gasolina, diesel}):
 *
 *   1. Precisión por grupo inferido — informativa, NO la métrica de decisión.
 *      Mide si el token inferido coincide con la etiqueta declarada.
 *
 *   2. Tasa de exclusión falsa — MÉTRICA DE DECISIÓN.
 *      Para cada oferta cuya etiqueta real es gasolina/diesel, ¿qué fracción
 *      excluiría la inferencia del pool de ese sujeto?
 *
 *      Clase dañina: declared.includes(sujeto) && inferred != null && !inferred.includes(sujeto)
 *      Clase benigna: declared ≠ sujeto && inferred == sujeto  → pass (igual que hoy)
 *
 *      La clase benigna NO es un error bajo gating: produce el mismo resultado
 *      que "sin dato = pasa". Solo la clase dañina introduce una regresión.
 *
 * Uso: node scripts/validate-fuel-inference.js
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { inferFuelFromVersion } = require('../lib/inferFuelFromVersion');

function normalizeToken(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function labelsCompatible(inferred, declared) {
  if (!inferred || !declared) return false;
  return declared.includes(inferred) || inferred.includes(declared);
}

const GROUPS = {
  gasolina:             { label: 'Gasolina',         inferResults: [] },
  diesel:               { label: 'Diesel',            inferResults: [] },
  hibrido:              { label: 'Híbrido',           inferResults: [] },
  'hibrido enchufable': { label: 'Híbrido enchuf.',   inferResults: [] },
  electrico:            { label: 'Eléctrico',         inferResults: [] },
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Consultando ofertas con fuel declarado y version no vacía...');
  const { rows } = await pool.query(`
    SELECT version, fuel, brand, model
    FROM moveadvisor_market_offers
    WHERE is_active = true
      AND fuel IS NOT NULL AND fuel != ''
      AND version IS NOT NULL AND version != ''
    LIMIT 200000
  `);
  await pool.end();

  console.log(`${rows.length} ofertas cargadas.\n`);

  // ─── Bucle 1: precisión por grupo inferido (métrica informativa) ─────────
  let total = 0, resolved = 0, correct = 0, incorrect = 0;
  const precisionErrors = [];

  for (const row of rows) {
    const declaredNorm = normalizeToken(row.fuel);
    const inferred     = inferFuelFromVersion(row.version);

    total++;
    if (inferred === null) continue;

    resolved++;
    const ok = labelsCompatible(inferred, declaredNorm);
    if (ok) {
      correct++;
      if (GROUPS[inferred]) GROUPS[inferred].inferResults.push({ ok: true });
    } else {
      incorrect++;
      if (GROUPS[inferred]) GROUPS[inferred].inferResults.push({ ok: false, declared: row.fuel, version: row.version });
      if (precisionErrors.length < 40) {
        precisionErrors.push({ version: row.version, brand: row.brand, model: row.model, declared: row.fuel, inferred });
      }
    }
  }

  const pct = (n, d) => d > 0 ? (100 * n / d).toFixed(2) + '%' : 'n/a';

  console.log('═══ Resultado global (precisión — informativo) ═══');
  console.log(`Total con fuel declarado:  ${total}`);
  console.log(`Resueltos por inferencia:  ${resolved}  (cobertura ${pct(resolved, total)})`);
  console.log(`Correctos:                 ${correct}   (precisión ${pct(correct, resolved)})`);
  console.log(`Incorrectos:               ${incorrect}  (error rate ${pct(incorrect, resolved)})`);
  console.log();

  console.log('═══ Precisión por grupo inferido (informativo) ═══');
  for (const [, grp] of Object.entries(GROUPS)) {
    const n   = grp.inferResults.length;
    const ok  = grp.inferResults.filter(r => r.ok).length;
    const err = grp.inferResults.filter(r => !r.ok);
    console.log(`${grp.label.padEnd(20)} n=${String(n).padStart(6)}  precisión=${pct(ok, n)}`);
    if (err.length > 0) {
      err.slice(0, 3).forEach(e => console.log(`  ERROR: declared="${e.declared}"  version="${e.version}"`));
      if (err.length > 3) console.log(`  ... y ${err.length - 3} más`);
    }
  }

  // ─── Bucle 2: tasa de exclusión falsa (métrica de decisión) ─────────────
  // Para cada sujeto ∈ {gasolina, diesel}: sobre las ofertas cuya etiqueta
  // real casaría con ese sujeto, ¿qué fracción excluiría la inferencia?
  // Este bucle recorre TODAS las filas (incluyendo las que inferencia no resuelve).
  const FE = {
    gasolina: { total: 0, false: 0, samples: [] },
    diesel:   { total: 0, false: 0, samples: [] },
  };

  for (const row of rows) {
    const declaredNorm = normalizeToken(row.fuel);
    const inferred     = inferFuelFromVersion(row.version);
    for (const [sujeto, bucket] of Object.entries(FE)) {
      if (!declaredNorm.includes(sujeto)) continue;  // oferta no es de este sujeto
      bucket.total++;
      if (inferred !== null && !inferred.includes(sujeto)) {
        // Inferencia dispara y excluye una oferta que debería pasar
        bucket.false++;
        if (bucket.samples.length < 10) {
          bucket.samples.push({ version: row.version, brand: row.brand, model: row.model, declared: row.fuel, inferred });
        }
      }
    }
  }

  const THRESHOLD_FE = 0.005; // 0.5%
  let fePass = true;

  console.log('\n═══ Exclusión falsa por sujeto — MÉTRICA DE DECISIÓN ═══');
  console.log('(Ofertas cuya etiqueta real = sujeto que la inferencia excluiría del pool)');
  for (const [sujeto, bucket] of Object.entries(FE)) {
    const rate = bucket.total > 0 ? bucket.false / bucket.total : 0;
    const ok   = rate < THRESHOLD_FE;
    if (!ok) fePass = false;
    console.log(`${ok ? '✓' : '✗'} ${sujeto.padEnd(22)} total=${String(bucket.total).padStart(6)}  falsas=${String(bucket.false).padStart(5)}  tasa=${pct(bucket.false, bucket.total)}  (umbral <0.50%)`);
    if (bucket.samples.length > 0) {
      bucket.samples.slice(0, 3).forEach(s =>
        console.log(`  EXCLUIDA: [${s.brand} ${s.model}] declared="${s.declared}" inferred="${s.inferred}" version="${s.version}"`)
      );
      if (bucket.false > 3) console.log(`  ... y ${bucket.false - 3} más`);
    }
  }

  console.log(fePass
    ? '\n✓ Exclusión falsa PASA — despliegue condicional aprobado'
    : '\n✗ Exclusión falsa NO PASA — revisar patrones de hibrido/enchufable/electrico');

  console.log('\n⚠  LIMITACIÓN: esta validación mide sobre ofertas ETIQUETADAS (54%).');
  console.log('   El hueco real (Autocasion 46%, Clicars 21%) puede tener textos de versión');
  console.log('   más pobres; la tasa de exclusión falsa real podría ser algo mejor o peor.');

  process.exit(fePass ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(2); });
