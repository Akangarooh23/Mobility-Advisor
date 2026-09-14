/**
 * Comprueba el verificador de AutoScout24 España.
 *
 *   npm run test:as24-es-verificar
 *
 * Pide fichas españolas de verdad con HEAD y le da las respuestas a los nodos
 * Code tal como están en el JSON. El SQL se lanza contra la base dentro de
 * BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que NO siga redirecciones. El 301 al listado del modelo ES la señal de
 *     venta; siguiéndolo se acaba en una página que responde 200 y el coche
 *     vendido se daría por vivo.
 *   - Que un 429 o un 503 NO den de baja a nadie: eso habla de nosotros, no
 *     del coche.
 *   - Que un 3xx que conserva el uuid se trate como URL nueva, no como venta.
 *     En Gamboa eso dejó muertas para siempre a 90 ofertas vivas.
 *   - Que el cortacircuitos mida sobre ACTIVAS miradas y muertes NUEVAS, no
 *     sobre el total: contando reconfirmaciones, una pasada sin novedades
 *     parece una matanza y corta sola.
 *   - Que la cola separe activas de bajas. Con el mismo filtro se llena de
 *     muertas y el cortacircuitos corta antes de mirar una viva.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autoscout24-verificar-activas.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const http = wf.nodes.find((n) => String(n.type).endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ item: { json: j }, first: () => ({ json: j }), all: () => [{ json: j }] });

/** Una oferta pasa por «¿toca pedirla?» y por «Veredicto». */
function pasa(oferta, respuesta, estatico, run) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (item.saltar) return { saltada: true, json: {}, log: t.log };
  const v = ejecuta(codigo("Code: Veredicto"), {
    estatico, run,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (v.items[0] || { json: {} }).json, log: v.log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  comprueba("pide con HEAD, que ahorra el 95% del tráfico",
    http.parameters.method === "HEAD");
  comprueba("NO sigue redirecciones: el 301 es la señal",
    ((http.parameters.options || {}).redirect || {}).redirect.followRedirects === false);
  comprueba("se queda con las cabeceras de la respuesta",
    ((http.parameters.options || {}).response || {}).response.fullResponse === true);
  comprueba("manda User-Agent donde n8n lo lee",
    http.parameters.sendHeaders === true && !!H["User-Agent"]
    && !(http.parameters.options || {}).headers);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("el que escribe oferta a oferta aguanta cortes largos",
    nodo("PG: Actualizar oferta").maxTries >= 5
    && nodo("PG: Actualizar oferta").waitBetweenTries >= 15000);
  comprueba("avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const cron = wf.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto", Number(p[1]) !== 0, "minuto " + p[1]);
  // El scraper español ocupa 13:30-16:15 y 16:30-19:15 contra el mismo dominio.
  comprueba("ninguna pasada cae dentro del scraper español",
    horas.every((h) => h < 13 || h >= 19), "horas " + p[2]);

  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) { console.log("      HUÉRFANA: " + de); rotas++; }
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  const jsv = codigo("Code: Veredicto");
  comprueba("reconstruye las URLs con el dominio ESPAÑOL",
    /autoscout24\.es/.test(jsv) && !/autoscout24\.de/.test(jsv));

  // ══ los veredictos ═══════════════════════════════════════════════════════
  console.log("\nQUÉ DECIDE CON CADA RESPUESTA");
  const URL = "https://www.autoscout24.es/anuncios/audi-a3-gasolina-gris-"
    + "481b7656-1614-4faf-bc72-3f0b706c8c56";
  const activa = { id: "as_1", url: URL, is_active: true };
  const muerta = { id: "as_2", url: URL, is_active: false };
  const r = (codigo, location) => ({ statusCode: codigo, headers: location ? { location } : {} });

  const viva = pasa(activa, r(200), {});
  comprueba("200 -> sigue viva, y no toca is_active",
    viva.json.veredicto === "viva" && !/is_active/.test(viva.json.sql));
  const resu = pasa(muerta, r(200), {});
  comprueba("200 sobre una dada de baja -> resucita",
    resu.json.veredicto === "resucitada" && /is_active = TRUE/.test(resu.json.sql));

  const baja410 = pasa(activa, r(410), {});
  comprueba("410 -> baja", baja410.json.veredicto === "baja"
    && /is_active = FALSE/.test(baja410.json.sql));
  const bajaLst = pasa(activa, r(301, "https://www.autoscout24.es/lst/audi/a3"), {});
  comprueba("301 al listado del modelo -> baja", bajaLst.json.veredicto === "baja");

  for (const c of [0, 403, 429, 500, 503]) {
    const t = pasa(activa, r(c), {});
    comprueba("HTTP " + c + " -> pasajero, NO da de baja",
      t.json.veredicto === "pasajero" && !/is_active/.test(t.json.sql));
  }

  const urlNueva = pasa(activa,
    r(301, "/anuncios/audi-a3-nuevo-slug-481b7656-1614-4faf-bc72-3f0b706c8c56"), {});
  comprueba("3xx que conserva el uuid -> URL nueva, no venta",
    urlNueva.json.veredicto === "url nueva" && !/is_active/.test(urlNueva.json.sql));
  comprueba("y la guarda absoluta y española",
    /www\.autoscout24\.es\/anuncios\/audi-a3-nuevo-slug/.test(urlNueva.json.sql || ""));

  const rara = pasa(activa, r(302, "https://www.autoscout24.es/promo/verano"), {});
  comprueba("un 3xx raro no da de baja a nadie",
    rara.json.veredicto === "rara" && !/is_active/.test(rara.json.sql));

  // ══ la cola vacía ════════════════════════════════════════════════════════
  console.log("\nLA COLA VACÍA");
  const vacio = pasa({}, r(200), {});
  comprueba("un item vacío se salta y no llega al HTTP", vacio.saltada === true);

  // ══ el cortacircuitos ════════════════════════════════════════════════════
  console.log("\nEL CORTACIRCUITOS");
  const masacre = {};
  let paradas = 0;
  for (let i = 0; i < 300; i++) {
    const t = pasa({ id: "x" + i, url: URL, is_active: true }, r(410), masacre, "run-a");
    if (t.saltada || t.json.veredicto === "parado") paradas++;
  }
  comprueba("para ante una mortandad imposible", paradas > 0,
    (300 - paradas) + " miradas antes de parar");
  comprueba("y lo deja escrito", /mortandad del/.test(masacre.es_motivo || ""), masacre.es_motivo);

  // Reconfirmar bajas YA sabidas no puede disparar el freno.
  const rutina = {};
  let paradas2 = 0;
  for (let i = 0; i < 300; i++) {
    const t = pasa({ id: "y" + i, url: URL, is_active: false }, r(410), rutina, "run-b");
    if (t.saltada || t.json.veredicto === "parado") paradas2++;
  }
  comprueba("pero reconfirmar bajas viejas NO lo dispara", paradas2 === 0,
    "300 reconfirmaciones sin parar");

  // Una pasada nueva limpia el freno de la anterior.
  const sigue = pasa({ id: "z", url: URL, is_active: true }, r(200), masacre, "run-c");
  comprueba("una pasada nueva empieza con el freno suelto",
    !sigue.saltada && sigue.json.veredicto === "viva");

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nDIEZ FICHAS REALES");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a verificar").parameters.query;
  comprueba("la cola separa activas de bajas",
    /is_active AND \(last_checked_at/.test(COLA) && /NOT is_active AND \(last_checked_at/.test(COLA));
  comprueba("y pone las activas primero, al azar",
    /ORDER BY is_active DESC, random\(\)/.test(COLA));
  comprueba("no toca ofertas alemanas", /COALESCE\(country, 'ES'\) = 'ES'/.test(COLA));

  const q = await c.query(COLA.replace(/LIMIT \d+/, "LIMIT 10"));
  comprueba("la cola devuelve candidatas", q.rows.length > 0, q.rows.length + " ofertas");

  const est = {};
  const cuenta = {};
  let ultimo = null;
  for (const f of q.rows) {
    let res = { statusCode: 0, headers: {} };
    try {
      const rr = await fetch(f.url, { method: "HEAD", headers: H, redirect: "manual",
        signal: AbortSignal.timeout(20000) });
      const h = {};
      rr.headers.forEach((v, k) => { h[k] = v; });
      res = { statusCode: rr.status, headers: h };
    } catch (e) { res = { statusCode: 0, headers: {} }; }
    const t = pasa(f, res, est, "run-real");
    const v = t.json.veredicto || "-";
    cuenta[v] = (cuenta[v] || 0) + 1;
    console.log("      HTTP " + String(res.statusCode).padEnd(4) + v);
    if (t.json.sql) ultimo = { f, sql: t.json.sql, veredicto: v };
    await dormir(900);
  }
  console.log("      " + Object.entries(cuenta).map(([k, v]) => k + ": " + v).join("   "));
  comprueba("clasifica todas las fichas", !cuenta["rara"], (cuenta["rara"] || 0) + " sin clasificar");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con la que probar", false);
  } else {
    await c.query("BEGIN");
    try {
      const res = await c.query(ultimo.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1,
        "(" + res.rowCount + " filas, veredicto «" + ultimo.veredicto + "»)");
      const d = (await c.query("SELECT is_active, last_checked_at FROM moveadvisor_market_offers"
        + " WHERE id = $1", [ultimo.f.id])).rows[0];
      comprueba("queda con fecha de comprobación", !!d.last_checked_at);
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ cuánto hay por delante ═══════════════════════════════════════════════
  console.log("\nLO QUE HAY POR DELANTE");
  const t = (await c.query(`SELECT
      count(*) FILTER (WHERE is_active)::int activas,
      count(*) FILTER (WHERE is_active AND (last_checked_at IS NULL
        OR last_checked_at < NOW() - INTERVAL '20 hours'))::int pendientes
    FROM moveadvisor_market_offers
    WHERE portal='autoscout24' AND COALESCE(country,'ES')='ES'`)).rows[0];
  const porDia = 3000 * 4;
  console.log("      activas: " + t.activas.toLocaleString("es")
    + "   pendientes de mirar: " + t.pendientes.toLocaleString("es"));
  console.log("      a " + porDia.toLocaleString("es") + " al día son "
    + Math.ceil(t.pendientes / porDia) + " días para la primera vuelta");
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
