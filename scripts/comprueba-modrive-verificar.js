/**
 * Comprueba el verificador de Modrive.
 *
 *   npm run test:modrive-verificar
 *
 * Este workflow da de baja coches del ESCAPARATE. Una baja mal puesta retira del
 * sitio un coche que se puede vender; una que no se pone deja a un cliente
 * pidiendo cita por un coche que ya no existe.
 *
 * Lo que vigila:
 *
 *   - Que si el sitemap no viene NO se dé de baja a nadie, pero que el parte se
 *     escriba igual. Y que la pasada llegue al veredicto: si el planificador
 *     devolviera una lista vacía, el splitInBatches no dispararía su salida de
 *     «terminado» y la ejecución desaparecería sin dejar rastro.
 *   - Que un sitemap que responde 200 pero trae cero coches cuente como avería,
 *     no como catálogo vacío.
 *   - Que el cortacircuitos pare si aparece menos de la mitad de lo que tenemos
 *     activo.
 *   - Que sella por la clave primaria y no por una expresión sobre la URL.
 *     Modrive ya nos cambió las rutas una vez y un sellado que dependiera de
 *     ellas habría dado de baja el catálogo entero ese día.
 *   - Y contra el sitemap de verdad: que lo que publica casa con lo que
 *     tenemos por activo.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "modrive-verificar-activas.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const nodoHttp = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const H = {};
(nodoHttp.parameters.headerParameters.parameters || []).forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }] });

/** Una pasada entera: leer el sitemap, sellar cada bloque, veredicto y freno. */
function pasada(estatico, respuesta, activas) {
  const $plan = (n) => (n === "PG: Cuántas tenemos activas" ? uno({ activas: activas }) : uno({}));
  const plan = ejecuta(codigo("Code: Leer el sitemap"),
    { estatico, $: $plan, $input: uno(respuesta) });
  const sqls = [];
  for (const it of plan.items) {
    const r = ejecuta(codigo("Code: Sellar los vistos"), {
      estatico,
      $: (n) => (n === "Loop: bloque por bloque" ? { item: { json: it.json } } : uno({})),
      $input: uno({}),
    });
    if (r.items[0] && r.items[0].json.sql) sqls.push(r.items[0].json.sql);
  }
  const ver = ejecuta(codigo("Code: Veredicto"), { estatico, $: () => uno({}), $input: uno({}) });
  const fre = ver.items.length
    ? ejecuta(codigo("Code: Cortacircuitos"),
      { estatico, $: () => uno({}), $input: uno(ver.items[0].json) })
    : { items: [], log: [] };
  return { plan, sqls, ver, freno: fre, log: [...plan.log, ...ver.log, ...fre.log] };
}

/** Un sitemap de mentira con los ids que se le pidan. */
const sitemap = (ids) => ({
  statusCode: 200,
  body: '<?xml version="1.0"?><urlset>'
    + ids.map((i) => "<loc>https://www.modrive.com/coches-ocasion/un-coche-" + i + "/</loc>").join("")
    + "</urlset>",
});

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  // ── configuración ─────────────────────────────────────────────────────────
  console.log("CONFIGURACIÓN");
  comprueba("el nodo HTTP manda cabeceras",
    nodoHttp.parameters.sendHeaders === true
    && (nodoHttp.parameters.headerParameters || {}).parameters);
  comprueba("ninguna escondida en options.headers", !(nodoHttp.parameters.options || {}).headers);
  comprueba("un fallo de red no tumba la pasada",
    nodoHttp.onError === "continueRegularOutput");
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  comprueba("cuesta UNA petición por pasada",
    wf.nodes.filter((n) => n.type.endsWith("httpRequest")).length === 1);

  // ── el sitemap no viene ───────────────────────────────────────────────────
  console.log("\nSI EL SITEMAP NO VIENE");
  const e1 = {};
  const r1 = pasada(e1, { statusCode: 0, body: "" }, 1988);
  r1.log.forEach((l) => console.log("      " + l));
  comprueba("marca la avería", e1.modrive_fallo === true);
  comprueba("llega al veredicto igual", r1.ver.items.length === 1);
  comprueba("no da de baja a nadie", !/is_active = FALSE/.test((r1.ver.items[0] || {}).json?.sql || ""));
  comprueba("pero deja el parte",
    /INSERT INTO moveadvisor_verify_runs/.test((r1.ver.items[0] || {}).json?.sql || ""));
  comprueba("y el parte queda marcado como avería",
    /, TRUE, 0$/.test((r1.ver.items[0] || {}).json?.sql || ""));

  // ── el sitemap viene vacío ────────────────────────────────────────────────
  console.log("\nSI EL SITEMAP VIENE CON CERO COCHES");
  const e2 = {};
  const r2 = pasada(e2, { statusCode: 200, body: '<?xml version="1.0"?><urlset></urlset>' }, 1988);
  r2.log.forEach((l) => console.log("      " + l));
  comprueba("cuenta como avería, no como catálogo vacío", e2.modrive_fallo === true);
  comprueba("y no da de baja a nadie",
    !/is_active = FALSE/.test((r2.ver.items[0] || {}).json?.sql || ""));

  // ── una pasada buena ──────────────────────────────────────────────────────
  console.log("\nUNA PASADA BUENA");
  const e3 = {};
  const ids3 = Array.from({ length: 1200 }, (_, i) => 700000 + i);
  const r3 = pasada(e3, sitemap(ids3), 1250);
  r3.log.forEach((l) => console.log("      " + l));
  comprueba("ha visto los coches del sitemap", e3.modrive_vistos === 1200, "(" + e3.modrive_vistos + ")");
  comprueba("los reparte en bloques", r3.sqls.length === 3, "(" + r3.sqls.length + " bloques)");
  comprueba("sella por la clave primaria, no por la url",
    r3.sqls.every((s) => /WHERE id IN \('modrive_/.test(s))
    && !r3.sqls.some((s) => /source_url/.test(s)));
  comprueba("sella last_seen_at, que es lo que fecha la baja",
    r3.sqls.every((s) => /last_seen_at = NOW\(\)/.test(s)));
  comprueba("ahora sí da de baja lo que no apareció",
    /is_active = FALSE/.test(r3.ver.items[0].json.sql));
  comprueba("y resucita lo que reapareció", /is_active = TRUE/.test(r3.ver.items[0].json.sql));
  comprueba("las bajas y el parte van en la misma sentencia",
    /^WITH bajas AS \(/.test(r3.ver.items[0].json.sql)
    && /INSERT INTO moveadvisor_verify_runs/.test(r3.ver.items[0].json.sql));
  comprueba("el cortacircuitos deja pasar", !(r3.freno.items[0] || {}).json?.parado);

  // ── el cortacircuitos ─────────────────────────────────────────────────────
  console.log("\nEL CORTACIRCUITOS");
  const e4 = {};
  const r4 = pasada(e4, sitemap(Array.from({ length: 400 }, (_, i) => 800000 + i)), 1988);
  r4.freno.log.forEach((l) => console.log("      " + l));
  comprueba("para si aparece menos de la mitad de lo que tenemos activo",
    (r4.freno.items[0] || {}).json?.parado === true);
  comprueba("y no deja SQL que ejecutar", !(r4.freno.items[0] || {}).json?.sql);

  // ── contra el sitemap de verdad ───────────────────────────────────────────
  console.log("\nCONTRA EL SITEMAP DE VERDAD");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const activas = (await c.query(
    wf.nodes.find((n) => n.name === "PG: Cuántas tenemos activas").parameters.query)).rows[0].activas;
  const r = await fetch(nodoHttp.parameters.url, { headers: H, signal: AbortSignal.timeout(30000) });
  const body = await r.text();
  console.log("      " + nodoHttp.parameters.url + "  ->  HTTP " + r.status + "   " + body.length + " bytes");
  const e5 = {};
  const r5 = pasada(e5, { statusCode: r.status, body: body }, activas);
  r5.log.forEach((l) => console.log("      " + l));
  comprueba("el sitemap trae el catálogo entero", e5.modrive_vistos > 1000,
    "(" + e5.modrive_vistos + " coches, tenemos " + activas + " activas)");
  comprueba("no hace falta pedir ficha por ficha para verificarlas todas",
    e5.modrive_vistos >= activas * 0.9);
  comprueba("el cortacircuitos no salta con datos de verdad",
    !(r5.freno.items[0] || {}).json?.parado);

  // ── contra la base ────────────────────────────────────────────────────────
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  // La pasada entera, de verdad, con los datos de verdad, y luego ROLLBACK.
  // Es la única forma de comprobar que sellado y veredicto encajan: si el
  // sellado no casara con nuestros ids -porque cambiara el formato del id, o la
  // ruta del sitemap-, el veredicto daría de baja el catálogo entero y aquí se
  // vería como 1.988 bajas en vez de 0.
  await c.query("BEGIN");
  try {
    let sellados = 0;
    for (const sql of r5.sqls) sellados += (await c.query(sql)).rowCount;
    // No se exige que cuadre al coche. Entre la pasada del scraper y este
    // momento Modrive publica coches nuevos, y esos salen en su sitemap sin
    // estar todavía en nuestra base: el sellado no casa con ellos y es normal.
    // Exigir la igualdad hacía fallar la prueba por que el concesionario hubiera
    // vendido un coche, que es justamente lo que queremos que sepa detectar.
    comprueba("el sellado casa con casi todas las nuestras",
      sellados >= e5.modrive_vistos * 0.98,
      "(" + sellados + " de " + e5.modrive_vistos + ", "
      + (e5.modrive_vistos - sellados) + " aún sin scrapear)");

    await c.query(r5.ver.items[0].json.sql);
    const parte = (await c.query(
      "SELECT checked, alive, deactivated, blocked FROM moveadvisor_verify_runs"
      + " WHERE portal = 'modrive' ORDER BY id DESC LIMIT 1")).rows[0];
    console.log("      parte: " + JSON.stringify(parte));
    comprueba("el veredicto se ejecuta y deja su parte", !!parte && parte.checked === e5.modrive_vistos);

    // Lo que sí tiene que cumplirse: las bajas de una pasada normal son unas
    // pocas -las que el concesionario haya vendido desde la última del scraper-,
    // no una matanza. Si un día esto se dispara, o Modrive ha cambiado el
    // sitemap o hemos roto la lectura.
    const vivas = (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_marketplace_vo_offers"
      + " WHERE portal = 'modrive' AND is_active")).rows[0].n;
    comprueba("da de baja unas pocas, no el catálogo",
      parte.deactivated < activas * 0.05,
      "(" + parte.deactivated + " bajas de " + activas + ")");
    comprueba("y el escaparate sigue en pie", vivas >= activas * 0.95,
      "(" + vivas + " activas, eran " + activas + ")");
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
