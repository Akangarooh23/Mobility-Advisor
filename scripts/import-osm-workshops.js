/**
 * Importa talleres de España desde Geofabrik (OSM PBF) a la tabla workshop_locations.
 *
 * Descarga: spain-latest.osm.pbf (~700 MB, solo la primera vez)
 * Uso:      node scripts/import-osm-workshops.js
 *           node scripts/import-osm-workshops.js --no-download   (si el PBF ya existe)
 *
 * Tags OSM procesados:
 *   shop=car_repair        → talleres mecánicos generales
 *   craft=car_repair       → talleres artesanales/pequeños
 *   shop=tyres             → neumáticos (Norauto, Midas, Feu Vert…)
 *   amenity=vehicle_inspection → ITV
 *   shop=car_parts         → recambios con taller asociado
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const parseOSM = require("osm-pbf-parser");
const through = require("through2");
const { Pool } = require("pg");

// ─── Config ────────────────────────────────────────────────────────────────

const PBF_URL = "https://download.geofabrik.de/europe/spain-latest.osm.pbf";
const PBF_PATH = path.join(__dirname, "..", "tmp_spain_latest.osm.pbf");
const BATCH_SIZE = 500;
const NO_DOWNLOAD = process.argv.includes("--no-download");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// ─── Tags que nos interesan ─────────────────────────────────────────────────

const RELEVANT_TAGS = {
  shop: new Set(["car_repair", "tyres", "car_parts"]),
  craft: new Set(["car_repair"]),
  amenity: new Set(["vehicle_inspection"]),
};

function isRelevant(tags) {
  if (!tags) return false;
  for (const [key, values] of Object.entries(RELEVANT_TAGS)) {
    if (tags[key] && values.has(tags[key])) return true;
  }
  return false;
}

// ─── Normalización ──────────────────────────────────────────────────────────

const CP_TO_PROVINCE = {
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

// Marcas conocidas para el campo partner (normalización)
const BRAND_MAP = {
  norauto: "norauto", midas: "midas",
  "feu vert": "feu_vert", "feuvert": "feu_vert",
  "aurgi": "aurgi", "autofit": "autofit",
  "speedy": "speedy", "euromaster": "euromaster",
  "kwik fit": "kwik_fit", "kwikfit": "kwik_fit",
  "carglass": "carglass", "belron": "carglass",
  "tallersplus": "tallersplus",
};

function inferPartner(tags) {
  const brand = (tags.brand || tags.name || "").toLowerCase().trim();
  for (const [key, val] of Object.entries(BRAND_MAP)) {
    if (brand.includes(key)) return val;
  }
  return "independent";
}

function inferProvince(tags) {
  if (tags["addr:province"]) return tags["addr:province"];
  if (tags["addr:state"]) return tags["addr:state"];
  const cp = (tags["addr:postcode"] || "").trim();
  if (cp.length >= 2) return CP_TO_PROVINCE[cp.slice(0, 2)] || null;
  return null;
}

function normalizeWorkshop(item) {
  if (!item.lat || !item.lon) return null; // solo nodes en v1
  const tags = item.tags || {};
  if (!isRelevant(tags)) return null;

  const name = tags.name || tags.brand || tags["name:es"] || null;
  if (!name) return null; // sin nombre no tiene utilidad para el usuario

  const street = tags["addr:street"] || null;
  const housenumber = tags["addr:housenumber"] || null;
  const address = [street, housenumber].filter(Boolean).join(", ") || null;
  const city =
    tags["addr:city"] || tags["addr:town"] ||
    tags["addr:municipality"] || tags["addr:village"] || null;
  const postcode = tags["addr:postcode"] || null;
  const province = inferProvince(tags);
  const phone = tags.phone || tags["contact:phone"] || null;
  const website = tags.website || tags["contact:website"] || null;
  const partner = inferPartner(tags);
  const serviceType = tags.shop || tags.craft || tags.amenity || "car_repair";
  const osmId = `node/${item.id}`;

  return { osmId, partner, serviceType, name, address, city, postcode, province, lat: item.lat, lon: item.lon, phone, website };
}

// ─── DB ────────────────────────────────────────────────────────────────────

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS workshop_locations (
      id            SERIAL PRIMARY KEY,
      partner       VARCHAR(64)  NOT NULL DEFAULT 'independent',
      osm_id        VARCHAR(64)  UNIQUE,
      service_type  VARCHAR(64),
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
    CREATE INDEX IF NOT EXISTS idx_workshop_partner   ON workshop_locations(partner);
    CREATE INDEX IF NOT EXISTS idx_workshop_province  ON workshop_locations(province);
    CREATE INDEX IF NOT EXISTS idx_workshop_service   ON workshop_locations(service_type);
  `);

  // Añadir service_type si la tabla ya existía sin esa columna
  await client.query(`
    ALTER TABLE workshop_locations
      ADD COLUMN IF NOT EXISTS service_type VARCHAR(64)
  `);
}

async function upsertBatch(client, batch) {
  if (!batch.length) return { inserted: 0, updated: 0 };
  let inserted = 0, updated = 0;
  for (const w of batch) {
    const { rows } = await client.query(
      `INSERT INTO workshop_locations
         (partner, osm_id, service_type, name, address, city, postcode, province, lat, lon, phone, website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (osm_id) DO UPDATE SET
         partner      = EXCLUDED.partner,
         service_type = EXCLUDED.service_type,
         name         = EXCLUDED.name,
         address      = EXCLUDED.address,
         city         = EXCLUDED.city,
         postcode     = EXCLUDED.postcode,
         province     = EXCLUDED.province,
         lat          = EXCLUDED.lat,
         lon          = EXCLUDED.lon,
         phone        = EXCLUDED.phone,
         website      = EXCLUDED.website,
         updated_at   = NOW()
       RETURNING (xmax = 0) AS is_new`,
      [w.partner, w.osmId, w.serviceType, w.name, w.address,
       w.city, w.postcode, w.province, w.lat, w.lon, w.phone, w.website]
    );
    if (rows[0]?.is_new) inserted++; else updated++;
  }
  return { inserted, updated };
}

// ─── Descarga ───────────────────────────────────────────────────────────────

function downloadPBF() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(PBF_PATH)) {
      const sizeMB = (fs.statSync(PBF_PATH).size / 1024 / 1024).toFixed(0);
      console.log(`PBF ya existe (${sizeMB} MB): ${PBF_PATH}`);
      resolve();
      return;
    }

    console.log(`Descargando ${PBF_URL} …`);
    const file = fs.createWriteStream(PBF_PATH);
    let downloaded = 0;
    let total = 0;
    let lastPct = -1;

    function doRequest(url, redirects = 0) {
      if (redirects > 5) { reject(new Error("Demasiados redirects")); return; }
      const mod = url.startsWith("https") ? https : http;
      mod.get(url, { headers: { "User-Agent": "CarsWise/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          doRequest(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`)); return;
        }
        total = parseInt(res.headers["content-length"] || "0", 10);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          if (total) {
            const pct = Math.floor((downloaded / total) * 100);
            if (pct !== lastPct && pct % 5 === 0) {
              process.stdout.write(`  ${pct}% (${(downloaded / 1024 / 1024).toFixed(0)} MB)\n`);
              lastPct = pct;
            }
          }
        });
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", reject);
      }).on("error", reject);
    }

    doRequest(PBF_URL);
  });
}

// ─── Parse ──────────────────────────────────────────────────────────────────

function parsePBF(client) {
  return new Promise((resolve, reject) => {
    let batch = [];
    let totalInserted = 0;
    let totalUpdated = 0;
    let processed = 0;
    let nodesSeen = 0;

    const flushBatch = async () => {
      if (!batch.length) return;
      const toFlush = batch.splice(0);
      const { inserted, updated } = await upsertBatch(client, toFlush);
      totalInserted += inserted;
      totalUpdated += updated;
    };

    const osm = parseOSM();
    const sink = through.obj(async function (items, enc, next) {
      const found = [];
      for (const item of items) {
        if (item.type === "node") {
          nodesSeen++;
          const w = normalizeWorkshop(item);
          if (w) found.push(w);
        }
        // Ways y relations se omiten en v1 (requieren node-coordinate cache)
      }

      batch.push(...found);
      processed++;

      if (batch.length >= BATCH_SIZE) {
        await flushBatch();
        if (processed % 500 === 0) {
          process.stdout.write(
            `  nodos=${(nodesSeen / 1e6).toFixed(1)}M  talleres=${totalInserted + totalUpdated}\n`
          );
        }
      }
      next();
    });

    sink.on("finish", async () => {
      await flushBatch();
      resolve({ inserted: totalInserted, updated: totalUpdated, nodes: nodesSeen });
    });
    sink.on("error", reject);
    osm.on("error", reject);

    fs.createReadStream(PBF_PATH).pipe(osm).pipe(sink);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!NO_DOWNLOAD) {
    await downloadPBF();
  } else {
    if (!fs.existsSync(PBF_PATH)) {
      console.error(`PBF no encontrado: ${PBF_PATH}`);
      process.exit(1);
    }
    console.log(`Usando PBF existente: ${PBF_PATH}`);
  }

  console.log("\nParsando PBF e importando a workshop_locations…");
  const t0 = Date.now();

  const client = await pool.connect();
  try {
    await ensureSchema(client);
    const { inserted, updated, nodes } = await parsePBF(client);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✓ Listo en ${elapsed}s`);
    console.log(`  Nodos OSM procesados: ${(nodes / 1e6).toFixed(2)}M`);
    console.log(`  Insertados: ${inserted}  |  Actualizados: ${updated}`);

    const { rows } = await client.query(`
      SELECT partner, count(*) AS total
      FROM workshop_locations
      GROUP BY partner ORDER BY total DESC
      LIMIT 20
    `);
    console.log("\nPor partner:");
    rows.forEach((r) => console.log(`  ${r.partner}: ${r.total}`));

    const { rows: byProv } = await client.query(`
      SELECT COALESCE(province,'(sin provincia)') AS province, count(*) AS total
      FROM workshop_locations
      GROUP BY province ORDER BY total DESC
      LIMIT 15
    `);
    console.log("\nTop provincias:");
    byProv.forEach((r) => console.log(`  ${r.province}: ${r.total}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
