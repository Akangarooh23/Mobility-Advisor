/**
 * coches.com – Enriquecer (CO₂ y consumo)
 *
 * El origen de n8n-workflows/cochescom-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-cochescom.js
 *   npm run test:cochescom-enrich
 *
 * ── Por qué existe, y por qué solo dos columnas ────────────────────────────
 *
 * El listado de coches.com ya deja al 100% el precio, el año, los kilómetros,
 * el combustible, el cambio, la potencia, la carrocería, las puertas, las
 * plazas y el color. No hace falta pedir la ficha para nada de eso.
 *
 * Lo que falta es CO₂ y consumo, los dos al 3%. Y no es un hueco cosmético: el
 * buscador tiene filtros por ambos, y están escritos de forma que una oferta
 * SIN el dato pasa el filtro igualmente:
 *
 *     if (Number.isFinite(minCo2) && Number.isFinite(offerCo2) && offerCo2 < minCo2)
 *
 * O sea que hoy, si alguien pide «menos de 120 g/km», ve 615.023 coches de los
 * que solo 6.570 cumplen de verdad: el 99% de lo que ve es ruido. Rellenar
 * coches.com no arregla el mercado entero -sube la cobertura global del 3% al
 * 11%- pero sí arregla sus 52.137.
 *
 * ── Qué trae la ficha, medido sobre 11 vivas ───────────────────────────────
 *
 *     data.classified.capabilities.co2Emissions              6 de 11 con valor
 *     data.classified.capabilities.consumptionCombined       6 de 11
 *     data.classified.capabilities.wltpConsumptionCombined   5 de 11
 *
 * Entre consumo combinado y WLTP, las 11 tenían uno de los dos.
 *
 * ── El cero es la trampa ───────────────────────────────────────────────────
 *
 * En las medidas, un gasolina y un diésel traían co2Emissions = 0. Eso NO es un
 * coche que no emite: es que el anuncio no lo declara. Escribir ese 0 lo
 * colocaría en el tramo más limpio de cualquier filtro.
 *
 * Pero un eléctrico SÍ emite 0, y su 0 hay que guardarlo. La ficha del eléctrico
 * medido traía co2 0 y 491 km de autonomía.
 *
 * Así que el 0 solo se guarda si el combustible es eléctrico. En cualquier otro
 * caso se trata como «no declarado» y se deja vacío, que es la verdad.
 *
 * ── Lo que NO arregla ──────────────────────────────────────────────────────
 *
 * La cilindrada. 15.699 de las 30.703 que tienen dato están en LITROS -«1.2»- en
 * vez de en centímetros cúbicos, y la ficha no la declara en ninguna parte. Eso
 * se arregla multiplicando, con scripts/arregla-cilindrada-es.js, que ya cubre
 * todos los portales españoles.
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

// 500 por pasada. El límite aquí es la latencia: coches.com tarda 862 ms en un
// HEAD y una ficha completa bastante más, así que 500 son unos 15 minutos.
//
// Sin nodo Wait, como todos desde el 15-sep: costaba casi 4 segundos por vuelta
// -no el 1 que declaraba- porque n8n guarda el estado para poder reanudar.
const LOTE = 500;
const SEGUNDOS_POR_OFERTA = 1.8;
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las ofertas de coches.com a las que les falta CO₂ o consumo.
--
-- Solo lo VISTO VIVO hace poco: last_seen_at, no last_checked_at. La diferencia
-- es que la primera dice «lo vimos vivo» y la segunda solo «lo intentamos», y
-- gastar una ficha en un coche vendido es tirar la petición. Lo aprendimos en
-- AutoScout24 España, donde la primera versión de la cola traía seis coches
-- muertos de cada seis.
SELECT id, url, COALESCE(fuel, '') AS fuel,
  COALESCE(co2, '') AS co2, COALESCE(consumption, 0) AS consumption
FROM moveadvisor_market_offers
WHERE portal = 'cochescom'
  AND is_active
  AND COALESCE(url, '') <> ''
  AND enrich_tried_at IS NULL
  AND (COALESCE(co2, '') = '' OR COALESCE(consumption, 0) = 0)
ORDER BY (last_seen_at > NOW() - INTERVAL '3 days') DESC, scraped_at DESC
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos y guarda de cola vacía, antes de gastar la ficha.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.ce_run || s.ce_run !== $execution.id) {
  s.ce_run = $execution.id;
  s.ce_parado = false;
  s.ce_intentos = 0;
  s.ce_fallos = 0;
  s.ce_leidas = 0;
  s.ce_co2 = 0;
  s.ce_consumo = 0;
  s.ce_vendidas = 0;
  s.ce_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
// Así cayeron cuatro ejecuciones de Gamboa el 2026-09-07.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[cc-enrich] no hay nada que enriquecer ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { url: '' }) }];
}
if (s.ce_parado) return [{ json: Object.assign({}, item, { url: '' }) }];

return [{ json: item }];`;

const CODE = `// coches.com - de la ficha a CO₂ y consumo.
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const id = String(oferta.id || '');
const s = $getWorkflowStaticData('global');

const esc = v => (v === null || v === undefined || v === '') ? 'NULL'
  : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

// enrich_tried_at se mueve pase lo que pase: sin eso, una ficha que falla vuelve
// en cada pasada y la cola no avanza nunca.
const soloIntento = (motivo) => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(id),
  veredicto: motivo,
} }];

if (!id) return [{ json: { sql: null, veredicto: 'sin id' } }];

s.ce_intentos = (s.ce_intentos || 0) + 1;
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.ce_fallos = (s.ce_fallos || 0) + 1;
  const intentos = s.ce_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.ce_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.ce_parado = true;
    s.ce_motivo = Math.round(100 * s.ce_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[cc-enrich] PARADO: ' + s.ce_motivo);
  }
  // Un 403 no dice nada de la oferta: NO gasta su intento, vuelve a la cola.
  return [{ json: { sql: null, veredicto: 'pasajero' } }];
}
// Un 410 aquí significa vendida, y un 3xx tampoco trae ficha.
if (codigo !== 200 || !cuerpo) {
  s.ce_vendidas = (s.ce_vendidas || 0) + 1;
  return soloIntento(codigo === 410 ? 'vendida' : 'sin ficha');
}

let cl = null;
try {
  const m = cuerpo.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) cl = ((JSON.parse(m[1]).props || {}).pageProps || {}).data;
  cl = cl ? cl.classified : null;
} catch (e) { cl = null; }
if (!cl) return soloIntento('ficha sin datos');

s.ce_leidas = (s.ce_leidas || 0) + 1;
const cap = cl.capabilities || {};
const num = x => { const n = Number(x); return Number.isFinite(n) ? n : null; };

// ── el CO₂, y la trampa del cero ───────────────────────────────────────────
//
// Un gasolina con co2Emissions = 0 no es un coche que no emite: es un anuncio
// que no lo declara. Guardar ese 0 lo colocaria en el tramo mas limpio de
// cualquier filtro. Pero un electrico SI emite 0 y ese 0 hay que guardarlo.
// Sin tildes antes de comparar: "eléctrico".indexOf('lectric') es -1, porque la
// é parte la palabra en "léctric". La primera versión dejaba SIN CO₂ justo a los
// eléctricos, que son los únicos cuyo 0 es verdad. Lo cazó el test con tres
// fichas reales seguidas.
const combustible = String(oferta.fuel || '')
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const esElectrico = combustible.indexOf('electric') !== -1;
const co2raw = num(cap.co2Emissions);
const co2 = (co2raw === null) ? null
  : (co2raw > 0 ? Math.round(co2raw) : (esElectrico ? 0 : null));

// ── el consumo ─────────────────────────────────────────────────────────────
// El combinado primero y el WLTP después: de 11 fichas, 6 traían el primero y 5
// solo el segundo, así que entre los dos estaban las 11.
const consumo = num(cap.consumptionCombined) > 0 ? num(cap.consumptionCombined)
  : (num(cap.wltpConsumptionCombined) > 0 ? num(cap.wltpConsumptionCombined) : null);

const sets = ['enrich_tried_at = NOW()'];
// co2 es varchar y consumption numérica: NULLIF(varchar, 0) da "operator does
// not exist: character varying = integer" y tumba el UPDATE entero.
if (co2 !== null) sets.push("co2 = COALESCE(NULLIF(co2, ''), " + esc(String(co2)) + ')');
if (consumo !== null) sets.push('consumption = COALESCE(NULLIF(consumption, 0), '
  + esc(Math.round(consumo * 100) / 100) + ')');

if (co2 !== null) s.ce_co2 = (s.ce_co2 || 0) + 1;
if (consumo !== null) s.ce_consumo = (s.ce_consumo || 0) + 1;

// updated_at NO se toca: enriquecer no es que el anuncio haya cambiado, es que
// nosotros nos hemos puesto al día.
console.log('[cc-enrich] ' + id + ': co2=' + (co2 === null ? '-' : co2)
  + ' consumo=' + (consumo === null ? '-' : consumo)
  + (esElectrico ? ' (eléctrico)' : ''));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: (co2 !== null || consumo !== null) ? 'enriquecida' : 'sin datos',
  co2: co2, consumo: consumo, electrico: esElectrico,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.ce_leidas || 0;

console.log('[cc-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.ce_intentos || 0));
console.log('  leídas         : ' + leidas);
console.log('  con CO₂        : ' + (s.ce_co2 || 0));
console.log('  con consumo    : ' + (s.ce_consumo || 0));
console.log('  ya vendidas    : ' + (s.ce_vendidas || 0));
console.log('  sin poder leer : ' + (s.ce_fallos || 0));
if (s.ce_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.ce_motivo);
if (!s.ce_parado && (s.ce_intentos || 0) > 0 && leidas === 0) {
  console.log('  OJO: ni una ficha leída. O el portal ha cambiado, o nos han cerrado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='cochescom-enrich':
//     checked  fichas pedidas   alive  con CO₂
//     deactivated  ya vendidas  unclassified  leídas sin dato
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('cochescom-enrich', NOW(), " + n(s.ce_intentos) + ', ' + n(s.ce_co2) + ', '
  + n(s.ce_vendidas) + ', ' + n(leidas - (s.ce_co2 || 0)) + ', ' + n(s.ce_fallos) + ', '
  + (s.ce_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.ce_intentos || 0, leidas: leidas,
  co2: s.ce_co2 || 0, consumo: s.ce_consumo || 0, vendidas: s.ce_vendidas || 0,
  fallos: s.ce_fallos || 0, parado: !!s.ce_parado };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('ce_') === 0) delete s[k]; }
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
const CRON = "4 veces/día (10:35, 14:35, 16:35 y 22:35)";
const nodos = [
  { parameters: {}, id: "ce-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // Fuera del scraper de coches.com (11:40 y 23:40) y de su verificador (9:05,
  // 12:05, 15:05 y 21:05, ~75 min cada uno), que son los que comparten dominio.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 35 10,14,16,22 * * *" }] } },
    id: "ce-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ce-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "ce-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "ce-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("ce-c-url", "url"), id: "ce-if-url",
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
        timeout: 30000,
        // SIN seguir redirecciones: una ficha vendida da 410, y un 3xx no trae
        // ficha. Siguiéndolo acabaríamos leyendo otra página.
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "ce-http", name: "HTTP: Ficha de coches.com",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "ce-code", name: "Code: Extraer CO2 y consumo",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("ce-c-sql", "sql"), id: "ce-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ce-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "ce-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ce-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":      { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                      { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":     { main: [[L("Loop: oferta por oferta")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada item. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: oferta por oferta":   { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":      { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de coches.com")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de coches.com": { main: [[L("Code: Extraer CO2 y consumo")]] },
  "Code: Extraer CO2 y consumo": { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":     { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":             { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "coches.com – Enriquecer (CO₂ y consumo)",
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

const destino = path.join(RAIZ, "n8n-workflows", "cochescom-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, 4 pasadas/día = "
  + (LOTE * 4).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");
console.log("  con 52.137 ofertas: " + Math.ceil(52137 / (LOTE * 4)) + " días para pasarlas todas");

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Extraer CO2 y consumo").parameters.jsCode;
const bien = js.indexOf("application\\/json") >= 0 && js.indexOf("[\\s\\S]*?") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "el regex del __NEXT_DATA__ conserva sus barras");
if (!bien) process.exit(1);
