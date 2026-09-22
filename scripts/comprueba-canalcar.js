/**
 * Comprueba el scraper de CanalCar.
 *
 *   npm run test:canalcar
 *
 * Baja el listado de verdad y se lo da a los nodos Code tal como están en el
 * JSON del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK,
 * que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE EL ID SEA data-coche-id. Es lo único que identifica al coche: la url
 *     no lleva número. Construirlo de otra forma duplicaría las 644 filas que
 *     ya hay.
 *
 *   - QUE NO PISE LO QUE LLENA EL ENRIQUECEDOR. El listado no trae color,
 *     puertas, plazas, carrocería ni potencia. Si el UPSERT los metiera en
 *     blanco, cada pasada borraría el trabajo del enriquecedor.
 *
 *   - QUE TRAIGA LO QUE ESTABA AL 0 %: provincia y cuota mensual.
 *
 *   - QUE MIDA EL CATÁLOGO POR DOS SITIOS. Quedarse corto significa no ver los
 *     coches de las últimas páginas, y eso no se nota: la pasada acaba en verde.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "canalcar-scraper-offers.json"), "utf8"));
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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
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
/** El valor de la columna `col` en la fila `i` del INSERT. */
function columna(sql, cols, fila, col) {
  const v = sql.slice(sql.indexOf("VALUES ") + 7, sql.indexOf(" ON CONFLICT"));
  const filas = v.split("), (");
  const t = filas[fila].replace(/^\(|\)$/g, "");
  // Partir por comas que no estén dentro de comillas simples.
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
  console.log("\n── CanalCar · scraper ──────────────────────────────────────\n");

  // ── 0. El workflow, por dentro ───────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("los Postgres llevan la credencial que existe",
    pgs.length > 0 && pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"),
    pgs.length + " nodos");
  comprueba("NO lleva la credencial fantasma del JSON viejo",
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
  const r1 = await fetch("https://www.canalcar.es/coches-ocasion",
    { headers: H, signal: AbortSignal.timeout(60000) });
  const html1 = await r1.text();
  const m = paginas(html1, r1.status);
  comprueba("mide el catálogo", m.items.length >= 6, m.items.length + " páginas");
  comprueba("lo mide por los dos sitios y coinciden",
    /los enlaces dicen (\d+), el total dice \1/.test(m.log.join(" ")), m.log.join(" | "));
  comprueba("una respuesta vacía no inventa páginas", paginas("", 520).items.length === 0);
  comprueba("un html sin paginación tampoco", paginas("<html>hola</html>", 200).items.length === 0);

  // ── 2. El transformador, contra la página de verdad ──────────────────────
  console.log("\n  leyendo la página 1");
  const t = transforma(html1);
  const cols = (() => {
    const a = t.sql.indexOf("(") + 1;
    return t.sql.slice(a, t.sql.indexOf(")")).split(",").map((x) => x.trim());
  })();
  comprueba("lee las 71 tarjetas", t.count === 71, t.count + " ofertas");

  const conId = t.sql.indexOf("'cnc_") !== -1;
  comprueba("el id es cnc_ + data-coche-id", conId, columna(t.sql, cols, 0, "id"));

  // Lo que estaba al 0 %
  const sinProvincia = [];
  const sinCuota = [];
  for (let i = 0; i < t.count; i++) {
    if (columna(t.sql, cols, i, "province") === "''") sinProvincia.push(i);
    if (columna(t.sql, cols, i, "monthly_price") === "NULL") sinCuota.push(i);
  }
  comprueba("trae la provincia (estaba al 0 %)", sinProvincia.length === 0,
    (t.count - sinProvincia.length) + "/" + t.count + "   p.ej. " + columna(t.sql, cols, 0, "province"));
  comprueba("trae la cuota mensual (estaba al 0 %)", sinCuota.length <= t.count * 0.1,
    (t.count - sinCuota.length) + "/" + t.count + "   p.ej. " + columna(t.sql, cols, 0, "monthly_price"));

  // Lo básico, entero
  for (const [col, prueba] of [
    ["price", (v) => Number(v) > 500 && Number(v) < 500000],
    ["year", (v) => Number(v) > 1990 && Number(v) < 2030],
    ["mileage", (v) => v === "NULL" || (Number(v) >= 0 && Number(v) < 1000000)],
    ["fuel", (v) => v !== "''"],
    ["transmission", (v) => v === "'Manual'" || v === "'Automatica'"],
    ["url", (v) => v.indexOf("'https://www.canalcar.es/coches-ocasion/") === 0],
    ["version", (v) => v.length > 4],
  ]) {
    const malas = [];
    for (let i = 0; i < t.count; i++) if (!prueba(columna(t.sql, cols, i, col))) malas.push(i);
    comprueba(col + " sale bien en las 71", malas.length === 0,
      malas.length ? malas.length + " mal, p.ej. " + columna(t.sql, cols, malas[0], col)
                   : "p.ej. " + columna(t.sql, cols, 0, col));
  }

  /*
   * EL PRECIO NO PUEDE SER 319.900.000.
   *
   * data-precio viene como '31990.0000'. Coger los dígitos a pelo -que es lo
   * que hacen los otros transformadores del repo- da trescientos diecinueve
   * millones. Aquí hay que cortar por el punto.
   */
  let precioMax = 0;
  for (let i = 0; i < t.count; i++) precioMax = Math.max(precioMax, Number(columna(t.sql, cols, i, "price")));
  comprueba("ningún precio se ha comido el decimal", precioMax < 500000,
    "el más caro: " + precioMax.toLocaleString("es-ES") + " €");

  // ── 3. Lo que NO debe tocar ──────────────────────────────────────────────
  console.log("\n  lo que no debe tocar");
  const oc = t.sql.slice(t.sql.indexOf("ON CONFLICT"));
  // Cada columna con quién la llena de verdad, que no es el enriquecedor en
  // todos los casos: la ficha de CanalCar no trae cilindrada ni CO₂.
  for (const [col, quien] of [
    ["color", "el enriquecedor"], ["doors", "el enriquecedor"],
    ["seats", "el enriquecedor"], ["body_type", "el enriquecedor"],
    ["power_cv", "el enriquecedor"], ["power_kw", "el enriquecedor"],
    ["environmental_label", "el derivador universal"],
    ["displacement", "el derivador universal, de la versión"],
    ["co2", "nadie: no está en ninguna parte del portal"],
    ["brand", "el alta, y no se rectifica"], ["model", "el alta, y no se rectifica"],
  ]) {
    comprueba("no pisa " + col + " (lo pone " + quien + ")",
      oc.indexOf(col + " =") === -1 && oc.indexOf(col + "=") === -1);
  }
  comprueba("resucita lo que vuelve a aparecer", /is_active = TRUE/.test(oc));
  comprueba("no da de baja nada: eso es del verificador", oc.indexOf("FALSE") === -1);

  // ── 4. Contra la base, y deshecho ────────────────────────────────────────
  console.log("\n  contra la base (y deshecho)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const antes = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='canalcar'")).rows[0].n;
  await c.query("BEGIN");
  try {
    await c.query(t.sql);
    const despues = (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='canalcar'")).rows[0].n;
    comprueba("el UPSERT entra sin quejarse", true, (despues - antes) + " filas nuevas de " + t.count);
    const mu = (await c.query(`SELECT count(*) FILTER (WHERE COALESCE(province,'')<>'')::int prov,
        count(monthly_price)::int cuota, count(*)::int n
      FROM moveadvisor_market_offers WHERE portal='canalcar' AND is_active`)).rows[0];
    comprueba("después hay provincia donde no la había", mu.prov >= 71, mu.prov + " de " + mu.n);
    comprueba("y cuota mensual", mu.cuota >= 60, mu.cuota + " de " + mu.n);
  } finally {
    await c.query("ROLLBACK");
  }
  const sigue = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='canalcar'")).rows[0].n;
  comprueba("el ROLLBACK ha dejado la base como estaba", sigue === antes, sigue + " filas");
  await c.end();

  // ── 5. Una página vacía no rompe la pasada ───────────────────────────────
  console.log("\n  los casos feos");
  comprueba("una página sin tarjetas no da SQL", transforma("<html></html>").sql === null);
  comprueba("una respuesta vacía tampoco", transforma("").sql === null);
  const sinPrecio = '<article class="vehicle" data-coche-id="1" data-url="/coches-ocasion/a/b/c"></article>';
  comprueba("una tarjeta sin precio se salta", transforma(sinPrecio).sql === null);

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
