/**
 * Comprueba el enriquecedor de OcasionPlus.
 *
 *   npm run test:ocasionplus-enrich
 *
 * Pide fichas de verdad y se las da a los nodos Code tal como están en el JSON
 * del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK, que
 * se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE LEA EL COCHE Y NO EL DICCIONARIO. En el payload de la ficha, la
 *     primera aparición de cada clave es el diccionario de traducciones de la
 *     interfaz —"doors":"Puertas"— y el dato está más adelante —"doors":5—.
 *     Buscando la primera concluí DOS VECES que este portal no tenía estos
 *     campos. Un ejemplo inventado no habría cazado eso: hay que pedir fichas.
 *   - Que la carrocería se normalice: el portal da TODOTERRENO y el resto del
 *     mercado usa Todoterreno, y un filtro trata las dos como valores distintos.
 *   - Que un 6 en puertas o un 100 en plazas se descarten.
 *   - Que un 404 dé la oferta por vendida y un 403 NO gaste su intento.
 *   - Que NO toque updated_at, que es lo que ordena el escaparate.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "ocasionplus-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const NOMBRE_CODE = "Code: Extraer puertas, plazas, color, carrocería y etiqueta";
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
  return { saltada: false, json: (v.items[0] || { json: {} }).json, log: v.log };
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// El guardia «¿toca pedirla?» exige una url: sin ella salta la oferta antes de
// llegar al Code que se quiere probar, y las pruebas salen todas en verde
// falso... o en rojo, que fue lo que pasó.
const URL_FALSA = "https://www.ocasionplus.com/coches-segunda-mano/coche-de-prueba-op_x";
/** Una ficha inventada, con el diccionario delante y el coche detrás. */
const fichaFalsa = (coche) => {
  const datos = Object.assign({ color: "Negro", doors: 5, seats: 5,
    bodyStyle: "TODOTERRENO", environmentalLabel: "C" }, coche);
  // Primero el diccionario, como en la ficha de verdad.
  const dic = '{"doors":"Puertas","seats":"Plazas","color":"Color","province":"Provincia"}';
  const real = '{"color":"' + datos.color + '","metallic":false,"doors":' + datos.doors
    + ',"seats":' + datos.seats + ',"bodyStyle":"' + datos.bodyStyle
    + '","environmentalLabel":"' + datos.environmentalLabel + '"}';
  return { statusCode: 200, data: 'self.__next_f.push([1,"' + dic + real + '"])</script>' };
};

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("no pisa al scraper (8:40 y 20:40) ni al verificador (10:20 y 22:20)",
    !horas.some((h) => [8, 20, 10, 22].indexOf(h) !== -1), "horas " + horas.join(","));
  comprueba("el nodo HTTP manda User-Agent", http.parameters.sendHeaders === true && !!H["User-Agent"]);
  comprueba("ninguna cabecera en options.headers, que typeVersion 4 ignora",
    !(http.parameters.options || {}).headers);
  comprueba("NO sigue redirecciones",
    (((http.parameters.options || {}).redirect || {}).redirect || {}).followRedirects === false);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("los nodos de Postgres reintentan",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("hay un IF antes del HTTP para la cola vacía", !!nodo("IF: ¿hay ficha que pedir?"));
  comprueba("el workflow avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
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
  const baseN8n = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");
  if (fs.existsSync(baseN8n)) {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(baseN8n, { readOnly: true });
    const existen = new Set(db.prepare("SELECT id FROM credentials_entity WHERE type='postgres'").all().map((x) => x.id));
    db.close();
    const usada = nodo("PG: Actualizar oferta").credentials.postgres.id;
    comprueba("la credencial de Postgres existe en n8n", existen.has(usada), usada);
  }

  // ══ el diccionario ═══════════════════════════════════════════════════════
  console.log("\nEL DICCIONARIO NO ES EL COCHE");
  const dic = pasa({ id: "op_x", url: URL_FALSA }, fichaFalsa({}), {});
  comprueba("lee 5 puertas, no la palabra «Puertas»", dic.json.puertas === 5, String(dic.json.puertas));
  comprueba("lee 5 plazas", dic.json.plazas === 5, String(dic.json.plazas));
  comprueba("y el color es «Negro», no «Color»", dic.json.color === "Negro", String(dic.json.color));

  console.log("\nLA CARROCERÍA SE NORMALIZA");
  for (const [bruta, nuestra] of [["TODOTERRENO", "Todoterreno"], ["COMPACTO", "Compacto"],
    ["CABRIO_DESCAPOTABLE", "Cabrio"], ["INDUSTRIAL", "Furgoneta"], ["PICKUP", "Pick Up"]]) {
    const r = pasa({ id: "op_x", url: URL_FALSA }, fichaFalsa({ bodyStyle: bruta }), {});
    comprueba("«" + bruta + "» -> " + nuestra, r.json.carroceria === nuestra, r.json.carroceria);
  }
  const rara = pasa({ id: "op_x", url: URL_FALSA }, fichaFalsa({ bodyStyle: "LO_QUE_SEA" }), {});
  comprueba("una que no conocemos se deja vacía, no se inventa",
    rara.json.carroceria === "" && String(rara.json.sql).indexOf("body_type") === -1);

  console.log("\nFILTRO DE CORDURA");
  const loco = pasa({ id: "op_x", url: URL_FALSA }, fichaFalsa({ doors: 6, seats: 100 }), {});
  comprueba("6 puertas y 100 plazas se descartan",
    loco.json.puertas === null && loco.json.plazas === null);
  comprueba("nunca toca updated_at", String(dic.json.sql).indexOf("updated_at") === -1);
  comprueba("y siempre deja enrich_tried_at", String(dic.json.sql).indexOf("enrich_tried_at = NOW()") !== -1);

  console.log("\nCUANDO LA FICHA NO ESTÁ");
  const vendida = pasa({ id: "op_x", url: URL_FALSA }, { statusCode: 410, data: "" }, {});
  comprueba("un 410 la da por vendida", String(vendida.json.sql).indexOf("is_active = FALSE") !== -1,
    vendida.json.veredicto);
  const est = {};
  const bloqueo = pasa({ id: "op_x", url: URL_FALSA }, { statusCode: 403, data: "" }, est);
  comprueba("un 403 no escribe nada y no gasta el intento",
    bloqueo.json.sql === null && bloqueo.json.veredicto === "pasajero");
  const sinAncla = pasa({ id: "op_x", url: URL_FALSA }, { statusCode: 200, data: 'self.__next_f.push([1,"{\\"doors\\":\\"Puertas\\"}"])</script>' }, {});
  comprueba("una ficha con solo el diccionario no inventa nada",
    String(sinAncla.json.sql).indexOf("doors") === -1, sinAncla.json.veredicto);

  console.log("\nEL CORTACIRCUITOS");
  const bl = {};
  let pedidas = 0, saltadas = 0;
  for (let i = 0; i < 120; i++) {
    const r = pasa({ id: "op_" + i, url: URL_FALSA }, { statusCode: 403, data: "" }, bl);
    if (r.saltada) saltadas++; else pedidas++;
  }
  comprueba("para si el portal nos cierra la puerta", saltadas > 0,
    pedidas + " pedidas antes de parar");
  const sanas = {};
  let vivas = 0;
  for (let i = 0; i < 120; i++) {
    if (!pasa({ id: "op_x", url: URL_FALSA }, fichaFalsa({}), sanas).saltada) vivas++;
  }
  comprueba("y NO para cuando todo va bien", vivas === 120, vivas + " de 120");
  const resumen = ejecuta(codigo("Code: Resumen"), { estatico: bl, $: () => uno({}), $input: uno({}) });
  comprueba("el parte apunta la pasada",
    String(resumen.items[0].json.sql).indexOf("'ocasionplus-enrich'") !== -1);
  comprueba("y deja la memoria limpia", !Object.keys(bl).some((k) => k.indexOf("oe_") === 0));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nCINCO FICHAS REALES");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a enriquecer").parameters.query;
  const soloSql = COLA.split("\n").filter((l) => l.trim().indexOf("--") !== 0).join("\n");
  comprueba("la cola es solo de OcasionPlus y de lo vivo",
    /portal = 'ocasionplus'/.test(soloSql) && /is_active/.test(soloSql));
  comprueba("y ordena por lo visto vivo, no por lo intentado",
    /last_seen_at/.test(soloSql) && !/last_checked_at/.test(soloSql));
  const q = await c.query(COLA);
  comprueba("la cola devuelve ofertas", q.rows.length > 0, q.rows.length + " esperando");

  let leidas = 0, ultimo = null;
  for (const fila of q.rows.slice(0, 5)) {
    const r = await fetch(fila.url, { headers: H, redirect: "manual", signal: AbortSignal.timeout(30000) });
    const cuerpo = await r.text();
    const out = pasa(fila, { statusCode: r.status, data: cuerpo }, {});
    const j = out.json;
    console.log("      HTTP " + r.status + "  " + String(j.veredicto || "-").padEnd(16)
      + " puertas " + String(j.puertas ?? "-") + "  plazas " + String(j.plazas ?? "-")
      + "  " + String(j.color || "-").padEnd(10) + String(j.carroceria || "-").padEnd(13)
      + " etiqueta " + String(j.etiqueta || "-"));
    if (j.veredicto === "enriquecida") { leidas++; ultimo = j; }
    await dormir(900);
  }
  comprueba("la mayoría de las fichas dan datos", leidas >= 3, leidas + " de 5");
  comprueba("y de una ficha REAL sale el color, no la palabra «Color»",
    ultimo && ultimo.color && ultimo.color !== "Color", ultimo ? ultimo.color : "-");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con la que probar", false);
  } else {
    const id = (String(ultimo.sql).match(/WHERE id = '([^']+)'/) || [])[1];
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, doors, seats, color, body_type, environmental_label, enrich_tried_at"
        + " FROM moveadvisor_market_offers WHERE id = $1", [id])).rows[0];
      const antes = await lee();
      const res = await c.query(ultimo.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1, "(" + res.rowCount + " filas)");
      const desp = await lee();
      console.log("      antes: puertas " + antes.doors + " plazas " + antes.seats
        + " «" + antes.color + "» «" + antes.body_type + "» " + antes.environmental_label);
      console.log("      ahora: puertas " + desp.doors + " plazas " + desp.seats
        + " «" + desp.color + "» «" + desp.body_type + "» " + desp.environmental_label);
      comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
      comprueba("y updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at));
    } finally { await c.query("ROLLBACK"); }
  }
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
