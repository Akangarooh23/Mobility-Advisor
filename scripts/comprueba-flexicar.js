/**
 * Comprueba el scraper de Flexicar.
 *
 *   npm run test:flexicar
 *
 * Pide páginas de verdad a la API y se las da a los nodos Code tal como están
 * en el JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que el id NO lleve prefijo. Las 27.454 filas que ya hay usan el id de
 *     Flexicar tal cual; ponerle «fx_» delante las duplicaría todas y dejaría
 *     las viejas muertas para siempre.
 *   - Que el UPSERT resucite (is_active = TRUE). Sin eso, una oferta que el
 *     verificador dé de baja por error se queda muerta aunque el scraper la
 *     vuelva a ver cada día.
 *   - Que NO machaque lo que el listado no trae -puertas, plazas, carrocería,
 *     cilindrada-, que es justo lo que rellena el enriquecedor.
 *   - Que un segmento sin ventana no se invente páginas: en Autocasión un
 *     valor por defecto scrapeó 360 ofertas de otra marca.
 *   - Que el cron caiga entre las 8:00 y las 00:00.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const orq = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "flexicar-scraper-offers.json"), "utf8"));
const seg = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "flexicar-segmento.json"), "utf8"));
const nodo = (wf, n) => wf.nodes.find((x) => x.name === n);
const codigo = (wf, n) => nodo(wf, n).parameters.jsCode;

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  const r = f(ctx.$ || (() => uno({})), ctx.$input, () => (ctx.estatico || {}), { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const varios = (arr) => ({ first: () => ({ json: arr[0] }), all: () => arr.map((j) => ({ json: j })) });

const CAB_API = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json", "Accept-Language": "es-ES,es;q=0.9",
  "Origin": "https://www.flexicar.es", "Referer": "https://www.flexicar.es/",
};
const CAB_WEB = { ...CAB_API, Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = orq.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(String(expr).split(" ")[1]) !== 0);

  for (const [quien, wf] of [["orquestador", orq], ["segmento", seg]]) {
    const https = wf.nodes.filter((n) => n.type.endsWith("httpRequest"));
    comprueba(quien + ": todas las peticiones mandan User-Agent",
      https.every((n) => n.parameters.sendHeaders === true
        && (n.parameters.headerParameters.parameters || []).some((c) => c.name === "User-Agent")));
    comprueba(quien + ": ninguna cabecera en options.headers, que typeVersion 4 ignora",
      https.every((n) => !(n.parameters.options || {}).headers));
    comprueba(quien + ": un corte de red no tumba la pasada",
      https.every((n) => n.onError === "continueRegularOutput"));
    comprueba(quien + ": los nodos de Postgres reintentan",
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

  const sub = nodo(orq, "Scrapear segmento (Flexicar – Segmento)");
  comprueba("el orquestador ESPERA a cada segmento",
    ((sub.parameters.options || {}).waitForSubWorkflow) === true);
  comprueba("y el id del segmento es texto, no un objeto",
    typeof sub.parameters.workflowId === "string", String(sub.parameters.workflowId));
  if (sub.parameters.workflowId === "PENDIENTE_DE_ENLAZAR") {
    console.log("        (todavía sin enlazar: npm run enlaza-segmento-flexicar)");
  }

  // ══ un segmento sin ventana no hace nada ═════════════════════════════════
  console.log("\nUN SEGMENTO VACÍO NO SE INVENTA NADA");
  for (const malo of [{}, { desde: 0, hasta: 0 }, { desde: 5 }, { hasta: 3, desde: 9 }]) {
    const r = ejecuta(codigo(seg, "Params"), { $input: uno(malo) });
    comprueba("con " + JSON.stringify(malo) + " no devuelve nada", r.items.length === 0);
  }

  // ══ la API, de verdad ════════════════════════════════════════════════════
  console.log("\nLA API DE FLEXICAR");
  const r1 = await fetch("https://services.flexicar.es/api/v1/vehicles?page=1",
    { headers: CAB_API, signal: AbortSignal.timeout(30000) });
  const cuerpo1 = await r1.text();
  const j1 = JSON.parse(cuerpo1);
  comprueba("responde y dice cuántas páginas hay", r1.status === 200 && j1.pages > 0,
    j1.total + " coches en " + j1.pages + " páginas");
  comprueba("y trae 12 por página", (j1.results || []).length === 12);

  await dormir(1000);
  const web = await fetch("https://www.flexicar.es/coches-segunda-mano/",
    { headers: CAB_WEB, signal: AbortSignal.timeout(30000) });
  const htmlWeb = await web.text();

  // El nodo que reparte ventanas, con las respuestas de verdad.
  const gen = ejecuta(codigo(orq, "Code: Generar segmentos (ventanas de páginas)"), {
    $input: uno({ data: cuerpo1 }),
    $: (n) => (n === "PG: Por dónde íbamos" ? varios([{ clave: "flexicar_pagina", valor: 1 }])
      : n === "HTTP: Listado (provincias)" ? uno({ data: htmlWeb }) : uno({})),
  });
  const ventanas = gen.items.map((x) => x.json);
  comprueba("reparte el catálogo en ventanas", ventanas.length > 0, ventanas.length + " ventanas");
  const ultima = ventanas[ventanas.length - 1];
  comprueba("y las ventanas llegan al final del catálogo", ultima.hasta >= j1.pages,
    "última hasta la " + ultima.hasta + " de " + j1.pages);
  comprueba("saca el mapa de provincias del listado",
    Object.keys(ventanas[0].provincias || {}).length > 100,
    Object.keys(ventanas[0].provincias || {}).length + " concesionarios");
  comprueba("apunta el cursor antes de scrapear", /flexicar_paginas/.test(ventanas[0].sqlCursor || ""));

  // ══ transformar una página real ══════════════════════════════════════════
  console.log("\nUNA PÁGINA REAL, TRADUCIDA");
  const t = ejecuta(codigo(seg, "Code: Transformar ofertas"), {
    $input: uno({ data: cuerpo1 }),
    $: (n) => (n === "Params" ? uno({ provincias: ventanas[0].provincias }) : uno({})),
  });
  const salida = t.items[0].json;
  comprueba("saca las 12 ofertas de la página", salida.count === 12, salida.count + " ofertas");
  const sql = String(salida.sql || "");
  comprueba("el id va SIN prefijo, como las filas que ya hay",
    /VALUES \('9\d{14}', 'flexicar'/.test(sql), (sql.match(/VALUES \('([^']+)'/) || [])[1]);
  comprueba("resucita lo que el verificador diera por muerto", /is_active = TRUE/.test(sql));
  comprueba("NO machaca lo que rellena el enriquecedor",
    !/\bdoors\b/.test(sql) && !/\bseats\b/.test(sql) && !/body_type/.test(sql) && !/displacement/.test(sql));
  comprueba("guarda la provincia, que la API no trae", /province/.test(sql));
  const conProvincia = (sql.match(/'(Madrid|Barcelona|Sevilla|Valencia|Málaga|Murcia|A Coruña)'/g) || []).length;
  comprueba("y alguna provincia real ha entrado", conProvincia > 0, conProvincia + " en esta página");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  await c.query("BEGIN");
  try {
    const antes = (await c.query("SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='flexicar'")).rows[0].n;
    const res = await c.query(sql);
    comprueba("el SQL entra sin quejarse", res.rowCount === 12, res.rowCount + " filas");
    const desp = (await c.query("SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='flexicar'")).rows[0].n;
    console.log("      ofertas de flexicar: " + antes + " -> " + desp
      + "   (" + (desp - antes) + " nuevas, " + (12 - (desp - antes)) + " que ya estaban)");

    const ids = (sql.match(/\('(9\d{14})'/g) || []).map((x) => x.slice(2, -1));
    const m = await c.query(`SELECT id, brand, model, price, province, is_active, doors, seats
       FROM moveadvisor_market_offers WHERE id = ANY($1::text[]) LIMIT 4`, [ids]);
    for (const x of m.rows) {
      console.log("      " + x.id + "  " + String(x.brand + " " + x.model).padEnd(22)
        + String(x.price).padStart(9) + " €  " + String(x.province || "-").padEnd(12)
        + (x.is_active ? "viva" : "MUERTA"));
    }
    comprueba("todas quedan vivas", m.rows.every((x) => x.is_active));
  } finally { await c.query("ROLLBACK"); }

  // ══ el tamaño del trabajo ════════════════════════════════════════════════
  console.log("\nEL TAMAÑO DEL TRABAJO");
  const t2 = (await c.query(`SELECT count(*) FILTER (WHERE is_active)::int activas,
      max(last_seen_at) visto FROM moveadvisor_market_offers WHERE portal='flexicar'`)).rows[0];
  console.log("      en la base: " + t2.activas + " activas, la última vista el "
    + String(t2.visto).slice(0, 10));
  console.log("      en el portal: " + j1.total + " coches");
  const paginasPorPasada = 20 * 100;
  comprueba("una pasada recorre el catálogo entero", paginasPorPasada >= j1.pages,
    paginasPorPasada + " páginas por pasada contra " + j1.pages);
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
