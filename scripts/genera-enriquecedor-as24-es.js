/**
 * AutoScout24 España – Enriquecer (puertas, plazas, cilindrada, tracción)
 *
 * El origen de n8n-workflows/autoscout24-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-as24-es.js
 *   npm run test:as24-es-enrich
 *
 * ── Qué trae de verdad la ficha española ───────────────────────────────────
 *
 * NO es la alemana, aunque sea el mismo portal. Medido el 15-sep-2026 sobre 15
 * fichas españolas vivas:
 *
 *     puertas              15 de 15
 *     plazas               15 de 15
 *     carrocería           15 de 15
 *     dato de daño         15 de 15
 *     cilindrada            9 de 15
 *     tracción              9 de 15
 *     consumo > 0           7 de 15
 *     CO2                   0 de 15      <- NUNCA
 *
 * El bloque `wltp`, que en Alemania es la fuente buena del CO2, sencillamente no
 * existe en las fichas españolas, y `co2emissionInGramPerKmWithFallback` viene
 * null. Por eso aquí NO se escribe co2: ese 2% que hay en la tabla no se puede
 * subir por este camino, y fingir que sí sería escribir nulos sobre 370.000
 * filas. Tampoco está en el listado: se comprobó.
 *
 * ── Por qué hace falta pedir la ficha ──────────────────────────────────────
 *
 * Porque el listado no lo trae. Cada oferta del listado incluye `vehicleDetails`
 * -que suena prometedor- y resulta ser lo que ya guarda el scraper:
 *
 *     kilometraje, transmisión, año, combustible, potencia
 *
 * y `wltpValues`, que en España viene siempre como lista vacía. Puertas, plazas,
 * cilindrada, tracción y daños solo están en la ficha, una petición por coche.
 *
 * ── La cilindrada guardada estaba mal, y mucho ─────────────────────────────
 *
 * El 15-sep, de 231.652 ofertas españolas con cilindrada, 102.937 la tenían en
 * LITROS -«1.0»- en vez de en centímetros cúbicos. El 44%. Cualquier filtro por
 * cilindrada estaba roto para ellas.
 *
 * Por eso aquí la cilindrada NO va con el COALESCE de los demás campos: se
 * sobrescribe cuando lo guardado no parece cc. Y la cola pone delante justo esas
 * ofertas, que son las que están mal ahora mismo.
 *
 * ── Los daños ──────────────────────────────────────────────────────────────
 *
 * Se guardan porque están ahí y son gratis. El 14-sep dije que ningún portal
 * español trae el dato de daños: era falso, y lo era porque miré títulos y
 * descripciones en vez de la ficha. autoscout24.es lo declara igual que el
 * alemán. El mercado español no se publica -solo sirve de comparable-, así que
 * esto no retira nada de ningún escaparate: sirve para que un siniestrado
 * tirado de precio no hunda la mediana con la que valoramos.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };

// 500 por pasada, y el límite aquí es la MEMORIA, no el portal.
//
// n8n guarda en memoria la salida de cada vuelta del bucle, y una ficha española
// pesa unos 330 KB. 500 son ~165 MB, que es lo que aguanta esta máquina: el
// verificador de Wallapop ya se colgó a la vuelta 1.551 con cuerpos de 13 KB.
//
// Sin nodo Wait, como los verificadores: costaba casi 4 segundos por oferta, no
// el 1 que declaraba. Con la ficha tardando ~1 s en llegar, una pasada son unos
// 10 minutos.
//
// SEAMOS HONESTOS CON EL RITMO: 2.000 al día contra 368.000 activas son seis
// meses para la primera vuelta. Eso es inherente a pedir una ficha por coche, y
// no se arregla con un número más grande -la memoria no da-. Por eso la cola va
// por utilidad y no por antigüedad: lo primero que se arregla son las 102.937
// cilindradas que hoy están mal.
const LOTE = 500;
const SEGUNDOS_POR_OFERTA = 1.2;
// El cortacircuitos de bloqueo, el mismo de los verificadores: si nos cierran la
// puerta, parar a los 50 intentos en vez de gastarse las 500 poniendo fechas.
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las ofertas españolas a las que les falta pasar por la ficha.
--
-- Por orden de UTILIDAD, no de antigüedad. Con 368.000 activas y 2.000 al día,
-- el orden decide qué se arregla este mes y qué dentro de medio año:
--
--   1. las que se han VISTO VIVAS hace poco: last_seen_at, no last_checked_at.
--      Esto lo puso el test. La primera versión ordenaba solo por la cilindrada
--      mal y de seis fichas reales TRES vinieron muertas; al cambiarlo a
--      «comprobadas hace poco» salieron SEIS de seis, y encima disfrazadas de
--      HTTP 200 porque eran listados de 640 KB.
--
--      La diferencia entre las dos fechas es justo eso: last_checked_at dice
--      «lo intentamos» -y se mueve también cuando la petición se cae-, mientras
--      que last_seen_at dice «lo vimos vivo». Para gastar una ficha hace falta
--      lo segundo.
--   2. dentro de esas, las que tienen la cilindrada en LITROS -«1.0»-, que no
--      es que les falte el dato: es que el que tienen está mal y engaña a
--      cualquier filtro. Eran 102.937 el 15-sep.
--   3. y después las más recientes, que son las que siguen a la venta y las
--      que de verdad se usan como comparables.
--
-- Cada oferta pasa UNA vez y no vuelve: puertas, plazas y cilindrada no cambian
-- en la vida de un anuncio. Por eso no hay ventana de refresco.
SELECT id, url
FROM moveadvisor_market_offers
WHERE portal = 'autoscout24'
  AND COALESCE(country, 'ES') = 'ES'
  AND is_active
  AND COALESCE(url, '') <> ''
  AND enrich_tried_at IS NULL
-- LIKE '%.%' en vez de una expresión regular a propósito: el regex tendría que
-- llevar barras invertidas, y estas consultas viven dentro de una cadena de
-- JavaScript donde "\\." se convierte en ".". Ya nos costó un regex roto.
ORDER BY (last_seen_at > NOW() - INTERVAL '3 days') DESC,
         (COALESCE(displacement, '') LIKE '%.%') DESC,
         scraped_at DESC
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos y guarda de cola vacía, antes de gastar la ficha.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.ee_run || s.ee_run !== $execution.id) {
  s.ee_run = $execution.id;
  s.ee_parado = false;
  s.ee_intentos = 0;
  s.ee_fallos = 0;
  s.ee_leidas = 0;
  s.ee_puertas = 0;
  s.ee_plazas = 0;
  s.ee_cilindrada = 0;
  s.ee_traccion = 0;
  s.ee_danadas = 0;
  s.ee_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle igual que una oferta y revienta el nodo HTTP con "URL parameter must be
// a string, got undefined". Así cayeron cuatro ejecuciones de Gamboa el
// 2026-09-07, y era el caso normal: no había nada que hacer.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[as24-es-enrich] no hay nada que enriquecer ahora mismo.');
  return [{ json: { url: '', id: (item || {}).id || '' } }];
}
if (s.ee_parado) return [{ json: { url: '', id: item.id } }];

return [{ json: { url: item.url, id: item.id } }];`;

const CODE = `// AutoScout24 ES - de la ficha a las columnas.
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

// enrich_tried_at se mueve pase lo que pase: sin eso, una ficha que falla se
// reintenta en cada pasada y atasca la cola para siempre.
const soloIntento = (motivo) => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(id),
  veredicto: motivo,
} }];

if (!id) return [{ json: { sql: null, veredicto: 'sin id' } }];

s.ee_intentos = (s.ee_intentos || 0) + 1;
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.ee_fallos = (s.ee_fallos || 0) + 1;
  const intentos = s.ee_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.ee_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.ee_parado = true;
    s.ee_motivo = Math.round(100 * s.ee_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[as24-es-enrich] PARADO: ' + s.ee_motivo + '. Bajar el ritmo antes de volver.');
  }
  // Un 403 no dice nada de la oferta: NO se gasta su intento, para que vuelva
  // a la cola cuando se pueda. Un 404 o un 410 sí, que esa ficha ya no existe.
  return [{ json: { sql: null, veredicto: 'pasajero' } }];
}
if (codigo !== 200 || !cuerpo) {
  console.log('[as24-es-enrich] ' + id + ': sin ficha (HTTP ' + codigo + ')');
  return soloIntento('sin ficha');
}

let raiz = null;
try {
  const m = cuerpo.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) raiz = ((JSON.parse(m[1]).props || {}).pageProps || {}).listingDetails;
} catch (e) { raiz = null; }
const v = (raiz && raiz.vehicle) ? raiz.vehicle : null;
if (!v) return soloIntento('ficha sin vehiculo');

s.ee_leidas = (s.ee_leidas || 0) + 1;

const entero = x => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const decimal = x => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

const carroc  = String(v.bodyType || '').trim();
const puertas = entero(v.numberOfDoors);
const plazas  = entero(v.numberOfSeats);
const cilin   = entero(v.rawDisplacementInCCM);

// El consumo viene 0 en muchas fichas españolas, y 0 no es un consumo: es «no
// lo declaro». decimal() ya lo descarta por exigir > 0.
const extra = (Array.isArray(v.additionalFuel) ? v.additionalFuel[0] : null) || {};
const sacaRaw = x => (x && typeof x === 'object' && 'raw' in x) ? x.raw : x;
const consumo = decimal(sacaRaw(v.fuelConsumptionCombined)) ||
  decimal(sacaRaw(extra.consumptionCombined));

// La tracción hay que traducirla al vocabulario de la tabla. El portal dice
// «Tracción delantera»; nosotros guardamos «Delantera», «Trasera», «Total».
let traccion = '';
const dt = String(v.driveTrain || '').toLowerCase();
if (dt.indexOf('delanter') !== -1) traccion = 'Delantera';
else if (dt.indexOf('traser') !== -1) traccion = 'Trasera';
else if (dt.indexOf('total') !== -1 || dt.indexOf('4x4') !== -1 || dt.indexOf('integral') !== -1) traccion = 'Total';

// Un coche sin daños declarados trae la lista vacía; uno que no hemos sabido
// leer no trae la clave. NULL es «no lo sé», FALSE es «no».
const danos = Array.isArray(v.damageConditions) ? v.damageConditions.filter(Boolean) : [];
const notaDano = danos.join(', ').slice(0, 200);
const danado = ('damageConditions' in v) ? (danos.length > 0) : null;
const accidente = (typeof v.hadAccident === 'boolean') ? v.hadAccident : null;

const sets = ['enrich_tried_at = NOW()'];
// OJO CON LOS TIPOS: doors y seats son integer; displacement, body_type y
// traction son varchar. NULLIF(col, 0) sobre una varchar da "operator does not
// exist: character varying = integer" y tumba el UPDATE entero.
const pon = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + " = COALESCE(NULLIF(" + col + ", ''), " + esc(val) + ')'); };
const ponNum = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = COALESCE(NULLIF(' + col + ', 0), ' + esc(val) + ')'); };

pon('body_type', carroc);
ponNum('doors', puertas);
ponNum('seats', plazas);
ponNum('consumption', consumo);
pon('traction', traccion);

// La cilindrada NO va con COALESCE: 102.937 ofertas la tienen en litros -«1.0»-
// y ese valor hay que PISARLO. Se respeta solo lo que ya parece cc: tres a cinco
// dígitos sin coma.
if (cilin !== null) {
  sets.push("displacement = CASE WHEN COALESCE(displacement,'') ~ '^[0-9]{3,5}$'"
    + ' THEN displacement ELSE ' + esc(String(cilin)) + ' END');
}

// co2 NO se escribe: la ficha española no lo trae nunca. Ver la cabecera.
// environmental_label tampoco: la ficha da la norma europea -«Euro 6»- y esa
// columna guarda la etiqueta de la DGT, que es otra cosa.

// Los daños se escriben SIEMPRE que la ficha los declare, sin COALESCE: son el
// estado del coche hoy, no un hueco que rellenar.
if (danado !== null) sets.push('is_damaged = ' + (danado ? 'TRUE' : 'FALSE'));
if (accidente !== null) sets.push('had_accident = ' + (accidente ? 'TRUE' : 'FALSE'));
if (notaDano) pon('damage_note', notaDano);

if (puertas) s.ee_puertas = (s.ee_puertas || 0) + 1;
if (plazas) s.ee_plazas = (s.ee_plazas || 0) + 1;
if (cilin) s.ee_cilindrada = (s.ee_cilindrada || 0) + 1;
if (traccion) s.ee_traccion = (s.ee_traccion || 0) + 1;
if (danado === true) s.ee_danadas = (s.ee_danadas || 0) + 1;

// updated_at NO se toca: enriquecer no es que el anuncio haya cambiado, es que
// nosotros nos hemos puesto al día.
console.log('[as24-es-enrich] ' + id + ': ' + (carroc || '-')
  + ' ' + (puertas || '-') + 'p ' + (plazas || '-') + ' plazas '
  + (cilin || '-') + ' cc ' + (traccion || '-')
  + (danado ? ' DANADO(' + notaDano + ')' : ''));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: 'enriquecida',
  carroceria: carroc, puertas: puertas, plazas: plazas, cilindrada: cilin,
  consumo: consumo, traccion: traccion, danado: danado, notaDano: notaDano,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.ee_leidas || 0;

console.log('[as24-es-enrich] ── resumen ──');
console.log('  fichas leídas : ' + leidas + ' de ' + (s.ee_intentos || 0) + ' intentos');
console.log('  con puertas   : ' + (s.ee_puertas || 0));
console.log('  con plazas    : ' + (s.ee_plazas || 0));
console.log('  con cilindrada: ' + (s.ee_cilindrada || 0));
console.log('  con tracción  : ' + (s.ee_traccion || 0));
console.log('  DAÑADAS       : ' + (s.ee_danadas || 0));
console.log('  fichas caídas : ' + (s.ee_fallos || 0));
if (s.ee_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.ee_motivo);
if (!s.ee_parado && leidas === 0 && (s.ee_intentos || 0) > 0) {
  console.log('  OJO: ni una ficha leída de ' + s.ee_intentos + '. Algo ha cambiado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='as24-es-enrich':
//     checked      fichas leídas          alive       con puertas
//     deactivated  dañadas encontradas    unclassified sin poder leer
//     transient    fichas caídas
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('as24-es-enrich', NOW(), " + n(leidas) + ', ' + n(s.ee_puertas) + ', '
  + n(s.ee_danadas) + ', ' + n((s.ee_intentos || 0) - leidas) + ', ' + n(s.ee_fallos) + ', '
  + (s.ee_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, leidas: leidas, intentos: s.ee_intentos || 0,
  puertas: s.ee_puertas || 0, plazas: s.ee_plazas || 0,
  cilindrada: s.ee_cilindrada || 0, traccion: s.ee_traccion || 0,
  danadas: s.ee_danadas || 0, fallos: s.ee_fallos || 0, parado: !!s.ee_parado };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('ee_') === 0) delete s[k]; }
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

const nodos = [
  { parameters: {}, id: "ee-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // En los huecos que dejan los otros dos de AutoScout24 España: el scraper
  // ocupa 13:30-19:15 y el verificador 9:25, 11:25, 19:25 y 21:25 con pasadas de
  // 83 minutos. Estas cuatro caben enteras entre medias.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 55 10,12,20,22 * * *" }] } },
    id: "ee-cron", name: "4 veces/día (10:55, 12:55, 20:55 y 22:55)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ee-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "ee-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "ee-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("ee-c-url", "url"), id: "ee-if-url",
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
        // SIN seguir redirecciones. Un coche vendido redirige a /lst/marca/
        // modelo, que responde 200 y pesa 640 KB: siguiéndola nos tragábamos el
        // listado entero y el lector lo daba por «ficha ilegible». Así el 301 se
        // ve como lo que es -una venta-, y de paso no se descargan 640 KB por
        // cada coche vendido. Lo cazó el test con seis fichas reales seguidas.
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "ee-http", name: "HTTP: Ficha de AutoScout24",
    // neverError solo calla los códigos HTTP; un corte de red seguiría matando
    // el nodo y con él la pasada entera.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "ee-code", name: "Code: Extraer de la ficha",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("ee-c-sql", "sql"), id: "ee-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ee-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "ee-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ee-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const CRON = "4 veces/día (10:55, 12:55, 20:55 y 22:55)";
const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                       { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":      { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":    { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":       { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?":  { main: [[L("HTTP: Ficha de AutoScout24")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de AutoScout24": { main: [[L("Code: Extraer de la ficha")]] },
  "Code: Extraer de la ficha":  { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":      { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":              { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "AutoScout24 ES – Enriquecer (puertas, plazas, cilindrada, tracción)",
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: "9BwKOPMIzjj3owho",
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "autoscout24-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, 4 pasadas/día = "
  + (LOTE * 4).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");
console.log("  NO escribe co2: la ficha española no lo trae nunca (0 de 15 medidas)");

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Extraer de la ficha").parameters.jsCode;
const bien = js.indexOf('application\\/json') >= 0 && js.indexOf('[\\s\\S]*?') >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "el regex del __NEXT_DATA__ conserva sus barras");
if (!bien) process.exit(1);
