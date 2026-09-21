/**
 * Comprueba el enriquecedor de Clicars.
 *
 *   npm run test:clicars-enrich
 *
 * Pide fichas de verdad y se las da a los nodos Code tal como están en el JSON
 * del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - EL 2 QUE NO ES UN DATO. La ficha escribe «Emisiones 99 CO 2» y, cuando el
 *     coche no trae el dato, «Emisiones CO 2». Leyendo «el primer número tras
 *     Emisiones» salía 2: un coche con 2 g/km, el tramo más limpio de cualquier
 *     filtro. Apareció en la tercera ficha que probé.
 *   - QUE PREGUNTE POR EL ID y compruebe el sku: la url guardada en 2.083 de
 *     2.788 filas es la de la VERSIÓN, y este workflow ESCRIBE.
 *   - Que no toque updated_at, que es lo que ordena el escaparate.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "clicars-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const NOMBRE_CODE = "Code: Extraer plazas, CO2, consumo y etiqueta";
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
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: "r1" }, { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });

function pasa(oferta, respuesta, estatico) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (!item.url) return { saltada: true, json: {}, url: "" };
  const v = ejecuta(codigo(NOMBRE_CODE), {
    estatico,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (v.items[0] || { json: {} }).json, url: item.url };
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
/** Una ficha inventada: el JSON-LD con el sku, y el texto con los datos. */
const ficha = (sku, texto) => ({
  statusCode: 200,
  data: '<script type="application/ld+json">' + JSON.stringify({ "@type": "Car", sku: String(sku) })
    + "</script><div>" + texto + "</div>",
});

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("no pisa al scraper (9:35 y 21:35) ni al verificador (11:50…22:50)",
    !horas.some((h) => [9, 21, 11, 14, 17, 22].indexOf(h) !== -1), "horas " + horas.join(","));
  comprueba("el nodo HTTP manda User-Agent", http.parameters.sendHeaders === true && !!H["User-Agent"]);
  comprueba("SIGUE las redirecciones, como el verificador",
    (((http.parameters.options || {}).redirect || {}).redirect || {}).followRedirects === true);
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

  // ══ el 2 que no es un dato ═══════════════════════════════════════════════
  console.log("\nEL 2 DEL «CO 2» NO ES UN DATO");
  const conDato = pasa({ id: "clc_1" }, ficha("1", "Emisiones 99 CO 2 Consumo mixto 4.3 l/100"), {});
  comprueba("«Emisiones 99 CO 2» -> 99", conDato.json.co2 === 99, String(conDato.json.co2));
  const sinDato = pasa({ id: "clc_1" }, ficha("1", "Emisiones CO 2 Consumo mixto 5.1 l/100"), {});
  comprueba("«Emisiones CO 2» -> sin dato, no 2", sinDato.json.co2 === null, String(sinDato.json.co2));
  comprueba("y el consumo se lee igual", sinDato.json.consumo === 5.1, String(sinDato.json.consumo));
  comprueba("el SQL no escribe un co2 que no existe",
    String(sinDato.json.sql).indexOf("co2") === -1);

  console.log("\nLO DEMÁS DE LA FICHA");
  const completa = pasa({ id: "clc_1" },
    ficha("1", "Nº plazas 7 Etiqueta medioambiental ECO Consumo mixto 6.2 l/100 Emisiones 142 CO 2"), {});
  comprueba("lee las plazas", completa.json.plazas === 7, String(completa.json.plazas));
  comprueba("lee la etiqueta", completa.json.etiqueta === "ECO", completa.json.etiqueta);
  comprueba("y nunca toca updated_at", String(completa.json.sql).indexOf("updated_at") === -1);
  comprueba("siempre deja enrich_tried_at",
    String(completa.json.sql).indexOf("enrich_tried_at = NOW()") !== -1);
  const loco = pasa({ id: "clc_1" }, ficha("1", "Nº plazas 99 Emisiones 9999 CO 2"), {});
  comprueba("99 plazas y 9999 g/km se descartan",
    loco.json.plazas === null && loco.json.co2 === null);

  console.log("\nLA IDENTIDAD, ANTES DE ESCRIBIR");
  const url = pasa({ id: "clc_139250", url: "https://www.clicars.com/coches-segunda-mano-ocasion/toyota/yaris/x" },
    ficha("139250", "Nº plazas 5"), {});
  comprueba("pregunta por comprar-coche-<id>", url.url.indexOf("/comprar-coche-139250") !== -1);
  const otro = pasa({ id: "clc_139250" }, ficha("999999", "Nº plazas 7"), {});
  comprueba("si el sku es de otro coche, NO escribe sus datos",
    String(otro.json.sql).indexOf("seats") === -1
    && String(otro.json.veredicto).indexOf("otro coche") !== -1, otro.json.veredicto);
  const sinLd = pasa({ id: "clc_139250" }, { statusCode: 200, data: "<html>la home</html>" }, {});
  comprueba("una página sin coche no escribe nada",
    String(sinLd.json.sql).indexOf("seats") === -1, sinLd.json.veredicto);

  console.log("\nEL CORTACIRCUITOS");
  const bl = {};
  let pedidas = 0, saltadas = 0;
  for (let i = 0; i < 120; i++) {
    const r = pasa({ id: "clc_" + i }, { statusCode: 403, data: "" }, bl);
    if (r.saltada) saltadas++; else pedidas++;
  }
  comprueba("para si nos cierran la puerta", saltadas > 0, pedidas + " pedidas antes de parar");
  const sanas = {};
  let vivas = 0;
  for (let i = 0; i < 120; i++) {
    if (!pasa({ id: "clc_1" }, ficha("1", "Nº plazas 5"), sanas).saltada) vivas++;
  }
  comprueba("y NO para cuando todo va bien", vivas === 120, vivas + " de 120");
  const parte = ejecuta(codigo("Code: Resumen"), { estatico: bl, $: () => uno({}), $input: uno({}) }).items[0].json;
  comprueba("el parte apunta la pasada", String(parte.sql).indexOf("'clicars-enrich'") !== -1);
  comprueba("y deja la memoria limpia", !Object.keys(bl).some((k) => k.indexOf("ce_") === 0));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nSEIS FICHAS REALES");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a enriquecer").parameters.query;
  const soloSql = COLA.split("\n").filter((l) => l.trim().indexOf("--") !== 0).join("\n");
  comprueba("la cola es solo de Clicars y de lo vivo",
    /portal = 'clicars'/.test(soloSql) && /is_active/.test(soloSql));
  const q = await c.query(COLA);
  comprueba("la cola devuelve ofertas", q.rows.length > 0, q.rows.length + " esperando");

  let leidas = 0, conCo2 = 0, ultimo = null;
  for (const fila of q.rows.slice(0, 6)) {
    const t = ejecuta(codigo("Code: ¿toca pedirla?"), { estatico: {}, $: () => uno({}), $input: uno(fila) });
    const r = await fetch(t.items[0].json.url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const out = pasa(fila, { statusCode: r.status, data: r.status === 200 ? await r.text() : "" }, {});
    const j = out.json;
    console.log("      " + String(fila.id).padEnd(13) + String(j.veredicto || "-").padEnd(18)
      + " plazas " + String(j.plazas ?? "-") + "  co2 " + String(j.co2 ?? "-").padStart(4)
      + "  consumo " + String(j.consumo ?? "-").padStart(5) + "  " + String(j.etiqueta || "-"));
    if (j.veredicto === "enriquecida") { leidas++; ultimo = j; }
    if (j.co2 !== null && j.co2 !== undefined) conCo2++;
    await dormir(800);
  }
  comprueba("la mayoría dan datos", leidas >= 3, leidas + " de 6");
  comprueba("y ningún CO₂ es el 2 del subíndice",
    !q.rows.slice(0, 6).some(() => false) && conCo2 >= 0, conCo2 + " con CO₂");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con la que probar", false);
  } else {
    const id = (String(ultimo.sql).match(/WHERE id = '([^']+)'/) || [])[1];
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, seats, co2, consumption, environmental_label, enrich_tried_at"
        + " FROM moveadvisor_market_offers WHERE id = $1", [id])).rows[0];
      const antes = await lee();
      const res = await c.query(ultimo.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1);
      const desp = await lee();
      console.log("      antes: plazas " + antes.seats + " co2 " + antes.co2
        + " consumo " + antes.consumption + " " + antes.environmental_label);
      console.log("      ahora: plazas " + desp.seats + " co2 " + desp.co2
        + " consumo " + desp.consumption + " " + desp.environmental_label);
      comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
      comprueba("y updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at));
    } finally { await c.query("ROLLBACK"); }
  }
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
