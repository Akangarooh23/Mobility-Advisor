/**
 * check-catalog-alias-gap.js
 *
 * Detecta marcas en el catálogo de UI (vehicle-catalog.json) que no tienen
 * cobertura en la BD de aliases NI en la tabla de segmentos de sellReportGenerator.js.
 *
 * Sin cobertura de alias → fail-closed devuelve n=0 → precio por depreciación.
 * Sin cobertura de segmento → refPrice=22000 (default mainstream) → estimación errónea.
 *
 * Uso: node scripts/check-catalog-alias-gap.js
 */

require("dotenv").config({ path: ".env.local" });

const fs   = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(__dirname, "../src/data/vehicle-catalog.json");

// Segmentos de sellReportGenerator.js (duplicados aquí para evitar require circular)
const SEGMENT_BRANDS = [
  "koenigsegg","pagani","bugatti","czinger","rimac",
  "ferrari","lamborghini","bentley","rolls-royce","rolls royce","aston martin","mclaren",
  "porsche","maserati","jaguar","lexus","genesis",
  "bmw","mercedes","audi","volvo","alfa romeo","alfa","mini","cupra","land rover","infiniti",
  "volkswagen","vw","toyota","ford","opel","vauxhall","peugeot","citroen","renault",
  "seat","skoda","hyundai","kia","nissan","mazda","honda","mitsubishi",
  "fiat","jeep","suzuki","subaru","chevrolet","dodge","tesla",
  "dacia","mg","lada","microcar","ligier","aixam","smart",
];

function normalizeCompact(text) {
  return (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}

function inSegments(brand) {
  const b = brand.toLowerCase().trim();
  return SEGMENT_BRANDS.some((n) => b.includes(n) || n.includes(b));
}

async function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const catalogBrands = Object.keys(catalog).sort();

  // Query alias keys from DB
  let aliasKeys = new Set();
  try {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const res = await pool.query("SELECT alias_key FROM moveadvisor_brand_aliases WHERE is_active = TRUE");
    aliasKeys = new Set(res.rows.map((r) => r.alias_key));
    await pool.end();
  } catch (e) {
    console.error("Error conectando a BD:", e.message);
    process.exit(1);
  }

  const noAlias   = [];
  const noSegment = [];

  for (const brand of catalogBrands) {
    const key = normalizeCompact(brand);
    if (!aliasKeys.has(key)) noAlias.push(brand);
    if (!inSegments(brand))  noSegment.push(brand);
  }

  console.log(`\nCatálogo UI: ${catalogBrands.length} marcas`);
  console.log(`Aliases BD:  ${aliasKeys.size} alias activos\n`);

  console.log(`── Sin alias en BD (${noAlias.length}) ─────────────────────────────────`);
  console.log(noAlias.length ? noAlias.join(", ") : "  (ninguna — catálogo cubierto)");

  console.log(`\n── Sin segmento (refPrice = default 22000€) (${noSegment.length}) ────`);
  console.log(noSegment.length ? noSegment.join(", ") : "  (ninguna — todos con segmento asignado)");

  const both = noAlias.filter((b) => noSegment.includes(b));
  if (both.length) {
    console.log(`\n⚠  Doble hueco — sin alias Y sin segmento (${both.length}):`);
    console.log("   " + both.join(", "));
    console.log("   → ratio-check usará refPrice=22000€ → estimación muy imprecisa");
  }

  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
