/**
 * Importa talleres desde los registros oficiales de CCAA que publican datos abiertos:
 *   - Cataluña  (API Socrata, JSON, actualización diaria)
 *   - Galicia   (ODS descargable, actualización diaria)
 *   - Castilla y León (CSV estático, actualización anual)
 *
 * Uso: node scripts/import-official-workshops.js [--only=gencat|xunta|jcyl]
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
const ONLY = (process.argv.find(a => a.startsWith("--only=")) || "").replace("--only=", "") || null;
const TMP  = path.join(__dirname, "..");

// ─── Mapa CP → provincia (igual que en el resto de scripts) ───────────────
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
function cpToProvince(cp) {
  return CP_TO_PROVINCE[(cp || "").toString().padStart(5,"0").slice(0,2)] || null;
}

// ─── Helpers de descarga ──────────────────────────────────────────────────
const sslAgent = new https.Agent({ rejectUnauthorized: false });

function fetchText(url, encoding = "utf8") {
  return new Promise((resolve, reject) => {
    function doReq(u, hops = 0) {
      if (hops > 6) { reject(new Error("Too many redirects")); return; }
      const mod = u.startsWith("https") ? https : http;
      const opts = { headers: { "User-Agent": "CarsWise/1.0 (movilidad-advisor)" } };
      if (mod === https) opts.agent = sslAgent;
      mod.get(u, opts, res => {
        if ([301,302,307,308].includes(res.statusCode)) { doReq(res.headers.location, hops+1); return; }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} → ${u}`)); return; }
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end",  () => resolve(Buffer.concat(chunks).toString(encoding)));
      }).on("error", reject);
    }
    doReq(url);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    function doReq(u, hops = 0) {
      if (hops > 6) { reject(new Error("Too many redirects")); return; }
      const mod = u.startsWith("https") ? https : http;
      const opts = { headers: { "User-Agent": "CarsWise/1.0 (movilidad-advisor)" } };
      if (mod === https) opts.agent = sslAgent;
      mod.get(u, opts, res => {
        if ([301,302,307,308].includes(res.statusCode)) { doReq(res.headers.location, hops+1); return; }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} → ${u}`)); return; }
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end",  () => resolve(Buffer.concat(chunks)));
      }).on("error", reject);
    }
    doReq(url);
  });
}

// ─── Schema ───────────────────────────────────────────────────────────────
async function ensureColumns(client) {
  await client.query(`
    ALTER TABLE workshop_locations
      ADD COLUMN IF NOT EXISTS source      VARCHAR(32) DEFAULT 'osm',
      ADD COLUMN IF NOT EXISTS external_id VARCHAR(128)
  `);
  // Rellenar source='osm' en los registros existentes
  await client.query(`UPDATE workshop_locations SET source='osm' WHERE source IS NULL`);
  // Índice UNIQUE normal sobre (source, external_id).
  // PostgreSQL permite múltiples filas con external_id=NULL en una UNIQUE constraint.
  // Eliminamos el índice parcial anterior si existía y creamos el estándar.
  await client.query(`DROP INDEX IF EXISTS idx_workshop_source_extid`);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workshop_source_extid
      ON workshop_locations(source, external_id)
  `);
}

// ─── Upsert bulk (batches de 500 filas — ~6500 parámetros, muy bajo el límite PG) ──
async function upsert(client, source, rows) {
  const COLS = 13;
  const BATCH = 500; // 500 × 13 = 6500 params por query

  // Deduplicar por (source, external_id) — la API puede devolver duplicados
  const seen  = new Set();
  const dedup = rows.filter(r => {
    const key = `${source}||${r.external_id||""}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const valid = dedup.filter(r => r.name && (r.lat || r.province));
  const skip  = rows.length - valid.length;
  let ins = 0, upd = 0;

  for (let i = 0; i < valid.length; i += BATCH) {
    const batch  = valid.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const r of batch) {
      values.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5},$${p+6},$${p+7},$${p+8},$${p+9},$${p+10},$${p+11},$${p+12})`);
      params.push(
        source, r.external_id||null, r.partner||"independent", r.service_type||"car_repair",
        r.name, r.address||null, r.city||null, r.postcode||null, r.province||null,
        r.lat||null, r.lon||null, r.phone||null, r.website||null
      );
      p += COLS;
    }
    const { rows: res } = await client.query(
      `INSERT INTO workshop_locations
         (source,external_id,partner,service_type,name,address,city,postcode,province,lat,lon,phone,website)
       VALUES ${values.join(",")}
       ON CONFLICT (source,external_id) DO UPDATE SET
         name=EXCLUDED.name, address=EXCLUDED.address, city=EXCLUDED.city,
         postcode=EXCLUDED.postcode, province=EXCLUDED.province,
         lat=COALESCE(EXCLUDED.lat,workshop_locations.lat),
         lon=COALESCE(EXCLUDED.lon,workshop_locations.lon),
         phone=EXCLUDED.phone, website=EXCLUDED.website, updated_at=NOW()
       RETURNING (xmax=0) AS is_new`,
      params
    );
    ins += res.filter(r => r.is_new).length;
    upd += res.filter(r => !r.is_new).length;
    process.stdout.write(`  ${Math.min(i + BATCH, valid.length)}/${valid.length}\n`);
  }
  return { ins, upd, skip };
}

// ─── 1. CATALUÑA — Socrata API ────────────────────────────────────────────
// Campos reales confirmados: n_mero_de_rasic, nom_titular_actual, adre_a,
// poblaci_, codi_postal, prov_ncia  (caracteres especiales normalizados por Socrata)
async function importGencat(client) {
  console.log("\n[Cataluña] Descargando desde API Socrata…");
  const BASE = "https://analisi.transparenciacatalunya.cat/resource/ebyt-8dme.json";
  const PAGE = 1000;
  const rows = [];
  let offset = 0;

  while (true) {
    const url = `${BASE}?$limit=${PAGE}&$offset=${offset}`;
    let text;
    try { text = await fetchText(url); } catch(e) { console.warn("  Error:", e.message); break; }
    let batch;
    try { batch = JSON.parse(text); } catch { break; }
    if (!Array.isArray(batch) || !batch.length) break;

    for (const r of batch) {
      const cp = (r.codi_postal || "").toString().trim();
      rows.push({
        external_id:  r.n_mero_de_rasic || `gencat-${offset + rows.length}`,
        name:         r.nom_titular_actual || null,
        address:      r.adre_a || null,
        city:         r.poblaci_ || r.municipi || null,
        postcode:     cp || null,
        province:     r.prov_ncia || cpToProvince(cp) || "Catalunya",
        lat:          null, lon: null,
        phone:        null,
        service_type: "car_repair",
      });
    }
    offset += batch.length;
    process.stdout.write(`  ${offset} registros…\n`);
    if (batch.length < PAGE) break;
  }

  console.log(`  Total descargado: ${rows.length}`);
  if (!rows.length) { console.log("  Sin datos"); return; }
  const { ins, upd, skip } = await upsert(client, "gencat", rows);
  console.log(`  Insertados: ${ins}  |  Actualizados: ${upd}  |  Saltados: ${skip}`);
}

// ─── 2. GALICIA — ODS (parseado como ZIP + XML) ───────────────────────────
// Estructura: Empresa | Nome Comercial | Enderezo | Teléfono | Especialidades | Ramas
// Enderezo formato: "CALLE NÚMERO CP CIUDAD (PROVINCIA_GALLEGA)"
// NRIG en "Nome Comercial": "NOMBRE (NRIG: XXXXXXXX)"
async function importXunta(client) {
  const JSZip = require("jszip");
  console.log("\n[Galicia] Descargando ODS…");
  const ODS_URL = "https://abertos.xunta.gal/catalogo/economia-empresa-emprego/-/dataset/0404/rexistro-talleres-reparacion-vehiculos/101/acceso-aos-datos.ods";

  let buf;
  try { buf = await fetchBuffer(ODS_URL); }
  catch(e) { console.warn("  Error:", e.message); return; }

  const zip  = await JSZip.loadAsync(buf);
  const xml  = await zip.file("content.xml").async("text");

  // Mapa provincia gallega → nombre canónico
  const PROV = {
    "Coruña (A)": "A Coruña", "Coruña": "A Coruña",
    "Lugo": "Lugo", "Ourense": "Ourense", "Pontevedra": "Pontevedra",
  };

  // Regex para extraer NRIG de "Nome Comercial" → "... (NRIG: 12345678)"
  const nrigRe = /NRIG:\s*(\d+)/;
  // Regex para extraer CP (5 dígitos) de Enderezo
  const cpRe   = /\b(\d{5})\b/;
  // Regex para extraer ciudad y provincia del final: "CIUDAD (PROVINCIA)"
  const locRe  = /([^(]+)\s*\(([^)]+)\)\s*$/;

  const rowMatches = [...xml.matchAll(/<table:table-row[^>]*>(.*?)<\/table:table-row>/gs)];
  console.log(`  ${rowMatches.length} filas en ODS`);

  const rows = [];
  for (let i = 1; i < rowMatches.length; i++) { // saltar cabecera
    const cells = [...rowMatches[i][1].matchAll(/office:string-value="([^"]*)"/g)].map(m => m[1].trim());
    if (!cells[0] && !cells[1]) continue;

    const empresa  = cells[0] || "";
    const nomeComercial = cells[1] || "";
    const enderezo = cells[2] || "";
    const telefono = cells[3] || "";

    // Extraer NRIG como external_id
    const nrigMatch = nrigRe.exec(nomeComercial);
    const nrig = nrigMatch ? nrigMatch[1] : `xunta-${i}`;

    // Nombre: tomar el nome comercial antes del paréntesis
    const name = (nomeComercial.replace(/\s*\(NRIG:.*\)/, "").trim()
                  || empresa.replace(/\s*\([^)]+\)$/, "").trim()) || null;
    if (!name) continue;

    // Extraer CP del enderezo
    const cpMatch = cpRe.exec(enderezo);
    const postcode = cpMatch ? cpMatch[1] : null;

    // Extraer ciudad y provincia del final del enderezo
    const locMatch = locRe.exec(enderezo.replace(postcode || "", "").trim());
    const city     = locMatch ? locMatch[1].trim() : null;
    const provRaw  = locMatch ? locMatch[2].trim() : null;
    const province = (provRaw && PROV[provRaw]) || cpToProvince(postcode) || "Galicia";

    // Dirección = todo antes del CP (o del final de ciudad)
    const addressEnd = enderezo.indexOf(postcode || city || "");
    const address = addressEnd > 0 ? enderezo.slice(0, addressEnd).trim() : null;

    rows.push({ external_id: nrig, name, address, city, postcode, province,
                phone: telefono || null, lat: null, lon: null, service_type: "car_repair" });
  }

  console.log(`  ${rows.length} talleres parseados`);
  const { ins, upd, skip } = await upsert(client, "xunta", rows);
  console.log(`  Insertados: ${ins}  |  Actualizados: ${upd}  |  Saltados: ${skip}`);
}

// ─── 3. CASTILLA Y LEÓN — CSV ─────────────────────────────────────────────
// Campos confirmados: PROVINCIA;MUNICIPIO;LOCALIDAD;TIPO;CALLE;Nº;C. POSTAL;TITULAR;CNAE…
async function importJcyl(client) {
  console.log("\n[Castilla y León] Descargando CSV…");
  const CSV_URL = "https://datosabiertos.jcyl.es/web/jcyl/risp/es/industria/talleres-reparacion-vehiculos/1284993284985.csv";

  let text;
  try { text = await fetchText(CSV_URL, "latin1"); }
  catch(e) { console.warn("  Error:", e.message); return; }

  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) { console.log("  CSV vacío"); return; }

  const sep     = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());

  const idx = (name) => headers.indexOf(name);
  const get = (parts, name) => (parts[idx(name)] || "").trim().replace(/^"|"$/g, "");

  const rows = lines.slice(1).map((line, i) => {
    const p = line.split(sep);
    const tipo = get(p, "tipo");
    const calle = get(p, "calle");
    const num   = get(p, "nº");
    const address = [tipo, calle, num].filter(Boolean).join(" ") || null;
    const cp = get(p, "c. postal").replace(/\D/g,"").padStart(5,"0");
    const province = get(p, "provincia") || cpToProvince(cp) || "Castilla y León";

    return {
      external_id:  `jcyl-${i+1}`,
      name:         get(p, "titular") || null,
      address,
      city:         get(p, "localidad") || get(p, "municipio") || null,
      postcode:     cp || null,
      province:     province || null,
      lat: null, lon: null,
      phone:        null,
      service_type: "car_repair",
    };
  }).filter(r => r.name);

  console.log(`  ${rows.length} talleres parseados`);
  const { ins, upd, skip } = await upsert(client, "jcyl", rows);
  console.log(`  Insertados: ${ins}  |  Actualizados: ${upd}  |  Saltados: ${skip}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    console.log("Preparando esquema…");
    await ensureColumns(client);

    if (!ONLY || ONLY === "gencat") await importGencat(client);
    if (!ONLY || ONLY === "xunta")  await importXunta(client);
    if (!ONLY || ONLY === "jcyl")   await importJcyl(client);

    const { rows } = await client.query(
      `SELECT source, count(*) AS n FROM workshop_locations GROUP BY source ORDER BY n DESC`
    );
    console.log("\n─── Resumen por fuente ───");
    rows.forEach(r => console.log(`  ${r.source}: ${r.n}`));

    const { rows: total } = await client.query(`SELECT count(*) AS n FROM workshop_locations`);
    console.log(`\nTotal: ${total[0].n} talleres`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
