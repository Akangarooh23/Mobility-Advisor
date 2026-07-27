/**
 * Asigna provincia a los workshop_locations sin ella usando el método
 * nearest-centroid: calcula la distancia haversine a las 52 capitales de
 * provincia y asigna la más cercana. Sin llamadas a APIs externas.
 *
 * Uso: node scripts/enrich-workshops-province.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// Capitales de las 52 provincias españolas (lat, lon)
const PROVINCE_CENTROIDS = [
  { province: "Álava",                   lat: 42.8467, lon: -2.6726 },
  { province: "Albacete",                lat: 38.9942, lon: -1.8564 },
  { province: "Alicante",                lat: 38.3453, lon: -0.4831 },
  { province: "Almería",                 lat: 36.8340, lon: -2.4637 },
  { province: "Asturias",                lat: 43.3614, lon: -5.8593 },
  { province: "Ávila",                   lat: 40.6567, lon: -4.6954 },
  { province: "Badajoz",                 lat: 38.8794, lon: -6.9706 },
  { province: "Barcelona",               lat: 41.3879, lon:  2.1699 },
  { province: "Burgos",                  lat: 42.3439, lon: -3.6969 },
  { province: "Cáceres",                 lat: 39.4752, lon: -6.3724 },
  { province: "Cádiz",                   lat: 36.5271, lon: -6.2886 },
  { province: "Cantabria",               lat: 43.4623, lon: -3.8099 },
  { province: "Castellón",               lat: 39.9864, lon: -0.0513 },
  { province: "Ciudad Real",             lat: 38.9848, lon: -3.9274 },
  { province: "Córdoba",                 lat: 37.8882, lon: -4.7794 },
  { province: "A Coruña",               lat: 43.3623, lon: -8.4115 },
  { province: "Cuenca",                  lat: 40.0704, lon: -2.1374 },
  { province: "Girona",                  lat: 41.9794, lon:  2.8214 },
  { province: "Granada",                 lat: 37.1773, lon: -3.5986 },
  { province: "Guadalajara",             lat: 40.6334, lon: -3.1679 },
  { province: "Gipuzkoa",               lat: 43.3183, lon: -1.9812 },
  { province: "Huelva",                  lat: 37.2614, lon: -6.9447 },
  { province: "Huesca",                  lat: 42.1362, lon: -0.4089 },
  { province: "Islas Baleares",          lat: 39.5696, lon:  2.6502 },
  { province: "Jaén",                    lat: 37.7796, lon: -3.7849 },
  { province: "La Rioja",               lat: 42.4650, lon: -2.4456 },
  { province: "Las Palmas",              lat: 28.1248, lon: -15.4300 },
  { province: "León",                    lat: 42.5987, lon: -5.5671 },
  { province: "Lleida",                  lat: 41.6176, lon:  0.6200 },
  { province: "Lugo",                    lat: 43.0097, lon: -7.5567 },
  { province: "Madrid",                  lat: 40.4168, lon: -3.7038 },
  { province: "Málaga",                  lat: 36.7213, lon: -4.4214 },
  { province: "Murcia",                  lat: 37.9922, lon: -1.1307 },
  { province: "Navarra",                 lat: 42.8169, lon: -1.6432 },
  { province: "Ourense",                 lat: 42.3361, lon: -7.8639 },
  { province: "Palencia",                lat: 42.0096, lon: -4.5288 },
  { province: "Pontevedra",              lat: 42.4310, lon: -8.6442 },
  { province: "Salamanca",               lat: 40.9701, lon: -5.6635 },
  { province: "Santa Cruz de Tenerife",  lat: 28.4636, lon: -16.2518 },
  { province: "Segovia",                 lat: 40.9429, lon: -4.1088 },
  { province: "Sevilla",                 lat: 37.3891, lon: -5.9845 },
  { province: "Soria",                   lat: 41.7640, lon: -2.4651 },
  { province: "Tarragona",               lat: 41.1189, lon:  1.2445 },
  { province: "Teruel",                  lat: 40.3440, lon: -1.1059 },
  { province: "Toledo",                  lat: 39.8567, lon: -4.0244 },
  { province: "Valencia",                lat: 39.4699, lon: -0.3763 },
  { province: "Valladolid",              lat: 41.6523, lon: -4.7245 },
  { province: "Vizcaya",                 lat: 43.2630, lon: -2.9350 },
  { province: "Zamora",                  lat: 41.5003, lon: -5.7441 },
  { province: "Zaragoza",                lat: 41.6488, lon: -0.8891 },
  { province: "Ceuta",                   lat: 35.8894, lon: -5.3198 },
  { province: "Melilla",                 lat: 35.2923, lon: -2.9381 },
];

// Haversine distance en km
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestProvince(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const c of PROVINCE_CENTROIDS) {
    const d = haversine(lat, lon, c.lat, c.lon);
    if (d < bestDist) { bestDist = d; best = c.province; }
  }
  return best;
}

// Bounding box de España (península + Canarias + Ceuta + Melilla)
// Rechaza coordenadas claramente fuera de España (datos OSM erróneos)
function isInSpain(lat, lon) {
  const peninsula   = lat >= 35.9 && lat <= 43.8 && lon >= -9.3 && lon <= 4.3;
  const canarias    = lat >= 27.0 && lat <= 29.5 && lon >= -18.2 && lon <= -13.0;
  const ceuta       = lat >= 35.7 && lat <= 36.2 && lon >= -5.5  && lon <= -5.0;
  const melilla     = lat >= 35.1 && lat <= 35.5 && lon >= -3.1  && lon <= -2.7;
  return peninsula || canarias || ceuta || melilla;
}

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, lat, lon FROM workshop_locations
       WHERE province IS NULL AND lat IS NOT NULL AND lon IS NOT NULL
       ORDER BY id`
    );
    console.log(`Enriqueciendo ${rows.length} talleres sin provincia…`);

    let assigned = 0;
    let skipped = 0;
    const updates = [];

    for (const row of rows) {
      if (!isInSpain(row.lat, row.lon)) { skipped++; continue; }
      const province = nearestProvince(row.lat, row.lon);
      updates.push([province, row.id]);
      assigned++;
    }

    // Bulk update en batches de 500
    const BATCH = 500;
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH);
      // Construir query multi-row
      const values = slice.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2}::int)`).join(",");
      const params = slice.flat();
      await client.query(
        `UPDATE workshop_locations AS w SET
           province   = v.province,
           updated_at = NOW()
         FROM (VALUES ${values}) AS v(province, id)
         WHERE w.id = v.id`,
        params
      );
      process.stdout.write(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}\n`);
    }

    console.log(`\nListo: ${assigned} asignados, ${skipped} fuera de España ignorados`);

    // Resumen final completo
    const { rows: summary } = await client.query(
      `SELECT COALESCE(province,'(sin provincia)') AS province, count(*) AS total
       FROM workshop_locations
       GROUP BY province ORDER BY total DESC`
    );
    console.log(`\nTotal: ${summary.reduce((s,r)=>s+parseInt(r.total),0)} talleres`);
    console.log("\nTop 20 provincias:");
    summary.slice(0, 20).forEach((r) => console.log(`  ${r.province}: ${r.total}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
