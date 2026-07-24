// Verificador de "vivo/muerto" de ofertas de mercado.
// Recorre por id (las menos-recientemente-verificadas primero), hace una petición
// LIGERA (HEAD, sin cuerpo) a la URL, y clasifica: viva / vendida / transitorio.
// Actualiza is_active + last_checked_at. NO extrae datos → rápido.
//
//   node scripts/verify-liveness.js                 (real, BATCH por defecto)
//   DRY_RUN=1 BATCH=800 node scripts/verify-liveness.js   (prueba, no actualiza)
//   BATCH=60000 node scripts/verify-liveness.js     (lote grande)
//
// Env: BATCH (nº ofertas/ejecución), DRY_RUN=1, PER_DOMAIN (concurrencia por portal).

const { Client } = require("pg");
const fs = require("fs");

const env = fs.readFileSync(require("path").join(__dirname, "..", ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const BATCH = parseInt(process.env.BATCH || "500", 10);
const PER_DOMAIN = parseInt(process.env.PER_DOMAIN || "10", 10);
// DUE_HOURS > 0: solo verifica las que llevan sin comprobar > DUE_HOURS (o nunca).
// Garantiza refresco de TODAS cada ~DUE_HOURS. 0 = verificar todas (modo "forzar", botón).
const DUE_HOURS = Math.max(0, parseInt(process.env.DUE_HOURS || "0", 10));
const DRY_RUN = process.env.DRY_RUN === "1";
const HTTP_TIMEOUT = 12000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const HEADERS = { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9" };

// path "landing" (categoría/home) por portal: si una ficha redirige AQUÍ, está vendida
const LANDING = {
  autoscout24: ["/es", "/lst"],
  autocasion: ["/coches-ocasion", "/coches-segunda-mano"],
  cochescom: ["/coches-segunda-mano"],
  ocasionplus: ["/coches-segunda-mano"],
  canalcar: ["/coches-ocasion"],
  clicars: ["/coches-segunda-mano-ocasion"],
  wallapop: [],
  milanuncios: ["/coches-de-segunda-mano"],
};

function isLanding(portal, path) {
  const p = (path || "/").replace(/\/+$/, "") || "/";
  const segs = p.split("/").filter(Boolean);
  if (segs.length <= 1) return true; // ruta muy corta = categoría/home
  return (LANDING[portal] || []).some((k) => k.replace(/\/+$/, "") === p);
}

function classify(portal, status, origUrl, finalUrl) {
  if (status === 404 || status === 410 || status === 451) return "gone";
  if (status === 0 || status === 403 || status === 429 || status >= 500) return "skip"; // transitorio/bloqueo → no tocar
  if (status >= 200 && status < 400) {
    try {
      const o = new URL(origUrl), f = new URL(finalUrl);
      if (o.pathname.replace(/\/+$/, "") !== f.pathname.replace(/\/+$/, "") && isLanding(portal, f.pathname)) return "gone";
    } catch (e) {}
    return "alive";
  }
  return "skip";
}

async function verifyOne(item) {
  let status = 0, finalUrl = item.url;
  try {
    const r = await fetch(item.url, { method: "HEAD", redirect: "follow", headers: HEADERS, signal: AbortSignal.timeout(HTTP_TIMEOUT) });
    status = r.status; finalUrl = r.url || item.url;
    // algunos servidores no soportan HEAD (405): reintentar con GET
    if (status === 405) {
      const g = await fetch(item.url, { method: "GET", redirect: "follow", headers: HEADERS, signal: AbortSignal.timeout(HTTP_TIMEOUT) });
      status = g.status; finalUrl = g.url || item.url;
    }
  } catch (e) { status = 0; }
  return { id: item.id, portal: item.portal, url: item.url, finalUrl, verdict: classify(item.portal, status, item.url, finalUrl), status };
}

// ¿la url final es una ficha nueva válida (redirigió a otra canónica, no a home) que conviene guardar?
function urlChanged(portal, origUrl, finalUrl) {
  if (!finalUrl || finalUrl === origUrl) return false;
  try {
    const o = new URL(origUrl), f = new URL(finalUrl);
    if (o.pathname.replace(/\/+$/, "") === f.pathname.replace(/\/+$/, "")) return false; // solo cambió query/hash
    if (isLanding(portal, f.pathname)) return false; // redirigió a categoría/home -> no es ficha
    return true;
  } catch (e) { return false; }
}

// pool con N workers para una lista (concurrencia por dominio)
async function runPool(items, workers) {
  let idx = 0; const out = new Array(items.length);
  async function worker() { while (idx < items.length) { const i = idx++; out[i] = await verifyOne(items[i]); } }
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, worker));
  return out;
}

async function withDb(fn) {
  const c = new Client({ connectionString: DB_URL });
  c.on("error", () => {}); // evita crash por 'error' asíncrono
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch (e) {} }
}

(async () => {
  const t0 = Date.now();
  // 1) LEER el lote y cerrar la conexión (no la mantenemos durante el HTTP, que tarda
  //    minutos y Neon cierra conexiones inactivas -> "Connection terminated").
  const dueCond = DUE_HOURS > 0
    ? `AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '${DUE_HOURS} hours')`
    : '';
  // Excluido: autoscout24 (anti-bot bloquea el check por URL ~98% -> su is_active lo
  // gobierna el umbral de last_seen). Flexicar SÍ se verifica aquí (su URL funciona y
  // su verificador propio solo miraba activas, dejando falsos inactivos sin corregir).
  // PORTAL (env, opcional) = verificar solo ese portal (para arreglos puntuales).
  const PORTAL = (process.env.PORTAL || "").replace(/[^a-z0-9]/gi, "");
  const portalCond = PORTAL ? `AND portal = '${PORTAL}'` : `AND portal <> 'autoscout24'`;
  const rows = await withDb((c) => c.query(
    `SELECT id, url, portal FROM moveadvisor_market_offers
     WHERE COALESCE(url,'') <> '' ${portalCond} ${dueCond}
     ORDER BY last_checked_at ASC NULLS FIRST
     LIMIT $1`, [BATCH]).then((r) => r.rows));
  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}Verificando ${rows.length} ofertas (por dominio, ${PER_DOMAIN}/portal)...`);

  // agrupar por dominio/portal → correr todos los dominios en paralelo, cada uno con PER_DOMAIN workers
  const byPortal = {};
  for (const r of rows) (byPortal[r.portal] ||= []).push(r);
  const packs = await Promise.all(Object.values(byPortal).map((items) => runPool(items, PER_DOMAIN)));
  const results = packs.flat();

  // resumen por portal
  const summary = {};
  for (const r of results) { const s = (summary[r.portal] ||= { alive: 0, gone: 0, skip: 0 }); s[r.verdict]++; }
  console.log("\nportal        viva   vendida  transit.");
  for (const p of Object.keys(summary).sort()) { const s = summary[p]; console.log(`  ${p.padEnd(12)} ${String(s.alive).padStart(5)} ${String(s.gone).padStart(8)} ${String(s.skip).padStart(8)}`); }
  const tot = results.reduce((a, r) => { a[r.verdict]++; return a; }, { alive: 0, gone: 0, skip: 0 });
  console.log(`  ${"TOTAL".padEnd(12)} ${String(tot.alive).padStart(5)} ${String(tot.gone).padStart(8)} ${String(tot.skip).padStart(8)}`);

  if (!DRY_RUN) {
    const alive = results.filter((r) => r.verdict === "alive").map((r) => r.id);
    const gone = results.filter((r) => r.verdict === "gone").map((r) => r.id);
    const skip = results.filter((r) => r.verdict === "skip").map((r) => r.id);
    // URLs a corregir: vivas que redirigieron a una canónica nueva (auto-heal de URL, por id)
    const urlFix = results.filter((r) => r.verdict === "alive" && urlChanged(r.portal, r.url, r.finalUrl));
    // 3) RECONECTAR (fresca) para escribir; en lotes por si el array de ids es enorme
    await withDb(async (c) => {
      const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
      for (const ids of chunk(alive, 10000)) await c.query(`UPDATE moveadvisor_market_offers SET is_active=TRUE, last_checked_at=NOW(), updated_at=NOW() WHERE id = ANY($1)`, [ids]);
      for (const ids of chunk(gone, 10000)) await c.query(`UPDATE moveadvisor_market_offers SET is_active=FALSE, last_checked_at=NOW(), updated_at=NOW() WHERE id = ANY($1)`, [ids]);
      for (const ids of chunk(skip, 10000)) await c.query(`UPDATE moveadvisor_market_offers SET last_checked_at=NOW() WHERE id = ANY($1)`, [ids]); // transitorio: solo rota, no cambia is_active
      for (const g of chunk(urlFix, 5000)) await c.query(
        `UPDATE moveadvisor_market_offers t SET url = d.url, updated_at=NOW()
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS url) d WHERE t.id = d.id`,
        [g.map((x) => x.id), g.map((x) => x.finalUrl)]);
    });
    console.log(`\nActualizado: ${alive.length} vivas, ${gone.length} vendidas, ${skip.length} transitorias, ${urlFix.length} URLs corregidas.`);
  } else {
    console.log("\n[DRY-RUN] no se ha tocado la BD.");
  }
  console.log(`Hecho en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
