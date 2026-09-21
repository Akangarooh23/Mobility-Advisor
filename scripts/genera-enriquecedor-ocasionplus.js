/**
 * OcasionPlus – Enriquecer (puertas, plazas, color, carrocería, etiqueta)
 *
 * El origen de n8n-workflows/ocasionplus-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-ocasionplus.js
 *   npm run test:ocasionplus-enrich
 *
 * ── Qué falta, y por qué no lo puede dar el listado ────────────────────────
 *
 * El listado deja al 100 % marca, modelo, versión, año, kilómetros, precio,
 * combustible y potencia. Pero no trae nada de esto:
 *
 *     color                57 % de las viejas, 0 % de las 4.542 nuevas
 *     carrocería           25 %                0 %
 *     puertas              25 %                0 %
 *     plazas               29 %                0 %
 *     etiqueta             88 %                0 %
 *
 * (Esos porcentajes son los de verdad. Los medí antes con `count(columna)`, que
 * cuenta las cadenas vacías como si fueran un valor, y me salían al 100 %.)
 *
 * ── Dónde están los datos, después de buscarlos mal dos veces ──────────────
 *
 * La ficha es Next.js del nuevo: no tiene `__NEXT_DATA__`, sino trozos
 * `self.__next_f.push([1,"...json..."])` que hay que juntar.
 *
 * Y dentro, la primera aparición de cada clave NO es el dato: es el diccionario
 * de traducciones de la interfaz.
 *
 *     "doors":"Puertas"        <- el diccionario
 *     "doors":5                <- el coche
 *
 * Buscando la primera aparición concluí dos veces que el portal no tenía los
 * datos: una vez «no los tiene» y otra «solo tiene puertas». Las dos veces
 * estaba leyendo el diccionario. El objeto del coche se localiza por
 * `"bodyStyle":`, que el diccionario no usa, y de ahí se leen los demás.
 *
 * Cilindrada y CO₂ NO están, eso sí era cierto. Y provincia tampoco: de esa
 * solo aparece la palabra en el diccionario, y las 18.784 filas del portal la
 * tienen vacía desde siempre.
 *
 * ── La carrocería, que se normaliza ────────────────────────────────────────
 *
 * El portal las da en mayúsculas -TODOTERRENO, COMPACTO, CABRIO_DESCAPOTABLE-
 * y así están las 3.431 filas viejas. El resto del mercado usa «Todoterreno»,
 * «Compacto», «Cabrio», y un filtro por carrocería trata las dos formas como
 * valores distintos. Aquí se escribe la forma compartida.
 *
 * Las 3.431 viejas en mayúsculas siguen ahí: eso es una limpieza aparte, no
 * trabajo de este workflow.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// El id de la credencial que EXISTE en n8n.
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };
const ERROR_WF = "9BwKOPMIzjj3owho";

// 500 por pasada. La ficha pesa medio mega, así que el límite aquí no es la
// latencia sino el tráfico: 500 fichas son unos 250 MB.
//
// Sin nodo Wait, como todos desde el 15-sep: costaba casi 4 segundos por vuelta
// -no el 1 que declaraba- porque n8n guarda el estado para poder reanudar.
const LOTE = 500;
const SEGUNDOS_POR_OFERTA = 1.2;
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las ofertas de OcasionPlus a las que les falta algo de la ficha.
--
-- Solo lo VISTO VIVO hace poco: last_seen_at, no last_checked_at. La diferencia
-- es que la primera dice «lo vimos vivo» y la segunda solo «lo intentamos», y
-- gastar media mega en un coche vendido es tirarla. Lo aprendimos en
-- AutoScout24 España, donde la primera versión de la cola traía seis coches
-- muertos de cada seis.
SELECT id, url,
       COALESCE(color, '') AS color,
       COALESCE(body_type, '') AS body_type,
       COALESCE(doors, 0) AS doors,
       COALESCE(seats, 0) AS seats,
       COALESCE(environmental_label, '') AS environmental_label
FROM moveadvisor_market_offers
WHERE portal = 'ocasionplus'
  AND is_active
  AND COALESCE(url, '') <> ''
  AND enrich_tried_at IS NULL
  AND (COALESCE(color, '') = ''
       OR COALESCE(body_type, '') = ''
       OR doors IS NULL OR doors = 0
       OR seats IS NULL OR seats = 0
       OR COALESCE(environmental_label, '') = '')
ORDER BY (last_seen_at > NOW() - INTERVAL '2 days') DESC, scraped_at DESC
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos y guarda de cola vacía, antes de gastar la ficha.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.oe_run || s.oe_run !== $execution.id) {
  s.oe_run = $execution.id;
  s.oe_parado = false;
  s.oe_intentos = 0;
  s.oe_fallos = 0;
  s.oe_leidas = 0;
  s.oe_vendidas = 0;
  s.oe_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
// Así cayeron cuatro ejecuciones de Gamboa el 2026-09-07.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[op-enrich] no hay nada que enriquecer ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { url: '' }) }];
}
if (s.oe_parado) return [{ json: Object.assign({}, item, { url: '' }) }];
return [{ json: item }];`;

const CODE = `// OcasionPlus - de la ficha a las columnas que faltan.
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
s.oe_intentos = (s.oe_intentos || 0) + 1;

// Un 403, un 429 o un 500 no dicen nada de la oferta: NO gastan su intento.
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.oe_fallos = (s.oe_fallos || 0) + 1;
  const intentos = s.oe_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.oe_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.oe_parado = true;
    s.oe_motivo = Math.round(100 * s.oe_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[op-enrich] PARADO: ' + s.oe_motivo);
  }
  return [{ json: { sql: null, veredicto: 'pasajero' } }];
}
// Un 410 o un 404 aquí significan vendida. Ya que lo sabemos, se da por muerta
// en el acto en vez de esperar al verificador.
if (codigo === 410 || codigo === 404) {
  s.oe_vendidas = (s.oe_vendidas || 0) + 1;
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW(), is_active = FALSE,'
      + ' last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'vendida',
  } }];
}
if (codigo !== 200 || !cuerpo) return soloIntento('sin ficha');

/*
 * El payload de Next.js del nuevo: trozos self.__next_f.push([1,"...json..."])
 * que hay que juntar y desescapar.
 */
const BARRA = String.fromCharCode(92);
let payload = '';
for (const t of cuerpo.split('self.__next_f.push(').slice(1)) {
  const fin = t.indexOf(')</script>');
  payload += t.slice(0, fin === -1 ? 400 : fin);
}
const limpio = payload.split(BARRA).join('');
if (!limpio) return soloIntento('ficha sin datos');

/*
 * El objeto del coche, localizado por "bodyStyle".
 *
 * La PRIMERA aparición de cada clave es el diccionario de traducciones de la
 * interfaz -"doors":"Puertas"-, no el dato. Buscándola concluí dos veces que
 * este portal no tenía estos campos. "bodyStyle" no está en el diccionario, así
 * que sirve de ancla: el coche está a su alrededor.
 */
const ancla = limpio.indexOf('"bodyStyle":');
if (ancla === -1) return soloIntento('ficha sin el bloque del coche');
const ventana = limpio.slice(Math.max(0, ancla - 600), ancla + 300);

// Lectores sin expresiones regulares: este código viaja dentro de una cadena y
// dentro de un JSON, y por el camino las barras se pierden. Hoy ha pasado
// cuatro veces.
const tras = (clave) => {
  // La ULTIMA aparicion dentro de la ventana, no la primera: el objeto del
  // coche esta pegado al ancla y el diccionario queda por delante. Buscando la
  // primera, una ficha con el diccionario cerca devolvia «Color» como color.
  const i = ventana.lastIndexOf('"' + clave + '":');
  return i === -1 ? null : ventana.slice(i + clave.length + 3, i + clave.length + 60);
};
const texto = (clave) => {
  const t = tras(clave);
  if (!t || t.charAt(0) !== '"') return null;
  const fin = t.indexOf('"', 1);
  return fin === -1 ? null : t.slice(1, fin).trim();
};
const numero = (clave) => {
  const t = tras(clave);
  if (!t) return null;
  let n = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch >= '0' && ch <= '9') n += ch; else break;
  }
  return n ? Number(n) : null;
};

s.oe_leidas = (s.oe_leidas || 0) + 1;
const entre = (x, min, max) => (x !== null && x >= min && x <= max) ? x : null;

// Filtro de cordura, como en Autocasión: un 6 en puertas o un 100 en plazas es
// basura, y guardarla es peor que no guardar nada.
const puertas = entre(numero('doors'), 2, 5);
const plazas = entre(numero('seats'), 2, 9);
const color = texto('color');

/*
 * La carrocería, a la forma que usa el resto del mercado.
 *
 * El portal las da en mayúsculas y así están las 3.431 filas viejas, pero los
 * demás portales guardan «Todoterreno» o «Cabrio»: un filtro por carrocería
 * trata las dos formas como valores distintos.
 */
const CARROCERIAS = {
  'TODOTERRENO': 'Todoterreno', 'SUV': 'SUV', 'COMPACTO': 'Compacto',
  'BERLINA': 'Berlina', 'FAMILIAR': 'Familiar', 'MONOVOLUMEN': 'Monovolumen',
  'INDUSTRIAL': 'Furgoneta', 'FURGONETA': 'Furgoneta', 'COUPE': 'Coupé',
  'CABRIO_DESCAPOTABLE': 'Cabrio', 'CABRIO': 'Cabrio', 'CAMPER': 'Camper',
  'PICKUP': 'Pick Up', 'PICK_UP': 'Pick Up', 'DEPORTIVO': 'Deportivo',
};
const bruta = texto('bodyStyle');
const carroceria = bruta ? (CARROCERIAS[bruta.toUpperCase()] || '') : '';

// La etiqueta de la DGT, que sí viene con su valor.
const ETIQUETAS = { '0': '0 Emisiones', 'ECO': 'ECO', 'C': 'C', 'B': 'B' };
const etiquetaBruta = texto('environmentalLabel');
const etiqueta = etiquetaBruta ? (ETIQUETAS[etiquetaBruta.toUpperCase()] || '') : '';

// Todo con COALESCE: lo que ya hubiera manda. Esto rellena huecos, no corrige.
const sets = ['enrich_tried_at = NOW()'];
if (puertas !== null) sets.push('doors = COALESCE(NULLIF(doors, 0), ' + puertas + ')');
if (plazas !== null) sets.push('seats = COALESCE(NULLIF(seats, 0), ' + plazas + ')');
if (color) sets.push("color = COALESCE(NULLIF(color, ''), " + esc(color) + ')');
if (carroceria) sets.push("body_type = COALESCE(NULLIF(body_type, ''), " + esc(carroceria) + ')');
if (etiqueta) sets.push("environmental_label = COALESCE(NULLIF(environmental_label, ''), "
  + esc(etiqueta) + ')');

// updated_at NO se toca: enriquecer no es que el anuncio haya cambiado, es que
// nosotros nos hemos puesto al día. Y updated_at ordena el escaparate.
console.log('[op-enrich] ' + id + ': puertas=' + (puertas === null ? '-' : puertas)
  + ' plazas=' + (plazas === null ? '-' : plazas) + ' ' + (color || '-')
  + ' ' + (carroceria || '-') + ' etiqueta=' + (etiqueta || '-'));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: sets.length > 1 ? 'enriquecida' : 'sin datos nuevos',
  puertas: puertas, plazas: plazas, color: color,
  carroceria: carroceria, carroceriaBruta: bruta, etiqueta: etiqueta,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.oe_leidas || 0;

console.log('[op-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.oe_intentos || 0));
console.log('  leídas         : ' + leidas);
console.log('  ya vendidas    : ' + (s.oe_vendidas || 0));
console.log('  sin poder leer : ' + (s.oe_fallos || 0));
if (s.oe_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.oe_motivo);
// Una pasada que no lee ni una ficha no es un éxito, es una cola vacía o algo
// roto. En Gamboa eso pasó tres días seguidos sin que lo dijera nadie.
if (!s.oe_parado && (s.oe_intentos || 0) > 0 && leidas === 0) {
  console.log('  OJO: ni una ficha leída. O el portal ha cambiado, o nos han cerrado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='ocasionplus-enrich':
//     checked  fichas pedidas   alive  leídas
//     deactivated  ya vendidas  unclassified  pedidas sin leer
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('ocasionplus-enrich', NOW(), " + n(s.oe_intentos) + ', ' + n(leidas) + ', '
  + n(s.oe_vendidas) + ', ' + n((s.oe_intentos || 0) - leidas) + ', ' + n(s.oe_fallos) + ', '
  + (s.oe_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.oe_intentos || 0, leidas: leidas,
  vendidas: s.oe_vendidas || 0, fallos: s.oe_fallos || 0, parado: !!s.oe_parado };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('oe_') === 0) delete s[k]; }
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
// Lejos del scraper de OcasionPlus (8:40 y 20:40) y de su verificador (10:20 y
// 22:20), que comparten dominio.
const CRON = "4 veces/día (12:15, 15:15, 18:15 y 23:15)";
const nodos = [
  { parameters: {}, id: "oe-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 15 12,15,18,23 * * *" }] } },
    id: "oe-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "oe-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "oe-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "oe-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("oe-c-url", "url"), id: "oe-if-url",
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
        // SIN seguir redirecciones: una ficha vendida da 410 o 404, y un 3xx no
        // trae ficha. Siguiéndolo acabaríamos leyendo otra página.
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "oe-http", name: "HTTP: Ficha de OcasionPlus",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "oe-code",
    name: "Code: Extraer puertas, plazas, color, carrocería y etiqueta",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("oe-c-sql", "sql"), id: "oe-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "oe-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "oe-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "oe-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const NOMBRE_CODE = "Code: Extraer puertas, plazas, color, carrocería y etiqueta";
const conexiones = {
  "Ejecutar manualmente":      { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                      { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":     { main: [[L("Loop: oferta por oferta")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada item. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: oferta por oferta":   { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":      { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de OcasionPlus")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de OcasionPlus": { main: [[L(NOMBRE_CODE)]] },
  [NOMBRE_CODE]:               { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":     { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":             { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "OcasionPlus – Enriquecer (puertas, plazas, color, carrocería, etiqueta)",
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

const destino = path.join(RAIZ, "n8n-workflows", "ocasionplus-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, " + PASADAS
  + " pasadas/día = " + (LOTE * PASADAS).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");
console.log("  con 10.847 en cola: " + Math.ceil(10847 / (LOTE * PASADAS)) + " días para ponerse al día");
