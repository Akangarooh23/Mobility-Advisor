/**
 * Clicars – Verificar ofertas activas
 *
 * El origen de n8n-workflows/clicars-verificar-activas.json.
 *
 *   node scripts/genera-verificador-clicars.js
 *   npm run test:clicars-verify
 *
 * ── Por qué aquí no vale mirar el código HTTP ──────────────────────────────
 *
 * En los demás portales un 410 o un 404 significan «vendido» y con eso basta.
 * Aquí no: medido sobre 30 ofertas, la mayoría de los coches VENDIDOS responden
 * 200 con su ficha entera. Lo que cambia es una línea del JSON-LD:
 *
 *     "availability": "https://schema.org/InStock"      <- sigue a la venta
 *     "availability": "https://schema.org/OutOfStock"   <- vendido
 *
 * Fiarse del 200 nos habría dejado 2.788 ofertas dadas por vivas de las que el
 * portal solo tiene 1.257.
 *
 * ── Y por qué se pregunta por el id, no por la url guardada ────────────────
 *
 * Clicars sirve dos formas de url, y la que teníamos guardada en 2.083 de las
 * 2.788 filas es la página de la VERSIÓN, compartida por hasta 18 coches. Esa
 * no dice nada de ninguno en concreto: preguntándole, 10 de 30 devolvían la
 * ficha de OTRO coche.
 *
 * El portal resuelve por el id:
 *
 *     /coches-segunda-mano-ocasion/comprar-coche-139250
 *
 * Así que la url se construye aquí con el id y no se usa la guardada. Y aun
 * así se comprueba que el `sku` de la ficha sea el nuestro antes de dar nada
 * por bueno: escribir sobre el coche equivocado no se deshace.
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

/*
 * 700 por pasada, 4 pasadas: las 2.788 activas se repasan enteras cada día.
 *
 * Aquí hay que traerse la ficha entera -215 KB- porque la respuesta que decide
 * está dentro, no en el código HTTP. Son unos 150 MB por pasada.
 *
 * Sin nodo Wait, como todos desde el 15-sep: costaba casi 4 segundos por vuelta
 * -no el 1 que declaraba- porque n8n guarda el estado para poder reanudar.
 */
const LOTE = 700;
const SEGUNDOS_POR_OFERTA = 0.9;
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;
/*
 * Y el freno de mortandad: dar de baja media cola no es que Clicars haya
 * vendido su parque.
 *
 * Hoy la mortandad real es altísima -80 % tras un mes parado- así que el tope
 * va alto a propósito: 0,9. Lo que tiene que cazar es un cambio del portal que
 * haga fallar la lectura en todas, no un mal mes.
 */
const MINIMO_PARA_JUZGAR = 100;
const TOPE_MORTANDAD = 0.9;

const COLA = `-- Las activas de Clicars, las que llevan más tiempo sin mirar primero.
SELECT id FROM moveadvisor_market_offers
WHERE portal = 'clicars' AND is_active
ORDER BY last_checked_at NULLS FIRST
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos, guarda de cola vacía y la url por id.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.cv_run || s.cv_run !== $execution.id) {
  s.cv_run = $execution.id;
  s.cv_parado = false;
  s.cv_pedidas = 0;
  s.cv_vivas = 0;
  s.cv_bajas = 0;
  s.cv_otro = 0;
  s.cv_fallos = 0;
  s.cv_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
// Así cayeron cuatro ejecuciones de Gamboa el 2026-09-07.
if (!item || !item.id) {
  console.log('[cl-verify] no hay nada que verificar ahora mismo.');
  return [{ json: { url: '', id: '' } }];
}
if (s.cv_parado) return [{ json: { url: '', id: String(item.id) } }];

// La url se construye con el id: la guardada puede ser la de la versión, que
// comparten hasta 18 coches.
const numero = String(item.id).split('_')[1] || '';
if (!numero) return [{ json: { url: '', id: String(item.id) } }];
return [{ json: {
  id: String(item.id),
  url: 'https://www.clicars.com/coches-segunda-mano-ocasion/comprar-coche-' + numero,
} }];`;

const CODE = `// Clicars - ¿sigue a la venta?
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const id = String(oferta.id || '');
const s = $getWorkflowStaticData('global');

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const baja = (motivo) => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET is_active = FALSE, last_checked_at = NOW()'
    + ' WHERE id = ' + esc(id),
  veredicto: motivo,
} }];
const sigue = () => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET last_checked_at = NOW() WHERE id = ' + esc(id),
  veredicto: 'viva',
} }];

if (!id) return [{ json: { sql: null, veredicto: 'sin id' } }];
s.cv_pedidas = (s.cv_pedidas || 0) + 1;

// Un 403, un 429 o un 500 no dicen nada de la oferta: no se toca.
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.cv_fallos = (s.cv_fallos || 0) + 1;
  const pedidas = s.cv_pedidas || 0;
  if (pedidas >= ${MINIMO_PARA_BLOQUEO} && (s.cv_fallos / pedidas) > ${TOPE_BLOQUEO}) {
    s.cv_parado = true;
    s.cv_motivo = Math.round(100 * s.cv_fallos / pedidas) + '% de respuestas cerradas en '
      + pedidas + ' intentos: nos han bloqueado';
    console.log('[cl-verify] PARADO: ' + s.cv_motivo);
  }
  return [{ json: { sql: null, veredicto: 'pasajero' } }];
}

/*
 * Una redirección NO es una baja, y casi me cuesta cara.
 *
 * La primera versión daba por vendido todo lo que redirigiera. Probándolo con
 * fichas de verdad, DIEZ DE DIEZ redirigían... y al seguirlas, dos de cada
 * cuatro acababan en una página cuyo sku era el nuestro: coches vivos que
 * habría dado de baja.
 *
 * Clicars redirige por dos motivos distintos y solo uno es la muerte:
 *
 *     comprar-coche-138159  ->  /smart/3/3-premium-...   sku 138159   VIVO
 *     comprar-coche-138326  ->  /                        la home     ya no está
 *
 * Así que el nodo sigue las redirecciones y se decide por lo que haya al final.
 * Aquí solo quedan los códigos que sí son definitivos.
 */
if (codigo === 404 || codigo === 410) {
  s.cv_bajas = (s.cv_bajas || 0) + 1;
  return baja('no existe');
}
if (codigo !== 200 || !cuerpo) {
  s.cv_fallos = (s.cv_fallos || 0) + 1;
  return [{ json: { sql: null, veredicto: 'sin ficha' } }];
}

/*
 * El bloque JSON-LD del coche, que es el que lleva sku y availability.
 *
 * Se recorren todos los bloques y se coge el que tenga sku: la ficha trae
 * varios -migas de pan, organización- y solo uno es el coche.
 */
let ld = null;
for (const trozo of cuerpo.split('application/ld+json').slice(1)) {
  const ini = trozo.indexOf('>');
  const fin = trozo.indexOf('</script>');
  if (ini === -1 || fin === -1) continue;
  let j = null;
  try { j = JSON.parse(trozo.slice(ini + 1, fin).trim()); } catch (e) { continue; }
  if (j && j.sku !== undefined) { ld = j; break; }
}
/*
 * Sin bloque de coche, la redirección ha acabado en otro sitio -la home, un
 * listado- y eso SÍ es que la oferta ya no está. Medido sobre 20: le pasa al
 * 40 %, y es la baja más común de este portal.
 */
if (!ld) {
  s.cv_bajas = (s.cv_bajas || 0) + 1;
  return baja('la url ya no lleva a ningún coche');
}

/*
 * Que la ficha sea la de NUESTRO coche.
 *
 * Con la url por id esto debería cumplirse siempre, pero comprobarlo cuesta una
 * línea y equivocarse no se deshace: preguntando por la url que teníamos
 * guardada, 10 de cada 30 devolvían la ficha de otro coche.
 */
const numero = id.split('_')[1] || '';
if (String(ld.sku) !== numero) {
  s.cv_otro = (s.cv_otro || 0) + 1;
  s.cv_bajas = (s.cv_bajas || 0) + 1;
  return baja('la ficha es de otro coche (' + ld.sku + ')');
}

const disponible = String((ld.offers || {}).availability || '');
if (disponible.indexOf('InStock') !== -1) {
  s.cv_vivas = (s.cv_vivas || 0) + 1;
  return sigue();
}
if (disponible.indexOf('OutOfStock') !== -1 || disponible.indexOf('SoldOut') !== -1) {
  s.cv_bajas = (s.cv_bajas || 0) + 1;
  return baja('vendida');
}
// Sin disponibilidad no se decide: ni viva ni muerta.
s.cv_fallos = (s.cv_fallos || 0) + 1;
return [{ json: { sql: null, veredicto: 'sin disponibilidad' } }];`;

const CODE_RESUMEN = `// El parte de la pasada, y el freno de mortandad.
const s = $getWorkflowStaticData('global');
const pedidas = s.cv_pedidas || 0;
const bajas = s.cv_bajas || 0;
const decididas = bajas + (s.cv_vivas || 0);

console.log('[cl-verify] ── resumen ──');
console.log('  fichas pedidas   : ' + pedidas);
console.log('  siguen vivas     : ' + (s.cv_vivas || 0));
console.log('  BAJAS            : ' + bajas);
console.log('  de ellas, «era otro coche»: ' + (s.cv_otro || 0));
console.log('  sin poder decidir: ' + (s.cv_fallos || 0));
if (s.cv_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.cv_motivo);
// Una pasada que pide fichas y no decide ninguna no es un éxito: o el portal ha
// cambiado el formato, o nos han cerrado.
if (!s.cv_parado && pedidas > 0 && decididas === 0) {
  console.log('  OJO: ni una decidida. O Clicars ha cambiado la ficha, o nos han cerrado.');
}
/*
 * El techo de mortandad se mira AQUÍ, no al dar cada baja: las bajas ya están
 * escritas. Lo que hace es dejarlo dicho en el parte, que es donde se mira si
 * algo va mal. Va al 90 % a propósito: la mortandad real de este portal tras un
 * mes parado es del 80 %, así que un tope bajo saltaría cada día sin motivo.
 */
const mortandad = decididas ? (bajas / decididas) : 0;
const sospechosa = decididas >= ${MINIMO_PARA_JUZGAR} && mortandad > ${TOPE_MORTANDAD};
if (sospechosa) {
  console.log('  OJO: ' + Math.round(mortandad * 100) + '% de bajas. Eso no es un mal mes,'
    + ' es que algo ha cambiado en el portal.');
}

const n = v => String(Number(v) || 0);
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('clicars', NOW(), " + n(pedidas) + ', ' + n(s.cv_vivas) + ', '
  + n(bajas) + ', ' + n(s.cv_otro) + ', ' + n(s.cv_fallos) + ', '
  + ((s.cv_parado || sospechosa) ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: pedidas, vivas: s.cv_vivas || 0, bajas: bajas,
  eraOtro: s.cv_otro || 0, fallos: s.cv_fallos || 0, parado: !!s.cv_parado,
  mortandad: Math.round(mortandad * 100) };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('cv_') === 0) delete s[k]; }
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

const L = (n) => ({ node: n, type: "main", index: 0 });
// Lejos del scraper de Clicars (9:35 y 21:35), que comparte dominio.
const CRON = "4 veces/día (11:50, 14:50, 17:50 y 22:50)";
const nodos = [
  { parameters: {}, id: "cv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 50 11,14,17,22 * * *" }] } },
    id: "cv-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "cv-cola", name: "PG: Cola a verificar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "cv-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "cv-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("cv-c-url", "url"), id: "cv-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [340, 420] },
  { parameters: {
      url: "={{ $json.url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ] },
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 30000,
        /*
         * SIGUIENDO las redirecciones, al revés que en los demás portales.
         *
         * Aquí una redirección no dice si el coche está o no: Clicars redirige
         * tanto a la ficha del mismo coche -normalizando la url- como a la
         * home. Solo se sabe mirando dónde acaba, y el sku que haya allí.
         */
        redirect: { redirect: { followRedirects: true } },
      },
    }, id: "cv-http", name: "HTTP: ¿sigue la ficha?",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "cv-code", name: "Code: ¿sigue a la venta?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("cv-c-sql", "sql"), id: "cv-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cv-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "cv-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cv-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":      { main: [[L("PG: Cola a verificar")]] },
  [CRON]:                      { main: [[L("PG: Cola a verificar")]] },
  "PG: Cola a verificar":      { main: [[L("Loop: oferta por oferta")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada item. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: oferta por oferta":   { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":      { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: ¿sigue la ficha?")], [L("Loop: oferta por oferta")]] },
  "HTTP: ¿sigue la ficha?":    { main: [[L("Code: ¿sigue a la venta?")]] },
  "Code: ¿sigue a la venta?":  { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":     { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":             { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Clicars – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "clicars-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + LOTE + " por pasada, " + PASADAS
  + " pasadas/día = " + (LOTE * PASADAS).toLocaleString("es") + " al día");
console.log("  con 2.788 activas: se repasan enteras cada día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");
