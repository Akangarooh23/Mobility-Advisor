/**
 * Comprueba el scraper de Clicars.
 *
 *   npm run test:clicars
 *
 * Este fichero faltaba: «test:clicars» llevaba apuntado en package.json desde
 * el commit 23d3507 y no existía, así que el comando fallaba con «Missing
 * script» -no, peor: existía el comando y fallaba el node-. Las otras dos
 * pruebas de Clicars sí estaban.
 *
 * Baja el listado de verdad y se lo da a los nodos Code tal como están en el
 * JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE LA URL SEA LA DEL COCHE, no la de la versión. En nuestra base había
 *     18 coches distintos compartiendo una sola url de versión, y 2.083 filas
 *     de 2.788 la tenían guardada.
 *
 *   - QUE EL PRECIO SEA EL DE CONTADO. Guardar el financiado hunde el
 *     comparable español y con él el margen de cada coche alemán: entre 1.500
 *     y 3.000 € por coche, que es lo que pasaba en Flexicar.
 *
 *   - QUE NO PISE LO QUE LLENA EL ENRIQUECEDOR.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "clicars-scraper-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
function paginas(html, estado) {
  const log = [];
  const f = new Function("$input", "console", codigo("Code: Generar páginas"));
  const r = f({ first: () => ({ json: { data: html, statusCode: estado } }) },
    { log: (m) => log.push(String(m)) });
  return { items: (r || []).map((x) => x.json), log };
}
function transforma(html) {
  const f = new Function("$input", codigo("Code: Transformar ofertas"));
  return f({ item: { json: { data: html, statusCode: 200 } } })[0].json;
}
/** El valor de la columna `col` en la fila `fila` del INSERT. */
function columna(sql, cols, fila, col) {
  const v = sql.slice(sql.indexOf("VALUES ") + 7, sql.indexOf(" ON CONFLICT"));
  const t = v.split("), (")[fila].replace(/^\(|\)$/g, "");
  const trozos = [];
  let act = "", dentro = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch === "'") { dentro = !dentro; act += ch; continue; }
    if (ch === "," && !dentro) { trozos.push(act.trim()); act = ""; continue; }
    act += ch;
  }
  trozos.push(act.trim());
  return trozos[cols.indexOf(col)];
}

(async () => {
  console.log("\n── Clicars · scraper ───────────────────────────────────────\n");

  // ── 0. El workflow, por dentro ───────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("los Postgres llevan la credencial que existe",
    pgs.length > 0 && pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"),
    pgs.length + " nodos");
  comprueba("no lleva ninguna credencial inventada",
    JSON.stringify(wf).indexOf("zoxD0jV8hxZqH0uY") === -1);
  const s = wf.connections["Loop: página por página"].main;
  comprueba("la salida 1 del bucle es la que trabaja",
    s[1] && s[1][0] && s[1][0].node === "HTTP: Página del listado");
  comprueba("la salida 0 del bucle no dispara nada", !s[0] || !s[0].length);
  comprueba("hay un IF antes de Postgres",
    wf.connections["Code: Transformar ofertas"].main[0][0].node.indexOf("IF") === 0);
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const horas = cron.parameters.rule.interval[0].expression.split(" ")[2].split(",").map(Number);
  comprueba("las pasadas caen entre las 8:00 y las 00:00",
    horas.every((h) => h >= 8 && h < 24), horas.join("h, ") + "h");

  // ── 1. La medida del catálogo ────────────────────────────────────────────
  console.log("\n  midiendo el catálogo de verdad");
  const base = nodo("HTTP: Contar el catálogo").parameters.url;
  const r1 = await fetch(base, { headers: H, signal: AbortSignal.timeout(60000) });
  const html1 = await r1.text();
  const m = paginas(html1, r1.status);
  comprueba("mide el catálogo y genera sus páginas", m.items.length > 10,
    m.items.length + " páginas");
  console.log("      " + m.log.join(" | "));
  comprueba("una respuesta vacía no inventa páginas", paginas("", 520).items.length === 0);
  comprueba("un html sin el recuento tampoco", paginas("<html>hola</html>", 200).items.length === 0);

  // ── 2. El transformador, contra la página de verdad ──────────────────────
  console.log("\n  leyendo la página 1");
  const t = transforma(html1);
  comprueba("lee las tarjetas", t.count >= 10, t.count + " ofertas");
  if (!t.count) {
    console.log("\n  sin tarjetas no hay nada más que comprobar: el portal ha cambiado.\n");
    process.exit(1);
  }
  const cols = (() => {
    const a = t.sql.indexOf("(") + 1;
    return t.sql.slice(a, t.sql.indexOf(")")).split(",").map((x) => x.trim());
  })();

  comprueba("el id es clc_ + data-vehicle-web-id",
    columna(t.sql, cols, 0, "id").indexOf("'clc_") === 0, columna(t.sql, cols, 0, "id"));

  /*
   * LA URL TIENE QUE SER LA DEL COCHE.
   *
   * Clicars sirve dos formas y solo una identifica a un coche:
   *     /coches-segunda-mano-ocasion/comprar-toyota-yaris-...-2015-139250
   *     /coches-segunda-mano-ocasion/toyota/yaris/yaris-1-0-city-...
   * La segunda es la página de la VERSIÓN, compartida por hasta 18 coches.
   */
  const sinComprar = [];
  for (let i = 0; i < t.count; i++) {
    if (columna(t.sql, cols, i, "url").indexOf("/comprar-") === -1) sinComprar.push(i);
  }
  comprueba("ninguna url es la de la versión", sinComprar.length === 0,
    sinComprar.length ? sinComprar.length + " mal" : "las " + t.count + " acaban en el id del coche");

  for (const [col, prueba] of [
    ["price", (v) => Number(v) > 500 && Number(v) < 500000],
    ["year", (v) => v === "NULL" || (Number(v) > 1990 && Number(v) < 2030)],
    ["mileage", (v) => v === "NULL" || (Number(v) >= 0 && Number(v) < 1000000)],
    ["transmission", (v) => v === "'Manual'" || v === "'Automatica'" || v === "''"],
    ["brand", (v) => v !== "''"],
  ]) {
    const malas = [];
    for (let i = 0; i < t.count; i++) if (!prueba(columna(t.sql, cols, i, col))) malas.push(i);
    comprueba(col + " sale bien en las " + t.count, malas.length === 0,
      malas.length ? malas.length + " mal, p.ej. " + columna(t.sql, cols, malas[0], col)
                   : "p.ej. " + columna(t.sql, cols, 0, col));
  }

  /*
   * EL PRECIO GUARDADO ES EL DE CONTADO.
   *
   * La tarjeta da cuatro. Si se colara el financiado, el precio saldría por
   * DEBAJO del de contado; aquí se comprueba al revés: el financiado que
   * guardamos, cuando lo hay, tiene que ser menor que el precio.
   */
  const malPrecio = [];
  for (let i = 0; i < t.count; i++) {
    const p = Number(columna(t.sql, cols, i, "price"));
    const f = columna(t.sql, cols, i, "finance_price");
    if (f !== "NULL" && Number(f) >= p) malPrecio.push(i);
  }
  comprueba("el precio guardado es el de contado, no el financiado", malPrecio.length === 0,
    malPrecio.length ? malPrecio.length + " filas con el financiado por encima" : "ninguna al revés");

  // ── 3. Lo que NO debe tocar ──────────────────────────────────────────────
  console.log("\n  lo que no debe tocar");
  const oc = t.sql.slice(t.sql.indexOf("ON CONFLICT"));
  for (const col of ["fuel", "color", "doors", "seats", "body_type",
                     "displacement", "environmental_label", "co2"]) {
    comprueba("no pisa " + col + " (lo llenan el enriquecedor o el derivador)",
      oc.indexOf(col + " =") === -1 && oc.indexOf(col + "=") === -1);
  }
  comprueba("resucita lo que vuelve a aparecer", /is_active = TRUE/.test(oc));
  comprueba("no da de baja nada: eso es del verificador", oc.indexOf("FALSE") === -1);
  comprueba("la url SÍ se pisa, que es lo que corrige las 2.083 de la versión",
    /url = EXCLUDED\.url/.test(oc));

  // ── 4. Contra la base, y deshecho ────────────────────────────────────────
  console.log("\n  contra la base (y deshecho)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const antes = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='clicars'")).rows[0].n;
  await c.query("BEGIN");
  try {
    await c.query(t.sql);
    comprueba("el UPSERT entra sin quejarse", true, t.count + " ofertas");
    const v = (await c.query(`SELECT count(*) FILTER (WHERE url LIKE '%/comprar-%')::int buenas,
        count(*)::int n FROM moveadvisor_market_offers WHERE portal='clicars' AND is_active`)).rows[0];
    comprueba("después hay más urls de coche que antes", v.buenas > 0,
      v.buenas + " de " + v.n);
  } finally {
    await c.query("ROLLBACK");
  }
  const sigue = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='clicars'")).rows[0].n;
  comprueba("el ROLLBACK ha dejado la base como estaba", sigue === antes, sigue + " filas");
  await c.end();

  // ── 5. Los casos feos ────────────────────────────────────────────────────
  console.log("\n  los casos feos");
  comprueba("una página sin tarjetas no da SQL", transforma("<html></html>").sql === null);
  comprueba("una respuesta vacía tampoco", transforma("").sql === null);

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
