/**
 * Comprueba el scraper de VIAN.
 *
 *   npm run test:vian
 *
 * Pide UNA página real del listado, se la da a los nodos Code tal como están en
 * el JSON del workflow, y lanza el SQL que generan contra la base de verdad
 * dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila:
 *
 *   - Que las cabeceras se manden. Estaban en options.headers.values, que en
 *     typeVersion 4 n8n ignora en silencio: pedía sin User-Agent.
 *   - Que el número de páginas se lea del listado. Estaba fijo en 55 con un
 *     comentario que decía "~52 págs para 609"; hoy son 622 coches, y el día
 *     que pasen de 660 el scraper dejaría de ver el catálogo entero sin avisar.
 *   - Que una página del listado que no venga bien pare el run, en vez de
 *     parsearse como un HTML sin coches.
 *   - Que una ficha mala se salte sin tumbar las otras cuatrocientas.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "vian-scraper-vo.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const nodosHttp = wf.nodes.filter((n) => n.type.endsWith("httpRequest"));

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

function corre(js, entrada, todos) {
  const log = [];
  const f = new Function("$input", "console", js);
  const r = f({
    all: () => (todos || [{ json: entrada }]),
    first: () => ({ json: entrada }),
    item: { json: entrada },
  }, { log: (m) => log.push(String(m)) });
  return { salida: r, log };
}

(async () => {
  // ── las cabeceras ─────────────────────────────────────────────────────────
  console.log("CABECERAS");
  comprueba("los " + nodosHttp.length + " nodos HTTP mandan cabeceras",
    nodosHttp.every((n) => n.parameters.sendHeaders === true
      && (n.parameters.headerParameters || {}).parameters));
  comprueba("ninguna escondida en options.headers",
    nodosHttp.every((n) => !(n.parameters.options || {}).headers));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  // ── una página real del listado ───────────────────────────────────────────
  console.log("\nUNA PÁGINA REAL DEL LISTADO");
  const H = {};
  (nodosHttp[0].parameters.headerParameters.parameters || []).forEach((c) => { H[c.name] = c.value; });
  const url = "https://www.comprayconduce.es/coches-ocasion/";
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(25000) });
  const body = await r.text();
  console.log("      " + url + "  ->  HTTP " + r.status + "   " + body.length + " bytes");
  comprueba("el listado responde 200", r.status === 200);

  // ── cuántas páginas planifica ─────────────────────────────────────────────
  console.log("\nPLANIFICACIÓN");
  const plan = corre(codigo("Code: Generar páginas de listado"), { statusCode: 200, body: body });
  plan.log.forEach((l) => console.log("      " + l));
  const paginas = plan.salida.length;
  comprueba("cuenta el catálogo y planifica en consecuencia", paginas >= 45 && paginas <= 80,
    "(" + paginas + " páginas)");
  comprueba("la página 1 va sin ?pagina=", !/pagina=/.test(plan.salida[0].json.url));
  let paro = false;
  try { corre(codigo("Code: Generar páginas de listado"), { statusCode: 503, body: "" }); }
  catch (e) { paro = /HTTP 503/.test(e.message); }
  comprueba("si no puede contar el catálogo, para el run", paro);

  // ── el extractor de fichas ────────────────────────────────────────────────
  console.log("\nEL EXTRACTOR DE FICHAS");
  const ex = corre(codigo("Code: Extraer fichas del listado"), null,
    [{ json: { statusCode: 200, body: body } }]);
  const urls = (ex.salida[0].json.urls || []);
  comprueba("saca las fichas de la página", urls.length > 0, "(" + urls.length + ")");
  let paro2 = false;
  try {
    corre(codigo("Code: Extraer fichas del listado"), null,
      [{ json: { statusCode: 200, body: body } }, { json: { statusCode: 502, body: "" } }]);
  } catch (e) { paro2 = /HTTP 502/.test(e.message); }
  comprueba("una página mala detiene el run", paro2);

  // ── una ficha real ────────────────────────────────────────────────────────
  console.log("\nUNA FICHA REAL");
  const rf = await fetch(urls[0].url, { headers: H, signal: AbortSignal.timeout(25000) });
  const ficha = await rf.text();
  const tr = corre(codigo("Code: Transformar oferta"), { statusCode: rf.status, body: ficha });
  const sql = tr.salida[0].json.sql;
  console.log("      " + urls[0].url.slice(-60) + "  ->  HTTP " + rf.status);
  comprueba("genera SQL de la ficha", !!sql && /INSERT INTO moveadvisor_marketplace_vo_offers/.test(sql));
  const mala = corre(codigo("Code: Transformar oferta"), { statusCode: 500, body: "" });
  comprueba("una ficha mala se salta sin tumbar la pasada", mala.salida[0].json.sql === null);

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
