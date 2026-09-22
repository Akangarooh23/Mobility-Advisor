/**
 * Autohero – Verificar ofertas activas (por su API, cruzando por uuid)
 *
 * El origen de n8n-workflows/autohero-verificar-activas.json.
 *
 *   node scripts/genera-verificador-autohero.js
 *   npm run test:autohero-verify
 *
 * ── Por qué hace falta, y cuánto ───────────────────────────────────────────
 *
 * Autohero no ha tenido nunca un verificador: en n8n no hay un solo flujo de
 * este portal. Nadie ha dado de baja un coche suyo jamás. Medido hoy: damos
 * 3.849 por vivos y su catálogo tiene 2.407. Son 2.340 bajas, el 61 %.
 *
 * Un 61 % de mortandad asusta, y con razón. Por eso conviene explicar de dónde
 * sale antes que bajar el freno: son cuatro meses de altas (desde mayo) sin
 * que nadie diera una sola baja. No es un mes malo de ventas: es la cuenta que
 * nunca se pasó.
 *
 * ── Por la API, y no por el sitemap ────────────────────────────────────────
 *
 * Tienen un sitemap_search.xml -mal llamado: son fichas de coche, no
 * búsquedas- con 2.444 urls y una sola petición. Tentador. No se usa:
 *
 *     el sitemap dice   2.444 coches
 *     su API dice       2.407 coches
 *
 * Los 37 de diferencia son coches que ya no están en la API pero siguen en el
 * sitemap, que se regenera más despacio. Verificar contra la lista más vieja
 * es dar por vivo lo que ya se vendió. Se usa la API, que es la misma fuente
 * que el scraper: si el catálogo cambia, las dos cosas cambian a la vez.
 *
 * (El sitemap sí sirve para una cosa, y se usa: como segunda opinión. Si la
 * API dijera de pronto que solo le quedan 200 coches y el sitemap siguiera
 * trayendo 2.400, es que la API se ha roto, no que hayan vendido el almacén.)
 *
 * ── Lo que puede salir mal, y los cuatro frenos ────────────────────────────
 *
 *   1. NINGUNA LLAMADA PUEDE FALLAR. Si la cuarta de veinticinco se cae,
 *      faltan 100 coches de la lista y los 100 parecerían vendidos.
 *
 *   2. HAY QUE RECOGER EL CATÁLOGO ENTERO. Su API declara el total en cada
 *      respuesta; si al terminar la vuelta hemos visto menos del 97 %, se
 *      para. (Medido hoy: 2.407 recogidos de 2.407 declarados, clavado.)
 *
 *   3. LA SEGUNDA OPINIÓN. El número de coches de la API tiene que parecerse
 *      al del sitemap. Si se separan más de un 25 %, no se da ninguna baja: no
 *      sabemos cuál de las dos miente, y eso ya es motivo para no borrar nada.
 *
 *   4. TECHO DE MORTANDAD, al 75 %. Hoy toca el 61 % y pasa; un 90 % no
 *      pasaría. Está más alto que en otros portales precisamente porque aquí
 *      la primera pasada tiene que poder hacer la limpieza de cuatro meses.
 *
 * Con los cuatro puestos, el peor caso es una pasada que no hace nada y lo
 * dice en su parte.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const API = "https://www.autohero.com/v1/retail-customer-gateway/graphql/searchAdV9AdsV2";
const SITEMAP = "https://www.autohero.com/es/sitemap_search.xml";
const POR_LLAMADA = 100;
const TOPE_LLAMADAS = 120;
const TOPE_MORTANDAD = 0.75;
const MERMA_ADMITIDA = 0.03;
const DESACUERDO_MAXIMO = 0.25;
const POR_TROZO = 1500;

const CABECERAS_API = {
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "accept", value: "*/*" },
    { name: "accept-language", value: "es,es-ES;q=0.9,en;q=0.8" },
    { name: "content-type", value: "application/json" },
    { name: "origin", value: "https://www.autohero.com" },
    { name: "referer", value: "https://www.autohero.com/es/search/" },
    { name: "rq-sender", value: "search-0.0.768" },
    { name: "rq-sender-app", value: "web" },
    { name: "rq-sender-device-type", value: "desktop" },
    { name: "user-agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
  ] },
};
const OPCIONES_API = {
  response: { response: { fullResponse: true, neverError: true } },
  timeout: 60000,
  redirect: { redirect: { followRedirects: true } },
};
const OPCIONES_XML = {
  response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
  timeout: 60000,
  redirect: { redirect: { followRedirects: true } },
};

const ACTIVAS = `-- Lo que damos por vivo de Autohero, para cruzarlo con su catálogo.
--
-- Solo el id: son 3.849 filas y el cruce va por el uuid que lleva dentro.
-- Traer lo demás sería memoria tirada, y n8n guarda en memoria la salida de
-- cada nodo, iteración a iteración.
SELECT id FROM moveadvisor_market_offers
WHERE portal = 'autohero' AND is_active`;

const CUERPO = `function cuerpo(offset, limite) {
  return JSON.stringify({
    operationName: 'searchAdV9AdsV2',
    variables: {
      search: {
        offset: offset, limit: limite, sort: 'most_popular',
        filter: { field: 'countryCode', op: 'eq', value: 'ES' },
        aggs: [], postFilter: null, fields: ['registration'],
        properties: {
          abTestViewParams: null, firstPublishedDays: -30,
          shuffleCategoryBResults: false, resultsCombiner: 'abbabbc',
          filterByEligibleDate: true, includeProspective: true,
        },
      },
      tradeInId: null,
    },
    query: 'query searchAdV9AdsV2($search: EsSearchRequestProjectionInput!, $tradeInId: UUID) { searchAdV9AdsV2(search: $search, tradeInId: $tradeInId) }',
  });
}
// Con fullResponse n8n deja el cuerpo en 'body' si la respuesta es JSON y en
// 'data' si se pidió como texto. Se miran los dos.
function dentro(res) {
  const raiz = (res && res.body) ? res.body : ((res && res.data && res.data.data) ? res.data : res);
  return ((raiz || {}).data || {}).searchAdV9AdsV2 || {};
}`;

const CODE_SITEMAP = `// La segunda opinión: cuántos coches trae su sitemap.
//
// No se usa para decidir quién vive -para eso está la API, que es la lista
// fresca-, sino para saber si la API se puede creer. Hoy: sitemap 2.444, API
// 2.407. Si un día se separan de verdad, no se da ninguna baja.
const s = $getWorkflowStaticData('global');
for (const k of Object.keys(s)) { if (k.indexOf('av_') === 0) delete s[k]; }
s.av_run = $execution.id;
s.av_ids = [];
s.av_fallos = 0;
s.av_llamadas_ok = 0;
s.av_motivo = '';

const res = $input.first().json;
const xml = String(res.data || res.body || '');
const codigo = Number(res.statusCode || 0);

let delSitemap = 0;
if (codigo === 200 && xml && xml.trim().slice(-9) === '</urlset>') {
  // Los uuid, sin expresión regular: este código viaja dentro de una cadena y
  // dentro de un JSON, y por el camino las barras se pierden.
  const vistos = {};
  let i = 0;
  for (;;) {
    const j = xml.indexOf('/id/', i);
    if (j === -1) break;
    const desde = j + 4;
    const fin = xml.indexOf('/', desde);
    i = desde;
    if (fin === -1) continue;
    const u = xml.slice(desde, fin);
    if (u.length === 36 && !vistos[u]) { vistos[u] = true; delSitemap++; }
  }
} else {
  console.log('[ah-verify] el sitemap no se pudo leer (HTTP ' + codigo + '). Se sigue sin segunda opinión.');
}
s.av_sitemap = delSitemap;
console.log('[ah-verify] el sitemap trae ' + delSitemap + ' coches');

${CUERPO}
return [{ json: { cuerpo: cuerpo(0, 1) } }];`;

const CODE_LLAMADAS = `// Cuántas llamadas hacen falta hoy.
${CUERPO}
const s = $getWorkflowStaticData('global');
const res = $input.first().json;
const nodo = dentro(res);
const total = Number(nodo.total) || 0;
const codigo = Number((res || {}).statusCode || 0);
s.av_total = total;

if (codigo && codigo !== 200) {
  s.av_motivo = 'su API contestó ' + codigo;
  console.log('[ah-verify] NO SE DAN BAJAS: ' + s.av_motivo);
  return [{ json: { hay: '', cuerpo: '' } }];
}
if (!(total > 0)) {
  s.av_motivo = 'su API no dice cuántos coches tiene';
  console.log('[ah-verify] NO SE DAN BAJAS: ' + s.av_motivo);
  return [{ json: { hay: '', cuerpo: '' } }];
}

/*
 * FRENO 3: la segunda opinión.
 *
 * El sitemap y la API tienen que decir números parecidos. Hoy 2.444 y 2.407,
 * un 1,5 % de diferencia. Si se separan más de un ${Math.round(DESACUERDO_MAXIMO * 100)} %, una de las dos
 * miente y no sabemos cuál: no se toca nada.
 *
 * Si el sitemap no se pudo leer se sigue igualmente. Perder la segunda opinión
 * no es motivo para no trabajar; los otros tres frenos siguen puestos.
 */
if (s.av_sitemap > 0) {
  const dif = Math.abs(s.av_sitemap - total) / Math.max(s.av_sitemap, total);
  if (dif > ${DESACUERDO_MAXIMO}) {
    s.av_motivo = 'su API dice ' + total + ' coches y su sitemap ' + s.av_sitemap
      + ': no concuerdan (' + Math.round(dif * 100) + '%)';
    console.log('[ah-verify] NO SE DAN BAJAS: ' + s.av_motivo);
    return [{ json: { hay: '', cuerpo: '' } }];
  }
}

let llamadas = Math.ceil(total / ${POR_LLAMADA});
if (llamadas > ${TOPE_LLAMADAS}) llamadas = ${TOPE_LLAMADAS};
const out = [];
for (let i = 0; i < llamadas; i++) {
  const offset = i * ${POR_LLAMADA};
  out.push({ json: { hay: 'si', offset: offset, cuerpo: cuerpo(offset, ${POR_LLAMADA}) } });
}
console.log('[ah-verify] su catálogo declara ' + total + ' coches; ' + llamadas + ' llamadas');
return out;`;

const CODE_APUNTAR = `// Los uuid de esta llamada, al montón.
${CUERPO}
const s = $getWorkflowStaticData('global');
const res = $input.first().json;
const nodo = dentro(res);
const cars = nodo.data || [];
const codigo = Number((res || {}).statusCode || 0);
const offset = $('Loop: cien en cien').first().json.offset;

if ((codigo && codigo !== 200) || !cars.length) {
  // FRENO 1: una llamada que falla son 100 coches que parecerían vendidos.
  //
  // La última llamada trae menos de cien -hoy siete- pero nunca cero: las
  // llamadas se generan a partir del total que declara la propia API.
  s.av_fallos = (s.av_fallos || 0) + 1;
  console.log('[ah-verify] la llamada del offset ' + offset + ' falló (HTTP ' + codigo + ', ' + cars.length + ' coches)');
  return [{ json: { offset: offset, ids: 0, fallo: true } }];
}

let n = 0;
for (const car of cars) {
  const u = String((car || {}).id || '');
  if (u) { s.av_ids.push('ah_' + u); n++; }
}
s.av_llamadas_ok = (s.av_llamadas_ok || 0) + 1;
return [{ json: { offset: offset, ids: n, fallo: false } }];`;

const CODE_CRUZAR = `// Cruzar lo nuestro con lo suyo, por uuid.
const s = $getWorkflowStaticData('global');
const nuestras = $('PG: Las que damos por vivas').all().map(x => x.json);
s.av_nuestras = nuestras.length;

const suyos = new Set(s.av_ids || []);
s.av_suyos = suyos.size;

if (!s.av_motivo) {
  // FRENO 1: ninguna llamada puede haber fallado.
  if (s.av_fallos > 0) {
    s.av_motivo = s.av_fallos + ' llamada(s) no se pudieron leer: faltan coches de la lista';
  // FRENO 2: hay que haber recogido el catálogo entero.
  } else if (s.av_total > 0 && suyos.size < Math.floor(s.av_total * ${1 - MERMA_ADMITIDA})) {
    s.av_motivo = 'recogimos ' + suyos.size + ' de los ' + s.av_total + ' que declaran: la vuelta vino corta';
  }
}

if (s.av_motivo) {
  console.log('[ah-verify] NO SE DAN BAJAS: ' + s.av_motivo);
  return [{ json: { seguir: '', sql: null } }];
}

console.log('[ah-verify] su catálogo trae ' + suyos.size
  + ' coches; nosotros damos por vivas ' + nuestras.length);

const muertas = [];
for (const o of nuestras) {
  if (!suyos.has(String(o.id))) muertas.push(String(o.id));
}
s.av_muertas = muertas.length;
s.av_vivas = nuestras.length - muertas.length;

// FRENO 4: una mortandad imposible es la lista rota, no un buen mes de ventas.
const pct = nuestras.length ? (muertas.length / nuestras.length) : 0;
if (pct > ${TOPE_MORTANDAD}) {
  s.av_motivo = 'faltan el ' + Math.round(pct * 100) + '% de las nuestras: la lista no es de fiar';
  console.log('[ah-verify] NO SE DAN BAJAS: ' + s.av_motivo);
  return [{ json: { seguir: '', sql: null } }];
}
if (!muertas.length) {
  s.av_nada = true;
  console.log('[ah-verify] nada que dar de baja: todas siguen en su catálogo.');
  return [{ json: { seguir: '', sql: null } }];
}

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const out = [];
for (let i = 0; i < muertas.length; i += ${POR_TROZO}) {
  const trozo = muertas.slice(i, i + ${POR_TROZO});
  out.push({ json: {
    seguir: 'si',
    sql: 'UPDATE moveadvisor_market_offers SET is_active = FALSE, last_checked_at = NOW()'
      + ' WHERE id IN (' + trozo.map(esc).join(', ') + ')',
    cuantas: trozo.length,
  } });
}
console.log('[ah-verify] ' + muertas.length + ' bajas en ' + out.length + ' trozos');
return out;`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');

console.log('[ah-verify] ── resumen ──');
console.log('  dábamos por vivas : ' + (s.av_nuestras || 0));
console.log('  su API trae       : ' + (s.av_suyos || 0) + ' de ' + (s.av_total || 0) + ' declarados');
console.log('  su sitemap dice   : ' + (s.av_sitemap || 0));
console.log('  llamadas leídas   : ' + (s.av_llamadas_ok || 0) + '   fallidas: ' + (s.av_fallos || 0));
console.log('  BAJAS             : ' + (s.av_muertas || 0));
console.log('  siguen vivas      : ' + (s.av_vivas || 0));
if (s.av_nada) console.log('  nada que dar de baja: todas siguen en su catálogo.');
if (s.av_motivo) console.log('  NO SE DIERON BAJAS: ' + s.av_motivo);

// Si un freno paró la pasada, no se ha dado ni una baja: el recuento de
// muertas es lo que HABRÍA hecho, no lo que hizo.
const frenada = !!s.av_motivo;
const bajas = frenada ? 0 : (s.av_muertas || 0);
const vivas = frenada ? 0 : (s.av_vivas || 0);

const n = v => String(Number(v) || 0);
// La tabla de los verificadores, con portal='autohero':
//     checked  las que dábamos por vivas   alive  las que siguen
//     deactivated  las bajas               unclassified  las que no se dieron
//     transient  las llamadas que fallaron blocked  TRUE si frenó
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('autohero', NOW(), " + n(s.av_nuestras) + ', ' + n(vivas) + ', '
  + n(bajas) + ', ' + n(frenada ? (s.av_muertas || 0) : 0) + ', ' + n(s.av_fallos) + ', '
  + (frenada ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, nuestras: s.av_nuestras || 0, suyos: s.av_suyos || 0,
  sitemap: s.av_sitemap || 0, bajas: bajas, vivas: vivas, motivo: s.av_motivo || '' };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('av_') === 0) delete s[k]; }
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
// 4 veces al día, en huecos libres. 26 llamadas cada una, unos 85 segundos.
const CRON = "4 veces/día (10:05, 14:05, 17:05 y 21:05)";
const nodos = [
  { parameters: {}, id: "av-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-1060, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 5 10,14,17,21 * * *" }] } },
    id: "av-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-1060, 400] },
  { parameters: { operation: "executeQuery", query: ACTIVAS, options: {} },
    id: "av-activas", name: "PG: Las que damos por vivas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-860, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { url: SITEMAP, sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "application/xml,text/xml,*/*;q=0.8" },
      ] },
      options: OPCIONES_XML },
    id: "av-sitemap", name: "HTTP: Su sitemap (segunda opinión)",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-660, 300] },
  { parameters: { jsCode: CODE_SITEMAP }, id: "av-contar-sitemap",
    name: "Code: Contar el sitemap",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-460, 300] },
  { parameters: { method: "POST", url: API, sendBody: true, specifyBody: "json",
      jsonBody: "={{ $json.cuerpo }}", ...CABECERAS_API, options: OPCIONES_API },
    id: "av-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-260, 300] },
  { parameters: { jsCode: CODE_LLAMADAS }, id: "av-llamadas", name: "Code: Generar llamadas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-60, 300] },
  // Si no se pudo medir, no se entra al bucle: se va derecho al cruce, que ve
  // el motivo puesto, no da ninguna baja y lo apunta en el parte.
  { parameters: condicion("av-c-hay", "hay"), id: "av-if-hay", name: "IF: ¿se pudo medir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [140, 300] },
  { parameters: { options: {} }, id: "av-loop", name: "Loop: cien en cien",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [360, 300] },
  { parameters: { method: "POST", url: API, sendBody: true, specifyBody: "json",
      jsonBody: "={{ $json.cuerpo }}", ...CABECERAS_API, options: OPCIONES_API },
    id: "av-http", name: "HTTP: Cien coches de su API",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [580, 440] },
  { parameters: { jsCode: CODE_APUNTAR }, id: "av-apuntar", name: "Code: Apuntar los uuid",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [800, 440] },
  { parameters: { jsCode: CODE_CRUZAR }, id: "av-cruzar", name: "Code: Cruzar por uuid",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [580, 160] },
  { parameters: condicion("av-c-seguir", "seguir"), id: "av-if", name: "IF: ¿se dan las bajas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [800, 160] },
  { parameters: { options: {} }, id: "av-loop2", name: "Loop: trozo a trozo",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [1020, 80] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "av-pg-bajas", name: "PG: Dar de baja",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 200],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "av-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1220, -40] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "av-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1420, -40],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Las que damos por vivas")]] },
  [CRON]:                       { main: [[L("PG: Las que damos por vivas")]] },
  "PG: Las que damos por vivas": { main: [[L("HTTP: Su sitemap (segunda opinión)")]] },
  "HTTP: Su sitemap (segunda opinión)": { main: [[L("Code: Contar el sitemap")]] },
  "Code: Contar el sitemap":    { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo":   { main: [[L("Code: Generar llamadas")]] },
  "Code: Generar llamadas":     { main: [[L("IF: ¿se pudo medir?")]] },
  "IF: ¿se pudo medir?":        { main: [[L("Loop: cien en cien")], [L("Code: Cruzar por uuid")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada llamada.
  "Loop: cien en cien":         { main: [[L("Code: Cruzar por uuid")], [L("HTTP: Cien coches de su API")]] },
  "HTTP: Cien coches de su API": { main: [[L("Code: Apuntar los uuid")]] },
  "Code: Apuntar los uuid":     { main: [[L("Loop: cien en cien")]] },
  "Code: Cruzar por uuid":      { main: [[L("IF: ¿se dan las bajas?")]] },
  // Sin bajas que dar -porque frenó o porque no había- se va directo al parte.
  "IF: ¿se dan las bajas?":     { main: [[L("Loop: trozo a trozo")], [L("Code: Resumen")]] },
  "Loop: trozo a trozo":        { main: [[L("Code: Resumen")], [L("PG: Dar de baja")]] },
  "PG: Dar de baja":            { main: [[L("Loop: trozo a trozo")]] },
  "Code: Resumen":              { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Autohero – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "autohero-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  26 llamadas por pasada para verificar 3.849 ofertas, cruzando por uuid");
console.log("  la primera pasada dará 2.340 bajas: cuatro meses sin verificar");
