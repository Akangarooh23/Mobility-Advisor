/**
 * Comprueba el enriquecedor de coches.com.
 *
 *   npm run test:cochescom-enrich
 *
 * Pide fichas de verdad y se las da al nodo Code tal como está en el JSON. El
 * SQL se lanza contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - EL CERO. Un gasolina con co2Emissions = 0 no es un coche limpio: es un
 *     anuncio que no lo declara. Guardar ese 0 lo colocaría en el tramo más
 *     limpio de cualquier filtro. Pero un eléctrico SÍ emite 0 y ese sí hay que
 *     guardarlo. Es la comprobación que justifica este fichero.
 *   - Que el consumo caiga al WLTP cuando no hay combinado: de 11 fichas, 6
 *     traían el primero y 5 solo el segundo.
 *   - Que una ficha vendida (410) gaste su intento y no escriba datos.
 *   - Que un 403 NO gaste el intento: no dice nada del coche.
 *   - Que no toque updated_at ni pise datos que ya estuvieran.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "cochescom-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const http = wf.nodes.find((n) => String(n.type).endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico || {}, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ item: { json: j }, first: () => ({ json: j }), all: () => [{ json: j }] });

function pasa(oferta, respuesta, estatico, run) {
  const est = estatico || {};
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico: est, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (!String(item.url || "").trim()) return { saltada: true, json: {} };
  const v = ejecuta(codigo("Code: Extraer CO2 y consumo"), {
    estatico: est, run,
    $: () => ({ item: { json: item } }),
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

/** Una ficha de mentira con el envoltorio real de coches.com. */
const ficha = (capabilities) => ({
  statusCode: 200,
  body: '<script id="__NEXT_DATA__" type="application/json">'
    + JSON.stringify({ props: { pageProps: { data: { classified: { capabilities } } } } })
    + "</script>",
});

(async () => {
  console.log("CONFIGURACIÓN");
  comprueba("el nodo HTTP manda User-Agent donde n8n lo lee",
    http.parameters.sendHeaders === true && !!H["User-Agent"]
    && !(http.parameters.options || {}).headers);
  comprueba("NO sigue redirecciones",
    ((http.parameters.options || {}).redirect || {}).redirect.followRedirects === false);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("el Code mira también la propiedad data, no solo body",
    /res\.body \|\| res\.data/.test(codigo("Code: Extraer CO2 y consumo")));
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
  // Comparten dominio: el scraper (11:40 y 23:40) y el verificador (9,12,15,21).
  comprueba("no pisa al scraper ni al verificador de coches.com",
    horas.every((h) => ![9, 11, 12, 15, 21, 23].includes(h)), "horas " + p[2]);

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

  // ══ el cero, que es el motivo de este fichero ════════════════════════════
  console.log("\nEL CERO: CUÁNDO ES UN DATO Y CUÁNDO ES UN HUECO");
  const base = { id: "cc_1", url: "https://www.coches.com/x.htm?id=A1", co2: "", consumption: 0 };

  const gasolina = pasa({ ...base, fuel: "Gasolina" }, ficha({ co2Emissions: 0, wltpConsumptionCombined: 5.5 }));
  comprueba("un GASOLINA con co2 = 0 no guarda el cero",
    !/co2 =/.test(String(gasolina.json.sql || "")), gasolina.json.sql ? "solo consumo" : "?");
  comprueba("pero sí guarda su consumo",
    /consumption = COALESCE/.test(String(gasolina.json.sql || "")));

  const electrico = pasa({ ...base, fuel: "Eléctrico" }, ficha({ co2Emissions: 0 }));
  comprueba("un ELÉCTRICO con co2 = 0 SÍ lo guarda",
    /co2 = COALESCE\(NULLIF\(co2, ''\), '0'\)/.test(String(electrico.json.sql || "")),
    electrico.json.co2 === 0 ? "co2 = 0" : String(electrico.json.co2));

  const diesel = pasa({ ...base, fuel: "Diesel" }, ficha({ co2Emissions: 110, consumptionCombined: 4 }));
  comprueba("un diésel con 110 g/km lo guarda tal cual",
    /co2 = COALESCE\(NULLIF\(co2, ''\), '110'\)/.test(String(diesel.json.sql || "")));

  console.log("\nEL CONSUMO");
  const soloWltp = pasa({ ...base, fuel: "Gasolina" },
    ficha({ consumptionCombined: 0, wltpConsumptionCombined: 4.9 }));
  comprueba("si no hay combinado, cae al WLTP", soloWltp.json.consumo === 4.9,
    String(soloWltp.json.consumo));
  const conAmbos = pasa({ ...base, fuel: "Diesel" },
    ficha({ consumptionCombined: 3, wltpConsumptionCombined: 4.5 }));
  comprueba("y si hay los dos, manda el combinado", conAmbos.json.consumo === 3,
    String(conAmbos.json.consumo));
  const ninguno = pasa({ ...base, fuel: "Gasolina" }, ficha({}));
  comprueba("sin ninguno de los dos, no escribe consumo",
    !/consumption/.test(String(ninguno.json.sql || "")));
  comprueba("pero gasta el intento igual, para no atascar la cola",
    /enrich_tried_at = NOW\(\)/.test(String(ninguno.json.sql || "")));

  console.log("\nCUANDO LA FICHA NO SE PUEDE LEER");
  const vendida = pasa({ ...base, fuel: "Diesel" }, { statusCode: 410, body: "" });
  comprueba("410: gasta el intento y no inventa nada",
    /enrich_tried_at = NOW\(\)/.test(String(vendida.json.sql || ""))
    && !/co2|consumption/.test(String(vendida.json.sql || "")), vendida.json.veredicto);
  const cerrada = pasa({ ...base, fuel: "Diesel" }, { statusCode: 403, body: "" });
  comprueba("403: NO gasta el intento, vuelve a la cola",
    cerrada.json.sql === null, cerrada.json.veredicto);
  const vacia = pasa({ ...base, fuel: "Diesel" }, { statusCode: 200, body: "<html>nada</html>" });
  comprueba("200 sin __NEXT_DATA__: gasta el intento y nada más",
    /enrich_tried_at = NOW\(\)/.test(String(vacia.json.sql || ""))
    && !/co2|consumption/.test(String(vacia.json.sql || "")));
  comprueba("y nunca toca updated_at",
    !/updated_at/.test(String(diesel.json.sql || "")));

  console.log("\nEL CORTACIRCUITOS");
  const puerta = {};
  let pedidas = 0;
  for (let i = 0; i < 200; i++) {
    const t = pasa({ ...base, id: "b" + i, fuel: "Diesel" }, { statusCode: 403, body: "" },
      puerta, "run-403");
    if (!t.saltada) pedidas++;
  }
  comprueba("un muro de 403 para la pasada", pedidas < 100, pedidas + " intentos antes de parar");
  comprueba("la cola vacía se salta y no llega al HTTP",
    pasa({}, ficha({}), {}).saltada === true);

  // ══ la cola y fichas de verdad ═══════════════════════════════════════════
  console.log("\nLA COLA");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a enriquecer").parameters.query;
  comprueba("solo pide las que les falta algo",
    /COALESCE\(co2, ''\) = '' OR COALESCE\(consumption, 0\) = 0/.test(COLA));
  comprueba("y primero lo VISTO VIVO, no lo solo intentado",
    /last_seen_at > NOW\(\)/.test(COLA) && !/last_checked_at[^\n]*DESC/.test(COLA));
  const q = await c.query(COLA.replace(/LIMIT \d+/, "LIMIT 8"));
  comprueba("la cola devuelve candidatas", q.rows.length > 0, q.rows.length + " ofertas");

  console.log("\nSEIS FICHAS REALES");
  let conCo2 = 0; let conCons = 0; let leidas = 0; let ultimo = null;
  for (const fila of q.rows.slice(0, 6)) {
    await dormir(900);
    let res;
    try {
      const rr = await fetch(fila.url, { headers: H, redirect: "manual",
        signal: AbortSignal.timeout(30000) });
      res = { statusCode: rr.status, data: rr.status === 200 ? await rr.text() : "" };
    } catch (e) { res = { statusCode: 0, data: "" }; }
    const out = pasa(fila, res);
    const j = out.json;
    console.log("      HTTP " + String(res.statusCode).padEnd(5)
      + String(fila.fuel || "-").slice(0, 18).padEnd(20)
      + "co2 " + String(j.co2 === null || j.co2 === undefined ? "-" : j.co2).padStart(4)
      + "   consumo " + String(j.consumo === null || j.consumo === undefined ? "-" : j.consumo).padStart(5));
    if (j.veredicto === "enriquecida") { leidas++; ultimo = { fila, j }; }
    if (j.co2 !== null && j.co2 !== undefined) conCo2++;
    if (j.consumo !== null && j.consumo !== undefined) conCons++;
  }
  comprueba("saca datos de las fichas vivas", leidas > 0, leidas + " de 6 enriquecidas");
  console.log("      con CO₂: " + conCo2 + "   con consumo: " + conCons);

  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con datos que probar", false);
  } else {
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, co2, consumption, enrich_tried_at FROM moveadvisor_market_offers"
        + " WHERE id = $1", [ultimo.fila.id])).rows[0];
      const antes = await lee();
      const r = await c.query(ultimo.j.sql);
      comprueba("el SQL casa con una oferta nuestra", r.rowCount === 1, "(" + r.rowCount + " filas)");
      const desp = await lee();
      comprueba("entra algún dato",
        String(antes.co2 || "") !== String(desp.co2 || "")
        || Number(antes.consumption || 0) !== Number(desp.consumption || 0),
        "co2 «" + (desp.co2 || "-") + "»   consumo " + (desp.consumption || "-"));
      comprueba("updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at));
      comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
    } finally { await c.query("ROLLBACK"); }
  }

  console.log("\nLO QUE HAY POR DELANTE");
  const t = (await c.query(`SELECT
      count(*) FILTER (WHERE is_active)::int activas,
      count(*) FILTER (WHERE is_active AND COALESCE(co2,'') <> '')::int con_co2,
      count(*) FILTER (WHERE is_active AND COALESCE(consumption,0) > 0)::int con_consumo,
      count(*) FILTER (WHERE is_active AND enrich_tried_at IS NULL)::int pendientes
    FROM moveadvisor_market_offers WHERE portal='cochescom'`)).rows[0];
  const lote = Number((COLA.match(/LIMIT\s+(\d+)/) || [])[1] || 0);
  console.log("      activas " + Number(t.activas).toLocaleString("es")
    + "   con CO₂ " + Number(t.con_co2).toLocaleString("es")
    + "   con consumo " + Number(t.con_consumo).toLocaleString("es"));
  console.log("      pendientes " + Number(t.pendientes).toLocaleString("es")
    + "   a " + (lote * horas.length) + " al día: "
    + Math.ceil(t.pendientes / (lote * horas.length)) + " días");
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
