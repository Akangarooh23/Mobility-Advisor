// Enricher AS24: extrae "Precio al contado" de la descripción de cada ficha
// y corrige price/finance_price para las que lo tienen (68% de cobertura esperada).
//
// Qué escribe cuando encuentra el precio de contado:
//   finance_price = precio actual AS24 (el financiado, publicado)
//   price         = precio de contado extraído de la descripción
//
// De paso también detecta fichas muertas (mismo GET que el verificador).
//
// Uso:
//   node scripts/as24-enrich-descriptions.js               (real)
//   DRY_RUN=1 BATCH=10 node scripts/as24-enrich-descriptions.js
//   DRY_RUN=1 BATCH=10 DEBUG=1 node scripts/as24-enrich-descriptions.js
//
// Env: BATCH (default 500), PER_DOMAIN (default 2), DRY_RUN=1, DEBUG=1

"use strict";

const { Client } = require("pg");
const fs   = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const BATCH      = parseInt(process.env.BATCH      || "500", 10);
const PER_DOMAIN = parseInt(process.env.PER_DOMAIN || "2",   10);
const DRY_RUN    = process.env.DRY_RUN === "1";
const DEBUG      = process.env.DEBUG   === "1";
const HTTP_TIMEOUT = 15000;

const HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};

// Extrae "Precio al contado: 18.990 €" del body HTML de AS24
function extractCashPrice(body) {
  const m = body.match(/[Pp]recio\s+al\s+contado[^0-9]*([0-9][0-9.]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ""), 10);
  if (isNaN(n) || n < 1000 || n > 999999) return null;
  return n;
}

// GET de la ficha, clasifica y extrae precio si está disponible
async function fetchAndExtract(item) {
  let status = 0, body = "", finalUrl = item.url;
  try {
    const r = await fetch(item.url, {
      method:   "GET",
      redirect: "follow",
      headers:  HEADERS,
      signal:   AbortSignal.timeout(HTTP_TIMEOUT),
    });
    status   = r.status;
    finalUrl = r.url || item.url;
    if (status === 200) body = await r.text();
  } catch (e) {
    if (DEBUG) console.log(`  [ERROR  ] ${e.message.slice(0, 40)} — ${item.url.slice(0, 60)}`);
    return { id: item.id, currentPrice: item.price, dead: false, cashPrice: null };
  }

  // Muerta por HTTP
  if (status === 404 || status === 410 || status === 451) {
    if (DEBUG) console.log(`  [DEAD   HTTP ${status}] ${item.url.slice(0, 60)}`);
    return { id: item.id, currentPrice: item.price, dead: true, cashPrice: null };
  }

  // Error transitorio / bloqueada → no tocar
  if (status === 0 || status === 403 || status === 429 || status >= 500) {
    if (DEBUG) console.log(`  [SKIP   HTTP ${status}] ${item.url.slice(0, 60)}`);
    return { id: item.id, currentPrice: item.price, dead: false, cashPrice: null };
  }

  if (status === 200) {
    // Redirigió a búsqueda → muerta
    try {
      const f = new URL(finalUrl);
      if (f.pathname.includes("/lst") || f.pathname === "/es" || f.pathname === "/") {
        if (DEBUG) console.log(`  [DEAD   redir→${f.pathname.slice(0, 25)}] ${item.url.slice(0, 60)}`);
        return { id: item.id, currentPrice: item.price, dead: true, cashPrice: null };
      }
    } catch (_) {}

    // Texto de ficha no disponible
    if (
      body.includes("ya no está disponible") ||
      body.includes("no longer available") ||
      body.includes("offer-not-found")
    ) {
      if (DEBUG) console.log(`  [DEAD   texto] ${item.url.slice(0, 60)}`);
      return { id: item.id, currentPrice: item.price, dead: true, cashPrice: null };
    }

    // Viva: intentar extraer precio de contado
    const cashPrice = extractCashPrice(body);
    if (DEBUG) {
      if (cashPrice) console.log(`  [FOUND  €${cashPrice} / financiado €${item.price}] ${item.url.slice(0, 60)}`);
      else           console.log(`  [ALIVE  sin precio — body ${body.length}b] ${item.url.slice(0, 60)}`);
    }
    return { id: item.id, currentPrice: item.price, dead: false, cashPrice };
  }

  return { id: item.id, currentPrice: item.price, dead: false, cashPrice: null };
}

async function runPool(items, workers) {
  let idx = 0;
  const out = new Array(items.length);
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      out[i] = await fetchAndExtract(items[i]);
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

  // Prioriza las más recientemente vistas (mayor probabilidad de estar vivas y tener descripción actual)
  const rows = await withDb((c) => c.query(
    `SELECT id, url, price::numeric AS price
     FROM moveadvisor_market_offers
     WHERE portal = 'autoscout24'
       AND COALESCE(is_active, TRUE)
       AND COALESCE(url, '') <> ''
       AND (finance_price IS NULL OR finance_price = price)
     ORDER BY last_seen_at DESC NULLS LAST
     LIMIT $1`,
    [BATCH]
  ).then((r) => r.rows));

  if (!rows.length) {
    console.log("AS24 enrich: nada pendiente — todas las ofertas activas ya tienen precio de contado.");
    return;
  }

  console.log(`${DRY_RUN ? "[DRY-RUN] " : ""}AS24 enrich: ${rows.length} fichas, ${PER_DOMAIN} concurrentes...`);

  const results = await runPool(rows, PER_DOMAIN);

  const withPrice = results.filter(r => r.cashPrice !== null);
  const dead      = results.filter(r => r.dead);
  const noPrice   = results.filter(r => !r.dead && r.cashPrice === null);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Con precio: ${withPrice.length}  Muertas: ${dead.length}  Sin precio: ${noPrice.length}  (${elapsed}s)`);

  if (!DRY_RUN) {
    await withDb(async (c) => {
      // Corregir precios: finance_price = precio financiado AS24, price = precio de contado
      for (const g of chunk(withPrice, 5000)) {
        await c.query(
          `UPDATE moveadvisor_market_offers t
           SET finance_price = d.fp,
               price         = d.cp,
               updated_at    = NOW()
           FROM (SELECT unnest($1::text[])    AS id,
                        unnest($2::numeric[]) AS fp,
                        unnest($3::numeric[]) AS cp) d
           WHERE t.id = d.id
             AND t.portal = 'autoscout24'
             AND (t.finance_price IS NULL OR t.finance_price = t.price)`,
          [g.map(r => r.id), g.map(r => String(r.currentPrice)), g.map(r => String(r.cashPrice))]
        );
      }

      // Marcar muertas (de paso, sin coste extra de HTTP)
      for (const ids of chunk(dead.map(r => r.id), 5000)) {
        await c.query(
          `UPDATE moveadvisor_market_offers
           SET is_active=FALSE, last_checked_at=NOW(), updated_at=NOW()
           WHERE id = ANY($1)`,
          [ids]
        );
      }
    });

    console.log(`Actualizado: ${withPrice.length} precios corregidos, ${dead.length} marcadas inactivas.`);
  } else {
    console.log("[DRY-RUN] sin cambios en BD.");
  }

  console.log(`Hecho en ${elapsed}s`);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
