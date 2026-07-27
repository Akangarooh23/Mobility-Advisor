/**
 * Import car repair workshops from HERE Places API into workshop_locations.
 * HERE free tier: 250,000 requests/month — Spain needs ~1,500 calls.
 *
 * Usage:
 *   HERE_API_KEY=xxxx node scripts/import-here-workshops.js
 *
 * Optional env:
 *   DRY_RUN=1   — print results without writing to DB
 */

require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const HERE_API_KEY = process.env.HERE_API_KEY;
if (!HERE_API_KEY) {
  console.error("Missing HERE_API_KEY env var");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
const DRY_RUN = process.env.DRY_RUN === "1";

// HERE category for Auto Repair & Maintenance
const CATEGORY = "700-7850-0117";

// Spain bounding box (includes islands)
const LAT_MIN = 27.6;  // Canarias
const LAT_MAX = 43.8;  // Pirineos
const LON_MIN = -18.2; // Canarias
const LON_MAX =  4.4;  // Cataluña

// Grid step: ~15km spacing, 10km search radius per point (with overlap)
const LAT_STEP = 0.13;
const LON_STEP = 0.17;
const RADIUS_M = 11000; // 11km radius
const LIMIT = 100;      // max per call

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildGrid() {
  const points = [];
  for (let lat = LAT_MIN; lat <= LAT_MAX; lat = Math.round((lat + LAT_STEP) * 1000) / 1000) {
    for (let lon = LON_MIN; lon <= LON_MAX; lon = Math.round((lon + LON_STEP) * 1000) / 1000) {
      points.push({ lat, lon });
    }
  }
  return points;
}

async function fetchHere(lat, lon) {
  const url =
    `https://browse.search.hereapi.com/v1/browse` +
    `?at=${lat},${lon}` +
    `&categories=${CATEGORY}` +
    `&limit=${LIMIT}` +
    `&circle:center=${lat},${lon};r=${RADIUS_M}` +
    `&apiKey=${HERE_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error("RATE_LIMIT");
    return [];
  }
  const data = await res.json();
  return data.items || [];
}

function parseItem(item) {
  const addr = item.address || {};
  const pos = item.position || {};
  const phone = item.contacts?.[0]?.phone?.[0]?.value || null;

  return {
    external_id: item.id,           // HERE unique place ID
    source: "here",
    name: item.title || null,
    address: addr.street
      ? `${addr.street}${addr.houseNumber ? " " + addr.houseNumber : ""}`
      : (addr.label || null),
    city: addr.city || null,
    postcode: addr.postalCode || null,
    province: addr.state || addr.county || null,
    lat: pos.lat != null ? pos.lat : null,
    lon: pos.lng != null ? pos.lng : null,
    phone,
    partner: "independent",
    is_active: true,
  };
}

async function upsertBatch(client, rows) {
  if (!rows.length) return 0;

  const values = rows.map((r, i) => {
    const b = i * 11;
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11})`;
  }).join(",");

  const flat = rows.flatMap((r) => [
    r.external_id, r.source, r.name, r.address, r.city,
    r.postcode, r.province, r.lat, r.lon, r.phone, r.partner,
  ]);

  const { rowCount } = await client.query(`
    INSERT INTO workshop_locations
      (external_id, source, name, address, city, postcode, province, lat, lon, phone, partner, is_active)
    VALUES ${values}
    ON CONFLICT (source, external_id) DO UPDATE SET
      name     = EXCLUDED.name,
      address  = EXCLUDED.address,
      city     = EXCLUDED.city,
      postcode = EXCLUDED.postcode,
      province = EXCLUDED.province,
      lat      = EXCLUDED.lat,
      lon      = EXCLUDED.lon,
      phone    = EXCLUDED.phone,
      is_active = true
  `, flat);

  return rowCount;
}

async function main() {
  const grid = buildGrid();
  console.log(`Grid: ${grid.length} points to search`);
  console.log(`Estimated HERE calls: ${grid.length} (~${Math.ceil(grid.length / 1000 * 32 / 100)} cents at paid tier)`);
  if (DRY_RUN) console.log("DRY RUN — no DB writes");

  const seen = new Set();
  let totalNew = 0;
  let totalSkipped = 0;
  let totalUpserted = 0;
  let errors = 0;

  const client = DRY_RUN ? null : await pool.connect();

  try {
    for (let i = 0; i < grid.length; i++) {
      const { lat, lon } = grid[i];

      let items;
      try {
        items = await fetchHere(lat, lon);
      } catch (err) {
        if (err.message === "RATE_LIMIT") {
          console.warn(`Rate limited at point ${i} — waiting 5s`);
          await sleep(5000);
          items = await fetchHere(lat, lon);
        } else {
          console.warn(`Error at (${lat},${lon}): ${err.message}`);
          errors++;
          items = [];
        }
      }

      const fresh = items.map(parseItem).filter((r) => {
        if (seen.has(r.external_id)) { totalSkipped++; return false; }
        seen.add(r.external_id);
        return true;
      });

      totalNew += fresh.length;

      if (fresh.length > 0 && !DRY_RUN) {
        const upserted = await upsertBatch(client, fresh);
        totalUpserted += upserted;
      }

      if ((i + 1) % 50 === 0 || i === grid.length - 1) {
        const pct = Math.round(((i + 1) / grid.length) * 100);
        console.log(`[${pct}%] ${i+1}/${grid.length} points — ${totalNew} workshops found (${totalSkipped} dupes skipped)`);
      }

      // 1 req/s to stay well within rate limits
      await sleep(1000);
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }

  console.log("\n=== DONE ===");
  console.log(`Points searched : ${grid.length}`);
  console.log(`Unique workshops: ${totalNew}`);
  console.log(`Dupes skipped   : ${totalSkipped}`);
  console.log(`DB upserted     : ${totalUpserted}`);
  console.log(`Errors          : ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
