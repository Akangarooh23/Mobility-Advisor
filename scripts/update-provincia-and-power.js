/**
 * Actualiza la BD marketplace_vo_offers con:
 *  - Añade columna `provincia` si no existe
 *  - Rellena `provincia` basándose en `location` (incluyendo CARSET → Madrid)
 *  - Extrae CV de los Excels de Astara (VERSIÓN) y Leasys (Modelo) y actualiza `power`
 *
 * Uso: node scripts/update-provincia-and-power.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const XLSX = require("xlsx");
const { Pool } = require("pg");
const path = require("path");

const TABLE = "moveadvisor_marketplace_vo_offers";
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// Mapeo completo location → provincia
const LOCATION_TO_PROVINCIA = {
  "Madrid":       "Madrid",
  "Barcelona":    "Barcelona",
  "Córdoba":      "Córdoba",
  "Cordoba":      "Córdoba",
  "Toda España":  "Toda España",
  "Toda Espana":  "Toda España",
  "CARSET":       "Madrid",   // Leasys campus en Madrid (no estaba mapeado)
};

function slugify(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normKey(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function kwToCv(kw) {
  return Math.round(kw * 1.35962);
}

// Fallback map keyed by normalized brand+model+version substring
// Keys are already normalized (no accents, no special chars, lowercase)
const KNOWN_CV_FALLBACK = [
  // Astara — match against normKey(MARCA + " " + Modelo + " " + VERSION)
  { match: "jeep avenger altitude 1 2",          cv: 100 },
  { match: "jeep avenger summit",                cv: 100 },
  { match: "maxus deliver 9 2 0d",               cv: 163 },
  { match: "honda cr v hybrid elegance 2 0 cvt", cv: 184 },
  { match: "audi q3 sportback e tron",           cv: 245 },
  { match: "audi q2 advanced",                   cv: 116 },
  { match: "kgm tivoli 1 2 4x2",                cv: 128 },
  { match: "subaru crosstrek field 2 0 hybrid",  cv: 150 },
  { match: "mercedes benz gla 200",              cv: 163 },
  { match: "omoda 5 1 6",                        cv: 150 },
  { match: "fiat ulysse m1 2 0",                 cv: 180 },
  { match: "fiat 500e",                          cv:  87 },
  // Leasys — match against normKey(Marca + " " + GAMMA + " " + Modelo)
  { match: "ford explorer 3 0 phev",             cv: 457 },
  { match: "peugeot e 208",                      cv: 136 },
  { match: "peugeot rifter",                     cv: 100 },
  { match: "doblo cargo base plus",              cv:  95 },
  { match: "doblo cargo sx 1 3 mjet",            cv:  95 },
  { match: "doblo cargo sx 1 6 mjet",            cv: 105 },
  { match: "ducato 35",                          cv: 140 },
  { match: "opel combo 1 5 td",                  cv: 102 },
  { match: "jeep compass 1 4 mair 125kw",        cv: 170 },
  { match: "jeep compass 1 4 mair",              cv: 170 },
];

function extractCvFromText(text) {
  if (!text) return null;
  const str = String(text);

  // 1. "(130CV)" o "(83CV)"
  const m1 = str.match(/\((\d{2,3})\s*[Cc][Vv]\)/);
  if (m1) return parseInt(m1[1], 10);

  // 2. Truncado: "(95" o "(105C" al final de string
  const m1b = str.match(/\((\d{2,3})[Cc]?\s*$/);
  if (m1b) return parseInt(m1b[1], 10);

  // 3. "130 CV" o "70CV"
  const m2 = str.match(/(\d{2,3})\s*[Cc][Vv]\b/);
  if (m2) return parseInt(m2[1], 10);

  // 4. PSA/VW motor + número: "Hybrid 136", "PureTech 130", "MHEV 136", "BlueHDI M 180"
  const m3 = str.match(/(?:Hybrid|MHEV|PureTech|BlueHD[Ii]|HDi|TDI|TSI|TFSI|GTD|e-HDi|e-THP|EcoBoost|EcoBlue)\s+(?:[A-Z]\s+)?(\d{3})\b/i);
  if (m3) return parseInt(m3[1], 10);

  // 5. Jumper style: "103KW (140)" → number in parens after kW
  const m4 = str.match(/[Kk][Ww]\s*\((\d{2,3})\)/);
  if (m4) return parseInt(m4[1], 10);

  // 6. kW / k (truncado): "92kW", "88 kW", "70k" at end → convert to CV
  const m5 = str.match(/(\d{2,3})\s*[Kk][Ww]?\b/);
  if (m5) {
    const kw = parseInt(m5[1], 10);
    if (kw >= 40 && kw <= 400) {
      const cv = kwToCv(kw);
      if (cv >= 50 && cv <= 600) return cv;
    }
  }

  return null;
}

function extractCvWithFallback(text, contextKey) {
  const fromText = extractCvFromText(text);
  if (fromText) return fromText;

  const haystack = normKey(contextKey || text);
  for (const { match, cv } of KNOWN_CV_FALLBACK) {
    if (haystack.includes(match)) return cv;
  }
  return null;
}

async function loadExcelCvMap() {
  const cvMap = {}; // bastidor → cv

  const files = [
    { file: "public/Excels VO/11052026 Stockastaramove B2B.xlsx", type: "astara" },
    { file: "public/Excels VO/2 Listado Leasys 21.05.2026.xlsx",  type: "leasys" },
  ];

  for (const { file, type } of files) {
    try {
      const wb = XLSX.readFile(path.resolve(file));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      for (const row of rows) {
        const bastidor = String(row["Bastidor"] || row["BASTIDOR"] || "").trim();
        if (!bastidor) continue;

        const id = `${type}-${slugify(bastidor)}`;
        let cv = null;

        if (type === "astara") {
          const version = row["VERSIÓN"] || row["VERSION"] || "";
          const model   = row["Modelo"] || "";
          cv = extractCvWithFallback(version, `${row["MARCA"]} ${model} ${version}`);
        } else {
          const modelo = row["Modelo"] || "";
          const gamma  = row["GAMMA"] || "";
          cv = extractCvWithFallback(modelo, `${row["Marca"]} ${gamma} ${modelo}`);
        }

        if (cv && cv >= 50 && cv <= 1000) {
          cvMap[id] = cv;
        }
      }
      console.log(`  ${type}: ${rows.length} filas leídas`);
    } catch (e) {
      console.warn(`  ⚠ No se pudo leer ${file}: ${e.message}`);
    }
  }

  return cvMap;
}

async function main() {
  // 1. Añadir columna provincia si no existe
  console.log("Añadiendo columna provincia...");
  await pool.query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS provincia VARCHAR(160)`);
  console.log("  ✓ Columna provincia lista");

  // 2. Actualizar provincia para todos los registros activos
  console.log("\nActualizando provincia...");
  let provinciaUpdated = 0;
  for (const [loc, prov] of Object.entries(LOCATION_TO_PROVINCIA)) {
    const res = await pool.query(
      `UPDATE ${TABLE} SET provincia = $1 WHERE location = $2 AND (provincia IS NULL OR provincia = '')`,
      [prov, loc]
    );
    if (res.rowCount > 0) {
      console.log(`  "${loc}" → "${prov}": ${res.rowCount} registros`);
      provinciaUpdated += res.rowCount;
    }
  }
  // Fallback: si queda alguno sin provincia, usar el propio location
  const fallback = await pool.query(
    `UPDATE ${TABLE} SET provincia = location WHERE is_active = TRUE AND (provincia IS NULL OR provincia = '') AND location IS NOT NULL`
  );
  if (fallback.rowCount > 0) {
    console.log(`  Fallback (location → provincia): ${fallback.rowCount} registros`);
    provinciaUpdated += fallback.rowCount;
  }
  console.log(`  ✓ Total provincia actualizados: ${provinciaUpdated}`);

  // 3. Cargar CV de los Excels
  console.log("\nLeyendo CV de Excels...");
  const cvMap = await loadExcelCvMap();
  const cvIds = Object.keys(cvMap);
  console.log(`  IDs con CV encontrado: ${cvIds.length}`);

  // 4. Actualizar power en BD
  console.log("\nActualizando potencia (CV) en BD...");
  let powerUpdated = 0;
  let powerSkipped = 0;

  for (const [id, cv] of Object.entries(cvMap)) {
    const res = await pool.query(
      `UPDATE ${TABLE} SET power = $1 WHERE id = $2 AND (power IS NULL OR power = '')`,
      [String(cv) + " CV", id]
    );
    if (res.rowCount > 0) {
      powerUpdated++;
    } else {
      powerSkipped++;
    }
  }
  console.log(`  ✓ Power actualizado: ${powerUpdated} registros`);
  if (powerSkipped > 0) {
    console.log(`  (${powerSkipped} IDs de Excel no encontrados en BD o ya tenían power)`);
  }

  // 5. Resumen final
  const { rows: summary } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE is_active) as total,
      COUNT(*) FILTER (WHERE is_active AND (provincia IS NOT NULL AND provincia != '')) as con_provincia,
      COUNT(*) FILTER (WHERE is_active AND (power IS NOT NULL AND power != '')) as con_power,
      COUNT(*) FILTER (WHERE is_active AND (power IS NULL OR power = '')) as sin_power
    FROM ${TABLE}
  `);
  const s = summary[0];
  console.log(`\n=== RESUMEN ===`);
  console.log(`  Activos: ${s.total}`);
  console.log(`  Con provincia: ${s.con_provincia}`);
  console.log(`  Con potencia: ${s.con_power}`);
  console.log(`  Sin potencia aún: ${s.sin_power}`);

  if (Number(s.sin_power) > 0) {
    const { rows: missing } = await pool.query(`
      SELECT brand, model, year, seller FROM ${TABLE}
      WHERE is_active = TRUE AND (power IS NULL OR power = '')
      ORDER BY brand, model
    `);
    console.log(`\n  Sin potencia (${missing.length}):`);
    missing.forEach(r => console.log(`    [${r.seller}] ${r.brand} ${r.model} ${r.year || ""}`));
  }
}

main()
  .catch(e => { console.error("\nERROR:", e.message); process.exit(1); })
  .finally(() => pool.end());
