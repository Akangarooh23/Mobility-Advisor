/**
 * Comprueba el enriquecedor de Flexicar.
 *
 *   npm run test:flexicar-enrich
 *
 * Pide fichas de verdad a la API y se las da a los nodos Code tal como están en
 * el JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que «Norma de emisiones EU6, 145 g/km CO2» dé 145 y no 6. El primer regex
 *     pescaba el 6 de EU6 en diez de doce fichas, y un 6 g/km coloca al coche
 *     en el tramo más limpio de cualquier filtro.
 *   - Que un eléctrico con 0 g/km guarde su 0, y que un gasolina con 0 no lo
 *     guarde: el primero es verdad y el segundo es un dato que falta.
 *   - Que «Turismo» NO se traduzca a carrocería: la API la usa para Berlina y
 *     para Compacto, y una mal puesta sale en las búsquedas equivocadas.
 *   - Que la cilindrada se guarde en centímetros cúbicos, no en litros.
 *   - Que un 404 dé la oferta por vendida y un 403 NO gaste su intento.
 *   - Que enrich_tried_at se mueva pase lo que pase, o la cola no avanza.
 *   - Que NO toque updated_at, que es lo que ordena el escaparate.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "flexicar-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const NOMBRE_CODE = "Code: Extraer puertas, plazas, potencia, cilindrada, carrocería y CO2";
const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });

/** Una oferta pasa por «¿toca pedirla?» y por el Code que lee la ficha. */
function pasa(oferta, respuesta, estatico) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (!item.url) return { saltada: true, json: {} };
  const v = ejecuta(codigo(NOMBRE_CODE), {
    estatico,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (v.items[0] || { json: {} }).json, log: v.log, url: item.url };
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
/** Una respuesta de la API inventada, para los casos que no se pueden pedir. */
const ficha = (extra) => ({ statusCode: 200, data: JSON.stringify(Object.assign({
  id: 903000000000001, brand: "Seat", model: "Leon", doors: 5, seats: 5, hp: 110,
  cylinder: 1.498, body: "Turismo", mixedConsumption: 5.4, ecoSticker: "C",
  dataSheet: ["Motor de combustión"],
}, extra)) });

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("no pisa al scraper de Flexicar (9:10 y 21:10)",
    !horas.some((h) => h === 9 || h === 21), "horas " + horas.join(","));
  comprueba("el nodo HTTP manda User-Agent y pide JSON",
    http.parameters.sendHeaders === true && !!H["User-Agent"] && H.Accept === "application/json");
  comprueba("ninguna cabecera en options.headers, que typeVersion 4 ignora",
    !(http.parameters.options || {}).headers);
  comprueba("NO sigue redirecciones", (((http.parameters.options || {}).redirect || {}).redirect || {}).followRedirects === false);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("los nodos de Postgres reintentan",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("el que escribe oferta a oferta aguanta cortes largos",
    nodo("PG: Actualizar oferta").maxTries >= 5 && nodo("PG: Actualizar oferta").waitBetweenTries >= 15000);
  comprueba("hay un IF antes del HTTP para la cola vacía", !!nodo("IF: ¿hay ficha que pedir?"));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  comprueba("el Code mira también la propiedad data, no solo body",
    /res\.body \|\| res\.data/.test(codigo(NOMBRE_CODE)));
  // La salida 0 del bucle es TERMINADO y la 1 es cada item.
  const salidas = wf.connections["Loop: oferta por oferta"].main;
  comprueba("el bucle va al resumen al terminar, no al HTTP",
    salidas[0][0].node === "Code: Resumen" && salidas[1][0].node === "Code: ¿toca pedirla?");

  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ la trampa del EU6 ════════════════════════════════════════════════════
  console.log("\nLA TRAMPA DEL «EU6»");
  const eu6 = pasa({ id: "903000000000001", fuel: "Gasolina" },
    ficha({ dataSheet: ["Norma de emisiones EU6, 145 g/km CO2 (combinado)"] }), {});
  comprueba("«EU6, 145 g/km CO2» da 145 y no 6", eu6.json.co2 === 145, "co2 = " + eu6.json.co2);
  const soloEu6 = pasa({ id: "903000000000001", fuel: "Gasolina" },
    ficha({ dataSheet: ["Norma de emisiones EU6 D"] }), {});
  comprueba("«EU6 D» a secas no inventa CO₂", soloEu6.json.co2 === null, "co2 = " + soloEu6.json.co2);
  const nada = pasa({ id: "903000000000001", fuel: "Gasolina" },
    ficha({ dataSheet: ["Dimensiones exteriores: 4.304 mm de largo"] }), {});
  comprueba("un número suelto en la prosa tampoco", nada.json.co2 === null, "co2 = " + nada.json.co2);

  console.log("\nEL CERO: VERDAD EN UN ELÉCTRICO, HUECO EN UN GASOLINA");
  const elec = pasa({ id: "903000000000001", fuel: "Eléctrico" },
    ficha({ dataSheet: ["Norma de emisiones 0 g/km CO2 (combinado)"] }), {});
  comprueba("un eléctrico guarda su 0", elec.json.co2 === 0, "co2 = " + elec.json.co2);
  const gas0 = pasa({ id: "903000000000001", fuel: "Gasolina" },
    ficha({ dataSheet: ["Norma de emisiones 0 g/km CO2 (combinado)"] }), {});
  comprueba("un gasolina con 0 lo deja vacío", gas0.json.co2 === null, "co2 = " + gas0.json.co2);
  const acento = pasa({ id: "903000000000001", fuel: "Eléctrico" },
    ficha({ dataSheet: ["Norma de emisiones 0 g/km CO2"] }), {});
  comprueba("y la tilde de «Eléctrico» no lo rompe", acento.json.electrico === true);

  // ══ la carrocería que no se escribe ══════════════════════════════════════
  console.log("\nLA CARROCERÍA AMBIGUA");
  comprueba("«Turismo» no se traduce", eu6.json.carroceria === "" && !/body_type/.test(eu6.json.sql));
  for (const [api, nuestra] of [["SUV 4x4", "SUV"], ["Familiar", "Familiar"],
    ["monovolumen", "Monovolumen"], ["Pick Up", "Pick Up"], ["Cabrio", "Cabrio"]]) {
    const r = pasa({ id: "903000000000001" }, ficha({ body: api }), {});
    comprueba("«" + api + "» -> " + nuestra, r.json.carroceria === nuestra, r.json.carroceria);
  }

  // ══ cordura ══════════════════════════════════════════════════════════════
  console.log("\nFILTRO DE CORDURA Y UNIDADES");
  const loco = pasa({ id: "903000000000001" }, ficha({ doors: 6, seats: 100, hp: 5 }), {});
  comprueba("6 puertas y 100 plazas se descartan",
    loco.json.puertas === null && loco.json.plazas === null && loco.json.cv === null);
  comprueba("la cilindrada va en cc, no en litros", eu6.json.cc === 1498, "cc = " + eu6.json.cc);
  comprueba("y el SQL la escribe como texto", /displacement = COALESCE\(NULLIF\(displacement, ''\), '1498'\)/.test(eu6.json.sql));
  comprueba("nunca toca updated_at", !/updated_at/.test(eu6.json.sql));
  comprueba("y siempre deja enrich_tried_at", /enrich_tried_at = NOW\(\)/.test(eu6.json.sql));

  // ══ lo que no es la oferta ═══════════════════════════════════════════════
  console.log("\nCUANDO LA API NO DA LA FICHA");
  const vendida = pasa({ id: "903000000000001" }, { statusCode: 404, data: "" }, {});
  comprueba("un 404 la da por vendida", /is_active = FALSE/.test(vendida.json.sql || ""), vendida.json.veredicto);
  const est = {};
  const bloqueo = pasa({ id: "903000000000001" }, { statusCode: 403, data: "" }, est);
  comprueba("un 403 no escribe nada y no gasta el intento",
    bloqueo.json.sql === null && bloqueo.json.veredicto === "pasajero");
  const otra = pasa({ id: "903000000000001" }, ficha({ id: 903000000999999 }), {});
  comprueba("una ficha de otro coche no se escribe",
    !/doors/.test(otra.json.sql || ""), otra.json.veredicto);

  console.log("\nEL CORTACIRCUITOS");
  const bl = {};
  let pedidas = 0, saltadas = 0;
  for (let i = 0; i < 120; i++) {
    const r = pasa({ id: "90300000000000" + (i % 10) }, { statusCode: 403, data: "" }, bl);
    if (r.saltada) saltadas++; else pedidas++;
  }
  comprueba("para si la API nos cierra la puerta", saltadas > 0,
    pedidas + " pedidas antes de parar, " + saltadas + " saltadas");
  const sanas = {};
  let vivas = 0;
  for (let i = 0; i < 120; i++) {
    const r = pasa({ id: "903000000000001" }, ficha({}), sanas);
    if (!r.saltada) vivas++;
  }
  comprueba("y NO para cuando todo va bien", vivas === 120, vivas + " de 120");
  const resumen = ejecuta(codigo("Code: Resumen"),
    { estatico: bl, $: () => uno({}), $input: uno({}) });
  comprueba("el parte apunta la pasada",
    /INSERT INTO moveadvisor_verify_runs/.test(resumen.items[0].json.sql)
    && /'flexicar-enrich'/.test(resumen.items[0].json.sql));
  comprueba("y deja la memoria limpia para la siguiente",
    !Object.keys(bl).some((k) => k.indexOf("fe_") === 0),
    "quedan: " + (Object.keys(bl).join(", ") || "nada"));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nCINCO FICHAS REALES");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a enriquecer").parameters.query;
  // Sin los comentarios: la consulta EXPLICA en prosa que no usa
  // last_checked_at, así que mirar el texto entero da por bueno el comentario
  // en vez del código. Ya me ha pasado tres veces.
  const SOLO_SQL = COLA.split("\n").filter((l) => l.trim().indexOf("--") !== 0).join("\n");
  comprueba("la cola es solo de Flexicar y de lo vivo",
    /portal = 'flexicar'/.test(SOLO_SQL) && /is_active/.test(SOLO_SQL));
  comprueba("y ordena por lo visto vivo hace poco, no por lo intentado",
    /last_seen_at/.test(SOLO_SQL) && !/last_checked_at/.test(SOLO_SQL));
  const q = await c.query(COLA);
  comprueba("la cola devuelve ofertas", q.rows.length > 0, q.rows.length + " esperando");

  let leidas = 0;
  let ultimo = null;
  for (const fila of q.rows.slice(0, 5)) {
    const url = "https://services.flexicar.es/api/v1/vehicles/" + fila.id;
    const r = await fetch(url, { headers: H, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const cuerpo = await r.text();
    const out = pasa(fila, { statusCode: r.status, data: cuerpo }, {});
    const j = out.json;
    console.log("      HTTP " + r.status + "  " + String(j.veredicto || "-").padEnd(16)
      + " puertas " + String(j.puertas ?? "-") + "  plazas " + String(j.plazas ?? "-")
      + "  cv " + String(j.cv ?? "-").padStart(4) + "  cc " + String(j.cc ?? "-").padStart(5)
      + "  " + String(j.carroceria || "-").padEnd(12) + " co2 " + String(j.co2 ?? "-"));
    comprueba("  deja la marca de intentado", /enrich_tried_at = NOW\(\)/.test(j.sql || ""));
    if (j.veredicto === "enriquecida") { leidas++; ultimo = j; }
    await dormir(900);
  }
  comprueba("la mayoría de las fichas dan datos", leidas >= 3, leidas + " de 5");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con la que probar", false);
  } else {
    const id = (ultimo.sql.match(/WHERE id = '([^']+)'/) || [])[1];
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, doors, seats, power_cv, displacement, body_type, co2, enrich_tried_at"
        + " FROM moveadvisor_market_offers WHERE id = $1", [id])).rows[0];
      const antes = await lee();
      const res = await c.query(ultimo.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1, "(" + res.rowCount + " filas)");
      const desp = await lee();
      console.log("      antes: puertas " + antes.doors + " cv " + antes.power_cv
        + " cc " + antes.displacement + " «" + antes.body_type + "» co2 " + antes.co2);
      console.log("      ahora: puertas " + desp.doors + " cv " + desp.power_cv
        + " cc " + desp.displacement + " «" + desp.body_type + "» co2 " + desp.co2);
      comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
      comprueba("y updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at), String(antes.updated_at).slice(0, 19));
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ el tamaño del trabajo ════════════════════════════════════════════════
  console.log("\nEL TAMAÑO DEL TRABAJO");
  const t = (await c.query(`SELECT
      count(*) FILTER (WHERE is_active)::int activas,
      count(*) FILTER (WHERE is_active AND enrich_tried_at IS NULL)::int sin_mirar
    FROM moveadvisor_market_offers WHERE portal='flexicar'`)).rows[0];
  const porDia = 1000 * 4;
  console.log("      " + t.activas + " activas, " + t.sin_mirar + " sin mirar");
  console.log("      a " + porDia.toLocaleString("es") + " al día: "
    + Math.ceil(t.sin_mirar / porDia) + " días para ponerse al día");
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
