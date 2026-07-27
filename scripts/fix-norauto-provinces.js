/**
 * Corrige las provincias que quedaron a nivel CCAA (Comunidad de Madrid, Cataluña, etc.)
 * volviendo a hacer reverse-geocode con addr.county para obtener la provincia exacta.
 *
 * Uso: node scripts/fix-norauto-provinces.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const https = require("https");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// CCAAs → si Nominatim devuelve esto como province, relanzar con county
const CCAA_LEVEL = new Set([
  "Comunidad de Madrid", "Comunidad Valenciana", "Cataluña", "Catalunya",
  "Andalucía", "País Vasco", "Euskadi", "Aragón", "Castilla y León",
  "Castilla-La Mancha", "Galicia", "Extremadura", "Murcia",
  "Región de Murcia", "Navarra", "Comunidad Foral de Navarra",
  "Asturias", "Principado de Asturias", "Cantabria", "La Rioja",
  "Islas Canarias", "Canarias",
]);

// Mapa directo de Comunidades uninominales
const CCAA_TO_PROVINCE = {
  "Comunidad de Madrid": "Madrid",
  "Asturias": "Asturias",
  "Principado de Asturias": "Asturias",
  "Cantabria": "Cantabria",
  "La Rioja": "La Rioja",
  "Murcia": "Murcia",
  "Región de Murcia": "Murcia",
  "Navarra": "Navarra",
  "Comunidad Foral de Navarra": "Navarra",
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function nominatimReverse(lat, lon) {
  return new Promise((resolve) => {
    const path = `/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es&zoom=10`;
    const options = {
      hostname: "nominatim.openstreetmap.org",
      path,
      method: "GET",
      headers: { "User-Agent": "CarsWise/1.0 (movilidad-advisor; anapicazokangaroo@gmail.com)" },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

function resolveProvince(addr) {
  if (!addr) return null;
  // Preferir county (provincia) sobre state (CCAA)
  const county = addr.county || addr.province;
  if (county && !CCAA_LEVEL.has(county)) return county;
  const state = addr.state;
  if (state && CCAA_TO_PROVINCE[state]) return CCAA_TO_PROVINCE[state];
  return county || state || null;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, lat, lon, province FROM workshop_locations
       WHERE partner = 'norauto'
         AND (province IS NULL OR province = ANY($1))
       ORDER BY id`,
      [Array.from(CCAA_LEVEL)]
    );
    console.log(`Corrigiendo ${rows.length} centros con provincia a nivel CCAA...`);

    let fixed = 0;
    let unchanged = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      await sleep(1100);
      const result = await nominatimReverse(row.lat, row.lon);
      const province = resolveProvince(result?.address);
      const city =
        result?.address?.city ||
        result?.address?.town ||
        result?.address?.village ||
        result?.address?.municipality ||
        null;

      if (province && province !== row.province) {
        await client.query(
          `UPDATE workshop_locations SET province=$1, city=COALESCE(city,$2), updated_at=NOW() WHERE id=$3`,
          [province, city, row.id]
        );
        fixed++;
        if (process.env.VERBOSE) console.log(`  #${row.id} ${row.province} → ${province} (${city})`);
      } else {
        unchanged++;
      }

      if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${rows.length}\n`);
    }

    console.log(`Corregidos: ${fixed}, sin cambio: ${unchanged}`);

    const { rows: summary } = await client.query(
      `SELECT COALESCE(province,'(sin provincia)') AS province, count(*) AS total
       FROM workshop_locations WHERE partner='norauto'
       GROUP BY province ORDER BY total DESC`
    );
    console.log("\nResumen final:");
    summary.forEach((r) => console.log(`  ${r.province}: ${r.total}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
