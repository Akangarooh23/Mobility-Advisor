/**
 * Autocasión – Enriquecer (color, puertas, plazas, potencia, carrocería)
 *
 * El origen de n8n-workflows/autocasion-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-autocasion.js
 *   npm run test:autocasion-enrich
 *
 * ── Lo que estaba mal, y no era poco ───────────────────────────────────────
 *
 * 1. ESCRIBÍA LOS DATOS DE OTRO COCHE. Es lo gordo. La cola no miraba si la URL
 *    guardada era una ficha, y 35.518 ofertas de julio y agosto tienen como URL
 *    un listado de provincia. Al pedirla, el lector cogía el PRIMER coche del
 *    listado y le escribía sus datos a la oferta. Probado el 15-sep contra
 *    /coches-segunda-mano/peugeot-2008-ocasion/madrid:
 *
 *        color = 'Naranja', doors = 6, power_cv = 100, body_type = 'SUV'
 *
 *    Seis puertas. Y el rastro estaba en la base: de las 34 ofertas de
 *    Autocasión con puertas guardadas, 32 tenían más de cinco. 542 ofertas de
 *    URL rota ya habían pasado por aquí.
 *
 *    Ahora hay tres redes: la cola solo coge URLs de ficha, el lector se planta
 *    si la URL no lo es o si la respuesta redirige -una ficha vendida redirige
 *    al listado del modelo-, y un filtro de cordura tira lo imposible.
 *
 * 2. LAS SALIDAS DEL BUCLE ESTABAN CAMBIADAS. En splitInBatches la salida 0 es
 *    TERMINADO y la 1 es cada item; aquí la 0 iba directa al nodo HTTP. O sea
 *    que al acabar el bucle se disparaba una petición de más, con lo que
 *    quedara en el item: es la receta del «URL parameter must be a string, got
 *    undefined» que tumbó cuatro ejecuciones de Gamboa.
 *
 * 3. Sin reintentos en Postgres, sin onError en el HTTP y sin aviso por correo:
 *    fallaba a oscuras. Y el cron a las 6:00, fuera de la franja de 8:00 a
 *    00:00 que pediste.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };
const ERROR_WF = "9BwKOPMIzjj3owho";

// 400 por pasada. El límite es la memoria: una ficha de Autocasión pesa ~250 KB
// y n8n guarda la salida de cada vuelta del bucle, o sea ~100 MB por pasada.
// Sin nodo Wait, como los demás: costaba casi 4 segundos por oferta, no el 1
// que declaraba.
const LOTE = 400;
const SEGUNDOS_POR_OFERTA = 1.5;
// El cortacircuitos de bloqueo, el mismo de los verificadores.
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las ofertas de Autocasión a las que les falta algo de la ficha.
--
-- SOLO URLs DE FICHA. Las que acaban en refNNNNNN identifican un coche; las
-- 35.518 que apuntan a «/marca-modelo-ocasion/madrid» son un listado de
-- provincia, y pedirlas hacía que se escribieran los datos del primer coche de
-- esa lista sobre esta oferta. 542 ya habían pasado por ahí.
--
-- Y solo lo visto vivo hace poco: gastar una ficha en un coche vendido es
-- tirar la petición, y además su ficha redirige al listado del modelo.
SELECT id,
  COALESCE(url, '') AS url,
  COALESCE(color, '') AS color,
  COALESCE(doors, 0)::int AS doors,
  COALESCE(seats, 0)::int AS seats,
  COALESCE(power_cv, 0)::int AS power_cv,
  COALESCE(body_type, '') AS body_type,
  COALESCE(traction, '') AS traction,
  COALESCE(co2, '') AS co2
FROM moveadvisor_market_offers
WHERE portal = 'autocasion'
  AND is_active
  AND url ~ 'ref[0-9]{6,}$'
  AND enrich_tried_at IS NULL
  AND (
    COALESCE(color, '') = ''
    OR COALESCE(doors, 0) = 0
    OR COALESCE(seats, 0) = 0
    OR COALESCE(body_type, '') = ''
  )
-- Primero lo que el scraper acaba de ver: es lo que sigue a la venta y lo que
-- de verdad se usa como comparable.
ORDER BY (last_seen_at > NOW() - INTERVAL '3 days') DESC, scraped_at DESC
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos y guarda de cola vacía, antes de gastar la ficha.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.ac_run || s.ac_run !== $execution.id) {
  s.ac_run = $execution.id;
  s.ac_parado = false;
  s.ac_intentos = 0;
  s.ac_fallos = 0;
  s.ac_leidas = 0;
  s.ac_escritas = 0;
  s.ac_listado = 0;
  s.ac_vendidas = 0;
  s.ac_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[ac-enrich] no hay nada que enriquecer ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { url: '' }) }];
}
if (s.ac_parado) return [{ json: Object.assign({}, item, { url: '' }) }];

return [{ json: item }];`;

// El lector vive aparte porque es largo y porque se le han añadido guardas que
// conviene poder probar solas: scripts/lib/autocasion-enriquecer.js
const CODE_LEER = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "autocasion-enriquecer.js"), "utf8");

const CODE_CONTAR = `// Cuenta lo que ha pasado y decide si nos han bloqueado.
const s = $getWorkflowStaticData('global');
const j = $input.first().json || {};
s.ac_intentos = (s.ac_intentos || 0) + 1;

if (j.veredicto === 'url de listado') s.ac_listado = (s.ac_listado || 0) + 1;
else if (j.veredicto === 'redirige') s.ac_vendidas = (s.ac_vendidas || 0) + 1;
else if (j.hasUpdates) { s.ac_leidas = (s.ac_leidas || 0) + 1; s.ac_escritas = (s.ac_escritas || 0) + 1; }
else s.ac_fallos = (s.ac_fallos || 0) + 1;

// Un 403 o un timeout no dicen nada del coche; mil seguidos dicen que nos han
// cerrado la puerta. Sin este freno, una pasada bloqueada se gasta las ${LOTE}
// ofertas poniendo fechas sin leer ninguna.
const intentos = s.ac_intentos || 0;
if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.ac_fallos / intentos) > ${TOPE_BLOQUEO}) {
  s.ac_parado = true;
  s.ac_motivo = Math.round(100 * s.ac_fallos / intentos) + '% sin poder leer en '
    + intentos + ' intentos: o nos han bloqueado, o el portal ha cambiado';
  console.log('[ac-enrich] PARADO: ' + s.ac_motivo);
}
return [{ json: j }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
console.log('[ac-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.ac_intentos || 0));
console.log('  con datos      : ' + (s.ac_leidas || 0));
console.log('  ya vendidas    : ' + (s.ac_vendidas || 0));
console.log('  URL de listado : ' + (s.ac_listado || 0) + '  (no deberían llegar: la cola las filtra)');
console.log('  sin poder leer : ' + (s.ac_fallos || 0));
if (s.ac_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.ac_motivo);
if (!s.ac_parado && (s.ac_intentos || 0) > 0 && (s.ac_leidas || 0) === 0) {
  console.log('  OJO: ni una ficha leída. Algo ha cambiado en el portal.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='autocasion-enrich':
//     checked  fichas pedidas    alive  con datos
//     deactivated  ya vendidas   unclassified  URL de listado
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('autocasion-enrich', NOW(), " + n(s.ac_intentos) + ', ' + n(s.ac_leidas) + ', '
  + n(s.ac_vendidas) + ', ' + n(s.ac_listado) + ', ' + n(s.ac_fallos) + ', '
  + (s.ac_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.ac_intentos || 0, leidas: s.ac_leidas || 0,
  vendidas: s.ac_vendidas || 0, listado: s.ac_listado || 0,
  fallos: s.ac_fallos || 0, parado: !!s.ac_parado };
// La memoria es del workflow, no de la pasada: sin limpiarla el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('ac_') === 0) delete s[k]; }
return [{ json: parte }];`;

const condicion = (id, campo) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id, leftValue: "={{ $json." + campo + " }}", rightValue: "",
      operator: { type: "string", operation: "notEmpty", singleValue: true } }],
    combinator: "and",
  },
  looseTypeValidation: true,
  options: {},
});

const CRON = "4 veces/día (9:50, 12:50, 17:50 y 22:50)";
const nodos = [
  { parameters: {}, id: "ae-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // Dentro de la franja de 8:00 a 00:00 -antes iba a las 6:00- y fuera de las
  // dos pasadas del scraper de Autocasión (8:20 y 21:20), que tardan lo suyo.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 50 9,12,17,22 * * *" }] } },
    id: "ae-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ae-cola", name: "PG: Ofertas a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "ae-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "ae-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("ae-c-url", "url"), id: "ae-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [340, 420] },
  { parameters: {
      url: "={{ $json.url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 25000,
        // SIN seguir redirecciones: una ficha vendida redirige al listado del
        // modelo, que responde 200 y trae 25 coches que no son este.
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "ae-http", name: "HTTP: Ficha de Autocasión",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE_LEER }, id: "ae-leer",
    name: "Code: Extraer campos y generar SQL",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: { jsCode: CODE_CONTAR }, id: "ae-contar", name: "Code: Contar y vigilar",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1000, 540] },
  { parameters: condicion("ae-c-sql", "updateSql"), id: "ae-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1220, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.updateSql }}", options: {} },
    id: "ae-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1440, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "ae-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ae-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
// La salida 0 del bucle es TERMINADO y la 1 es cada item. Estaban al revés, y
// eso disparaba el HTTP al acabar la pasada.
const conexiones = {
  "Ejecutar manualmente":     { main: [[L("PG: Ofertas a enriquecer")]] },
  [CRON]:                     { main: [[L("PG: Ofertas a enriquecer")]] },
  "PG: Ofertas a enriquecer": { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":  { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":     { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de Autocasión")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de Autocasión": { main: [[L("Code: Extraer campos y generar SQL")]] },
  "Code: Extraer campos y generar SQL": { main: [[L("Code: Contar y vigilar")]] },
  "Code: Contar y vigilar":   { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":    { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":            { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Autocasión – Enriquecer Ofertas",
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: ERROR_WF,
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "autocasion-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, 4 pasadas/día = "
  + (LOTE * 4).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");

// Que las barras hayan sobrevivido: en una cadena "\d" es "d". El regex que
// decide si una URL es una ficha quedó una vez como /refd{6,}$/.
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Extraer campos y generar SQL").parameters.jsCode;
const bien = js.indexOf("/ref[0-9]{6,}$/") >= 0 && js.indexOf("application\\/ld\\+json") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "los regex del lector conservan sus barras");
if (!bien) process.exit(1);
