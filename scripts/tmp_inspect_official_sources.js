/**
 * Inspecciona los campos reales que devuelven las tres fuentes oficiales.
 * Uso: node scripts/tmp_inspect_official_sources.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");
const XLSX  = require("xlsx");

const TMP = path.join(__dirname, "..");

function fetchText(url, encoding = "utf8") {
  return new Promise((resolve, reject) => {
    function doReq(u, hops = 0) {
      if (hops > 6) { reject(new Error("Too many redirects")); return; }
      const mod = u.startsWith("https") ? https : http;
      // Ignorar errores SSL temporalmente para inspección
      const agent = mod === https ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      mod.get(u, { headers: { "User-Agent": "CarsWise/1.0" }, agent }, res => {
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

function fetchBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    function doReq(u, hops = 0) {
      if (hops > 6) { reject(new Error("Too many redirects")); return; }
      const mod = u.startsWith("https") ? https : http;
      const agent = mod === https ? new https.Agent({ rejectUnauthorized: false }) : undefined;
      mod.get(u, { headers: { "User-Agent": "CarsWise/1.0" }, agent }, res => {
        if ([301,302,307,308].includes(res.statusCode)) { doReq(res.headers.location, hops+1); return; }
        if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        const file = fs.createWriteStream(destPath);
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
        file.on("error", reject);
      }).on("error", reject);
    }
    doReq(url);
  });
}

async function main() {
  // ─── 1. Cataluña: primer registro ──────────────────────────────────────
  console.log("=== CATALUÑA (Socrata) ===");
  try {
    const text = await fetchText(
      "https://analisi.transparenciacatalunya.cat/resource/ebyt-8dme.json?$limit=2"
    );
    const data = JSON.parse(text);
    if (data.length) {
      console.log("Campos:", Object.keys(data[0]).join(", "));
      console.log("Primer registro:", JSON.stringify(data[0], null, 2));
    } else {
      console.log("Sin datos");
    }
  } catch(e) { console.log("Error:", e.message); }

  // ─── 2. Galicia: inspeccionar ODS ──────────────────────────────────────
  console.log("\n=== GALICIA (ODS) ===");
  const odsPath = path.join(TMP, "tmp_inspect_galicia.ods");
  try {
    await fetchBinary(
      "https://abertos.xunta.gal/catalogo/economia-empresa-emprego/-/dataset/0404/rexistro-talleres-reparacion-vehiculos/101/acceso-aos-datos.ods",
      odsPath
    );
    const wb = XLSX.readFile(odsPath, { type:"file", cellDates:true });
    console.log("Hojas:", wb.SheetNames.join(", "));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data  = XLSX.utils.sheet_to_json(sheet, { defval:"", header:1 });
    console.log("Fila 0 (cabeceras):", JSON.stringify(data[0]));
    console.log("Fila 1 (ejemplo):",   JSON.stringify(data[1]));
    console.log("Total filas:", data.length);
    fs.unlinkSync(odsPath);
  } catch(e) { console.log("Error:", e.message); }

  // ─── 3. Castilla y León: primeras líneas del CSV ───────────────────────
  console.log("\n=== CASTILLA Y LEÓN (CSV) ===");
  try {
    const text = await fetchText(
      "https://datosabiertos.jcyl.es/web/jcyl/risp/es/industria/talleres-reparacion-vehiculos/1284993284985.csv",
      "latin1"
    );
    const lines = text.split(/\r?\n/).slice(0, 3);
    lines.forEach((l, i) => console.log(`Línea ${i}:`, l.slice(0, 300)));
  } catch(e) { console.log("Error:", e.message); }
}

main().catch(e => { console.error(e.message); process.exit(1); });
