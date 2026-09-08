/**
 * Comprueba el scraper de Modrive.
 *
 *   npm run test:modrive
 *
 * Pide el sitemap de verdad y UNA ficha real, se los da a los nodos Code tal
 * como están en el JSON del workflow, y lanza el SQL que generan contra la base
 * dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila:
 *
 *   - Que las cabeceras se manden. Estaban en options.headers.values, que en
 *     typeVersion 4 n8n ignora en silencio: pedía sin User-Agent.
 *   - Que si el sitemap no viene, el run se pare. El sitemap ES el catálogo
 *     entero: seguir con una lista vacía haría creer que Modrive no tiene
 *     coches.
 *   - Que una ficha mala se salte sin tumbar las otras cuatrocientas.
 *   - Que updated_at solo se mueva si el anuncio ha cambiado. Modrive son 1.788
 *     ofertas, el 59% del escaparate: una pasada suya sellando sin motivo
 *     entierra a Gamboa y a VIAN en el orden de la tienda.
 *   - Que se selle last_seen_at, que es lo que convierte esa columna en la
 *     fecha de baja.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "modrive-scraper-vo.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const nodosHttp = wf.nodes.filter((n) => n.type.endsWith("httpRequest"));
const H = {};
(nodosHttp[0].parameters.headerParameters.parameters || []).forEach((c) => { H[c.name] = c.value; });

function corre(js, entrada) {
  const log = [];
  const f = new Function("$", "$input", "console", js);
  const r = f(() => ({ item: { json: { url: (entrada || {}).urlPedida || "" } }, first: () => ({ json: {} }) }),
    { item: { json: entrada }, first: () => ({ json: entrada }), all: () => [{ json: entrada }] },
    { log: (m) => log.push(String(m)) });
  return { salida: r, log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  // ── configuración ─────────────────────────────────────────────────────────
  console.log("CONFIGURACIÓN");
  comprueba("los " + nodosHttp.length + " nodos HTTP mandan cabeceras",
    nodosHttp.every((n) => n.parameters.sendHeaders === true
      && (n.parameters.headerParameters || {}).parameters));
  comprueba("ninguna escondida en options.headers",
    nodosHttp.every((n) => !(n.parameters.options || {}).headers));
  comprueba("un fallo de red no tumba el run",
    nodosHttp.every((n) => n.onError === "continueRegularOutput"));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  // ── el sitemap ────────────────────────────────────────────────────────────
  console.log("\nEL SITEMAP");
  const r = await fetch(nodosHttp[0].parameters.url, { headers: H, signal: AbortSignal.timeout(30000) });
  const xml = await r.text();
  console.log("      " + nodosHttp[0].parameters.url + "  ->  HTTP " + r.status + "   " + xml.length + " bytes");
  const sm = corre(codigo("Code: Extraer URLs del sitemap"), { statusCode: r.status, body: xml });
  const urls = sm.salida[0].json.urls || [];
  comprueba("saca las URLs del sitemap", urls.length > 500, "(" + urls.length + " coches)");
  comprueba("y les pone su id", urls.every((u) => /^modrive_\d+$/.test(u.id)));

  let paro = false;
  try { corre(codigo("Code: Extraer URLs del sitemap"), { statusCode: 503, body: "" }); }
  catch (e) { paro = /HTTP 503/.test(e.message); }
  comprueba("si el sitemap no viene, para el run", paro);

  // ── una ficha real ────────────────────────────────────────────────────────
  console.log("\nUNA FICHA REAL");
  const rf = await fetch(urls[0].url, { headers: H, signal: AbortSignal.timeout(30000) });
  const ficha = await rf.text();
  console.log("      " + urls[0].url.slice(-58) + "  ->  HTTP " + rf.status);
  const tr = corre(codigo("Code: Transformar oferta"), { statusCode: rf.status, body: ficha, urlPedida: urls[0].url });
  const sql = tr.salida[0].json.sql;
  comprueba("genera SQL de la ficha",
    !!sql && /INSERT INTO moveadvisor_marketplace_vo_offers/.test(sql));
  const mala = corre(codigo("Code: Transformar oferta"), { statusCode: 500, body: "" });
  comprueba("una ficha mala se salta sin tumbar la pasada", mala.salida[0].json.sql === null);

  // ── lo que ordena el escaparate ───────────────────────────────────────────
  console.log("\nEL ORDEN DEL ESCAPARATE");
  comprueba("updated_at solo se mueve si el anuncio ha cambiado",
    /updated_at = CASE WHEN/.test(sql)
    && !/updated_at = NOW\(\)/.test(sql.split("ON CONFLICT")[1] || ""));
  comprueba("y lo decide comparando precio, título y kilómetros",
    /price IS DISTINCT FROM EXCLUDED\.price/.test(sql)
    && /title IS DISTINCT FROM EXCLUDED\.title/.test(sql)
    && /mileage IS DISTINCT FROM EXCLUDED\.mileage/.test(sql));
  comprueba("sella last_seen_at al reencontrarlas", /last_seen_at = NOW\(\)/.test(sql));

  // ── la URL que se guarda ──────────────────────────────────────────────────
  //
  // Tiene que ser la del SITEMAP, no la que anuncia el JSON-LD de la ficha.
  // Modrive cambió sus rutas de /coches-segunda-mano/ a /coches-ocasion/: el
  // sitemap ya publica las nuevas, pero el JSON-LD de dentro de la ficha sigue
  // diciendo la vieja. Fiándose de él, el scraper metió 210 ofertas con la ruta
  // rota el mismo día en que se repararon a mano las otras 1.788.
  console.log("\nLA URL QUE SE GUARDA");
  console.log("      la del sitemap : " + urls[0].url.slice(-56));
  comprueba("guarda la URL del sitemap, no la del JSON-LD",
    sql.includes("'" + urls[0].url + "'"));
  comprueba("y no la ruta vieja", !/coches-segunda-mano/.test(sql));

  // ── el precio ─────────────────────────────────────────────────────────────
  //
  // El JSON-LD publica como `price` el de FINANCIAR SIN ENTRADA. La ficha los
  // enseña separados: «Precio al contado 17.500 €» frente a «Financia sin
  // entrada 16.000 €». En 12 fichas al azar el guardado era el financiado en
  // las 12, entre 1.000 y 2.862 € por debajo del de contado.
  console.log("\nEL PRECIO");
  const mContado = ficha.match(/Precio al contado[\s\S]{0,200}?<span[^>]*>\s*([\d.]+)\s*(?:€|&euro;)/);
  const contado = mContado ? Number(mContado[1].replace(/\./g, "")) : null;
  const jsonLd = Number(((JSON.parse(
    (ficha.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i) || [])[1] || "{}"
  )["@graph"] || []).find((o) => o && o["@type"] === "Vehicle") || { offers: {} }).offers.price || 0);
  console.log("      al contado : " + (contado || "-") + "      financiando : " + (jsonLd || "-"));
  comprueba("la ficha trae el precio al contado", contado > 0);
  comprueba("guarda el precio al contado, no el de financiar",
    new RegExp("(^|[(,]\\s*)" + contado + "\\s*,").test(sql));
  if (contado && jsonLd && contado !== jsonLd) {
    comprueba("y no guarda el financiado como precio",
      !new RegExp("(^|[(,]\\s*)" + jsonLd + "\\s*,\\s*" + jsonLd).test(sql));
  }
  comprueba("el financiado no se pierde, va a price_financed",
    /price_financed/.test(sql) && (!jsonLd || sql.includes(String(jsonLd))));
  comprueba("un cambio de precio financiado cuenta como cambio del anuncio",
    /price_financed IS DISTINCT FROM EXCLUDED\.price_financed/.test(sql));

  // ── contra la base ────────────────────────────────────────────────────────
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  await c.query("BEGIN");
  try {
    const q = await c.query(sql);
    comprueba("el SQL se ejecuta sin error", true, "(" + q.rowCount + " filas)");
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
