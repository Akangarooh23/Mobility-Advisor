// Verificador AS24: GET completo + parsing HTML para detectar fichas muertas.
// AS24 devuelve 200 en páginas muertas ("ya no está disponible" en el body),
// por lo que HEAD no sirve. Este script cubre lo que verify-liveness.js excluye.
//
// Cubre 2.000 fichas cada ejecución × 6 veces/día = 12.000/día → 352k en ~29 días.
//
//   node scripts/as24-verify-liveness.js           (real, BATCH por defecto)
//   DRY_RUN=1 node scripts/as24-verify-liveness.js (prueba, no actualiza BD)
//   BATCH=200 DRY_RUN=1 node ...                   (muestra rápida)
//
// Env: BATCH (default 2000), PER_DOMAIN (default 5), DUE_HOURS (default 720 = 30d), DRY_RUN=1

"use strict";

const { Client } = require("pg");
const fs   = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const BATCH      = parseInt(process.env.BATCH      || "2000", 10);
const PER_DOMAIN = parseInt(process.env.PER_DOMAIN || "5",    10);  // concurrencia baja = respeto anti-bot
const DUE_HOURS  = Math.max(0, parseInt(process.env.DUE_HOURS || "720", 10)); // 30 días por defecto
const DRY_RUN    = process.env.DRY_RUN === "1";
const DEBUG      = process.env.DEBUG === "1";
const HTTP_TIMEOUT = 15000; // 15s: AS24 carga JSON pesado en cada ficha

const HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

// Clasifica una URL de AS24 como "alive" | "gone" | "skip"
async function verifyAs24(url) {
  let status = 0, body = "", finalUrl = url;
  try {
    const r = await fetch(url, {
      method:   "GET",
      redirect: "follow",
      headers:  HEADERS,
      signal:   AbortSignal.timeout(HTTP_TIMEOUT),
    });
    status   = r.status;
    finalUrl = r.url || url;
    if (status === 200) body = await r.text();
  } catch (e) {
    if (DEBUG) console.log(`  ERROR fetch ${url}: ${e.message}`);
    status = 0;
  }

  let verdict;

  // Códigos HTTP definitivos
  if (status === 404 || status === 410 || status === 451) {
    verdict = "gone";
  } else if (status === 0 || status === 403 || status === 429 || status >= 500) {
    verdict = "skip";
  } else if (status === 200) {
    // Redirigió a búsqueda/categoría (cambio de pathname)
    try {
      const f = new URL(finalUrl);
      if (f.pathname.includes("/lst") || f.pathname === "/es" || f.pathname === "/") {
        verdict = "gone";
      }
    } catch (_) {}

    if (!verdict) {
      // Texto explícito de ficha ya no disponible
      if (
        body.includes("ya no está disponible") ||
        body.includes("no longer available") ||
        body.includes("nicht mehr verfügbar") ||
        body.includes("offer-not-found")
      ) {
        verdict = "gone";
      // JSON de resultados de búsqueda embebido: redirigió a búsqueda inline
      } else if (
        body.includes('"listings":[') &&
        !body.includes('"listingDetails"') &&
        !body.includes('"@type":"Car"')
      ) {
        verdict = "gone";
      // Tiene datos de ficha → viva
      } else if (body.includes('"listingDetails"') || body.includes('"@type":"Car"')) {
        verdict = "alive";
      } else {
        verdict = "skip";
      }
    }
  } else {
    verdict = "skip";
  }

  if (DEBUG) {
    const reason = status !== 200 ? `HTTP ${status}`
      : finalUrl !== url ? `redir→${new URL(finalUrl).pathname.slice(0, 40)}`
      : body.includes("ya no está disponible") ? "texto-muerta"
      : body.includes('"listingDetails"') ? "listingDetails"
      : body.includes('"@type":"Car"') ? "@type:Car"
      : body.includes('"listings":[') ? "listings-json"
      : `body ${body.length}b sin patrón`;
    console.log(`  [${verdict.toUpperCase().padEnd(5)}] ${reason.padEnd(45)} ${url.slice(0, 70)}`);
  }

  return verdict;
}

// Pool de N workers sobre una lista de items
async function runPool(items, workers) {
  let idx = 0;
  const out = new Array(items.length);
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = { id: items[i].id, verdict: await verifyAs24(items[i].url) };
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, items.length) }, worker));
  return out;
}

async function withDb(fn) {
  const c = new Client({ connectionString: DB_URL });
  c.on("error", () => {});
  await c.connect();
  try { return await fn(c); } finally { try { await c.end(); } catch (_) {} }
}

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

(async () => {
  const t0 = Date.now();
  const dueCond = DUE_HOURS > 0
    ? `AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '${DUE_HOURS} hours')`
    : "";

  const rows = await withDb((c) => c.query(
    `SELECT id, url
     FROM moveadvisor_market_offers
     WHERE portal = 'autoscout24'
       AND COALESCE(is_active, TRUE)
       AND COALESCE(url, '') <> ''
       ${dueCond}
     ORDER BY last_checked_at ASC NULLS FIRST
     LIMIT $1`,
    [BATCH]
  ).then((r) => r.rows));

  if (!rows.length) {
    console.log(`AS24 verificar: nada pendiente (todas verificadas en los últimos ${DUE_HOURS}h).`);
    return;
  }

  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}AS24 verificar: ${rows.length} fichas, ${PER_DOMAIN} concurrentes...`);

  const results = await runPool(rows, PER_DOMAIN);

  const alive = results.filter((r) => r.verdict === "alive").map((r) => r.id);
  const gone  = results.filter((r) => r.verdict === "gone").map((r) => r.id);
  const skip  = results.filter((r) => r.verdict === "skip").map((r) => r.id);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Vivas: ${alive.length}  Vendidas: ${gone.length}  Sin determinar: ${skip.length}  (${elapsed}s)`);

  if (!DRY_RUN) {
    await withDb(async (c) => {
      for (const ids of chunk(alive, 5000))
        await c.query(
          `UPDATE moveadvisor_market_offers SET is_active=TRUE,  last_checked_at=NOW(), updated_at=NOW() WHERE id = ANY($1)`,
          [ids]
        );
      for (const ids of chunk(gone, 5000))
        await c.query(
          `UPDATE moveadvisor_market_offers SET is_active=FALSE, last_checked_at=NOW(), updated_at=NOW() WHERE id = ANY($1)`,
          [ids]
        );
      for (const ids of chunk(skip, 5000))
        await c.query(
          `UPDATE moveadvisor_market_offers SET last_checked_at=NOW() WHERE id = ANY($1)`,
          [ids]
        );
    });
    console.log("BD actualizada.");
  } else {
    console.log("[DRY-RUN] sin cambios en BD.");
  }
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
