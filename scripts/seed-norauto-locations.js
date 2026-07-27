/**
 * Importa centros Norauto España desde OpenStreetMap (Overpass API)
 * y los inserta en la tabla workshop_locations.
 *
 * Uso: node scripts/seed-norauto-locations.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const https = require("https");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// Mapa ciudad → provincia para las ciudades más frecuentes donde hay Norauto
const CITY_TO_PROVINCE = {
  madrid: "Madrid", barcelona: "Barcelona", valencia: "Valencia",
  sevilla: "Sevilla", zaragoza: "Zaragoza", málaga: "Málaga", malaga: "Málaga",
  murcia: "Murcia", palma: "Islas Baleares", "palma de mallorca": "Islas Baleares",
  "las palmas": "Las Palmas", "las palmas de gran canaria": "Las Palmas",
  bilbao: "Vizcaya", alicante: "Alicante", córdoba: "Córdoba", cordoba: "Córdoba",
  valladolid: "Valladolid", vigo: "Pontevedra", gijón: "Asturias", gijon: "Asturias",
  granada: "Granada", "l'hospitalet de llobregat": "Barcelona", hospitalet: "Barcelona",
  vitoria: "Álava", "vitoria-gasteiz": "Álava", "a coruña": "A Coruña", coruña: "A Coruña",
  elche: "Alicante", oviedo: "Asturias", badalona: "Barcelona", cartagena: "Murcia",
  terrassa: "Barcelona", "santa coloma de gramenet": "Barcelona", jerez: "Cádiz",
  "jerez de la frontera": "Cádiz", sabadell: "Barcelona", marbella: "Málaga",
  almería: "Almería", almeria: "Almería", donostia: "Gipuzkoa",
  "san sebastián": "Gipuzkoa", "san sebastian": "Gipuzkoa",
  santander: "Cantabria", burgos: "Burgos", albacete: "Albacete",
  castellón: "Castellón", castellon: "Castellón", "castelló de la plana": "Castellón",
  logroño: "La Rioja", lograno: "La Rioja", badajoz: "Badajoz", salamanca: "Salamanca",
  huelva: "Huelva", tarragona: "Tarragona", lleida: "Lleida", lérida: "Lleida",
  jaén: "Jaén", jaen: "Jaén", ourense: "Ourense", lugo: "Lugo",
  cáceres: "Cáceres", caceres: "Cáceres", toledo: "Toledo", cuenca: "Cuenca",
  cádiz: "Cádiz", cadiz: "Cádiz", ferrol: "A Coruña", pontevedra: "Pontevedra",
  pamplona: "Navarra", iruña: "Navarra", getafe: "Madrid", alcalá: "Madrid",
  "alcalá de henares": "Madrid", leganés: "Madrid", leganes: "Madrid",
  móstoles: "Madrid", mostoles: "Madrid", fuenlabrada: "Madrid", alcorcón: "Madrid",
  alcorcon: "Madrid", torrejón: "Madrid", "torrejón de ardoz": "Madrid",
  pozuelo: "Madrid", "pozuelo de alarcón": "Madrid", rivas: "Madrid",
  parla: "Madrid", alcobendas: "Madrid", majadahonda: "Madrid",
  tenerife: "Santa Cruz de Tenerife", "santa cruz de tenerife": "Santa Cruz de Tenerife",
  "san cristóbal de la laguna": "Santa Cruz de Tenerife", laguna: "Santa Cruz de Tenerife",
  "puerto de la cruz": "Santa Cruz de Tenerife", arona: "Santa Cruz de Tenerife",
  arrecife: "Las Palmas", "puerto del rosario": "Las Palmas",
  ibiza: "Islas Baleares", eivissa: "Islas Baleares", mahón: "Islas Baleares", mahon: "Islas Baleares",
  girona: "Girona", gerona: "Girona", manresa: "Barcelona", mataró: "Barcelona",
  mataro: "Barcelona", rubí: "Barcelona", rubi: "Barcelona",
  "l'hospitalet": "Barcelona", cornellà: "Barcelona", cornella: "Barcelona",
  "el prat": "Barcelona", viladecans: "Barcelona", gavà: "Barcelona", gava: "Barcelona",
  granollers: "Barcelona", mollet: "Barcelona", cerdanyola: "Barcelona",
};

function inferProvince(tags) {
  if (tags["addr:province"]) return tags["addr:province"];
  if (tags["addr:state"]) return tags["addr:state"];
  const city = (tags["addr:city"] || tags["addr:town"] || tags["addr:municipality"] || "").toLowerCase().trim();
  return CITY_TO_PROVINCE[city] || null;
}

function fetchOverpass() {
  const query = `[out:json][timeout:90];
area["ISO3166-1"="ES"]->.spain;
(
  node["brand"="Norauto"](area.spain);
  way["brand"="Norauto"](area.spain);
  relation["brand"="Norauto"](area.spain);
  node["name"~"[Nn]orauto"](area.spain);
  way["name"~"[Nn]orauto"](area.spain);
);
out center;`;

  const postBody = "data=" + encodeURIComponent(query);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "overpass-api.de",
      path: "/api/interpreter",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postBody),
        "User-Agent": "CarsWise/1.0 (movilidad-advisor)",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (!data.trim().startsWith("{")) {
          reject(new Error("Respuesta inesperada de Overpass:\n" + data.slice(0, 300)));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("JSON parse error: " + e.message));
        }
      });
    });

    req.on("error", reject);
    req.write(postBody);
    req.end();
  });
}

function normalizeElement(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;

  if (!lat || !lon) return null;

  const name = tags["name"] || tags["brand"] || "Norauto";
  const street = tags["addr:street"] || null;
  const housenumber = tags["addr:housenumber"] || null;
  const address = [street, housenumber].filter(Boolean).join(", ") || null;
  const city = tags["addr:city"] || tags["addr:town"] || tags["addr:municipality"] || null;
  const postcode = tags["addr:postcode"] || null;
  const province = inferProvince(tags);
  const phone =
    tags["phone"] || tags["contact:phone"] || tags["contact:mobile"] || null;
  const website =
    tags["website"] || tags["contact:website"] || tags["url"] || null;
  const osmId = `${el.type}/${el.id}`;

  return { osmId, name, address, city, postcode, province, lat, lon, phone, website };
}

async function createTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS workshop_locations (
      id            SERIAL PRIMARY KEY,
      partner       VARCHAR(64)  NOT NULL DEFAULT 'norauto',
      osm_id        VARCHAR(64)  UNIQUE,
      name          VARCHAR(255) NOT NULL,
      address       TEXT,
      city          VARCHAR(128),
      postcode      VARCHAR(16),
      province      VARCHAR(128),
      lat           DOUBLE PRECISION NOT NULL,
      lon           DOUBLE PRECISION NOT NULL,
      phone         VARCHAR(64),
      website       VARCHAR(512),
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_workshop_locations_partner ON workshop_locations(partner);
    CREATE INDEX IF NOT EXISTS idx_workshop_locations_province ON workshop_locations(province);
  `);
}

async function main() {
  console.log("Consultando Overpass API para centros Norauto en España...");
  const osm = await fetchOverpass();
  const elements = osm.elements || [];
  console.log(`  → ${elements.length} elementos OSM recibidos`);

  const locations = elements
    .map(normalizeElement)
    .filter(Boolean)
    // dedup por osm_id
    .filter((loc, idx, arr) => arr.findIndex((x) => x.osmId === loc.osmId) === idx);

  console.log(`  → ${locations.length} centros Norauto válidos (con coordenadas)`);
  if (!locations.length) {
    console.log("Sin resultados — comprueba la query Overpass.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await createTable(client);
    console.log("Tabla workshop_locations lista.");

    let inserted = 0;
    let updated = 0;

    for (const loc of locations) {
      const { rowCount, rows } = await client.query(
        `INSERT INTO workshop_locations
           (partner, osm_id, name, address, city, postcode, province, lat, lon, phone, website)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (osm_id) DO UPDATE SET
           name     = EXCLUDED.name,
           address  = EXCLUDED.address,
           city     = EXCLUDED.city,
           postcode = EXCLUDED.postcode,
           province = EXCLUDED.province,
           lat      = EXCLUDED.lat,
           lon      = EXCLUDED.lon,
           phone    = EXCLUDED.phone,
           website  = EXCLUDED.website,
           updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        ["norauto", loc.osmId, loc.name, loc.address, loc.city, loc.postcode,
          loc.province, loc.lat, loc.lon, loc.phone, loc.website]
      );
      if (rows[0]?.inserted) inserted++;
      else updated++;
    }

    console.log(`\nListo: ${inserted} insertados, ${updated} actualizados.`);

    // Resumen por provincia
    const { rows: byProvince } = await client.query(`
      SELECT COALESCE(province, '(sin provincia)') AS province, COUNT(*) AS total
      FROM workshop_locations WHERE partner = 'norauto'
      GROUP BY province ORDER BY total DESC
    `);
    console.log("\nCentros por provincia:");
    byProvince.forEach((r) => console.log(`  ${r.province}: ${r.total}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
