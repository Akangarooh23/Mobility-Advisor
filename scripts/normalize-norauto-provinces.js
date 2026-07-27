/**
 * Normaliza provincias al nivel estándar de las 52 provincias españolas.
 * Comarcas, regiones y otros geo-niveles los mapea a su provincia correcta.
 *
 * Uso: node scripts/normalize-norauto-provinces.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const https = require("https");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// 52 provincias españolas (nombres canónicos)
const VALID_PROVINCES = new Set([
  "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila",
  "Badajoz", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Cantabria",
  "Castellón", "Ciudad Real", "Córdoba", "A Coruña", "Cuenca",
  "Girona", "Granada", "Guadalajara", "Gipuzkoa", "Huelva", "Huesca",
  "Islas Baleares", "Jaén", "La Rioja", "Las Palmas", "León", "Lleida",
  "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Ourense",
  "Palencia", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife",
  "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo",
  "Valencia", "Valladolid", "Vizcaya", "Zamora", "Zaragoza",
  "Ceuta", "Melilla",
]);

// Mapa de valores no-estándar que puede devolver Nominatim → provincia correcta
const NORMALIZE = {
  // Comarcas de Cataluña → Provincia
  "Vallés Oriental": "Barcelona", "Vallés Occidental": "Barcelona",
  "Bajo Llobregat": "Barcelona", "Maresme": "Barcelona",
  "Osona": "Barcelona", "Bages": "Barcelona", "Anoia": "Barcelona",
  "Berguedà": "Barcelona", "Garraf": "Barcelona", "Baix Penedès": "Tarragona",
  "Baix Llobregat": "Barcelona", "Barcelonès": "Barcelona",
  "Alt Penedès": "Barcelona", "Selva": "Girona", "Gironès": "Girona",
  "Gironés": "Girona", "La Selva": "Girona", "Tarragonès": "Tarragona",
  "Tarragonés": "Tarragona", "Bajo Campo": "Tarragona",
  // País Vasco — cuadrillas de Álava
  "Estribaciones del Gorbea": "Álava", "Montaña Alavesa": "Álava",
  "Llanada Alavesa": "Álava", "Rioja Alavesa": "Álava",
  // Navarra
  "Comarca de Pamplona": "Navarra", "Pamplona": "Navarra",
  // Cádiz
  "Campo de Gibraltar": "Cádiz", "Campiña de Jerez": "Cádiz",
  "La Janda": "Cádiz",
  // Alicante
  "La Vega Baja": "Alicante", "Vega Baja del Segura": "Alicante",
  "Baix Vinalopó": "Alicante", "Baix Segura": "Alicante",
  // Málaga
  "Costa del Sol Occidental": "Málaga", "Axarquía": "Málaga",
  // A Coruña
  "Ferrol": "A Coruña",
  // Guipúzcoa normalization
  "Guipúzcoa": "Gipuzkoa", "Gipuzkoa": "Gipuzkoa",
  // Comunidades uninominales que pasaron sin normalizar
  "Comunidad de Madrid": "Madrid",
  "Asturias": "Asturias", "Principado de Asturias": "Asturias",
  "Cantabria": "Cantabria", "La Rioja": "La Rioja",
  "Murcia": "Murcia", "Región de Murcia": "Murcia",
  "Navarra": "Navarra", "Comunidad Foral de Navarra": "Navarra",
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function nominatimReverse(lat, lon) {
  return new Promise((resolve) => {
    const path = `/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es&zoom=8`;
    const options = {
      hostname: "nominatim.openstreetmap.org",
      path,
      method: "GET",
      headers: { "User-Agent": "CarsWise/1.0 (movilidad-advisor; anapicazokangaroo@gmail.com)" },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

function resolveProvince(addr) {
  if (!addr) return null;
  // zoom=8 da state_district = provincia directamente en muchos casos
  const candidates = [
    addr.state_district,
    addr.county,
    addr.province,
    addr.state,
  ].filter(Boolean);

  for (const c of candidates) {
    if (VALID_PROVINCES.has(c)) return c;
    if (NORMALIZE[c]) return NORMALIZE[c];
  }
  // Último recurso: normalizar el primero disponible
  const first = candidates[0];
  return first || null;
}

async function main() {
  const client = await pool.connect();
  try {
    // Calcular qué entradas tienen provincia inválida (no en la lista de 52)
    const { rows: all } = await client.query(
      `SELECT id, lat, lon, province FROM workshop_locations WHERE partner='norauto' ORDER BY id`
    );

    const toFix = all.filter(
      (r) => !r.province || (!VALID_PROVINCES.has(r.province) && !NORMALIZE[r.province])
    );

    // También incluir las que tienen valor de NORMALIZE (para actualizar a la forma canónica)
    const toNormalize = all.filter(
      (r) => r.province && NORMALIZE[r.province] && !VALID_PROVINCES.has(r.province)
    );

    // Normalizar directamente los que ya tienen el valor de NORMALIZE
    let normalized = 0;
    for (const row of toNormalize) {
      const canonical = NORMALIZE[row.province];
      if (canonical && canonical !== row.province) {
        await client.query(
          `UPDATE workshop_locations SET province=$1, updated_at=NOW() WHERE id=$2`,
          [canonical, row.id]
        );
        normalized++;
      }
    }
    console.log(`Normalizados (mapa directo): ${normalized}`);

    // Re-geocodificar los que quedan sin provincia válida
    const needsGeocode = toFix.filter(
      (r) => !NORMALIZE[r.province || ""]
    );
    console.log(`Re-geocodificando: ${needsGeocode.length} centros...`);

    let geocoded = 0;
    for (let i = 0; i < needsGeocode.length; i++) {
      const row = needsGeocode[i];
      await sleep(1100);
      const result = await nominatimReverse(row.lat, row.lon);
      const province = resolveProvince(result?.address);

      if (province) {
        await client.query(
          `UPDATE workshop_locations SET province=$1, updated_at=NOW() WHERE id=$2`,
          [province, row.id]
        );
        geocoded++;
      } else {
        console.warn(`  #${row.id} sin datos (lat=${row.lat} lon=${row.lon})`);
      }
      if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${needsGeocode.length}\n`);
    }
    console.log(`Re-geocodificados: ${geocoded}`);

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
