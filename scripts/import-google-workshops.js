/**
 * Import car repair workshops from Google Places API into workshop_locations.
 * Google free credit: $200/month — Spain at 1 page/point costs ~$130.
 *
 * Usage:
 *   GOOGLE_PLACES_KEY=xxxx node scripts/import-google-workshops.js
 *
 * Optional:
 *   DRY_RUN=1        — no DB writes, just count results
 *   START_INDEX=500  — resume from grid point N (if interrupted)
 */

require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;
if (!GOOGLE_KEY) { console.error("Missing GOOGLE_PLACES_KEY"); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
const DRY_RUN = process.env.DRY_RUN === "1";
const START_INDEX = parseInt(process.env.START_INDEX || "0", 10);

// Spain coverage as 3 zones to avoid filling the Atlantic with empty calls
const ZONES = [
  // Península + Baleares
  { latMin: 35.9, latMax: 43.8, lonMin: -9.4, lonMax: 4.4 },
  // Canarias occidental (Gran Canaria, Tenerife, La Palma, Gomera, Hierro)
  { latMin: 27.6, latMax: 29.4, lonMin: -18.2, lonMax: -15.4 },
  // Canarias oriental (Lanzarote, Fuerteventura)
  { latMin: 28.0, latMax: 29.2, lonMin: -14.6, lonMax: -13.4 },
];

// ~20km step, 15km search radius — overlapping circles ensure no gaps
const LAT_STEP = 0.18;
const LON_STEP = 0.23;
const RADIUS_M = 15000;

// Known partner chains — will be tagged accordingly instead of "independent"
const PARTNER_NAMES = {
  norauto:    /norauto/i,
  midas:      /\bmidas\b/i,
  carglass:   /carglass/i,
  euromaster: /euromaster/i,
  kwik_fit:   /kwik.?fit/i,
  aurgi:      /aurgi/i,
  feu_vert:   /feu.?vert/i,
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function detectPartner(name = "") {
  for (const [key, re] of Object.entries(PARTNER_NAMES)) {
    if (re.test(name)) return key;
  }
  return "independent";
}

function buildGrid() {
  const pts = [];
  for (const z of ZONES) {
    for (let lat = z.latMin; lat <= z.latMax; lat = Math.round((lat + LAT_STEP) * 10000) / 10000) {
      for (let lon = z.lonMin; lon <= z.lonMax; lon = Math.round((lon + LON_STEP) * 10000) / 10000) {
        pts.push({ lat, lon });
      }
    }
  }
  return pts;
}

async function fetchPage(lat, lon, pageToken = null) {
  let url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lon}&radius=${RADIUS_M}&type=car_repair&key=${GOOGLE_KEY}`;
  if (pageToken) url += `&pagetoken=${pageToken}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parsePlace(place) {
  const loc = place.geometry?.location || {};
  return {
    external_id: place.place_id,
    source:      "google",
    name:        place.name || null,
    address:     place.vicinity || null,
    city:        null,   // nearbysearch doesn't return city separately
    postcode:    null,
    province:    null,
    lat:         loc.lat ?? null,
    lon:         loc.lng ?? null,
    phone:       null,   // nearbysearch doesn't return phone — ok for discovery
    partner:     detectPartner(place.name),
    is_active:   true,
  };
}

async function upsertBatch(client, rows) {
  if (!rows.length) return 0;
  const vals = rows.map((_, i) => {
    const b = i * 12;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`;
  }).join(",");
  const flat = rows.flatMap((r) => [
    r.external_id, r.source, r.name, r.address, r.city,
    r.postcode, r.province, r.lat, r.lon, r.phone, r.partner, r.is_active,
  ]);
  const { rowCount } = await client.query(`
    INSERT INTO workshop_locations
      (external_id, source, name, address, city, postcode, province, lat, lon, phone, partner, is_active)
    VALUES ${vals}
    ON CONFLICT (source, external_id) DO UPDATE SET
      name      = EXCLUDED.name,
      address   = EXCLUDED.address,
      lat       = EXCLUDED.lat,
      lon       = EXCLUDED.lon,
      partner   = EXCLUDED.partner,
      is_active = true
  `, flat);
  return rowCount;
}

async function main() {
  const grid = buildGrid();
  const slice = grid.slice(START_INDEX);
  console.log(`Grid: ${grid.length} total points, starting at ${START_INDEX} (${slice.length} remaining)`);
  console.log(`Estimated cost: ~$${(grid.length * 0.032).toFixed(0)} (within $200 free credit)`);
  if (DRY_RUN) console.log("DRY RUN — no DB writes");

  const seen = new Set();
  let totalFound = 0, totalUpserted = 0, apiCalls = 0, errors = 0;

  const client = DRY_RUN ? null : await pool.connect();

  try {
    for (let i = 0; i < slice.length; i++) {
      const { lat, lon } = slice[i];
      const globalIdx = START_INDEX + i;

      let data;
      try {
        data = await fetchPage(lat, lon);
        apiCalls++;
      } catch (err) {
        console.warn(`[${globalIdx}] Error (${lat},${lon}): ${err.message}`);
        errors++;
        await sleep(2000);
        continue;
      }

      if (data.status === "REQUEST_DENIED") {
        console.error("API key rejected:", data.error_message);
        break;
      }
      if (data.status === "OVER_QUERY_LIMIT") {
        console.warn("Daily limit hit — stopping. Resume with START_INDEX=" + globalIdx);
        break;
      }

      const places = data.results || [];
      const fresh = places.map(parsePlace).filter((r) => {
        if (!r.lat || !r.lon) return false;
        if (seen.has(r.external_id)) return false;
        seen.add(r.external_id);
        return true;
      });

      totalFound += fresh.length;
      if (fresh.length && !DRY_RUN) {
        totalUpserted += await upsertBatch(client, fresh);
      }

      // Progress every 100 points
      if ((i + 1) % 100 === 0 || i === slice.length - 1) {
        const pct = Math.round(((i + 1) / slice.length) * 100);
        console.log(`[${pct}%] point ${globalIdx}/${grid.length - 1} | found ${totalFound} | API calls ${apiCalls} | resume: START_INDEX=${globalIdx + 1}`);
      }

      // Google allows ~10 req/s but 1/s is safe and free-tier friendly
      await sleep(1000);
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }

  console.log("\n=== DONE ===");
  console.log(`API calls    : ${apiCalls}`);
  console.log(`Unique places: ${totalFound}`);
  console.log(`DB upserted  : ${totalUpserted}`);
  console.log(`Errors       : ${errors}`);
  console.log(`Est. cost    : ~$${(apiCalls * 0.032).toFixed(2)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
