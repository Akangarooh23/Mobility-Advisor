/**
 * Comprueba el verificador de coches.com.
 *
 *   npm run test:cochescom-verificar
 *
 * Pide fichas de verdad con HEAD y le da las respuestas a los nodos Code tal
 * como están en el JSON. El SQL se lanza contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que la cola NO filtre por URL: aquí las 52.137 activas tienen 52.137 URLs
 *     distintas, una por coche. En Autocasión había que descartar 35.518 que
 *     apuntaban a un listado de provincia.
 *   - Que un 410 dé de baja y un 301 NO: aquí la señal es el 410, y no se vio
 *     ni una redirección de venta en 14 medidas. Dar de baja por un 3xx sería
 *     copiar la lógica de otro portal sin haberla medido en este.
 *   - Que un 429 o un 503 no den de baja a nadie.
 *   - Que un 3xx que conserva el ?id= se trate como URL nueva, no como venta.
 *     Pasa de verdad: en diez fichas reales salió un 308 así. En Gamboa
 *     confundir eso dejó muertas para siempre a 90 ofertas vivas.
 *   - Que los dos cortacircuitos funcionen: el de mortandad y el de bloqueo.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "cochescom-verificar-activas.json"), "utf8"));
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

function pasa(oferta, respuesta, estatico, run) {
  const est = estatico || {};
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico: est, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (item.saltar) return { saltada: true, json: {} };
  const v = ejecuta(codigo("Code: Veredicto"), {
    estatico: est, run,
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
  console.log("CONFIGURACIÓN");
  comprueba("pide con HEAD, que ahorra el 95% del tráfico", http.parameters.method === "HEAD");
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
  comprueba("no queda ningún nodo Wait",
    !wf.nodes.some((n) => String(n.type).endsWith("n8n-nodes-base.wait")));

  const cron = wf.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto", Number(p[1]) !== 0, "minuto " + p[1]);
  // El scraper de coches.com arranca a las 11:40 y a las 23:40. Es el único que
  // comparte dominio con esto: pedirle a la vez desde dos sitios es lo que nos
  // haría ganar un bloqueo. Con los demás basta el límite de concurrencia.
  comprueba("ninguna pasada arranca dentro del scraper de coches.com",
    horas.every((h) => h !== 11 && h !== 23), "horas " + p[2]);

  const m = wf.connections["Loop: oferta por oferta"].main;
  comprueba("la salida 0 del bucle es la de TERMINADO",
    (m[0][0] || {}).node === "Code: Resumen");
  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ los veredictos ═══════════════════════════════════════════════════════
  console.log("\nQUÉ DECIDE CON CADA RESPUESTA");
  const URL = "https://www.coches.com/coches-segunda-mano/ocasion-bmw-x3-190-20d.htm?id=Kp7xQ2";
  const activa = { id: "ac_1", url: URL, is_active: true };
  const muerta = { id: "ac_2", url: URL, is_active: false };
  const r = (cod, loc) => ({ statusCode: cod, headers: loc ? { location: loc } : {} });

  const viva = pasa(activa, r(200), {});
  comprueba("200 -> sigue viva, y no toca is_active",
    viva.json.veredicto === "viva" && !/is_active/.test(viva.json.sql));
  const resu = pasa(muerta, r(200), {});
  comprueba("200 sobre una dada de baja -> resucita",
    resu.json.veredicto === "resucitada" && /is_active = TRUE/.test(resu.json.sql));

  const baja410 = pasa(activa, r(410), {});
  comprueba("410 -> baja, que aquí es LA señal",
    baja410.json.veredicto === "baja" && /is_active = FALSE/.test(baja410.json.sql));
  // En este portal un 3xx no significa venta: no se ha visto ni uno en 14
  // medidas. Si aparece, se apunta como «rara» y se mira, en vez de dar de baja
  // por parecido con otros portales.
  const redir = pasa(activa, r(301, "https://www.coches.com/coches-segunda-mano/bmw.htm"), {});
  comprueba("un 301 NO da de baja: aquí no es la señal",
    redir.json.veredicto === "rara" && !/is_active/.test(redir.json.sql || ""),
    redir.json.veredicto);

  for (const c of [0, 403, 429, 500, 503]) {
    const t = pasa(activa, r(c), {});
    comprueba("HTTP " + c + " -> pasajero, NO da de baja",
      t.json.veredicto === "pasajero" && !/is_active/.test(t.json.sql));
  }

  // Pasa de verdad: en las diez fichas reales de más abajo salió un 308 así.
  const urlNueva = pasa(activa,
    r(308, "/coches-segunda-mano/ocasion-bmw-x3-nuevo-slug.htm?id=Kp7xQ2"), {});
  comprueba("3xx que conserva el ?id= -> URL nueva, no venta",
    urlNueva.json.veredicto === "url nueva" && !/is_active/.test(urlNueva.json.sql),
    urlNueva.json.veredicto);
  comprueba("y la guarda absoluta",
    /www\.coches\.com\/coches-segunda-mano\/ocasion-bmw-x3-nuevo-slug/.test(urlNueva.json.sql || ""));

  const rara = pasa(activa, r(302, "https://www.coches.com/promo/verano"), {});
  comprueba("un 3xx raro no da de baja a nadie",
    rara.json.veredicto === "rara" && !/is_active/.test(rara.json.sql));

  console.log("\nLA COLA VACÍA");
  comprueba("un item vacío se salta y no llega al HTTP", pasa({}, r(200), {}).saltada === true);

  // ══ los cortacircuitos ═══════════════════════════════════════════════════
  console.log("\nLOS CORTACIRCUITOS");
  const masacre = {};
  let paradas = 0;
  for (let i = 0; i < 300; i++) {
    const t = pasa({ id: "x" + i, url: URL, is_active: true },
      r(410), masacre, "run-a");
    if (t.saltada || t.json.veredicto === "parado") paradas++;
  }
  comprueba("para ante una mortandad imposible", paradas > 0,
    (300 - paradas) + " miradas antes de parar");
  const rutina = {};
  let paradas2 = 0;
  for (let i = 0; i < 300; i++) {
    const t = pasa({ id: "y" + i, url: URL, is_active: false },
      r(410), rutina, "run-b");
    if (t.saltada || t.json.veredicto === "parado") paradas2++;
  }
  comprueba("pero reconfirmar bajas viejas NO lo dispara", paradas2 === 0,
    "300 reconfirmaciones sin parar");

  for (const malo of [403, 429, 503]) {
    const puerta = {};
    let vistas = 0;
    for (let i = 0; i < 200; i++) {
      const t = pasa({ id: "b" + i, url: URL, is_active: true }, r(malo), puerta, "run-" + malo);
      if (!t.saltada && t.json.veredicto !== "parado") vistas++;
    }
    comprueba("un muro de " + malo + " para la pasada", vistas < 100,
      vistas + " intentos antes de parar");
  }
  const goteo = {};
  let paradas3 = 0;
  for (let i = 0; i < 300; i++) {
    const t = pasa({ id: "g" + i, url: URL, is_active: true },
      (i % 20 === 0) ? r(503) : r(200), goteo, "run-g");
    if (t.saltada || t.json.veredicto === "parado") paradas3++;
  }
  comprueba("un 5% de fallos sueltos NO para la pasada", paradas3 === 0);

  // ══ la cola ══════════════════════════════════════════════════════════════
  console.log("\nLA COLA");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a verificar").parameters.query;
  // Aquí NO se filtra por URL, al revés que en Autocasión: las 52.137 activas
  // tienen 52.137 URLs distintas, una por coche.
  comprueba("no filtra por URL, porque aquí todas valen", !/url ~/.test(COLA));
  comprueba("separa activas de bajas",
    /is_active AND \(last_checked_at/.test(COLA) && /NOT is_active AND \(last_checked_at/.test(COLA));
  comprueba("y va al azar dentro de cada grupo",
    /ORDER BY is_active DESC, random\(\)/.test(COLA));
  const q = await c.query(COLA.replace(/LIMIT \d+/, "LIMIT 12"));
  comprueba("la cola devuelve candidatas", q.rows.length > 0, q.rows.length + " ofertas");
  comprueba("todas traen URL del portal",
    q.rows.every((x) => String(x.url).indexOf("coches.com") !== -1));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nDIEZ FICHAS REALES");
  const cuenta = {};
  let ultimo = null;
  for (const fila of q.rows.slice(0, 10)) {
    let res;
    try {
      const rr = await fetch(fila.url, { method: "HEAD", headers: H, redirect: "manual",
        signal: AbortSignal.timeout(20000) });
      const h = {};
      rr.headers.forEach((v, k) => { h[k] = v; });
      res = { statusCode: rr.status, headers: h };
    } catch (e) { res = { statusCode: 0, headers: {} }; }
    const out = pasa(fila, res, {});
    const v = out.json.veredicto || "?";
    cuenta[v] = (cuenta[v] || 0) + 1;
    console.log("      HTTP " + String(res.statusCode).padEnd(5) + v);
    if (out.json.sql) ultimo = { fila, j: out.json };
    await dormir(800);
  }
  console.log("      " + Object.entries(cuenta).map(([k, v]) => k + ": " + v).join("   "));
  comprueba("clasifica todas las fichas", !cuenta["rara"], (cuenta["rara"] || 0) + " sin clasificar");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con veredicto", false);
  } else {
    await c.query("BEGIN");
    try {
      const res = await c.query(ultimo.j.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1,
        "(" + res.rowCount + " filas, veredicto «" + ultimo.j.veredicto + "»)");
      const d = (await c.query("SELECT is_active, last_checked_at FROM moveadvisor_market_offers"
        + " WHERE id = $1", [ultimo.fila.id])).rows[0];
      comprueba("queda con fecha de comprobación", !!d.last_checked_at);
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ lo que hay por delante ═══════════════════════════════════════════════
  console.log("\nLO QUE HAY POR DELANTE");
  const t = (await c.query(`SELECT
      count(*) FILTER (WHERE is_active)::int activas,
      count(*) FILTER (WHERE is_active)::int verificables,
      0::int ciegas
    FROM moveadvisor_market_offers WHERE portal='cochescom'`)).rows[0];
  const lote = Number((COLA.match(/LIMIT\s+(\d+)/) || [])[1] || 0);
  const porDia = lote * horas.length;
  console.log("      activas " + Number(t.activas).toLocaleString("es")
    + "   verificables " + Number(t.verificables).toLocaleString("es")
    + "   sin URL de ficha " + Number(t.ciegas).toLocaleString("es"));
  console.log("      a " + porDia.toLocaleString("es") + " al día: "
    + Math.ceil(t.verificables / porDia) + " días para la primera vuelta");
  // Que la pasada quepa antes de la siguiente, medido: 0,5 s por oferta.
  // 0,9 s por oferta: el HEAD solo ya son 862 ms.
  const minutos = Math.round(lote * 0.9 / 60);
  const saltos = horas.slice(1).map((h, i) => (h - horas[i]) * 60);
  comprueba("una pasada termina antes de que arranque la siguiente",
    minutos < Math.min(...saltos), minutos + " min de pasada, " + Math.min(...saltos) + " de hueco");
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
