/**
 * Comprueba el verificador de OcasionPlus.
 *
 *   npm run test:ocasionplus-verify
 *
 * Este verificador se fía de una lista: el sitemap del portal. Con una sola
 * petición decide sobre 10.209 ofertas, y eso lo hace barato y peligroso a la
 * vez. Si la lista viene mal —media, cortada, con otro formato— «no está en la
 * lista» deja de significar «se ha vendido».
 *
 * Así que lo que hay que demostrar no es que dé bajas, sino que NO LAS DA
 * cuando la lista no es de fiar:
 *
 *   1. Un sitemap cortado a la mitad no da de baja medio catálogo.
 *   2. Una mortandad imposible tampoco.
 *   3. Y si el portal no contesta, no pasa nada.
 *
 * Además se pide su sitemap de verdad, una vez: es lo único que demuestra que
 * el formato sigue siendo el que creemos.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "ocasionplus-verificar-activas.json"), "utf8"));
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
  const r = f(ctx.$ || (() => ({ all: () => [] })), ctx.$input, () => ctx.estatico,
    { id: "r1" }, { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const varios = (arr) => ({ first: () => ({ json: arr[0] }), all: () => arr.map((j) => ({ json: j })) });

/** Una pasada de mentira: nuestras ofertas contra un sitemap dado. */
function cruza(nuestras, xml, estado) {
  const s = {};
  const r = ejecuta(codigo("Code: Cruzar con su catálogo"), {
    estatico: s,
    $input: uno({ data: xml, statusCode: estado === undefined ? 200 : estado }),
    $: (n) => (n === "PG: Las que damos por vivas" ? varios(nuestras) : uno({})),
  });
  return { items: r.items.map((x) => x.json), estatico: s, log: r.log };
}
const sitemapCon = (urls) => '<?xml version="1.0"?><urlset>'
  + urls.map((u) => "<loc>" + u + "</loc>").join("") + "</urlset>";
const coches = (n, desde) => Array.from({ length: n },
  (_, i) => "https://www.ocasionplus.com/coches-segunda-mano/coche-" + ((desde || 0) + i));

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("al menos una pasada al día", horas.length >= 1, horas.length + " pasadas");
  comprueba("el nodo HTTP manda User-Agent", http.parameters.sendHeaders === true && !!H["User-Agent"]);
  comprueba("ninguna cabecera en options.headers, que typeVersion 4 ignora",
    !(http.parameters.options || {}).headers);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("pide el sitemap UNA vez, no una por oferta", http.executeOnce === true);
  comprueba("y con tiempo de sobra: son casi 3 MB",
    (http.parameters.options || {}).timeout >= 60000, (http.parameters.options || {}).timeout + " ms");
  comprueba("los nodos de Postgres reintentan",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("el workflow avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  const salidas = wf.connections["Loop: trozo a trozo"].main;
  comprueba("el bucle va al resumen al terminar, no a escribir",
    salidas[0][0].node === "Code: Resumen" && salidas[1][0].node === "PG: Dar de baja");
  comprueba("sin bajas que dar se apunta el parte igual",
    wf.connections["IF: ¿se dan las bajas?"].main[1][0].node === "Code: Resumen");
  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ el caso normal ═══════════════════════════════════════════════════════
  console.log("\nUNA PASADA NORMAL");
  const nuestras = coches(100).map((u, i) => ({ id: "op_" + i, url: u }));
  // De las 100, 80 siguen en su catálogo y 20 se han vendido.
  const normal = cruza(nuestras, sitemapCon(coches(80).concat(coches(30, 500))));
  comprueba("da de baja solo las que faltan", normal.estatico.op_muertas === 20,
    normal.estatico.op_muertas + " bajas de 100");
  comprueba("y cuenta bien las vivas", normal.estatico.op_vivas === 80);
  comprueba("el SQL solo toca esas", (normal.items[0].sql.match(/op_/g) || []).length === 20);
  comprueba("la barra final no cuenta: /coche-1 y /coche-1/ son el mismo",
    cruza([{ id: "op_x", url: "https://www.ocasionplus.com/coches-segunda-mano/coche-1/" }],
      sitemapCon(["https://www.ocasionplus.com/coches-segunda-mano/coche-1"])).estatico.op_muertas === 0);

  // ══ los frenos ═══════════════════════════════════════════════════════════
  console.log("\nFRENO 1: UN SITEMAP CORTADO NO DA DE BAJA MEDIO CATÁLOGO");
  const entero = sitemapCon(coches(80));
  const cortado = entero.slice(0, Math.round(entero.length * 0.4));
  const roto = cruza(nuestras, cortado);
  comprueba("con el XML sin cerrar, ni una baja", roto.items[0].sql === null);
  comprueba("y el parte dice por qué", /cortado/.test(roto.estatico.op_motivo || ""),
    roto.estatico.op_motivo);

  console.log("\nFRENO 2: UNA MORTANDAD IMPOSIBLE ES LA LISTA ROTA");
  const masacre = cruza(nuestras, sitemapCon(coches(20)));
  comprueba("si faltan el 80%, ni una baja", masacre.items[0].sql === null);
  comprueba("y el parte dice por qué", /80%/.test(masacre.estatico.op_motivo || ""),
    masacre.estatico.op_motivo);
  const limite = cruza(nuestras, sitemapCon(coches(65)));
  comprueba("un 35% sí pasa: es un mes sin mirar", limite.items[0].sql !== null,
    limite.estatico.op_muertas + " bajas");

  console.log("\nFRENO 3: SI NO CONTESTA, NO PASA NADA");
  for (const [nombre, xml, estado] of [
    ["el portal devuelve 503", "", 503],
    ["la petición se cae", "", 0],
    ["contesta 200 pero vacío", "", 200],
  ]) {
    const r = cruza(nuestras, xml, estado);
    comprueba(nombre + ": ni una baja", r.items[0].sql === null, r.estatico.op_motivo);
  }

  console.log("\nY CUANDO NO HAY NADA QUE HACER");
  const limpio = cruza(nuestras, sitemapCon(coches(100)));
  comprueba("todas siguen: ni una baja y sin freno",
    limpio.items[0].sql === null && !limpio.estatico.op_motivo && limpio.estatico.op_nada === true);

  // ══ el parte ═════════════════════════════════════════════════════════════
  console.log("\nEL PARTE");
  const parte = ejecuta(codigo("Code: Resumen"),
    { estatico: normal.estatico, $input: uno({}) }).items[0].json;
  comprueba("apunta la pasada", String(parte.sql).indexOf("'ocasionplus'") !== -1);
  comprueba("con las bajas de verdad", parte.bajas === 20, "bajas " + parte.bajas);
  comprueba("y deja la memoria limpia",
    !Object.keys(normal.estatico).some((k) => k.indexOf("op_") === 0));
  const parteFrenado = ejecuta(codigo("Code: Resumen"),
    { estatico: masacre.estatico, $input: uno({}) }).items[0].json;
  comprueba("una pasada frenada NO apunta bajas que no dio",
    parteFrenado.bajas === 0 && String(parteFrenado.sql).indexOf("TRUE, 0)") !== -1);

  // ══ su sitemap, de verdad ════════════════════════════════════════════════
  console.log("\nSU SITEMAP, DE VERDAD (una petición)");
  const t0 = Date.now();
  const r = await fetch(http.parameters.url, { headers: H, signal: AbortSignal.timeout(120000) });
  const xml = await r.text();
  console.log("      HTTP " + r.status + "   " + Math.round(xml.length / 1024) + " KB   "
    + (Date.now() - t0) + " ms");
  comprueba("responde", r.status === 200);
  comprueba("llega entero", xml.trim().slice(-9) === "</urlset>");
  const suyas = (xml.match(/<loc>/g) || []).length;
  comprueba("y trae su catálogo", suyas > 5000, suyas.toLocaleString("es") + " fichas");

  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const mias = (await c.query(nodo("PG: Las que damos por vivas").parameters.query)).rows;
  await c.end();
  const real = cruza(mias, xml);
  console.log("\n  CONTRA LOS DATOS DE VERDAD");
  console.log("      dábamos por vivas : " + mias.length.toLocaleString("es"));
  console.log("      siguen en su lista: " + (real.estatico.op_vivas || 0).toLocaleString("es"));
  console.log("      se han vendido    : " + (real.estatico.op_muertas || 0).toLocaleString("es")
    + "   (" + Math.round(100 * (real.estatico.op_muertas || 0) / (mias.length || 1)) + "%)");
  comprueba("la pasada de verdad pasaría los frenos", !real.estatico.op_motivo,
    real.estatico.op_motivo || "sin frenos");

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
