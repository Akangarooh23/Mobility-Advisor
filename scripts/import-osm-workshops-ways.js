/**
 * Segunda pasada sobre el PBF de España: extrae talleres mapeados como ways
 * (polígonos de edificio con tags de taller) y los añade a workshop_locations.
 *
 * Estrategia two-pass:
 *   Pasada 1 → recopilar ways relevantes y sus node refs
 *   Pasada 2 → recopilar coordenadas de esos nodos (para centroide)
 *   Luego → calcular centroides y upsert en BD
 *
 * Uso: node scripts/import-osm-workshops-ways.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const parseOSM = require("osm-pbf-parser");
const through = require("through2");
const { Pool } = require("pg");

const PBF_PATH = path.join(__dirname, "..", "tmp_spain_latest.osm.pbf");
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

// ─── Tags relevantes (igual que el importer de nodes) ──────────────────────

const RELEVANT_TAGS = {
  shop:    new Set(["car_repair", "tyres", "car_parts"]),
  craft:   new Set(["car_repair"]),
  amenity: new Set(["vehicle_inspection"]),
};

function isRelevant(tags) {
  if (!tags) return false;
  for (const [k, vs] of Object.entries(RELEVANT_TAGS)) {
    if (tags[k] && vs.has(tags[k])) return true;
  }
  return false;
}

// ─── Normalización (idéntica al importer de nodes) ─────────────────────────

const CP_TO_PROVINCE = {
  "01":"Álava","02":"Albacete","03":"Alicante","04":"Almería",
  "05":"Ávila","06":"Badajoz","07":"Islas Baleares","08":"Barcelona",
  "09":"Burgos","10":"Cáceres","11":"Cádiz","12":"Castellón",
  "13":"Ciudad Real","14":"Córdoba","15":"A Coruña","16":"Cuenca",
  "17":"Girona","18":"Granada","19":"Guadalajara","20":"Gipuzkoa",
  "21":"Huelva","22":"Huesca","23":"Jaén","24":"León",
  "25":"Lleida","26":"La Rioja","27":"Lugo","28":"Madrid",
  "29":"Málaga","30":"Murcia","31":"Navarra","32":"Ourense",
  "33":"Asturias","34":"Palencia","35":"Las Palmas","36":"Pontevedra",
  "37":"Salamanca","38":"Santa Cruz de Tenerife","39":"Cantabria",
  "40":"Segovia","41":"Sevilla","42":"Soria","43":"Tarragona",
  "44":"Teruel","45":"Toledo","46":"Valencia","47":"Valladolid",
  "48":"Vizcaya","49":"Zamora","50":"Zaragoza","51":"Ceuta","52":"Melilla",
};

const BRAND_MAP = {
  norauto:"norauto", midas:"midas", "feu vert":"feu_vert",
  feuvert:"feu_vert", aurgi:"aurgi", autofit:"autofit",
  speedy:"speedy", euromaster:"euromaster",
  "kwik fit":"kwik_fit", kwikfit:"kwik_fit",
  carglass:"carglass", belron:"carglass",
};

function inferPartner(tags) {
  const brand = (tags.brand || tags.name || "").toLowerCase();
  for (const [k, v] of Object.entries(BRAND_MAP)) if (brand.includes(k)) return v;
  return "independent";
}

function inferProvince(tags) {
  if (tags["addr:province"]) return tags["addr:province"];
  if (tags["addr:state"])    return tags["addr:state"];
  const cp = (tags["addr:postcode"] || "").trim();
  if (cp.length >= 2) return CP_TO_PROVINCE[cp.slice(0, 2)] || null;
  return null;
}

const PROVINCE_CENTROIDS = [
  {province:"Álava",lat:42.8467,lon:-2.6726},{province:"Albacete",lat:38.9942,lon:-1.8564},
  {province:"Alicante",lat:38.3453,lon:-0.4831},{province:"Almería",lat:36.8340,lon:-2.4637},
  {province:"Asturias",lat:43.3614,lon:-5.8593},{province:"Ávila",lat:40.6567,lon:-4.6954},
  {province:"Badajoz",lat:38.8794,lon:-6.9706},{province:"Barcelona",lat:41.3879,lon:2.1699},
  {province:"Burgos",lat:42.3439,lon:-3.6969},{province:"Cáceres",lat:39.4752,lon:-6.3724},
  {province:"Cádiz",lat:36.5271,lon:-6.2886},{province:"Cantabria",lat:43.4623,lon:-3.8099},
  {province:"Castellón",lat:39.9864,lon:-0.0513},{province:"Ciudad Real",lat:38.9848,lon:-3.9274},
  {province:"Córdoba",lat:37.8882,lon:-4.7794},{province:"A Coruña",lat:43.3623,lon:-8.4115},
  {province:"Cuenca",lat:40.0704,lon:-2.1374},{province:"Girona",lat:41.9794,lon:2.8214},
  {province:"Granada",lat:37.1773,lon:-3.5986},{province:"Guadalajara",lat:40.6334,lon:-3.1679},
  {province:"Gipuzkoa",lat:43.3183,lon:-1.9812},{province:"Huelva",lat:37.2614,lon:-6.9447},
  {province:"Huesca",lat:42.1362,lon:-0.4089},{province:"Islas Baleares",lat:39.5696,lon:2.6502},
  {province:"Jaén",lat:37.7796,lon:-3.7849},{province:"La Rioja",lat:42.4650,lon:-2.4456},
  {province:"Las Palmas",lat:28.1248,lon:-15.4300},{province:"León",lat:42.5987,lon:-5.5671},
  {province:"Lleida",lat:41.6176,lon:0.6200},{province:"Lugo",lat:43.0097,lon:-7.5567},
  {province:"Madrid",lat:40.4168,lon:-3.7038},{province:"Málaga",lat:36.7213,lon:-4.4214},
  {province:"Murcia",lat:37.9922,lon:-1.1307},{province:"Navarra",lat:42.8169,lon:-1.6432},
  {province:"Ourense",lat:42.3361,lon:-7.8639},{province:"Palencia",lat:42.0096,lon:-4.5288},
  {province:"Pontevedra",lat:42.4310,lon:-8.6442},{province:"Salamanca",lat:40.9701,lon:-5.6635},
  {province:"Santa Cruz de Tenerife",lat:28.4636,lon:-16.2518},{province:"Segovia",lat:40.9429,lon:-4.1088},
  {province:"Sevilla",lat:37.3891,lon:-5.9845},{province:"Soria",lat:41.7640,lon:-2.4651},
  {province:"Tarragona",lat:41.1189,lon:1.2445},{province:"Teruel",lat:40.3440,lon:-1.1059},
  {province:"Toledo",lat:39.8567,lon:-4.0244},{province:"Valencia",lat:39.4699,lon:-0.3763},
  {province:"Valladolid",lat:41.6523,lon:-4.7245},{province:"Vizcaya",lat:43.2630,lon:-2.9350},
  {province:"Zamora",lat:41.5003,lon:-5.7441},{province:"Zaragoza",lat:41.6488,lon:-0.8891},
  {province:"Ceuta",lat:35.8894,lon:-5.3198},{province:"Melilla",lat:35.2923,lon:-2.9381},
];

function haversine(la1,lo1,la2,lo2){
  const R=6371,dL=(la2-la1)*Math.PI/180,dO=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function nearestProvince(lat,lon){
  let best=null,d=Infinity;
  for(const c of PROVINCE_CENTROIDS){const x=haversine(lat,lon,c.lat,c.lon);if(x<d){d=x;best=c.province;}}
  return best;
}

// ─── Pasada 1: recopilar ways relevantes ───────────────────────────────────

function pass1CollectWays() {
  return new Promise((resolve, reject) => {
    // wayId → { tags, refs[] }
    const ways = new Map();
    const neededNodeIds = new Set();
    let nodesCount = 0;
    let waysCount = 0;

    const osm = parseOSM();
    const sink = through.obj(function (items, enc, next) {
      for (const item of items) {
        if (item.type === "node") { nodesCount++; }
        else if (item.type === "way") {
          waysCount++;
          if (isRelevant(item.tags) && item.refs && item.refs.length > 0) {
            const name = item.tags.name || item.tags.brand || item.tags["name:es"] || null;
            if (name) {
              ways.set(item.id, { tags: item.tags, refs: item.refs });
              for (const ref of item.refs) neededNodeIds.add(ref);
            }
          }
        }
      }
      next();
    });

    sink.on("finish", () => {
      console.log(`  Pasada 1: ${(nodesCount/1e6).toFixed(1)}M nodos, ${waysCount.toLocaleString()} ways → ${ways.size} ways relevantes, ${neededNodeIds.size.toLocaleString()} nodos necesarios`);
      resolve({ ways, neededNodeIds });
    });
    sink.on("error", reject);
    osm.on("error", reject);
    fs.createReadStream(PBF_PATH).pipe(osm).pipe(sink);
  });
}

// ─── Pasada 2: recopilar coordenadas de nodos necesarios ───────────────────

function pass2CollectCoords(neededNodeIds) {
  return new Promise((resolve, reject) => {
    // nodeId → [lat, lon]
    const coords = new Map();
    let found = 0;
    const total = neededNodeIds.size;

    const osm = parseOSM();
    const sink = through.obj(function (items, enc, next) {
      let doneEarly = false;
      for (const item of items) {
        // Los nodes vienen antes que los ways en el PBF.
        // Cuando llegamos a ways ya tenemos todos los nodes.
        if (item.type !== "node") { doneEarly = true; break; }
        if (neededNodeIds.has(item.id)) {
          coords.set(item.id, [item.lat, item.lon]);
          found++;
          if (found >= total) { doneEarly = true; break; }
        }
      }
      if (doneEarly && found >= total) {
        // Destruir el stream si ya tenemos todo
        this.destroy();
        resolve(coords);
        return;
      }
      next();
    });

    sink.on("finish", () => resolve(coords));
    sink.on("close",  () => resolve(coords)); // stream destruido
    sink.on("error",  (e) => {
      // Si destruimos el stream, puede llegar un error no-fatal
      if (coords.size > 0) resolve(coords); else reject(e);
    });
    osm.on("error", reject);
    fs.createReadStream(PBF_PATH).pipe(osm).pipe(sink);
  });
}

// ─── Compute centroides ────────────────────────────────────────────────────

function computeCentroid(refs, coords) {
  let sumLat = 0, sumLon = 0, count = 0;
  for (const ref of refs) {
    const c = coords.get(ref);
    if (c) { sumLat += c[0]; sumLon += c[1]; count++; }
  }
  if (!count) return null;
  return { lat: sumLat / count, lon: sumLon / count };
}

// ─── Upsert ────────────────────────────────────────────────────────────────

async function upsertWays(client, ways, coords) {
  let inserted = 0, updated = 0, skipped = 0;

  for (const [wayId, { tags, refs }] of ways) {
    const centroid = computeCentroid(refs, coords);
    if (!centroid) { skipped++; continue; }

    const { lat, lon } = centroid;
    const name     = tags.name || tags.brand || tags["name:es"];
    const street   = tags["addr:street"] || null;
    const house    = tags["addr:housenumber"] || null;
    const address  = [street, house].filter(Boolean).join(", ") || null;
    const city     = tags["addr:city"] || tags["addr:town"] || tags["addr:municipality"] || null;
    const postcode = tags["addr:postcode"] || null;
    const province = inferProvince(tags) || nearestProvince(lat, lon);
    const phone    = tags.phone || tags["contact:phone"] || null;
    const website  = tags.website || tags["contact:website"] || null;
    const partner  = inferPartner(tags);
    const svcType  = tags.shop || tags.craft || tags.amenity || "car_repair";
    const osmId    = `way/${wayId}`;

    const { rows } = await client.query(
      `INSERT INTO workshop_locations
         (partner,osm_id,service_type,name,address,city,postcode,province,lat,lon,phone,website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (osm_id) DO UPDATE SET
         partner=EXCLUDED.partner, service_type=EXCLUDED.service_type,
         name=EXCLUDED.name, address=EXCLUDED.address, city=EXCLUDED.city,
         postcode=EXCLUDED.postcode, province=EXCLUDED.province,
         lat=EXCLUDED.lat, lon=EXCLUDED.lon,
         phone=EXCLUDED.phone, website=EXCLUDED.website, updated_at=NOW()
       RETURNING (xmax=0) AS is_new`,
      [partner,osmId,svcType,name,address,city,postcode,province,lat,lon,phone,website]
    );
    if (rows[0]?.is_new) inserted++; else updated++;
  }

  return { inserted, updated, skipped };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(PBF_PATH)) {
    console.error(`PBF no encontrado: ${PBF_PATH}\nEjecuta primero: node scripts/import-osm-workshops.js`);
    process.exit(1);
  }

  const t0 = Date.now();
  console.log("Pasada 1 — recopilando ways relevantes…");
  const { ways, neededNodeIds } = await pass1CollectWays();

  if (!ways.size) {
    console.log("No se encontraron ways nuevos.");
    await pool.end(); return;
  }

  console.log("Pasada 2 — recopilando coordenadas de nodos…");
  const coords = await pass2CollectCoords(neededNodeIds);
  console.log(`  ${coords.size.toLocaleString()} coordenadas encontradas de ${neededNodeIds.size.toLocaleString()} necesarias`);

  console.log("Insertando en BD…");
  const client = await pool.connect();
  try {
    const { inserted, updated, skipped } = await upsertWays(client, ways, coords);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✓ Listo en ${elapsed}s`);
    console.log(`  Ways insertados: ${inserted}  |  Actualizados: ${updated}  |  Sin coords: ${skipped}`);

    const { rows } = await client.query(
      `SELECT count(*) AS total FROM workshop_locations`
    );
    console.log(`\nTotal workshop_locations: ${rows[0].total}`);

    const { rows: byPartner } = await client.query(
      `SELECT partner, count(*) AS n FROM workshop_locations GROUP BY partner ORDER BY n DESC LIMIT 12`
    );
    console.log("\nPor partner:");
    byPartner.forEach(r => console.log(`  ${r.partner}: ${r.n}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
