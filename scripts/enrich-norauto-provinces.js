/**
 * Enriquece workshop_locations (partner=norauto) con provincia usando
 * Nominatim reverse-geocoding para los que no tienen provincia.
 *
 * Uso: node scripts/enrich-norauto-provinces.js
 * Nominatim: max 1 req/s (política de uso justo)
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const https = require("https");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// Mapa código INE (primeros 2 dígitos del CP) → provincia
const CP_PREFIX_TO_PROVINCE = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería",
  "05": "Ávila", "06": "Badajoz", "07": "Islas Baleares", "08": "Barcelona",
  "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón",
  "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca",
  "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León",
  "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid",
  "29": "Málaga", "30": "Murcia", "31": "Navarra", "32": "Ourense",
  "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra",
  "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria",
  "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona",
  "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid",
  "48": "Vizcaya", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta",
  "52": "Melilla",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nominatimReverse(lat, lon) {
  return new Promise((resolve, reject) => {
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
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve(null); }
      });
    }).on("error", () => resolve(null));
  });
}

function extractProvince(nominatimResult) {
  if (!nominatimResult) return null;
  const addr = nominatimResult.address || {};
  // Nominatim devuelve state, county, province según la zona
  return addr.state || addr.county || addr.province || null;
}

async function main() {
  const client = await pool.connect();
  try {
    // 1. Enriquecer los que tienen postcode pero sin provincia
    const { rows: withPostcode } = await client.query(
      `SELECT id, postcode FROM workshop_locations
       WHERE partner = 'norauto' AND province IS NULL AND postcode IS NOT NULL`
    );
    let cpFixed = 0;
    for (const row of withPostcode) {
      const prefix = (row.postcode || "").slice(0, 2);
      const province = CP_PREFIX_TO_PROVINCE[prefix] || null;
      if (province) {
        await client.query(
          `UPDATE workshop_locations SET province = $1, updated_at = NOW() WHERE id = $2`,
          [province, row.id]
        );
        cpFixed++;
      }
    }
    console.log(`CP-prefix: ${cpFixed} provincias rellenadas`);

    // 2. Reverse-geocode los restantes (sin ciudad ni CP)
    const { rows: toGeocode } = await client.query(
      `SELECT id, lat, lon FROM workshop_locations
       WHERE partner = 'norauto' AND province IS NULL
       ORDER BY id`
    );
    console.log(`Nominatim: ${toGeocode.length} centros pendientes...`);

    let geocoded = 0;
    let failed = 0;
    for (let i = 0; i < toGeocode.length; i++) {
      const row = toGeocode[i];
      await sleep(1100); // Nominatim: 1 req/s
      const result = await nominatimReverse(row.lat, row.lon);
      const province = extractProvince(result);
      const city =
        result?.address?.city ||
        result?.address?.town ||
        result?.address?.village ||
        result?.address?.municipality ||
        null;

      if (province || city) {
        await client.query(
          `UPDATE workshop_locations SET
             province = COALESCE(province, $1),
             city     = COALESCE(city, $2),
             updated_at = NOW()
           WHERE id = $3`,
          [province, city, row.id]
        );
        geocoded++;
      } else {
        failed++;
      }

      if ((i + 1) % 10 === 0) {
        process.stdout.write(`  ${i + 1}/${toGeocode.length} procesados\n`);
      }
    }
    console.log(`Nominatim: ${geocoded} OK, ${failed} sin datos`);

    // 3. Resumen final
    const { rows: summary } = await client.query(
      `SELECT COALESCE(province, '(sin provincia)') AS province, count(*) AS total
       FROM workshop_locations WHERE partner = 'norauto'
       GROUP BY province ORDER BY total DESC`
    );
    console.log("\nResumen final por provincia:");
    summary.forEach((r) => console.log(`  ${r.province}: ${r.total}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
