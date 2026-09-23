/**
 * Comprueba el flujo de altas de AutoScout24 España.
 *
 *   npm run test:as24-altas
 *
 * No comprueba que el JSON esté bien escrito -eso ya lo dice n8n al importar-,
 * sino las cuatro formas que tiene este flujo de quedarse EN VERDE sin hacer
 * nada, que son las que cuestan un día entero de altas antes de que alguien
 * se dé cuenta:
 *
 *   1. El bucle con las salidas al revés (0 es «terminado», 1 es «cada uno»).
 *   2. Una rama que devuelve cero items y deja el bucle sin retorno.
 *   3. executeOnce metido en el camino del bucle, que lo reduce a un item.
 *   4. El Wait sin unidad: n8n borra los valores por defecto al importar y
 *      la unidad por defecto es HORAS.
 *
 * Y al final, contra el portal de verdad: que el regex siga casando con el
 * HTML de hoy y que en la página 1 haya coches que no tenemos. Son dos
 * peticiones, no un scrapeo. Con --sin-red se salta esa parte.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const WF = path.join(RAIZ, "n8n-workflows", "autoscout24-altas-es.json");

let fallos = 0;
const ok = (b, t) => { console.log((b ? "  ok    " : "  FALLA ") + t); if (!b) fallos++; };

const wf = JSON.parse(fs.readFileSync(WF, "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const salidas = (n, i) => ((wf.connections[n] || {}).main || [])[i] || [];
const nombres = (n, i) => salidas(n, i).map((c) => c.node);

console.log("\n  EL ESQUELETO");
ok(/^[A-Za-z0-9]{16}$/.test(String(wf.id)), "el workflow lleva id de 16 caracteres (reimportar actualiza, no duplica)");
ok(wf.settings && wf.settings.errorWorkflow, "tiene workflow de errores");

console.log("\n  LOS BUCLES, QUE ES DONDE SE FALLA");
// Salida 0 = terminado, salida 1 = cada elemento. Al revés, el HTTP se
// dispara al ACABAR la pasada y no durante.
ok(nombres("Loop: marca por marca", 0).length === 0,
  "bucle de marcas: la salida 0 (terminado) no va a ninguna parte");
ok(nombres("Loop: marca por marca", 1).indexOf("HTTP: Página 1 de la marca") !== -1,
  "bucle de marcas: la salida 1 (cada marca) pide la página 1");
ok(nombres("Loop: página por página", 0).indexOf("Loop: marca por marca") !== -1,
  "bucle de páginas: al terminar una marca, vuelve al bucle de marcas");
ok(nombres("Loop: página por página", 1).indexOf("HTTP: Resto de páginas") !== -1,
  "bucle de páginas: la salida 1 pide la página");

// El retorno al bucle tiene que existir por las DOS ramas del IF, si no una
// página sin ofertas corta la marca entera.
ok(nombres("IF: ¿hay ofertas?", 1).indexOf("Esperar 1s") !== -1,
  "una página sin ofertas sigue dando la vuelta al bucle (rama falsa del IF)");
ok(nombres("PG: Upsert ofertas", 0).indexOf("Esperar 1s") !== -1,
  "una página con ofertas también vuelve, después de guardar");
ok(nombres("Esperar 1s", 0).indexOf("Loop: página por página") !== -1,
  "la espera cierra el bucle de páginas");

console.log("\n  EL CURSOR");
const cur = nodo("PG: Por dónde íbamos").parameters.query;
ok(cur.indexOf("as24_es_altas") !== -1, "usa su propia clave, no la del barrido gradual");
ok(cur.indexOf("as24_es_marca") === -1, "no toca la clave del barrido gradual");
// La fila no existe todavía: un SELECT vacío son cero items y en n8n un nodo
// sin items no se ejecuta. El flujo moriría en el primer nodo, en verde.
ok(/INSERT INTO moveadvisor_cursores/.test(cur) && /ON CONFLICT/.test(cur) && /RETURNING/.test(cur),
  "se siembra solo: devuelve fila aunque la clave no exista todavía");
ok(cur.indexOf("DO UPDATE") !== -1,
  "ON CONFLICT DO UPDATE, no DO NOTHING (si no, no devuelve nada a partir de la 2ª pasada)");

const marcas = nodo("Code: Marcas de esta pasada").parameters.jsCode;
ok(marcas.indexOf("UPDATE moveadvisor_cursores") !== -1, "apunta el cursor para la próxima pasada");
const mk = (marcas.match(/const makes = \[([^\]]+)\]/) || [])[1];
ok(mk && mk.split(",").length === 45, "las 45 marcas (son " + (mk ? mk.split(",").length : 0) + ")");

console.log("\n  executeOnce FUERA DEL CAMINO DEL BUCLE");
// executeOnce saca UN item. En serie delante del bucle, las quince marcas se
// quedarían en una y la pasada haría 1/15 del trabajo sin quejarse.
const apunta = nodo("PG: Apuntar dónde nos quedamos");
ok(apunta.executeOnce === true, "el apunte del cursor es executeOnce (una vez, no quince)");
ok(nombres("PG: Apuntar dónde nos quedamos", 0).length === 0,
  "y es un callejón sin salida: el bucle no pasa por él");
ok(nombres("Code: Marcas de esta pasada", 0).indexOf("Loop: marca por marca") !== -1,
  "el bucle cuelga directo del Code, sin el executeOnce en medio");

console.log("\n  LA ESPERA");
const w = nodo("Esperar 1s").parameters;
ok(w.unit === "seconds", "la unidad está escrita (sin ella n8n asume HORAS y espera 60 min)");
ok(w.amount === 1, "espera 1");

console.log("\n  CUÁNTAS PÁGINAS SE PIDEN");
const pag = nodo("Code: Cuántas páginas más").parameters.jsCode;
ok(pag.indexOf("return []") === -1,
  "nunca devuelve cero items: una marca rota no puede cortar el bucle de marcas");
ok(pag.indexOf("res.data") !== -1 && pag.indexOf("res.body") !== -1,
  "lee 'data' además de 'body' (con responseFormat text el cuerpo va en data)");

// Se ejecuta el código de verdad, con el HTML de verdad, para tres tamaños.
const simula = (resultados) => {
  const html = "<script id=\"__NEXT_DATA__\" type=\"application/json\">"
    + JSON.stringify({ props: { pageProps: { numberOfResults: resultados } } }) + "</script>";
  const ctx = {
    $: () => ({ first: () => ({ json: { mk: 74 } }) }),
    $input: { first: () => ({ json: { data: html } }) },
    console: { log: () => {} },
  };
  const fn = new Function("$", "$input", "console", pag);
  return fn(ctx.$, ctx.$input, ctx.console).length;
};
// Una página por cada 800 ofertas, suelo 2 y techo 30. Las devueltas son
// «de la 2 en adelante», o sea una menos que el total.
ok(simula(19776) === 24, "Volkswagen (19.776 ofertas) -> 25 páginas: " + (simula(19776) + 1));
ok(simula(4000) === 4, "una marca de 4.000 -> 5 páginas: " + (simula(4000) + 1));
ok(simula(300) === 1, "una marca pequeña (300) -> el suelo de 2: " + (simula(300) + 1));
ok(simula(999999) === 29, "una marca enorme topa en 30: " + (simula(999999) + 1));
ok(simula(0) === 1, "sin resultados legibles -> sigue con el mínimo, no corta el bucle");

// ── Y ahora contra el portal ────────────────────────────────────────────────
(async () => {
  if (process.argv.includes("--sin-red")) { fin(); return; }
  console.log("\n  CONTRA EL PORTAL (2 peticiones)");
  const url = "https://www.autoscout24.es/lst?atype=C&ustate=N,U&sort=age&desc=1"
    + "&cy=E&powertype=kw&mmvmk0=74&page=";
  const cab = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "es-ES,es;q=0.9" };

  const lee = async (p) => {
    const r = await fetch(url + p, { headers: cab });
    if (r.status !== 200) return { status: r.status, listings: [], n: 0 };
    const html = await r.text();
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return { status: 200, listings: [], n: 0, sinRegex: true };
    const pp = JSON.parse(m[1]).props.pageProps;
    return { status: 200, listings: pp.listings || [], n: Number(pp.numberOfResults || 0), kb: Math.round(html.length / 1024) };
  };

  const p1 = await lee(1);
  if (p1.status !== 200) {
    console.log("  (el portal responde " + p1.status + "; me salto la parte de red)");
    fin(); return;
  }
  ok(!p1.sinRegex, "el regex de __NEXT_DATA__ casa con el HTML de hoy");
  ok(p1.listings.length > 0, "la página 1 trae anuncios: " + p1.listings.length);
  ok(p1.n > 0, "el conteo se lee: " + p1.n.toLocaleString("es") + " ofertas de Volkswagen");
  console.log("        peso de la página: " + p1.kb + " KB");

  /*
   * Y lo que justifica el flujo entero: que en la página 1 haya de verdad
   * coches que no tenemos.
   *
   * El listado NO trae la fecha de publicación -se miraron las 24 claves de un
   * anuncio y no está-, así que la frescura no se puede comprobar por ahí. Pero
   * se puede comprobar por el lado que de verdad importa, que es cruzar esos
   * ids con los nuestros: si la página 1 fuera lo mismo que ya tenemos, este
   * flujo sobraría.
   *
   * El 23-sep-2026 salían 20 de 20 desconocidos en seis marcas, y también 20 de
   * 20 en la página 10. Se pide la mitad -10 de 20- para no hacer saltar el
   * test por una marca que un día vaya bien servida.
   */
  const { Client } = require("pg");
  const envTxt = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
  const dbUrl = (envTxt.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
  const c = new Client({ connectionString: dbUrl, statement_timeout: 30000 });
  await c.connect();
  const nuevos = async (listings) => {
    const ids = listings.map((x) => "as_" + String(x.id));
    const r = await c.query("SELECT count(*)::int n FROM moveadvisor_market_offers WHERE id = ANY($1)", [ids]);
    return ids.length - r.rows[0].n;
  };
  const n1 = await nuevos(p1.listings);
  ok(n1 >= 10, "de los 20 de la página 1, no tenemos " + n1 + " (si fueran 0, el flujo sobraría)");

  const pN = await lee(25);
  ok(pN.status === 200 && pN.listings.length > 0,
    "la página 25 también responde y trae anuncios: " + pN.listings.length);
  if (pN.listings.length) {
    const nN = await nuevos(pN.listings);
    console.log("        y de los 20 de la página 25, no tenemos " + nN);
  }
  await c.end();

  fin();
})().catch((e) => { console.error("\n  ERROR: " + e.message); process.exit(1); });

function fin() {
  console.log(fallos ? "\n  " + fallos + " FALLOS\n" : "\n  todo en orden\n");
  process.exit(fallos ? 1 : 0);
}
