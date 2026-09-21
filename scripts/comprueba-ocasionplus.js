/**
 * Comprueba el scraper de OcasionPlus.
 *
 *   npm run test:ocasionplus
 *
 * Pide páginas de verdad y se las da a los nodos Code tal como están en el JSON
 * del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK, que
 * se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que el id sea «op_» más la cola de la url. Así están las 27.000 filas que
 *     ya hay —comprobado sobre ocho al azar, ocho de ocho— y cualquier otra
 *     forma de construirlo las duplicaría todas.
 *   - Que NO machaque color, carrocería, provincia ni etiqueta. Las 8.036 vivas
 *     las tienen al 100 % de cuando el scraper leía la ficha; pisarlas con
 *     vacío en cada pasada sería tirar ese trabajo cada noche.
 *   - Que resucite (is_active = TRUE): si el verificador se equivoca un día, el
 *     scraper tiene que poder deshacerlo.
 *   - Que la página 1 sea la url base, porque «?page=1» devuelve 404.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const orq = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "ocasionplus-scraper-offers.json"), "utf8"));
const seg = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "ocasionplus-segmento.json"), "utf8"));
const nodo = (wf, n) => wf.nodes.find((x) => x.name === n);
const codigo = (wf, n) => nodo(wf, n).parameters.jsCode;

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "console", js);
  const r = f(ctx.$ || (() => uno({})), ctx.$input, { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const varios = (arr) => ({ first: () => ({ json: arr[0] }), all: () => arr.map((j) => ({ json: j })) });
const CAB = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = orq.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  for (const [quien, wf] of [["orquestador", orq], ["segmento", seg]]) {
    const https = wf.nodes.filter((n) => n.type.endsWith("httpRequest"));
    comprueba(quien + ": manda User-Agent",
      https.every((n) => n.parameters.sendHeaders === true));
    comprueba(quien + ": nada en options.headers, que typeVersion 4 ignora",
      https.every((n) => !(n.parameters.options || {}).headers));
    comprueba(quien + ": un corte de red no tumba la pasada",
      https.every((n) => n.onError === "continueRegularOutput"));
    comprueba(quien + ": Postgres reintenta",
      wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
    comprueba(quien + ": avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
    const nombres = new Set(wf.nodes.map((n) => n.name));
    let rotas = 0;
    for (const [de, x] of Object.entries(wf.connections)) {
      if (!nombres.has(de)) rotas++;
      for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
    }
    comprueba(quien + ": ninguna conexión apunta a un nodo que no existe", rotas === 0);
  }
  const sub = nodo(orq, "Scrapear segmento (OcasionPlus – Segmento)");
  comprueba("el orquestador ESPERA a cada segmento",
    ((sub.parameters.options || {}).waitForSubWorkflow) === true);
  comprueba("y el id del segmento es texto, no un objeto",
    typeof sub.parameters.workflowId === "string", String(sub.parameters.workflowId));
  const baseN8n = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");
  if (fs.existsSync(baseN8n)) {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(baseN8n, { readOnly: true });
    const existen = new Set(db.prepare("SELECT id FROM credentials_entity WHERE type='postgres'").all().map((x) => x.id));
    db.close();
    const usadas = [...new Set(orq.nodes.concat(seg.nodes).filter((n) => n.credentials)
      .map((n) => n.credentials.postgres.id))];
    comprueba("la credencial de Postgres existe en n8n",
      usadas.every((id) => existen.has(id)), usadas.join(", "));
  }

  // ══ un segmento vacío ════════════════════════════════════════════════════
  console.log("\nUN SEGMENTO VACÍO NO SE INVENTA NADA");
  for (const malo of [{}, { desde: 0, hasta: 0 }, { desde: 5 }, { hasta: 3, desde: 9 }]) {
    comprueba("con " + JSON.stringify(malo) + " no devuelve nada",
      ejecuta(codigo(seg, "Params"), { $input: uno(malo) }).items.length === 0);
  }

  // ══ la página 1 ══════════════════════════════════════════════════════════
  console.log("\nLA PÁGINA 1 ES LA URL BASE, NO «?page=1»");
  const pags = ejecuta(codigo(seg, "Code: Generar páginas"), { $input: uno({ desde: 1, hasta: 3 }) })
    .items.map((x) => x.json);
  comprueba("la 1 va sin parámetro", pags[0].url.indexOf("?page=") === -1, pags[0].url.slice(-30));
  comprueba("y la 2 sí lo lleva", pags[1].url.indexOf("?page=2") !== -1);
  comprueba("ninguna url lleva filtros, que su robots.txt prohíbe",
    pags.every((p) => !/[?&](marca|modelo|sort|type|location|price_min)=/.test(p.url)));

  // ══ contra el portal ═════════════════════════════════════════════════════
  console.log("\nEL PORTAL, DE VERDAD");
  const r1 = await fetch("https://www.ocasionplus.com/coches-segunda-mano", { headers: CAB, signal: AbortSignal.timeout(60000) });
  const home = await r1.text();
  comprueba("responde", r1.status === 200, "HTTP " + r1.status);
  const gen = ejecuta(codigo(orq, "Code: Generar segmentos (ventanas de páginas)"), {
    $input: uno({ data: home, statusCode: 200 }),
    $: (n) => (n === "PG: Por dónde íbamos" ? varios([{ clave: "ocasionplus_pagina", valor: 1 }]) : uno({})),
  });
  const ventanas = gen.items.map((x) => x.json);
  comprueba("cuenta el catálogo y lo reparte", ventanas.length > 0 && ventanas[0].hasta > 0,
    ventanas.length + " ventanas, hasta la página " + (ventanas[ventanas.length - 1] || {}).hasta);
  comprueba("y apunta el cursor antes de scrapear",
    String(ventanas[0].sqlCursor || "").indexOf("ocasionplus_paginas") !== -1);

  await dormir(1500);
  const r3 = await fetch("https://www.ocasionplus.com/coches-segunda-mano?page=3", { headers: CAB, signal: AbortSignal.timeout(60000) });
  const html3 = await r3.text();
  const t = ejecuta(codigo(seg, "Code: Transformar ofertas"), { $input: uno({ data: html3 }) });
  const salida = t.items[0].json;
  comprueba("saca los coches de una página", salida.count >= 15, salida.count + " coches");
  const sql = String(salida.sql || "");

  console.log("\nLO QUE NO SE PUEDE FALLAR");
  comprueba("el id es «op_» + la cola de la url", /VALUES \('op_[a-z0-9]{6,}'/.test(sql),
    (sql.match(/VALUES \('([^']+)'/) || [])[1]);
  // Y que case con la url de esa misma fila, que es la prueba de verdad.
  const primera = sql.slice(sql.indexOf("VALUES (") + 8);
  const idPrimero = (primera.match(/^'([^']+)'/) || [])[1];
  const urlPrimera = (primera.match(/'(https:\/\/[^']+)'/) || [])[1] || "";
  comprueba("y casa con la url de su propia fila",
    idPrimero === "op_" + urlPrimera.split("-").pop(), idPrimero + "  <-  ..." + urlPrimera.slice(-14));
  comprueba("resucita lo que el verificador diera por muerto", sql.indexOf("is_active = TRUE") !== -1);
  for (const c of ["color", "body_type", "province", "environmental_label", "doors", "seats", "co2"]) {
    comprueba("NO toca " + c, sql.indexOf(c) === -1);
  }
  comprueba("saca la potencia del nombre", /, [0-9]{2,4}, 'profesional'/.test(sql),
    "«(122 CV)» -> 122");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  await c.query("BEGIN");
  try {
    const antes = (await c.query("SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='ocasionplus'")).rows[0].n;
    const res = await c.query(sql);
    comprueba("el SQL entra sin quejarse", res.rowCount === salida.count, res.rowCount + " filas");
    const desp = (await c.query("SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='ocasionplus'")).rows[0].n;
    console.log("      ofertas de ocasionplus: " + antes + " -> " + desp
      + "   (" + (desp - antes) + " nuevas, " + (salida.count - (desp - antes)) + " que ya estaban)");

    /*
     * Lo que importa no es cuántas eran nuevas, sino que una segunda pasada no
     * duplique.
     *
     * Aquí exigía que la mayoría ya estuvieran en la base, y fallaba con el
     * código bien: el listado va por novedad, y de esa página las veinte eran
     * coches que no teníamos —hay 4.702 suyos sin registrar—. Medir el solape
     * era medir el azar. Lo que de verdad prueba que el id está bien construido
     * es lanzar el mismo SQL otra vez: si el id casara mal, la tabla crecería
     * otras veinte filas.
     */
    await c.query(sql);
    const otraVez = (await c.query("SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='ocasionplus'")).rows[0].n;
    comprueba("repetir la misma pasada NO duplica ni una fila", otraVez === desp,
      desp + " -> " + otraVez);
  } finally { await c.query("ROLLBACK"); }
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
