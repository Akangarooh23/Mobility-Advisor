/**
 * fix-as24-price-from-twins.js
 *
 * Para los anuncios de AutoScout24 (donde el precio publicado es el financiado),
 * busca el precio de contado usando "gemelos": el mismo coche publicado en otro
 * portal (brand + version normalizada + year + mileage exacto).
 *
 * Qué escribe:
 *   - finance_price = precio actual de AS24 (el financiado, que es el publicado)
 *   - price        = precio del gemelo en otro portal (el de contado)
 *
 * Guardarraíles:
 *   - Solo actúa si twin.price > as24.price (el contado siempre es mayor)
 *   - Solo si ratio twin/as24 < 1.5 (fuera de ahí es ruido o coche distinto)
 *   - Solo si finance_price IS NULL (no sobrescribir correcciones previas)
 *   - Usa la mediana de todos los gemelos encontrados (robusto a outliers)
 *
 * Uso:
 *   node scripts/fix-as24-price-from-twins.js               (en seco — solo muestra)
 *   node scripts/fix-as24-price-from-twins.js --aplicar     (escribe en BD)
 *   node scripts/fix-as24-price-from-twins.js --limit 500   (limitar muestra)
 *   node scripts/fix-as24-price-from-twins.js --limit 0     (sin límite)
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const { Client } = require("pg");

// ── env ────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL no está definida en .env.local");
  process.exit(1);
}

const APLICAR    = process.argv.includes("--aplicar");
const LIMIT_IDX  = process.argv.indexOf("--limit");
const LIMIT      = LIMIT_IDX !== -1
  ? (Number(process.argv[LIMIT_IDX + 1]) || 0)
  : 50000;   // sin --limit: hasta 50k (prácticamente sin límite)

// ── consulta ───────────────────────────────────────────────────────────────
//
// Empareja cada anuncio de AS24 con sus gemelos en otros portales usando
// brand + version normalizadas + year + mileage exacto.
// Usa la mediana del precio de los gemelos como precio de contado.
//
// Normalización: lower(regexp_replace(campo, '[^a-zA-Z0-9]', '', 'g'))
// (igual que el SQL de comprobación del encargo)
//
const QUERY_TWINS = `
WITH as24 AS (
  SELECT id,
         price                                                         AS as24_price,
         lower(regexp_replace(brand,   '[^a-zA-Z0-9]', '', 'g'))      AS nb,
         lower(regexp_replace(version, '[^a-zA-Z0-9]', '', 'g'))      AS nv,
         year,
         mileage
  FROM moveadvisor_market_offers
  WHERE portal       = 'autoscout24'
    AND COALESCE(is_active, TRUE)
    AND price        > 0
    AND finance_price IS NULL
    AND version      IS NOT NULL AND version <> ''
    AND year         IS NOT NULL
    AND mileage      > 1000
    AND mileage % 1000 <> 0
),
otros AS (
  SELECT lower(regexp_replace(brand,   '[^a-zA-Z0-9]', '', 'g'))      AS nb,
         lower(regexp_replace(version, '[^a-zA-Z0-9]', '', 'g'))      AS nv,
         year,
         mileage,
         price                                                         AS twin_price,
         portal                                                        AS twin_portal
  FROM moveadvisor_market_offers
  WHERE portal      <> 'autoscout24'
    AND COALESCE(is_active, TRUE)
    AND price        > 0
    AND version      IS NOT NULL AND version <> ''
    AND year         IS NOT NULL
    AND mileage      > 1000
    AND mileage % 1000 <> 0
),
pares AS (
  SELECT a.id                                                             AS as24_id,
         a.as24_price,
         MIN(o.twin_price)                                               AS twin_min,
         MAX(o.twin_price)                                               AS twin_max,
         PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY o.twin_price)       AS contado_median,
         COUNT(*)                                                         AS n_gemelos,
         STRING_AGG(DISTINCT o.twin_portal, ', ' ORDER BY o.twin_portal) AS portales
  FROM as24 a
  JOIN otros o ON a.nb = o.nb AND a.nv = o.nv AND a.year = o.year AND a.mileage = o.mileage
  WHERE o.twin_price > a.as24_price             -- gemelo más caro = contado
    AND o.twin_price < a.as24_price * 1.5       -- guardarraíl: no más del 50%
  GROUP BY a.id, a.as24_price
)
SELECT as24_id,
       as24_price,
       ROUND(contado_median::numeric)::int                        AS contado_price,
       n_gemelos,
       portales,
       twin_min = twin_max                                        AS unanimous,
       ROUND((contado_median / as24_price::numeric)::numeric, 3) AS ratio
FROM pares
-- Solo los unánimes: todos los gemelos coinciden en el mismo precio de contado
WHERE twin_min = twin_max
ORDER BY n_gemelos DESC, as24_id
${LIMIT > 0 ? `LIMIT ${LIMIT}` : ""}
`;

const QUERY_UPDATE = `
UPDATE moveadvisor_market_offers
SET  finance_price = $2,
     price         = $3,
     updated_at    = NOW()
WHERE id = $1
  AND portal       = 'autoscout24'
  AND finance_price IS NULL
`;

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log(`\n=== fix-as24-price-from-twins (${APLICAR ? "APLICAR" : "en seco"}) ===\n`);
  console.log("Buscando gemelos en la BD...");

  const { rows } = await client.query(QUERY_TWINS);
  console.log(`Pares encontrados: ${rows.length}\n`);

  if (!rows.length) {
    console.log("Sin pares — nada que hacer.");
    await client.end();
    return;
  }

  // Estadísticas de ratios
  const ratios = rows.map(r => parseFloat(r.ratio));
  ratios.sort((a, b) => a - b);
  const medRatio = ratios[Math.floor(ratios.length / 2)];
  const avgDiff  = rows.reduce((s, r) => s + (r.contado_price - r.as24_price), 0) / rows.length;

  console.log(`  Ratio mediano (contado/financiado): ${medRatio}`);
  console.log(`  Diferencia media: +${Math.round(avgDiff)} €`);
  const portalCounts = {};
  for (const r of rows) {
    for (const p of r.portales.split(", ")) portalCounts[p] = (portalCounts[p] || 0) + 1;
  }
  console.log(`  Fuentes de gemelos: ${Object.entries(portalCounts).map(([k,v]) => `${k}(${v})`).join(', ')}`);

  // Muestra previa (máx 20 ejemplos)
  console.log("\n=== Muestra (primeros 20) ===");
  const sample = rows.slice(0, 20);
  for (const r of sample) {
    console.log(
      `  id=${String(r.as24_id).padEnd(36)}  financiado=${String(r.as24_price).padStart(7)}  ` +
      `contado=${String(r.contado_price).padStart(7)}  ratio=${r.ratio}  ` +
      `gemelos=${r.n_gemelos}  portales=${r.portales}`
    );
  }
  if (rows.length > 20) console.log(`  ... y ${rows.length - 20} más`);

  if (!APLICAR) {
    console.log(`\nEn seco — sin cambios. Usa --aplicar para escribir ${rows.length} registros (unánimes).\n`);
    await client.end();
    return;
  }

  // Aplicar updates
  console.log(`\nAplicando ${rows.length} updates...`);
  let ok = 0, skip = 0, err = 0;
  for (const r of rows) {
    try {
      const res = await client.query(QUERY_UPDATE, [r.as24_id, r.as24_price, r.contado_price]);
      if (res.rowCount > 0) ok++;
      else skip++;   // ya tenía finance_price (condición de la query, pero por si acaso)
    } catch (e) {
      err++;
      console.error(`  ERROR id=${r.as24_id}: ${e.message}`);
    }
  }

  console.log(`\n=== Resultado ===`);
  console.log(`  Actualizados: ${ok}`);
  console.log(`  Saltados (ya tenían finance_price): ${skip}`);
  console.log(`  Errores: ${err}`);
  console.log(`\nVerificación post-ejecución (pega en Neon/psql):`);
  console.log(`  SELECT COUNT(*) FROM moveadvisor_market_offers`);
  console.log(`    WHERE portal='autoscout24' AND finance_price IS NOT NULL;\n`);

  await client.end();
}

main().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
