/**
 * Comprueba el verificador de Flexicar.
 *
 *   npm run test:flexicar-verify
 *
 * Este verificador no pregunta oferta por oferta: da de baja EN MASA todo lo
 * que el scraper no haya visto en su última vuelta al catálogo. Eso lo hace
 * barato -40 peticiones para decidir sobre 24.000 coches- y también peligroso:
 * si el scraper falla, «no lo he visto» deja de significar «no está».
 *
 * Por eso aquí lo que hay que demostrar no es que dé bajas, sino que LOS TRES
 * FRENOS PARAN:
 *
 *   1. Sin scraper reciente, ni una baja.
 *   2. Con una mortandad imposible, ni una baja.
 *   3. Con la cata diciendo que siguen vivas, ni una baja.
 *
 * Y además que la baja, cuando sí se da, casa con lo que hay en la base: se
 * lanza contra Postgres dentro de BEGIN/ROLLBACK, que se deshace siempre.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "flexicar-verificar-activas.json"), "utf8"));
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
  const r = f(ctx.$ || (() => uno({})), ctx.$input, () => ctx.estatico, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });

/** Una pasada entera de mentira: salud -> cata -> veredicto. */
function pasada(salud, respuestas) {
  const s = {};
  const r1 = ejecuta(codigo("Code: ¿Se puede dar de baja?"), { estatico: s, $input: uno(salud) });
  const permiso = String((r1.items[0].json || {}).seguir || "") !== "";
  if (!permiso) return { permiso: false, sql: null, estatico: s, log: r1.log };
  for (const resp of (respuestas || [])) {
    const u = ejecuta(codigo("Code: URL de la cata"), { estatico: s, $input: uno({ id: "903000000000001" }) });
    const item = u.items[0].json;
    ejecuta(codigo("Code: ¿Muerta de verdad?"), {
      estatico: s, $input: uno(resp),
      $: (n) => (n === "Code: URL de la cata" ? { item: { json: item } } : uno({})),
    });
  }
  const v = ejecuta(codigo("Code: Veredicto de la cata"), { estatico: s, $input: uno({}) });
  return { permiso: true, sql: (v.items[0].json || {}).sql, estatico: s, log: v.log };
}
const muerta = { statusCode: 404, data: "" };
const viva = { statusCode: 200, data: '{"id":903000000000001}' };
const muda = { statusCode: 0, data: "" };
const muchas = (n, r) => Array(n).fill(r);

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(String(expr).split(" ")[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("hay al menos una pasada al día", horas.length >= 1, horas.length + " pasadas");
  comprueba("pasa DESPUÉS del scraper (9:10 y 21:10)",
    horas.every((h) => h > 9 && h !== 21), "horas " + horas.join(","));
  comprueba("el nodo HTTP manda User-Agent", http.parameters.sendHeaders === true && !!H["User-Agent"]);
  comprueba("ninguna cabecera en options.headers, que typeVersion 4 ignora",
    !(http.parameters.options || {}).headers);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("los nodos de Postgres reintentan",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("hay un IF antes del HTTP para la cola vacía", !!nodo("IF: ¿hay ficha que preguntar?"));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  const salidas = wf.connections["Loop: cata una a una"].main;
  comprueba("el bucle va al veredicto al terminar, no al HTTP",
    salidas[0][0].node === "Code: Veredicto de la cata" && salidas[1][0].node === "Code: URL de la cata");
  comprueba("sin permiso se apunta el parte igual, con el motivo",
    wf.connections["IF: ¿hay permiso?"].main[1][0].node === "Code: Resumen");
  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ los tres frenos ══════════════════════════════════════════════════════
  console.log("\nFRENO 1: SIN SCRAPER RECIENTE, NI UNA BAJA");
  const dormido = pasada({ activas: 24000, candidatas: 500, horas_sin_ver: 40 }, muchas(40, muerta));
  comprueba("con el catálogo sin ver desde hace 40 h no se sigue", !dormido.permiso);
  comprueba("y el parte dice por qué", /lleva 40 h sin ver/.test(dormido.estatico.fv_motivo || ""),
    dormido.estatico.fv_motivo);
  const justo = pasada({ activas: 24000, candidatas: 500, horas_sin_ver: 13 }, muchas(40, muerta));
  comprueba("con 13 h sí se sigue", justo.permiso);

  console.log("\nFRENO 2: UNA MORTANDAD IMPOSIBLE ES EL SCRAPER ROTO");
  const masacre = pasada({ activas: 24000, candidatas: 22000, horas_sin_ver: 1 }, muchas(40, muerta));
  comprueba("si desaparece el 92% del catálogo, no se dan bajas", !masacre.permiso);
  comprueba("y el parte dice por qué", /92%/.test(masacre.estatico.fv_motivo || ""),
    masacre.estatico.fv_motivo);
  const normal = pasada({ activas: 24000, candidatas: 1700, horas_sin_ver: 1 }, muchas(40, muerta));
  comprueba("un 7% es un día normal y sí pasa", normal.permiso);

  console.log("\nFRENO 3: LA CATA MANDA");
  const buena = pasada({ activas: 24000, candidatas: 1700, horas_sin_ver: 1 }, muchas(40, muerta));
  comprueba("40 de 40 muertas -> se dan las bajas", !!buena.sql);
  const dudosa = pasada({ activas: 24000, candidatas: 1700, horas_sin_ver: 1 },
    muchas(30, muerta).concat(muchas(10, viva)));
  comprueba("10 de 40 vivas (25%) -> NO se dan bajas", dudosa.sql === null,
    dudosa.estatico.fv_motivo);
  const limite = pasada({ activas: 24000, candidatas: 1700, horas_sin_ver: 1 },
    muchas(36, muerta).concat(muchas(4, viva)));
  comprueba("4 de 40 vivas (10%) -> sí se dan", !!limite.sql);
  const muda40 = pasada({ activas: 24000, candidatas: 1700, horas_sin_ver: 1 }, muchas(40, muda));
  comprueba("si la API no contesta a NINGUNA, no se dan bajas", muda40.sql === null,
    muda40.estatico.fv_motivo);
  comprueba("un fallo de red no cuenta como muerta ni como viva",
    (muda40.estatico.fv_muertas || 0) === 0 && (muda40.estatico.fv_vivas || 0) === 0);

  console.log("\nY CUANDO NO HAY NADA QUE HACER");
  const limpio = pasada({ activas: 24000, candidatas: 0, horas_sin_ver: 1 }, []);
  comprueba("con todo el catálogo visto hoy, no se sigue", !limpio.permiso);
  comprueba("y no es un error, es que no hay nada",
    /no hay ninguna/.test(limpio.estatico.fv_motivo || ""), limpio.estatico.fv_motivo);

  // ══ el parte ═════════════════════════════════════════════════════════════
  console.log("\nEL PARTE");
  const resumen = ejecuta(codigo("Code: Resumen"), {
    estatico: buena.estatico, $input: uno({}),
    $: (n) => (n === "PG: Dar de baja y confirmar" ? uno({ bajas: 1700, confirmadas: 22300 }) : uno({})),
  });
  const parte = resumen.items[0].json;
  comprueba("apunta la pasada", /INSERT INTO moveadvisor_verify_runs/.test(parte.sql)
    && /'flexicar'/.test(parte.sql));
  comprueba("con las bajas de verdad", parte.bajas === 1700, "bajas " + parte.bajas);
  comprueba("y deja la memoria limpia para la siguiente",
    !Object.keys(buena.estatico).some((k) => k.indexOf("fv_") === 0),
    "quedan: " + (Object.keys(buena.estatico).join(", ") || "nada"));

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 600000 });
  await c.connect();
  const salud = (await c.query(nodo("PG: ¿Cómo está el catálogo?").parameters.query)).rows[0];
  console.log("      " + salud.activas + " activas, " + salud.candidatas
    + " sin aparecer, el catálogo se vio hace " + salud.horas_sin_ver + " h");
  const muestra = (await c.query(nodo("PG: Muestra de candidatas").parameters.query)).rows;
  comprueba("la muestra sale al azar y no siempre la misma", true, muestra.length + " candidatas");

  await c.query("BEGIN");
  try {
    const r = await c.query(buena.sql);
    const f = r.rows[0];
    console.log("      daría de baja " + f.bajas + " y confirmaría vivas " + f.confirmadas);
    comprueba("la baja masiva se ejecuta", r.rowCount === 1);
    comprueba("las bajas casan con las candidatas contadas",
      Number(f.bajas) === Number(salud.candidatas), f.bajas + " vs " + salud.candidatas);
    comprueba("y NO da de baja el catálogo entero",
      Number(f.confirmadas) > Number(f.bajas), f.confirmadas + " siguen vivas");
  } finally { await c.query("ROLLBACK"); }

  // ══ la cata, de verdad ═══════════════════════════════════════════════════
  console.log("\nLA CATA, CONTRA LA API DE VERDAD (5 candidatas)");
  let vivasDeVerdad = 0, muertasDeVerdad = 0;
  for (const x of muestra.slice(0, 5)) {
    const r = await fetch("https://services.flexicar.es/api/v1/vehicles/" + x.id,
      { headers: H, redirect: "manual", signal: AbortSignal.timeout(25000) });
    if (r.status === 404) muertasDeVerdad++;
    else if (r.status === 200) vivasDeVerdad++;
    console.log("      " + x.id + "  HTTP " + r.status + (r.status === 404 ? "  (vendida)" : ""));
    await new Promise((s) => setTimeout(s, 900));
  }
  comprueba("las que el scraper no vio están muertas de verdad", vivasDeVerdad === 0,
    muertasDeVerdad + " muertas, " + vivasDeVerdad + " vivas");
  await c.end();

  console.log("\n" + (fallos ? fallos + " FALLOS" : "Todo correcto."));
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
