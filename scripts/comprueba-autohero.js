/**
 * Comprueba el scraper de Autohero.
 *
 *   npm run test:autohero
 *
 * Llama a su API de verdad y le da la respuesta a los nodos Code tal como
 * están en el JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - EL DICCIONARIO DE COMBUSTIBLE. El del scraper viejo era falso en dos
 *     entradas y ha dejado 839 coches con el combustible equivocado: 726
 *     «Híbrido» que son de gasolina y 33 «Gas» que son eléctricos. Esta prueba
 *     coge coches de la API y comprueba la traducción contra el NOMBRE DEL
 *     MOTOR, que es texto: un «2.0 TDI» no puede salir Gasolina.
 *
 *   - QUE UN CÓDIGO DESCONOCIDO NO BORRE NADA. Hoy hay uno sin traducir
 *     (1041, un coche). Tiene que salir vacío y el UPSERT tiene que dejar el
 *     dato viejo, no machacarlo.
 *
 *   - LA URL. 1.063 filas tienen guardada una BÚSQUEDA en vez de una ficha.
 *     Todas las que salgan de aquí tienen que llevar /id/<uuid>/.
 *
 *   - EL PRECIO. Viene en céntimos (amountMinorUnits: 2089900). Si alguien
 *     quita la división, los coches pasan a valer dos millones.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autohero-scraper-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const API = http.parameters.url;
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const pide = async (cuerpo) => {
  const r = await fetch(API, { method: "POST", headers: H, body: cuerpo, signal: AbortSignal.timeout(90000) });
  return { statusCode: r.status, body: await r.json() };
};
function transforma(res) {
  return new Function("$input", codigo("Code: Transformar ofertas"))({ item: { json: res } })[0].json;
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
  console.log("\n── Autohero · scraper ──────────────────────────────────────\n");

  // ── 0. El workflow, por dentro ───────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("los Postgres llevan la credencial que existe",
    pgs.length > 0 && pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"));
  comprueba("NO lleva la credencial fantasma del JSON viejo",
    JSON.stringify(wf).indexOf("zoxD0jV8hxZqH0uY") === -1);
  const s = wf.connections["Loop: cien en cien"].main;
  comprueba("la salida 1 del bucle es la que trabaja",
    s[1] && s[1][0] && s[1][0].node === "HTTP: Cien coches de su API");
  comprueba("la salida 0 del bucle no dispara nada", !s[0] || !s[0].length);
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const horas = cron.parameters.rule.interval[0].expression.split(" ")[2].split(",").map(Number);
  comprueba("las pasadas caen entre las 8:00 y las 00:00",
    horas.every((h) => h >= 8 && h < 24), horas.join("h, ") + "h");
  for (const w of wf.nodes.filter((n) => n.type.endsWith(".wait"))) {
    comprueba("«" + w.name + "» dice su unidad", w.parameters.unit === "seconds");
  }

  // ── 1. La API, de verdad ─────────────────────────────────────────────────
  console.log("\n  su API");
  const contar = new Function("console", codigo("Code: Cuerpo de la llamada que cuenta"))({ log: () => {} });
  comprueba("el cuerpo que arma es JSON válido",
    (() => { try { JSON.parse(contar[0].json.cuerpo); return true; } catch (e) { return false; } })());
  const res0 = await pide(contar[0].json.cuerpo);
  const total = res0.body.data.searchAdV9AdsV2.total;
  comprueba("contesta y declara un total", res0.statusCode === 200 && total > 100, total + " coches");

  const log = [];
  const llamadas = new Function("$input", "console", codigo("Code: Generar llamadas"))(
    { first: () => ({ json: res0 }) }, { log: (m) => log.push(String(m)) }).map((x) => x.json);
  comprueba("genera una llamada por cada cien coches",
    llamadas.length === Math.ceil(total / 100), llamadas.length + " llamadas");
  comprueba("los offsets van de cien en cien",
    llamadas[0].offset === 0 && llamadas[1].offset === 100);
  comprueba("una respuesta rota no inventa llamadas",
    new Function("$input", "console", codigo("Code: Generar llamadas"))(
      { first: () => ({ json: { statusCode: 503, body: {} } }) }, { log: () => {} }).length === 0);

  // ── 2. El transformador ──────────────────────────────────────────────────
  console.log("\n  cien coches de verdad");
  const res1 = await pide(llamadas[0].cuerpo);
  const cars = res1.body.data.searchAdV9AdsV2.data;
  const t = transforma(res1);
  comprueba("lee los cien", t.count === cars.length, t.count + " ofertas");
  const cols = (() => {
    const a = t.sql.indexOf("(") + 1;
    return t.sql.slice(a, t.sql.indexOf(")")).split(",").map((x) => x.trim());
  })();

  comprueba("el id es ah_ + el uuid de su API",
    columna(t.sql, cols, 0, "id") === "'ah_" + cars[0].id + "'", columna(t.sql, cols, 0, "id"));

  const malUrl = [];
  for (let i = 0; i < t.count; i++) {
    const u = columna(t.sql, cols, i, "url");
    if (u.indexOf("/id/") === -1 || u.indexOf("/search/") !== -1) malUrl.push(i);
  }
  comprueba("todas las urls son fichas, ninguna es una búsqueda", malUrl.length === 0,
    malUrl.length ? malUrl.length + " mal" : "las " + t.count + " llevan /id/<uuid>/");

  /*
   * EL PRECIO NO PUEDE SER DOS MILLONES.
   *
   * La API lo da en céntimos: { amountMinorUnits: 2089900, conversionMajor: 100 }.
   */
  let maximo = 0;
  for (let i = 0; i < t.count; i++) maximo = Math.max(maximo, Number(columna(t.sql, cols, i, "price")));
  comprueba("los precios están en euros, no en céntimos", maximo < 500000,
    "el más caro: " + maximo.toLocaleString("es-ES") + " €");

  /*
   * EL COMBUSTIBLE, CONTRA EL NOMBRE DEL MOTOR.
   *
   * Esta es la comprobación que justifica medio fichero. El diccionario viejo
   * decía que 1039 era «Híbrido» y son coches de gasolina, y que 1044 era
   * «Gas» y son eléctricos. Un nombre de motor con «TDI», «HDi» o «dCi» es
   * diésel; uno que diga «electric drive» es eléctrico. Si la traducción los
   * contradice, está mal.
   */
  const contradicen = [];
  for (let i = 0; i < t.count; i++) {
    const f = columna(t.sql, cols, i, "fuel").replace(/'/g, "");
    const motor = String((cars[i].subType || "") + " " + (cars[i].subTypeExtra || "")).toLowerCase();
    const esDiesel = /tdi|hdi|dci|cdti|crdi|bluehdi| d\b|jtd/.test(motor);
    const esElectrico = motor.indexOf("electric") !== -1;
    if (esElectrico && f !== "Eléctrico") contradicen.push(i + " «" + motor.trim() + "» -> " + f);
    if (esDiesel && f === "Gasolina") contradicen.push(i + " «" + motor.trim() + "» -> " + f);
  }
  comprueba("el combustible no contradice al nombre del motor", contradicen.length === 0,
    contradicen.length ? contradicen.slice(0, 2).join(" | ") : "ninguno de los " + t.count);

  const fuels = {};
  for (let i = 0; i < t.count; i++) {
    const f = columna(t.sql, cols, i, "fuel");
    fuels[f] = (fuels[f] || 0) + 1;
  }
  comprueba("y no sale todo «Híbrido», que es lo que hacía el viejo",
    (fuels["'Híbrido'"] || 0) < t.count * 0.6,
    Object.entries(fuels).map(([k, v]) => k.replace(/'/g, "") + ":" + v).join("  "));

  // Los campos que antes obligaban a abrir la ficha
  for (const [col, prueba] of [
    ["color", (v) => v !== "''"],
    ["body_type", (v) => v !== "''"],
    ["doors", (v) => Number(v) >= 2 && Number(v) <= 5],
    ["seats", (v) => v === "NULL" || (Number(v) >= 2 && Number(v) <= 9)],
    ["displacement", (v) => v === "''" || (Number(v.replace(/'/g, "")) > 500 && Number(v.replace(/'/g, "")) < 9000)],
    ["province", (v) => v !== "''"],
    ["environmental_label", (v) => v !== "''"],
  ]) {
    const malas = [];
    for (let i = 0; i < t.count; i++) if (!prueba(columna(t.sql, cols, i, col))) malas.push(i);
    comprueba(col + " sale bien", malas.length <= t.count * 0.1,
      malas.length ? malas.length + " sin dato, p.ej. " + columna(t.sql, cols, malas[0], col)
                   : "p.ej. " + columna(t.sql, cols, 0, col));
  }

  /*
   * ── 2b. NADA SE PASA DEL LARGO DE SU COLUMNA ────────────────────────────
   *
   * La primera versión se cayó en la sexta llamada: «value too long for type
   * character varying(120)». Era la ciudad de un coche que está de camino, y
   * que su API rellena con un aviso de 136 caracteres en inglés y alemán:
   *
   *     "Please call us to get further information about the location // ..."
   *
   * Un solo valor raro tiró las 100 ofertas del lote, porque el INSERT va
   * entero o no va. Los límites se leen del esquema de verdad, no de una copia
   * a mano: si alguien estrecha una columna, esta prueba lo dice antes que
   * Postgres a las tres de la mañana.
   */
  console.log("\n  el largo de cada columna");
  const cc = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await cc.connect();
  const limites = {};
  for (const x of (await cc.query(`SELECT column_name, character_maximum_length len
    FROM information_schema.columns WHERE table_name='moveadvisor_market_offers'
      AND character_maximum_length IS NOT NULL`)).rows) {
    limites[x.column_name] = x.len;
  }
  await cc.end();
  const pasados = [];
  for (let i = 0; i < t.count; i++) {
    for (const col of cols) {
      if (!limites[col]) continue;
      const v = columna(t.sql, cols, i, col);
      if (v === "NULL") continue;
      const limpio = v.replace(/^'|'$/g, "").split("''").join("'");
      if (limpio.length > limites[col]) {
        pasados.push(col + " (" + limites[col] + ") con " + limpio.length + ": " + limpio.slice(0, 50));
      }
    }
  }
  comprueba("ningún valor se pasa del largo de su columna", pasados.length === 0,
    pasados.length ? pasados[0] : "comprobadas " + Object.keys(limites).length + " columnas");

  // Y el caso concreto que lo rompió: una ciudad que no es una ciudad.
  const conAviso = JSON.parse(JSON.stringify(res1));
  conAviso.body.data.searchAdV9AdsV2.data = [Object.assign({}, cars[0], {
    esBranch: { branchId: 2008, name: "Im Transport", zipcode: "-", street: "-",
      city: "Please call us to get further information about the location // "
        + "Bitte rufen Sie uns an, um nähere Informationen zum Standort zu erhalten" },
  })];
  const ta = transforma(conAviso);
  const colsA = (() => {
    const a = ta.sql.indexOf("(") + 1;
    return ta.sql.slice(a, ta.sql.indexOf(")")).split(",").map((x) => x.trim());
  })();
  comprueba("un aviso de 136 caracteres no entra como ciudad",
    columna(ta.sql, colsA, 0, "city") === "''", columna(ta.sql, colsA, 0, "city"));
  comprueba("y de un código postal «-» no sale provincia",
    columna(ta.sql, colsA, 0, "province") === "''");
  comprueba("pero el coche NO se pierde: la fila sale igual", ta.count === 1);

  // ── 3. El código desconocido ─────────────────────────────────────────────
  console.log("\n  un código de combustible que no conocemos");
  const inventado = JSON.parse(JSON.stringify(res1));
  inventado.body.data.searchAdV9AdsV2.data = [Object.assign({}, cars[0], { fuelType: 9999, gearType: 9999 })];
  const ti = transforma(inventado);
  const colsI = (() => {
    const a = ti.sql.indexOf("(") + 1;
    return ti.sql.slice(a, ti.sql.indexOf(")")).split(",").map((x) => x.trim());
  })();
  comprueba("no se lo inventa: sale vacío", columna(ti.sql, colsI, 0, "fuel") === "''");
  comprueba("y el UPSERT protege el dato viejo con NULLIF",
    /fuel = COALESCE\(NULLIF\(EXCLUDED\.fuel, ''\)/.test(ti.sql));

  // ── 4. Lo que NO debe tocar ──────────────────────────────────────────────
  console.log("\n  lo que no debe tocar");
  const oc = t.sql.slice(t.sql.indexOf("ON CONFLICT"));
  comprueba("no pisa el color, que puede haber puesto una persona",
    /color = COALESCE\(NULLIF\(moveadvisor_market_offers\.color/.test(oc));
  comprueba("no pisa next_itv: eso es del enriquecedor", oc.indexOf("next_itv") === -1);
  comprueba("resucita lo que vuelve a aparecer", /is_active = TRUE/.test(oc));
  comprueba("no da de baja nada: eso es del verificador", oc.indexOf("FALSE") === -1);
  comprueba("la url SÍ se pisa, que es lo que corrige las 1.063 búsquedas",
    /url = EXCLUDED\.url/.test(oc));

  // ── 5. Contra la base, y deshecho ────────────────────────────────────────
  console.log("\n  contra la base (y deshecho)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const antes = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='autohero'")).rows[0].n;
  await c.query("BEGIN");
  try {
    await c.query(t.sql);
    comprueba("el UPSERT entra sin quejarse", true, t.count + " ofertas");
    const q = (await c.query(`SELECT count(*)::int n,
        count(*) FILTER (WHERE fuel='Híbrido')::int hibridos,
        count(*) FILTER (WHERE COALESCE(province,'')='Toda España')::int toda_espania
      FROM moveadvisor_market_offers WHERE id = ANY($1)`,
      [cars.map((x) => "ah_" + x.id)])).rows[0];
    comprueba("las cien quedan en la base", q.n === t.count, q.n + " filas");
    comprueba("ya no dicen «Toda España» de provincia", q.toda_espania === 0);
  } finally {
    await c.query("ROLLBACK");
  }
  const sigue = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='autohero'")).rows[0].n;
  comprueba("el ROLLBACK ha dejado la base como estaba", sigue === antes, sigue + " filas");
  await c.end();

  // ── 6. Los casos feos ────────────────────────────────────────────────────
  console.log("\n  los casos feos");
  comprueba("una respuesta sin coches no da SQL",
    transforma({ statusCode: 200, body: { data: { searchAdV9AdsV2: { total: 0, data: [] } } } }).sql === null);
  comprueba("una respuesta vacía tampoco", transforma({ statusCode: 500, body: {} }).sql === null);

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
