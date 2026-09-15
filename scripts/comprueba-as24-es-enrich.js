/**
 * Comprueba el enriquecedor de AutoScout24 España.
 *
 *   npm run test:as24-es-enrich
 *
 * Pide fichas españolas de verdad y se las da al nodo Code tal como está en el
 * JSON del workflow. El SQL se lanza contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que la CILINDRADA EN LITROS se pise. 102.937 ofertas españolas tenían
 *     «1.0» donde debía ir «998». Si esto se escribiera con el COALESCE de los
 *     demás campos, esas 102.937 se quedarían mal para siempre.
 *   - Que una cilindrada que YA es correcta no se toque.
 *   - Que NO escriba co2: la ficha española no lo trae nunca, y un COALESCE con
 *     null no hace nada, pero un String(null) escribiría la palabra «null».
 *   - Que NO escriba environmental_label: la ficha da «Euro 6», que es la norma
 *     europea, y esa columna guarda la etiqueta de la DGT.
 *   - Que updated_at no se toque: enriquecer no es que el anuncio haya
 *     cambiado, es que nosotros nos hemos puesto al día.
 *   - Que un 403 NO gaste el intento de la oferta -volvera a la cola- pero un
 *     410 sí, para no atascarla.
 *   - Que los tipos cuadren: doors y seats son integer, displacement varchar.
 *     NULLIF(varchar, 0) tumba el UPDATE entero.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autoscout24-enrich-offers.json"), "utf8"));
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

/** Una oferta pasa por «¿toca pedirla?» y por «Extraer de la ficha». */
function pasa(oferta, respuesta, estatico, run) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico: estatico || {}, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (!String(item.url || "").trim()) return { saltada: true, json: {} };
  const v = ejecuta(codigo("Code: Extraer de la ficha"), {
    estatico: estatico || {}, run,
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

/** Una ficha española de mentira, con el envoltorio real. */
const ficha = (vehiculo) => ({
  statusCode: 200,
  body: '<script id="__NEXT_DATA__" type="application/json">'
    + JSON.stringify({ props: { pageProps: { listingDetails: { vehicle: vehiculo } } } })
    + "</script>",
});

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  comprueba("el nodo HTTP manda User-Agent donde n8n lo lee",
    http.parameters.sendHeaders === true && !!H["User-Agent"]
    && !(http.parameters.options || {}).headers);
  comprueba("un corte de red no tumba la pasada",
    http.onError === "continueRegularOutput");
  comprueba("el Code mira también la propiedad data, no solo body",
    /res\.body \|\| res\.data/.test(codigo("Code: Extraer de la ficha")));
  comprueba("el que escribe oferta a oferta aguanta cortes largos",
    nodo("PG: Actualizar oferta").maxTries >= 5
    && nodo("PG: Actualizar oferta").waitBetweenTries >= 15000);
  comprueba("hay un IF antes del HTTP para la cola vacía",
    wf.nodes.some((n) => n.name === "IF: ¿hay ficha que pedir?"));
  comprueba("avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const cron = wf.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto", Number(p[1]) !== 0, "minuto " + p[1]);
  // El scraper español ocupa 13:30-19:15 contra el mismo dominio.
  comprueba("ninguna pasada cae dentro del scraper español",
    horas.every((h) => h < 13 || h >= 19), "horas " + p[2]);

  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ lo que escribe, campo a campo ════════════════════════════════════════
  console.log("\nQUÉ ESCRIBE Y QUÉ NO");
  const completa = pasa({ id: "es_1", url: "u" }, ficha({
    bodyType: "SUV/4x4/Pickup", numberOfDoors: 5, numberOfSeats: 5,
    rawDisplacementInCCM: 998, driveTrain: "Tracción delantera",
    fuelConsumptionCombined: 5.4, damageConditions: [],
  }));
  const sql = completa.json.sql || "";
  comprueba("puertas y plazas van como número", /doors = COALESCE\(NULLIF\(doors, 0\)/.test(sql)
    && /seats = COALESCE\(NULLIF\(seats, 0\)/.test(sql));
  comprueba("carrocería y tracción van como texto",
    /body_type = COALESCE\(NULLIF\(body_type, ''\)/.test(sql)
    && /traction = COALESCE\(NULLIF\(traction, ''\)/.test(sql));
  comprueba("la tracción usa NUESTRO vocabulario", completa.json.traccion === "Delantera",
    completa.json.traccion);
  comprueba("NO escribe co2, que la ficha española no trae", !/co2/.test(sql));
  comprueba("NO escribe environmental_label",
    !/environmental_label/.test(sql) && !/Euro ?\d/.test(sql));
  comprueba("NO toca updated_at", !/updated_at/.test(sql));
  comprueba("gasta el intento", /enrich_tried_at = NOW\(\)/.test(sql));

  // El consumo 0 es «no lo declaro», no un consumo.
  const cero = pasa({ id: "es_2", url: "u" }, ficha({
    numberOfDoors: 5, fuelConsumptionCombined: 0,
  }));
  comprueba("un consumo de 0 no se guarda", !/consumption/.test(cero.json.sql || ""));

  // ══ la cilindrada, que es el motivo de este workflow ═════════════════════
  console.log("\nLA CILINDRADA EN LITROS");
  comprueba("se pisa lo que no parezca cc",
    /displacement = CASE WHEN/.test(sql) && /ELSE '998' END/.test(sql), "998");
  comprueba("y se respeta lo que ya son cc de verdad",
    /\^\[0-9\]\{3,5\}\$/.test(sql), "tres a cinco dígitos");

  // ══ los daños ════════════════════════════════════════════════════════════
  console.log("\nLOS DAÑOS");
  const sano = pasa({ id: "es_3", url: "u" }, ficha({ damageConditions: [] }));
  comprueba("sin daños declarados -> is_damaged = FALSE",
    /is_damaged = FALSE/.test(sano.json.sql || ""));
  const roto = pasa({ id: "es_4", url: "u" },
    ficha({ damageConditions: ["Dañado", "No apto para circular"] }));
  comprueba("con daños -> is_damaged = TRUE y la nota tal cual",
    /is_damaged = TRUE/.test(roto.json.sql || "")
    && /Dañado, No apto para circular/.test(roto.json.sql || ""));
  const mudo = pasa({ id: "es_5", url: "u" }, ficha({ numberOfDoors: 3 }));
  comprueba("sin la clave -> NO escribe is_damaged, se queda en NULL",
    !/is_damaged/.test(mudo.json.sql || ""));

  // ══ fichas que fallan ════════════════════════════════════════════════════
  console.log("\nCUANDO LA FICHA NO SE PUEDE LEER");
  const ida = pasa({ id: "es_6", url: "u" }, { statusCode: 410, body: "" });
  comprueba("410: gasta el intento y no inventa nada",
    /enrich_tried_at = NOW\(\)/.test(ida.json.sql || "")
    && !/body_type|doors|is_damaged/.test(ida.json.sql || ""));
  const cerrada = pasa({ id: "es_7", url: "u" }, { statusCode: 403, body: "" });
  comprueba("403: NO gasta el intento, vuelve a la cola",
    cerrada.json.sql === null, cerrada.json.veredicto);
  const vacia = pasa({ id: "es_8", url: "u" }, { statusCode: 200, body: "<html>nada</html>" });
  comprueba("200 sin __NEXT_DATA__: gasta el intento y nada más",
    /enrich_tried_at = NOW\(\)/.test(vacia.json.sql || "")
    && !/body_type|doors/.test(vacia.json.sql || ""));

  // ══ la cola vacía y el cortacircuitos ════════════════════════════════════
  console.log("\nLA COLA VACÍA Y EL FRENO");
  comprueba("un item vacío se salta y no llega al HTTP",
    pasa({}, ficha({}), {}).saltada === true);

  for (const malo of [403, 429, 503]) {
    const puerta = {};
    let pedidas = 0;
    for (let i = 0; i < 200; i++) {
      const t = pasa({ id: "b" + i, url: "u" }, { statusCode: malo, body: "" }, puerta, "run-" + malo);
      if (!t.saltada) pedidas++;
    }
    comprueba("un muro de " + malo + " para la pasada", pedidas < 100,
      pedidas + " intentos antes de parar");
  }
  const goteo = {};
  let pedidasGoteo = 0;
  for (let i = 0; i < 200; i++) {
    const resp = (i % 20 === 0) ? { statusCode: 503, body: "" } : ficha({ numberOfDoors: 5 });
    const t = pasa({ id: "g" + i, url: "u" }, resp, goteo, "run-g");
    if (!t.saltada) pedidasGoteo++;
  }
  comprueba("un 5% de fallos sueltos NO para la pasada", pedidasGoteo === 200,
    pedidasGoteo + " de 200");

  // ══ la cola ══════════════════════════════════════════════════════════════
  console.log("\nLA COLA");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a enriquecer").parameters.query;
  comprueba("no toca ofertas alemanas", /COALESCE\(country, 'ES'\) = 'ES'/.test(COLA));
  comprueba("pone delante las que tienen la cilindrada en litros",
    /LIKE '%\.%'\) DESC/.test(COLA));
  const q = await c.query(COLA.replace(/LIMIT \d+/, "LIMIT 12"));
  comprueba("la cola devuelve candidatas", q.rows.length > 0, q.rows.length + " ofertas");
  comprueba("todas traen URL", q.rows.every((r) => String(r.url || "").startsWith("http")));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nSEIS FICHAS REALES");
  let ultimo = null;
  let conPuertas = 0;
  let leidas = 0;
  let vivas = 0;
  for (const fila of q.rows.slice(0, 6)) {
    const r = await fetch(fila.url, { headers: H, signal: AbortSignal.timeout(30000) });
    const cuerpo = await r.text();
    const out = pasa(fila, { statusCode: r.status, body: cuerpo });
    const j = out.json;
    console.log("      HTTP " + r.status + "  " + String(j.veredicto || "-").padEnd(14)
      + String(j.carroceria || "-").slice(0, 16).padEnd(18)
      + (j.puertas || "-") + "p  " + (j.plazas || "-") + " plazas  "
      + (j.cilindrada || "-") + " cc  " + (j.traccion || "-"));
    if (j.veredicto === "enriquecida") { leidas++; ultimo = { fila, j }; }
    if (j.veredicto === "enriquecida" || j.veredicto === "sin datos") vivas++;
    if (j.puertas > 0) conPuertas++;
    await dormir(1200);
  }
  // Una ficha vendida puede venir 410 o, como seguimos redirecciones, 200 con
  // el listado del modelo -que no trae listingDetails-. Ninguna de las dos es
  // un fallo del lector: son coches que ya no estan.
  comprueba("lee la mayoría de las fichas VIVAS", vivas === 0 || leidas >= vivas,
    leidas + " leidas de " + vivas + " vivas (" + (6 - vivas) + " ya vendidas)");
  comprueba("y de casi todas saca las puertas, que es a lo que viene",
    conPuertas >= leidas, conPuertas + " con puertas");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha leída con la que probar", false);
  } else {
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, body_type, doors, seats, displacement, traction, co2,"
        + " is_damaged, enrich_tried_at FROM moveadvisor_market_offers WHERE id = $1",
        [ultimo.fila.id])).rows[0];
      const antes = await lee();
      const res = await c.query(ultimo.j.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1, "(" + res.rowCount + " filas)");
      const desp = await lee();
      comprueba("las puertas entran", Number(desp.doors) > 0, desp.doors + " puertas");
      if (ultimo.j.cilindrada) {
        comprueba("la cilindrada queda en cc, no en litros",
          /^[0-9]{3,5}$/.test(String(desp.displacement || "")),
          "antes «" + (antes.displacement || "-") + "», ahora «" + desp.displacement + "»");
      }
      comprueba("el co2 se queda como estaba",
        String(antes.co2 || "") === String(desp.co2 || ""), "«" + (desp.co2 || "-") + "»");
      comprueba("updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at), String(antes.updated_at).slice(0, 19));
      comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ lo que hay por delante ═══════════════════════════════════════════════
  console.log("\nLO QUE HAY POR DELANTE");
  const t = (await c.query(`SELECT
      count(*) FILTER (WHERE is_active AND enrich_tried_at IS NULL)::int pendientes,
      count(*) FILTER (WHERE is_active AND COALESCE(displacement,'') LIKE '%.%')::int en_litros
    FROM moveadvisor_market_offers
    WHERE portal='autoscout24' AND COALESCE(country,'ES')='ES'`)).rows[0];
  const lote = Number((COLA.match(/LIMIT\s+(\d+)/) || [])[1] || 0);
  const porDia = lote * horas.length;
  console.log("      sin pasar por la ficha: " + Number(t.pendientes).toLocaleString("es"));
  console.log("      con la cilindrada en litros: " + Number(t.en_litros).toLocaleString("es"));
  console.log("      a " + porDia.toLocaleString("es") + " al día: "
    + Math.ceil(t.en_litros / porDia) + " días para arreglar las cilindradas, "
    + Math.ceil(t.pendientes / porDia) + " para pasarlas todas");
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
