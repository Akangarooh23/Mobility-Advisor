/**
 * CanalCar – Enriquecer (color, carrocería, potencia, puertas, plazas, dónde está)
 *
 * El origen de n8n-workflows/canalcar-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-canalcar.js
 *   npm run test:canalcar-enrich
 *
 * ── Lo que la ficha SÍ tiene, y lo que NO ──────────────────────────────────
 *
 * Antes de escribir esto medí la ficha, porque de las 459 filas vivas había
 * tres columnas al 0 %: cilindrada, CO₂ y provincia. Dos de las tres NO ESTÁN
 * EN LA FICHA:
 *
 *     cilindrada   no aparece, ni en el JSON-LD ni en el texto
 *     CO₂          no aparece
 *     provincia    no aparece en la ficha; viene en la TARJETA del listado,
 *                  y la rellena el scraper
 *
 * Así que este enriquecedor no va a llenar ninguna de las tres, y no hay
 * manera de que lo haga: no es cuestión de buscar mejor. La cilindrada de
 * CanalCar la seguirá poniendo el derivador universal a partir de la versión
 * («1.0 TSI» -> 1.000 cc), que es de donde sale hoy.
 *
 * Lo que sí trae su JSON-LD, y es lo que hace este flujo:
 *
 *     color, carrocería, puertas, plazas, potencia   -> están al ~90 %
 *     el concesionario y la ciudad                   -> están al 0 %
 *
 * O sea: tapa los huecos de unos 48 coches y da de alta los 98 que el scraper
 * va a traer nuevos. No es espectacular, y decirlo es más útil que inflarlo.
 *
 * ── La potencia dice BHP y es CV ───────────────────────────────────────────
 *
 * El JSON-LD escribe enginePower con unitCode 'BHP'. No lo es. El Citroën C3
 * Aircross «BlueHDi 110» trae value 110, y el Volkswagen Taigo que ellos
 * mismos llaman «81 kW (110 CV)» trae también 110. El número es CV y la
 * etiqueta está mal. Tomarla al pie de la letra y convertir metería un 1,4 %
 * de error en cada potencia del portal.
 *
 * ── Que la ficha sea del coche que pedimos ─────────────────────────────────
 *
 * En CanalCar la url no lleva número -es /marca/modelo/texto-de-la-version- y
 * la reescriben. Antes de escribirle nada a una fila se comprueba que la ficha
 * traiga data-coche-id="<nuestro número>".
 *
 * No es una precaución teórica. Pedí 40 urls nuestras al azar:
 *
 *     26   siguen en su listado   ->  26 de 26 devuelven SU ficha
 *     14   ya no están            ->  14 de 14 devuelven la ficha de OTRO
 *
 * Ni un 404. Cuando venden un coche, esa dirección pasa a servir otro coche
 * distinto, con su JSON-LD entero y su availability InStock. Sin esta
 * comprobación, cada coche vendido le escribiría a su fila el color, la
 * potencia y la carrocería de un desconocido.
 *
 * Por lo mismo, un verificador que preguntara ficha a ficha daría por vivos a
 * los 103 vendidos: contestan 200 y parecen sanos. El verificador de este
 * portal cruza el listado por id, y por eso.
 *
 * ── Lo que NO toca ─────────────────────────────────────────────────────────
 *
 * Ni is_active ni last_seen_at. Que una ficha conteste 200 no prueba que el
 * coche esté a la venta -los de 2020 siguen contestando-, y de la vida y la
 * muerte se encarga el verificador, que mira el listado.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const POR_PASADA = 300;
// Cortacircuitos: si quince fichas seguidas no se pueden leer, es que han
// cerrado la puerta, y seguir pidiendo 285 más no arregla nada.
const FALLOS_SEGUIDOS = 15;

const CABECERAS = {
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
  ] },
};
const OPCIONES_HTTP = {
  response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
  timeout: 30000,
  redirect: { redirect: { followRedirects: true } },
};

const COLA = `-- Las de CanalCar a las que les falta algo de la ficha.
--
-- Solo lo que damos por vivo: gastar una petición en un coche vendido es
-- tirarla. Lo aprendimos en AutoScout24 España, donde la primera versión de la
-- cola traía seis coches muertos de cada seis.
--
-- enrich_tried_at es lo que impide que la cola sea siempre la misma: sin él,
-- las 48 que no tienen color se volverían a pedir tres veces al día para
-- siempre. Se reintenta a la semana por si la ficha cambia.
SELECT id, url
FROM moveadvisor_market_offers
WHERE portal = 'canalcar'
  AND is_active
  AND COALESCE(url, '') <> ''
  AND (power_cv IS NULL
       OR doors IS NULL
       OR seats IS NULL
       OR COALESCE(color, '') = ''
       OR COALESCE(body_type, '') = ''
       OR COALESCE(dealer_name, '') = ''
       OR COALESCE(city, '') = '')
  AND (enrich_tried_at IS NULL OR enrich_tried_at < NOW() - INTERVAL '7 days')
ORDER BY (enrich_tried_at IS NULL) DESC, last_seen_at DESC
LIMIT ${POR_PASADA}`;

const CODE_TOCA = `// ¿Toca pedir esta ficha?
const s = $getWorkflowStaticData('global');
if (s.cn_run !== $execution.id) {
  // Arranque de pasada. La memoria es del workflow, no de la pasada.
  for (const k of Object.keys(s)) { if (k.indexOf('cn_') === 0) delete s[k]; }
  s.cn_run = $execution.id;
  s.cn_intentos = 0;
  s.cn_leidas = 0;
  s.cn_otro = 0;
  s.cn_fallos = 0;
  s.cn_seguidos = 0;
  s.cn_parado = false;
  s.cn_motivo = '';
}

const o = $input.item.json;
const id = String(o.id || '');
const url = String(o.url || '');

// Una consulta que no devuelve filas hace que n8n emita UN ITEM VACÍO. Sin
// esta salida, el HTTP se dispararía con la url en blanco.
if (!id || !url) return [{ json: { pedir: '', id: id, url: '' } }];

// CORTACIRCUITOS.
if (s.cn_parado) return [{ json: { pedir: '', id: id, url: '' } }];
if (s.cn_seguidos >= ${FALLOS_SEGUIDOS}) {
  s.cn_parado = true;
  s.cn_motivo = s.cn_seguidos + ' fichas seguidas sin poder leerse';
  console.log('[cn-enrich] PARADO: ' + s.cn_motivo);
  return [{ json: { pedir: '', id: id, url: '' } }];
}

s.cn_intentos = (s.cn_intentos || 0) + 1;
// El número de nuestro id es lo que tiene que aparecer en la ficha.
const numero = id.indexOf('_') !== -1 ? id.split('_')[1] : '';
return [{ json: { pedir: 'si', id: id, url: url, numero: numero } }];`;

const CODE_EXTRAER = `// Sacar de la ficha lo que la tarjeta no trae.
const s = $getWorkflowStaticData('global');
const pedida = $('Code: ¿toca pedirla?').item.json;
const id = String(pedida.id || '');
const numero = String(pedida.numero || '');

const res = $input.item.json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const html = typeof res === 'string' ? res : String(res.data || res.body || '');
const codigo = Number((res || {}).statusCode || 0);

function esc(v) {
  if (v === null || v === undefined || v === '') return null;
  return "'" + String(v).replace(/'/g, "''") + "'";
}
// Marcar el intento SIEMPRE, salga bien o mal: si no, la misma ficha rota
// vuelve a la cola tres veces al día para siempre.
const soloIntento = { json: { sql: 'UPDATE moveadvisor_market_offers'
  + ' SET enrich_tried_at = NOW() WHERE id = ' + esc(id), campos: 0, id: id } };

if (codigo !== 200 || !html) {
  s.cn_fallos = (s.cn_fallos || 0) + 1;
  s.cn_seguidos = (s.cn_seguidos || 0) + 1;
  return [soloIntento];
}

/*
 * ¿ES LA FICHA DE ESTE COCHE?
 *
 * La url de CanalCar no lleva número y la reescriben. La ficha sí trae
 * data-coche-id="<número>", y es lo único que ata la página a la fila. Sin
 * esta comprobación se le escribiría el color de otro coche a esta oferta,
 * que es exactamente lo que pasó en Clicars: 10 de cada 30.
 */
if (numero && html.indexOf('data-coche-id="' + numero + '"') === -1) {
  s.cn_otro = (s.cn_otro || 0) + 1;
  s.cn_seguidos = 0;   // contestó bien; no es la puerta cerrada
  console.log('[cn-enrich] ' + id + ': la ficha no es de este coche');
  return [soloIntento];
}
s.cn_seguidos = 0;

// El JSON-LD de tipo Car, que es donde está todo.
let v = {};
for (const trozo of html.split('application/ld+json').slice(1)) {
  const a = trozo.indexOf('>');
  const b = trozo.indexOf('</script>');
  if (a === -1 || b === -1) continue;
  let j;
  try { j = JSON.parse(trozo.slice(a + 1, b).trim()); } catch (e) { continue; }
  const lista = Array.isArray(j) ? j : (j['@graph'] || [j]);
  for (const o of lista) {
    if (!o) continue;
    const tipo = JSON.stringify(o['@type'] || '');
    if (tipo.indexOf('Car') !== -1 || tipo.indexOf('Vehicle') !== -1) v = o;
  }
}
if (!v || v.color === undefined && v.bodyType === undefined && v.vehicleEngine === undefined) {
  s.cn_fallos = (s.cn_fallos || 0) + 1;
  console.log('[cn-enrich] ' + id + ': la ficha no trae JSON-LD de coche');
  return [soloIntento];
}
s.cn_leidas = (s.cn_leidas || 0) + 1;

const color = String(v.color || '').trim();
const carroceria = String(v.bodyType || '').trim();
const puertas = v.numberOfDoors !== undefined && v.numberOfDoors !== null ? Number(v.numberOfDoors) : null;
const plazasCrudo = v.seatingCapacity !== undefined && v.seatingCapacity !== null
  ? v.seatingCapacity : v.vehicleSeatingCapacity;
const plazas = plazasCrudo !== undefined && plazasCrudo !== null ? Number(plazasCrudo) : null;

/*
 * LA POTENCIA: dice BHP y es CV.
 *
 * El Citroën C3 Aircross «BlueHDi 110» trae value 110, y el Volkswagen Taigo
 * que ellos mismos llaman «81 kW (110 CV)» trae también 110. El número son
 * caballos y el unitCode está mal puesto. Convertir de BHP metería un 1,4 %
 * de error en cada potencia del portal, así que se guarda tal cual.
 */
let cv = null;
try {
  let ep = v.vehicleEngine && v.vehicleEngine.enginePower;
  if (Array.isArray(ep)) ep = ep[0];
  const val = ep && ep.value;
  if (val !== null && val !== undefined) cv = Number(val);
} catch (e) { cv = null; }
if (!(cv > 30 && cv < 1000)) cv = null;
// 1 CV son 0,7355 kW. Se deriva en vez de leerlo porque la ficha no lo da.
const kw = cv !== null ? Math.round(cv * 0.7355) : null;

// Dónde está el coche: el vendedor va dentro de la oferta.
let concesionario = '';
let ciudad = '';
try {
  const ven = v.offers && v.offers.seller;
  concesionario = String((ven && ven.name) || '').trim();
  ciudad = String((ven && ven.address && ven.address.addressLocality) || '').trim();
} catch (e) { concesionario = ''; ciudad = ''; }

const sets = [];
// El color NO se pisa: puede llevar puesto el que contestó una persona, y
// aquí no había nada que lo protegiera antes.
if (esc(color)) sets.push("color = COALESCE(NULLIF(color, ''), " + esc(color) + ")");
if (esc(carroceria)) sets.push('body_type = ' + esc(carroceria));
if (puertas !== null && puertas > 0) sets.push('doors = ' + puertas);
if (plazas !== null && plazas > 0) sets.push('seats = ' + plazas);
if (cv !== null) sets.push('power_cv = ' + cv);
if (kw !== null) sets.push('power_kw = ' + kw);
if (esc(concesionario)) sets.push("dealer_name = COALESCE(NULLIF(dealer_name, ''), " + esc(concesionario) + ")");
if (esc(ciudad)) sets.push("city = COALESCE(NULLIF(city, ''), " + esc(ciudad) + ")");

if (!sets.length) return [soloIntento];
// enrich_tried_at siempre; is_active y last_seen_at nunca: que la ficha
// conteste 200 no prueba que el coche esté a la venta.
sets.push('enrich_tried_at = NOW()', 'updated_at = NOW()');
return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  campos: sets.length - 2,
  id: id,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.cn_leidas || 0;

console.log('[cn-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.cn_intentos || 0));
console.log('  leídas         : ' + leidas);
console.log('  era otro coche : ' + (s.cn_otro || 0));
console.log('  sin poder leer : ' + (s.cn_fallos || 0));
if (s.cn_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.cn_motivo);
// Una pasada que no lee ni una ficha no es un éxito, es una cola vacía o algo
// roto. En Gamboa eso pasó tres días seguidos sin que lo dijera nadie.
if (!s.cn_parado && (s.cn_intentos || 0) > 0 && leidas === 0) {
  console.log('  OJO: ni una ficha leída. O el portal ha cambiado, o nos han cerrado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='canalcar-enrich':
//     checked  fichas pedidas   alive  leídas
//     deactivated  0            unclassified  era otro coche
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('canalcar-enrich', NOW(), " + n(s.cn_intentos) + ', ' + n(leidas) + ', 0, '
  + n(s.cn_otro) + ', ' + n(s.cn_fallos) + ', ' + (s.cn_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.cn_intentos || 0, leidas: leidas,
  eraOtro: s.cn_otro || 0, fallos: s.cn_fallos || 0, parado: !!s.cn_parado,
  motivo: s.cn_motivo || '' };
for (const k of Object.keys(s)) { if (k.indexOf('cn_') === 0) delete s[k]; }
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
// 3 veces al día, en huecos libres. No pisa a Autocasión (12:10, 18:10, 22:10),
// ni a OcasionPlus (12:15, 18:15, 22:15), ni a AutoScout24 (12:25, 22:25).
const CRON = "3 veces/día (12:05, 18:05 y 22:05)";
const nodos = [
  { parameters: {}, id: "cn-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-660, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 5 12,18,22 * * *" }] } },
    id: "cn-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-660, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "cn-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-460, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "cn-loop", name: "Loop: coche por coche",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-240, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "cn-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [0, 420] },
  { parameters: condicion("cn-c-pedir", "pedir"), id: "cn-if-pedir",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [220, 420] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "cn-http", name: "HTTP: Ficha de CanalCar",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [440, 500] },
  { parameters: { jsCode: CODE_EXTRAER }, id: "cn-extraer",
    name: "Code: Extraer color, carrocería, potencia y sitio",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [660, 500] },
  { parameters: condicion("cn-c-sql", "sql"), id: "cn-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [880, 500] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cn-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1100, 580],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { amount: 1 }, id: "cn-esperar", name: "Esperar 1s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1320, 580],
    webhookId: "cn-esperar-canalcar" },
  { parameters: { jsCode: CODE_RESUMEN }, id: "cn-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [0, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cn-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [220, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":   { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                   { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":  { main: [[L("Loop: coche por coche")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada coche. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: coche por coche":  { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":   { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de CanalCar")], [L("Loop: coche por coche")]] },
  "HTTP: Ficha de CanalCar": { main: [[L("Code: Extraer color, carrocería, potencia y sitio")]] },
  "Code: Extraer color, carrocería, potencia y sitio": { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: coche por coche")]] },
  "PG: Actualizar oferta":  { main: [[L("Esperar 1s")]] },
  "Esperar 1s":             { main: [[L("Loop: coche por coche")]] },
  "Code: Resumen":          { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "CanalCar – Enriquecer (color, carrocería, potencia, puertas, plazas, sitio)",
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

const destino = path.join(RAIZ, "n8n-workflows", "canalcar-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día, " + POR_PASADA + " fichas por pasada");
console.log("  NO llena cilindrada ni CO₂: la ficha de CanalCar no los trae");
