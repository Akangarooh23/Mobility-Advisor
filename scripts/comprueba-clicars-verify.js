/**
 * Comprueba el verificador de Clicars.
 *
 *   npm run test:clicars-verify
 *
 * Pide fichas de verdad y se las da a los nodos Code tal como están en el JSON
 * del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK, que
 * se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE NO SE FÍE DEL 200. En Clicars la mayoría de los coches vendidos
 *     responden 200 con su ficha entera; lo que cambia es «availability»
 *     OutOfStock. Un verificador que mire el código HTTP daría por vivas las
 *     2.788 cuando el portal solo tiene 1.257.
 *   - QUE PREGUNTE POR EL ID. La url guardada en 2.083 de 2.788 filas es la
 *     página de la VERSIÓN, compartida por hasta 18 coches: preguntándole, 10
 *     de cada 30 devolvían la ficha de otro.
 *   - Y que aun así compruebe el sku antes de decidir.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "clicars-verificar-activas.json"), "utf8"));
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
function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: "r1" }, { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });

/** Una oferta pasa por «¿toca pedirla?» y por el Code que decide. */
function pasa(oferta, respuesta, estatico) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (!item.url) return { saltada: true, json: {}, url: "" };
  const v = ejecuta(codigo("Code: ¿sigue a la venta?"), {
    estatico,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (v.items[0] || { json: {} }).json, url: item.url };
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
/** Una ficha inventada con el sku y la disponibilidad que se quieran. */
const ficha = (sku, disponibilidad) => ({
  statusCode: 200,
  data: '<script type="application/ld+json">' + JSON.stringify({
    "@type": "Car", sku: String(sku), name: "Un coche",
    offers: { "@type": "Offer", availability: "https://schema.org/" + disponibilidad },
  }) + "</script>",
});

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("no pisa al scraper de Clicars (9:35 y 21:35)",
    !horas.some((h) => h === 9 || h === 21), "horas " + horas.join(","));
  comprueba("el nodo HTTP manda User-Agent", http.parameters.sendHeaders === true && !!H["User-Agent"]);
  // SIGUE las redirecciones, al reves que los demas: aqui una redireccion no
  // dice si el coche esta o no. Dando el 301 por muerte, diez de diez fichas
  // reales salian «vendidas» y dos de cada cuatro seguian a la venta.
  comprueba("SIGUE las redirecciones y decide por donde acaban",
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
  const baseN8n = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");
  if (fs.existsSync(baseN8n)) {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(baseN8n, { readOnly: true });
    const existen = new Set(db.prepare("SELECT id FROM credentials_entity WHERE type='postgres'").all().map((x) => x.id));
    db.close();
    comprueba("la credencial de Postgres existe en n8n",
      existen.has(nodo("PG: Actualizar oferta").credentials.postgres.id));
  }

  // ══ la url por id ════════════════════════════════════════════════════════
  console.log("\nPREGUNTA POR EL ID, NO POR LA URL GUARDADA");
  const conUrlMala = pasa({ id: "clc_139250", url: "https://www.clicars.com/coches-segunda-mano-ocasion/toyota/yaris/yaris-1-0" },
    ficha("139250", "InStock"), {});
  comprueba("construye comprar-coche-<id>",
    conUrlMala.url.indexOf("/comprar-coche-139250") !== -1, conUrlMala.url.slice(38));
  comprueba("y no usa la de la versión", conUrlMala.url.indexOf("/toyota/yaris/") === -1);

  // ══ lo que decide ════════════════════════════════════════════════════════
  console.log("\nLA DISPONIBILIDAD MANDA, NO EL CÓDIGO HTTP");
  const viva = pasa({ id: "clc_139250" }, ficha("139250", "InStock"), {});
  comprueba("200 + InStock -> sigue viva", viva.json.veredicto === "viva"
    && String(viva.json.sql).indexOf("is_active = FALSE") === -1);
  const vendida = pasa({ id: "clc_139250" }, ficha("139250", "OutOfStock"), {});
  comprueba("200 + OutOfStock -> BAJA, aunque responda 200",
    String(vendida.json.sql).indexOf("is_active = FALSE") !== -1, vendida.json.veredicto);
  const otro = pasa({ id: "clc_139250" }, ficha("999999", "InStock"), {});
  comprueba("200 + el sku es de otro coche -> baja y se dice",
    String(otro.json.sql).indexOf("is_active = FALSE") !== -1
    && String(otro.json.veredicto).indexOf("otro coche") !== -1, otro.json.veredicto);
  // Ya no llega ningun 3xx al Code -el nodo los sigue-, pero si la redireccion
  // acaba en una pagina sin coche, eso si es una baja.
  const sinCoche = pasa({ id: "clc_139250" }, { statusCode: 200, data: "<html>la home</html>" }, {});
  comprueba("acabar en una página sin coche -> baja",
    String(sinCoche.json.sql).indexOf("is_active = FALSE") !== -1, sinCoche.json.veredicto);
  const sinDisp = pasa({ id: "clc_139250" }, ficha("139250", "Cualquiera"), {});
  comprueba("sin disponibilidad reconocible NO se decide", sinDisp.json.sql === null,
    sinDisp.json.veredicto);
  const est = {};
  const bloqueo = pasa({ id: "clc_139250" }, { statusCode: 403, data: "" }, est);
  comprueba("un 403 no toca la oferta", bloqueo.json.sql === null, bloqueo.json.veredicto);

  console.log("\nEL CORTACIRCUITOS");
  const bl = {};
  let pedidas = 0, saltadas = 0;
  for (let i = 0; i < 120; i++) {
    const r = pasa({ id: "clc_1392" + (i % 10) }, { statusCode: 403, data: "" }, bl);
    if (r.saltada) saltadas++; else pedidas++;
  }
  comprueba("para si nos cierran la puerta", saltadas > 0, pedidas + " pedidas antes de parar");
  const sanas = {};
  let seguidas = 0;
  for (let i = 0; i < 120; i++) {
    if (!pasa({ id: "clc_139250" }, ficha("139250", "InStock"), sanas).saltada) seguidas++;
  }
  comprueba("y NO para cuando todo va bien", seguidas === 120, seguidas + " de 120");

  console.log("\nEL PARTE");
  const parte = ejecuta(codigo("Code: Resumen"), { estatico: sanas, $: () => uno({}), $input: uno({}) }).items[0].json;
  comprueba("apunta la pasada", String(parte.sql).indexOf("'clicars'") !== -1);
  comprueba("y deja la memoria limpia", !Object.keys(sanas).some((k) => k.indexOf("cv_") === 0));
  // Una mortandad imposible tiene que quedar dicha en el parte.
  const masacre = {};
  for (let i = 0; i < 150; i++) pasa({ id: "clc_1392" + i }, ficha("1392" + i, "OutOfStock"), masacre);
  const parteMasacre = ejecuta(codigo("Code: Resumen"), { estatico: masacre, $: () => uno({}), $input: uno({}) }).items[0].json;
  comprueba("una pasada con el 100% de bajas se marca como sospechosa",
    String(parteMasacre.sql).indexOf("TRUE, 0)") !== -1, parteMasacre.mortandad + "% de bajas");

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nDIEZ FICHAS REALES");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const q = await c.query(nodo("PG: Cola a verificar").parameters.query);
  comprueba("la cola devuelve ofertas", q.rows.length > 0, q.rows.length + " esperando");

  const cuenta = {};
  let decididas = 0;
  for (const fila of q.rows.slice(0, 10)) {
    const t = ejecuta(codigo("Code: ¿toca pedirla?"), { estatico: {}, $: () => uno({}), $input: uno(fila) });
    const url = t.items[0].json.url;
    // Siguiendo las redirecciones, igual que el nodo HTTP del workflow: si el
    // test pide de otra manera que el workflow, no está probando el workflow.
    const r = await fetch(url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(30000) });
    const cuerpo = r.status === 200 ? await r.text() : "";
    const out = pasa(fila, { statusCode: r.status, data: cuerpo }, {});
    cuenta[out.json.veredicto] = (cuenta[out.json.veredicto] || 0) + 1;
    if (out.json.sql) decididas++;
    console.log("      " + String(fila.id).padEnd(13) + "HTTP " + String(r.status).padStart(3)
      + "   " + String(out.json.veredicto).slice(0, 40));
    await dormir(700);
  }
  console.log("\n      " + JSON.stringify(cuenta));
  // Se cuenta si DECIDIÓ -si salió un SQL-, no si el veredicto se llama de una
  // manera concreta: la lista de nombres se quedó vieja en cuanto añadí «la url
  // ya no lleva a ningún coche», y el test falló con el código bien.
  comprueba("decide casi todas", decididas >= 8, decididas + " de 10");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  await c.query("BEGIN");
  try {
    const id = q.rows[0].id;
    const sql = "UPDATE moveadvisor_market_offers SET is_active = FALSE, last_checked_at = NOW() WHERE id = '"
      + id + "'";
    const res = await c.query(sql);
    comprueba("el SQL de baja casa con una oferta nuestra", res.rowCount === 1);
  } finally { await c.query("ROLLBACK"); }
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
