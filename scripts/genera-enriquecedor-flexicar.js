/**
 * Flexicar – Enriquecer (puertas, plazas, potencia, cilindrada, carrocería, CO₂)
 *
 * El origen de n8n-workflows/flexicar-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-flexicar.js
 *   npm run test:flexicar-enrich
 *
 * ── Por qué, y por dónde entra ─────────────────────────────────────────────
 *
 * El catálogo (services.flexicar.es/api/v1/vehicles) deja al 100% marca,
 * modelo, versión, año, precio, kilómetros, combustible, cambio y color. No
 * trae puertas, plazas, potencia, cilindrada, carrocería ni CO₂.
 *
 * Eso sí lo da la MISMA API, pidiendo el coche suelto:
 *
 *     https://services.flexicar.es/api/v1/vehicles/{id}
 *
 * 10 KB de JSON contra los 575 KB del HTML de la ficha, y un id que ya no
 * existe responde 404 limpio. No hay razón para pedir la página.
 *
 * ── Qué trae, medido sobre 12 fichas vivas ─────────────────────────────────
 *
 *     doors             12 de 12        body              12 de 12
 *     seats             12 de 12        mixedConsumption  11 de 12
 *     hp                12 de 12        ecoSticker        11 de 12
 *     cylinder          11 de 12        CO₂                el aparte de abajo
 *
 * ── El CO₂ y la trampa de «emisiones EU6» ──────────────────────────────────
 *
 * El CO₂ no es un campo: está dentro de dataSheet, que es prosa. La primera
 * versión del regex buscaba un número cerca de «emisiones» y encontraba esto:
 *
 *     «Norma de emisiones EU6, 145 g/km CO2 (combinado)»
 *                          ^^
 *
 * Doce de doce fichas «traían CO₂», y en diez era el 6 de EU6. Habríamos
 * escrito 6 g/km, que coloca al coche en el tramo más limpio de cualquier
 * filtro. Así que el patrón exige «N g/km CO2», con el CO2 detrás: con eso
 * salen 11 de 24, el 46%, que es la cobertura de verdad.
 *
 * El 0 de un eléctrico SÍ se guarda -«Norma de emisiones 0 g/km CO2» es cierto-
 * pero solo si el combustible es eléctrico, por si un día un gasolina trae 0
 * porque no lo sabe.
 *
 * ── La carrocería que NO se escribe ────────────────────────────────────────
 *
 * Preguntándole a la base qué guardaban las filas viejas para cada body de la
 * API, todas casan una a una menos una:
 *
 *     Cabrio <- Cabrio        Familiar <- Familiar     SUV <- SUV 4x4
 *     Pick Up <- Pick Up      Furgoneta <- Furgoneta   Deportivo <- Deportivo
 *     Berlina  <- Turismo
 *     Compacto <- Turismo     <-- la misma palabra para dos cosas
 *
 * La API dice «Turismo» para los dos, así que de ahí no se puede sacar cuál es.
 * Esos se quedan sin carrocería en vez de con una inventada: un Compacto
 * etiquetado como Berlina sale en las búsquedas equivocadas para siempre.
 *
 * ── La cilindrada, en centímetros cúbicos ──────────────────────────────────
 *
 * La API la da en litros (cylinder: 1.798) y aquí se guarda en cc: 1798. Las
 * filas viejas de Flexicar están en litros -«1.0»- como las de medio mercado
 * español; eso lo arregla scripts/arregla-cilindrada-es.js, aparte.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// El id de la credencial que EXISTE en n8n. La plantilla de la que salieron
// estos generadores llevaba otro que no existe en esta maquina, y los nodos
// entraron sin credencial: dos triangulos de aviso y nada que escribiera.
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };
const ERROR_WF = "9BwKOPMIzjj3owho";

// 1.000 por pasada: la API responde en 200-300 ms, así que son unos 8 minutos.
// Sin nodo Wait, como todos desde el 15-sep: costaba casi 4 segundos por vuelta
// -no el 1 que declaraba- porque n8n guarda el estado para poder reanudar.
const LOTE = 1000;
const SEGUNDOS_POR_OFERTA = 0.5;
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las ofertas de Flexicar a las que les falta algo de la ficha.
--
-- Solo lo VISTO VIVO hace poco: last_seen_at, no last_checked_at. La diferencia
-- es que la primera dice «lo vimos vivo» y la segunda solo «lo intentamos», y
-- gastar una petición en un coche vendido es tirarla. Lo aprendimos en
-- AutoScout24 España, donde la primera versión de la cola traía seis coches
-- muertos de cada seis.
--
-- El scraper recorre el catálogo entero dos veces al día, así que «visto en los
-- últimos 3 días» aquí es de verdad «sigue en el catálogo».
SELECT id,
       COALESCE(fuel, '') AS fuel,
       COALESCE(doors, 0) AS doors,
       COALESCE(seats, 0) AS seats,
       COALESCE(power_cv, 0) AS power_cv,
       COALESCE(displacement, '') AS displacement,
       COALESCE(body_type, '') AS body_type,
       COALESCE(co2, '') AS co2,
       COALESCE(consumption, 0) AS consumption,
       COALESCE(environmental_label, '') AS environmental_label
FROM moveadvisor_market_offers
WHERE portal = 'flexicar'
  AND is_active
  AND enrich_tried_at IS NULL
  AND (doors IS NULL OR doors = 0
       OR seats IS NULL OR seats = 0
       OR power_cv IS NULL OR power_cv = 0
       OR COALESCE(displacement, '') = ''
       OR COALESCE(body_type, '') = ''
       OR COALESCE(co2, '') = '')
ORDER BY (last_seen_at > NOW() - INTERVAL '3 days') DESC, scraped_at DESC
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos y guarda de cola vacía, antes de gastar la petición.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.fe_run || s.fe_run !== $execution.id) {
  s.fe_run = $execution.id;
  s.fe_parado = false;
  s.fe_intentos = 0;
  s.fe_fallos = 0;
  s.fe_leidas = 0;
  s.fe_co2 = 0;
  s.fe_vendidas = 0;
  s.fe_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
// Así cayeron cuatro ejecuciones de Gamboa el 2026-09-07.
if (!item || !item.id) {
  console.log('[fx-enrich] no hay nada que enriquecer ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { url: '' }) }];
}
if (s.fe_parado) return [{ json: Object.assign({}, item, { url: '' }) }];

// La URL se arma con el id, no se lee de la base: la de la base es la de la
// página web y lo que queremos es la API.
return [{ json: Object.assign({}, item, {
  url: 'https://services.flexicar.es/api/v1/vehicles/' + String(item.id),
}) }];`;

const CODE = `// Flexicar - del JSON del coche a las columnas que faltan.
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

s.fe_intentos = (s.fe_intentos || 0) + 1;

// Un 403, un 429 o un 500 no dicen nada de la oferta: NO gastan su intento.
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.fe_fallos = (s.fe_fallos || 0) + 1;
  const intentos = s.fe_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.fe_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.fe_parado = true;
    s.fe_motivo = Math.round(100 * s.fe_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[fx-enrich] PARADO: ' + s.fe_motivo);
  }
  return [{ json: { sql: null, veredicto: 'pasajero' } }];
}

// Un 404 en esta API es un coche que ya no está en el catálogo. Ya que lo
// sabemos, se da por muerto aquí mismo en vez de esperar al verificador, igual
// que el comprobador de daños con el 410 de AutoScout24.
if (codigo === 404) {
  s.fe_vendidas = (s.fe_vendidas || 0) + 1;
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW(), is_active = FALSE,'
      + ' last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'vendida',
  } }];
}
if (codigo !== 200 || !cuerpo) return soloIntento('sin ficha');

let v = null;
try { v = JSON.parse(cuerpo); } catch (e) { v = null; }
if (!v || !v.id) return soloIntento('ficha ilegible');

// Que la ficha sea la del coche que pedimos. Aquí no puede haber redirección
// como en Autocasión -es una API por id-, pero comprobarlo cuesta una línea y
// escribir los datos de otro coche no se deshace.
if (String(v.id) !== id) return soloIntento('la ficha es de otro coche');

s.fe_leidas = (s.fe_leidas || 0) + 1;
const num = x => { const n = Number(x); return Number.isFinite(n) ? n : null; };
const entre = (x, min, max) => (x !== null && x >= min && x <= max) ? x : null;

// Filtro de cordura, como en Autocasión: un 6 en puertas o un 100 en plazas es
// basura, y guardarla es peor que no guardar nada.
const puertas = entre(num(v.doors), 2, 5);
const plazas = entre(num(v.seats), 2, 9);
const cv = entre(num(v.hp), 20, 1500);
// La API da litros (1.798) y aquí se guarda en centímetros cúbicos.
const litros = num(v.cylinder);
const cc = (litros !== null && litros > 0.5 && litros < 9) ? Math.round(litros * 1000) : null;
const consumo = entre(num(v.mixedConsumption), 0.5, 30);

// ── la carrocería ──────────────────────────────────────────────────────────
// «Turismo» NO se traduce: la API la usa para lo que guardamos como Berlina y
// también para Compacto, y de ahí no se puede saber cuál es. Mejor vacía que
// mal puesta.
const CARROCERIAS = {
  'suv 4x4': 'SUV', 'suv': 'SUV', 'todoterreno': 'Todoterreno',
  'familiar': 'Familiar', 'monovolumen': 'Monovolumen', 'furgoneta': 'Furgoneta',
  'cabrio': 'Cabrio', 'descapotable': 'Cabrio', 'coupe': 'Coupé', 'coupé': 'Coupé',
  'deportivo': 'Deportivo', 'pick up': 'Pick Up', 'pickup': 'Pick Up',
};
const carroceria = CARROCERIAS[String(v.body || '').trim().toLowerCase()] || '';

// ── el CO₂, dentro de la prosa de dataSheet ────────────────────────────────
//
// Exige «N g/km CO2», con el CO2 DETRÁS. Sin esa última parte, «Norma de
// emisiones EU6, 145 g/km CO2» se leía como 6 en diez de doce fichas.
const hoja = Array.isArray(v.dataSheet) ? v.dataSheet.join(' | ') : String(v.dataSheet || '');
const mCo2 = hoja.match(/([0-9]{1,3})\\s*g\\s*\\/\\s*km\\s*CO2/i);
// Sin tildes antes de comparar: "eléctrico".indexOf('lectric') es -1, porque la
// é parte la palabra. En coches.com eso habría dejado sin CO₂ justo a los
// eléctricos, que son los únicos cuyo 0 es verdad.
const combustible = String(oferta.fuel || v.fuel || '')
  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
const esElectrico = combustible.indexOf('electric') !== -1;
const co2raw = mCo2 ? Number(mCo2[1]) : null;
const co2 = (co2raw === null) ? null
  : (co2raw > 0 ? co2raw : (esElectrico ? 0 : null));

// ── a escribir ─────────────────────────────────────────────────────────────
// Todo con COALESCE: lo que ya hubiera manda. Esto rellena huecos, no corrige.
const sets = ['enrich_tried_at = NOW()'];
if (puertas !== null) sets.push('doors = COALESCE(NULLIF(doors, 0), ' + puertas + ')');
if (plazas !== null) sets.push('seats = COALESCE(NULLIF(seats, 0), ' + plazas + ')');
if (cv !== null) {
  sets.push('power_cv = COALESCE(NULLIF(power_cv, 0), ' + cv + ')');
  sets.push('power_kw = COALESCE(NULLIF(power_kw, 0), ' + Math.round(cv / 1.35962) + ')');
}
// displacement es varchar: NULLIF(displacement, 0) daría «operator does not
// exist: character varying = integer» y tumbaría el UPDATE entero.
if (cc !== null) sets.push("displacement = COALESCE(NULLIF(displacement, ''), '" + cc + "')");
if (carroceria) sets.push("body_type = COALESCE(NULLIF(body_type, ''), " + esc(carroceria) + ')');
if (co2 !== null) sets.push("co2 = COALESCE(NULLIF(co2, ''), '" + co2 + "')");
if (consumo !== null) sets.push('consumption = COALESCE(NULLIF(consumption, 0), '
  + (Math.round(consumo * 100) / 100) + ')');
if (v.ecoSticker) sets.push("environmental_label = COALESCE(NULLIF(environmental_label, ''), "
  + esc(String(v.ecoSticker)) + ')');

if (co2 !== null) s.fe_co2 = (s.fe_co2 || 0) + 1;

// updated_at NO se toca: enriquecer no es que el anuncio haya cambiado, es que
// nosotros nos hemos puesto al día. Y updated_at ordena el escaparate.
console.log('[fx-enrich] ' + id + ': puertas=' + (puertas === null ? '-' : puertas)
  + ' plazas=' + (plazas === null ? '-' : plazas) + ' cv=' + (cv === null ? '-' : cv)
  + ' cc=' + (cc === null ? '-' : cc) + ' ' + (carroceria || '-')
  + ' co2=' + (co2 === null ? '-' : co2) + (esElectrico ? ' (eléctrico)' : ''));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: sets.length > 1 ? 'enriquecida' : 'sin datos nuevos',
  puertas: puertas, plazas: plazas, cv: cv, cc: cc,
  carroceria: carroceria, co2: co2, consumo: consumo, electrico: esElectrico,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.fe_leidas || 0;

console.log('[fx-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.fe_intentos || 0));
console.log('  leídas         : ' + leidas);
console.log('  con CO₂        : ' + (s.fe_co2 || 0));
console.log('  ya vendidas    : ' + (s.fe_vendidas || 0));
console.log('  sin poder leer : ' + (s.fe_fallos || 0));
if (s.fe_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.fe_motivo);
// Una pasada que no lee ni una ficha no es un éxito, es una cola vacía o algo
// roto. En Gamboa eso pasó tres días seguidos sin que lo dijera nadie.
if (!s.fe_parado && (s.fe_intentos || 0) > 0 && leidas === 0) {
  console.log('  OJO: ni una ficha leída. O la API ha cambiado, o nos han cerrado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='flexicar-enrich':
//     checked  fichas pedidas   alive  con CO₂
//     deactivated  ya vendidas  unclassified  leídas sin CO₂
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('flexicar-enrich', NOW(), " + n(s.fe_intentos) + ', ' + n(s.fe_co2) + ', '
  + n(s.fe_vendidas) + ', ' + n(leidas - (s.fe_co2 || 0)) + ', ' + n(s.fe_fallos) + ', '
  + (s.fe_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.fe_intentos || 0, leidas: leidas,
  co2: s.fe_co2 || 0, vendidas: s.fe_vendidas || 0,
  fallos: s.fe_fallos || 0, parado: !!s.fe_parado };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('fe_') === 0) delete s[k]; }
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
// Lejos del scraper de Flexicar (9:10 y 21:10), que comparte dominio.
const CRON = "4 veces/día (10:25, 14:25, 18:25 y 22:25)";
const nodos = [
  { parameters: {}, id: "fe-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 25 10,14,18,22 * * *" }] } },
    id: "fe-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "fe-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "fe-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "fe-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("fe-c-url", "url"), id: "fe-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [340, 420] },
  { parameters: {
      url: "={{ $json.url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "application/json" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
        { name: "Origin", value: "https://www.flexicar.es" },
        { name: "Referer", value: "https://www.flexicar.es/" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 25000,
        // SIN seguir redirecciones: la API responde 404 limpio a un coche que
        // ya no está, y un 3xx no traería su ficha sino otra cosa.
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "fe-http", name: "HTTP: Ficha de la API",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "fe-code",
    name: "Code: Extraer puertas, plazas, potencia, cilindrada, carrocería y CO2",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("fe-c-sql", "sql"), id: "fe-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "fe-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "fe-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "fe-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const NOMBRE_CODE = "Code: Extraer puertas, plazas, potencia, cilindrada, carrocería y CO2";
const conexiones = {
  "Ejecutar manualmente":      { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                      { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":     { main: [[L("Loop: oferta por oferta")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada item. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: oferta por oferta":   { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":      { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de la API")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de la API":     { main: [[L(NOMBRE_CODE)]] },
  [NOMBRE_CODE]:               { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":     { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":             { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Flexicar – Enriquecer (puertas, plazas, potencia, cilindrada, carrocería, CO₂)",
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

const destino = path.join(RAIZ, "n8n-workflows", "flexicar-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
// Las pasadas se cuentan del propio cron: llevarlas a mano es como se quedan
// viejos los números de los comentarios.
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, " + PASADAS
  + " pasadas/día = " + (LOTE * PASADAS).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d", y
// el regex del CO₂ es justo el que no puede aflojarse.
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === NOMBRE_CODE).parameters.jsCode;
const bien = js.indexOf("g\\s*\\/\\s*km\\s*CO2") >= 0 && js.indexOf("[\\u0300-\\u036f]") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "el regex del CO₂ exige «g/km CO2» y conserva sus barras");
if (!bien) process.exit(1);
