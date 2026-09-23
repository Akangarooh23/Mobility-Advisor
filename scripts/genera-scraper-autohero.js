/**
 * Autohero – Scraper (mercado)
 *
 * El origen de n8n-workflows/autohero-scraper-offers.json.
 *
 *   node scripts/genera-scraper-autohero.js
 *   npm run test:autohero
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * Porque no estaba corriendo: en n8n no hay ni un flujo de Autohero. Los dos
 * JSON del repo llevan la credencial «uG6rcC7AqSKyEJOW», que no existe en esta
 * instalación, y nunca llegaron a importarse. El último coche suyo que vimos
 * fue el 2 de septiembre.
 *
 * Damos 3.849 por vivos y su catálogo tiene 2.407. Son 2.340 bajas y 898
 * coches suyos que no tenemos.
 *
 * ── Por dónde entra: su propia API ─────────────────────────────────────────
 *
 * Autohero pinta el catálogo en el navegador, pero detrás tiene un GraphQL
 * que devuelve los coches en JSON, cien por llamada:
 *
 *     POST /v1/retail-customer-gateway/graphql/searchAdV9AdsV2
 *
 * Medido hoy: 2.407 coches en 25 llamadas y 82 segundos, y la respuesta trae
 * 49 campos por coche. La alternativa era pedir 2.444 fichas HTML de 724 KB
 * cada una: 1,7 GB por pasada.
 *
 * La paginación es por offset y es ESTABLE: pedí dos veces el mismo offset y
 * salieron los mismos 100 coches, con y sin su «shuffleCategoryBResults». Aun
 * así se manda ese shuffle en false, porque un barajado silencioso se saltaría
 * coches sin que nadie lo notara.
 *
 * ── Lo que esto arregla, medido ────────────────────────────────────────────
 *
 * EL COMBUSTIBLE, que lleva meses mal. El scraper viejo traducía los códigos
 * con un diccionario a mano y dos entradas eran falsas. De los 1.509 coches
 * nuestros que siguen vivos, 839 -el 56 %- tienen el combustible equivocado:
 *
 *     726  «Híbrido» que son de Gasolina        (código 1039)
 *      80  «Híbrido enchufable» que son Híbrido (código 1046)
 *      33  «Gas» que son ELÉCTRICOS             (código 1044)
 *
 * El diccionario nuevo está hecho pidiendo 19 fichas y leyendo el combustible
 * en texto en cada una. Está en scripts/lib/autohero-transformar.js.
 *
 * Y lo demás que la API trae lleno y nosotros a medias:
 *
 *     cilindrada  95 % -> 98 %      etiqueta     86 % -> 100 %
 *     CO2         70 % -> 97 %      tracción     80 % -> 100 %
 *     consumo             -> 90 %   sede        «Toda España» -> ciudad real
 *
 * ── Un aviso sobre los daños ───────────────────────────────────────────────
 *
 * La API trae numberOfDamages y numberOfAccidents. NO se usan para marcar
 * is_damaged: numberOfDamages es mayor que cero en el 99 % de los 2.407 -es su
 * parte de arañazos de inspección, no un siniestro- y numberOfAccidents es
 * cero en TODOS. Atarlo a «los dañados no los publiques» borraría el portal
 * entero.
 *
 * ── Su robots.txt ──────────────────────────────────────────────────────────
 *
 * No declara Crawl-delay para nadie. Solo prohíbe /myhero/, /inspection/,
 * /checkout/, /identify, /center y /unsubscribe/. Mirado grupo por grupo.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// El id de la credencial que EXISTE en n8n.
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const API = "https://www.autohero.com/v1/retail-customer-gateway/graphql/searchAdV9AdsV2";
const POR_LLAMADA = 100;
const TOPE_LLAMADAS = 120;   // 12.000 coches de margen sobre los 2.407 de hoy

// Las cabeceras que su propia web manda. Sin origin/referer la API contesta,
// pero no hay razón para disimular menos de lo que hace el navegador.
const CABECERAS = {
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
const OPCIONES_HTTP = {
  response: { response: { fullResponse: true, neverError: true } },
  // Cada llamada de 100 tarda unos 3,2 s. 60 s es holgura de sobra.
  timeout: 60000,
  redirect: { redirect: { followRedirects: true } },
};

/*
 * EL CUERPO DE LA PETICIÓN SE ARMA EN EL CODE, no en el nodo HTTP.
 *
 * Poner un JSON con expresiones «{{ }}» dentro del campo jsonBody funciona,
 * pero es de lo más frágil que tiene n8n: basta una llave de más para que el
 * cuerpo salga mal formado y la API conteste 400 sin decir por qué. Armarlo en
 * JavaScript y mandarlo como una cadena ya hecha se puede probar fuera de n8n.
 */
const CUERPO = `function cuerpo(offset, limite) {
  return JSON.stringify({
    operationName: 'searchAdV9AdsV2',
    variables: {
      search: {
        offset: offset,
        limit: limite,
        sort: 'most_popular',
        filter: { field: 'countryCode', op: 'eq', value: 'ES' },
        aggs: [],
        postFilter: null,
        /*
         * 'fields' es una PROYECCIÓN: lo que se pone aquí lo devuelve además
         * de los 49 campos de siempre. No está documentado en ninguna parte;
         * salió probando nombres uno a uno contra su API.
         *
         * Estos cuatro son los que obligaban a abrir la ficha: color,
         * carrocería, puertas y plazas. Con ellos aquí, no hay que pedir 1.700
         * páginas de 724 KB para completarlos.
         *
         * 'registration' ya iba en el scraper viejo; se mantiene.
         */
        fields: ['registration', 'outerColor', 'bodyType', 'doorCount', 'seatCount'],
        properties: {
          abTestViewParams: null,
          firstPublishedDays: -30,
          // En false a propósito: si un día empezara a barajar, paginar por
          // offset se saltaría coches y repetiría otros, y nadie lo notaría.
          shuffleCategoryBResults: false,
          resultsCombiner: 'abbabbc',
          filterByEligibleDate: true,
          includeProspective: true,
        },
      },
      tradeInId: null,
    },
    query: 'query searchAdV9AdsV2($search: EsSearchRequestProjectionInput!, $tradeInId: UUID) { searchAdV9AdsV2(search: $search, tradeInId: $tradeInId) }',
  });
}`;

const CODE_CONTAR = `// El cuerpo de la llamada que cuenta: pide UN coche y mira el total.
${CUERPO}
return [{ json: { cuerpo: cuerpo(0, 1) } }];`;

const CODE_PAGINAS = `// Cuántas llamadas hacen falta hoy.
${CUERPO}

const res = $input.first().json;
// Con fullResponse n8n deja el cuerpo en 'body' si la respuesta es JSON y en
// 'data' si se pidió como texto. Se miran los dos.
const raiz = (res && res.body) ? res.body : ((res && res.data && res.data.data) ? res.data : res);
const nodo = ((raiz || {}).data || {}).searchAdV9AdsV2 || {};
const total = Number(nodo.total) || 0;
const codigo = Number((res || {}).statusCode || 0);

if (codigo && codigo !== 200) {
  console.log('[autohero] su API contestó ' + codigo + '. Nada que hacer.');
  return [];
}
if (!(total > 0)) {
  // Sin medida no se inventa un número: una pasada que no hace nada y lo dice
  // es mejor que una que recorre ciento veinte páginas vacías.
  console.log('[autohero] su API no dice cuántos coches tiene. Nada que hacer.');
  return [];
}

let llamadas = Math.ceil(total / ${POR_LLAMADA});
if (llamadas > ${TOPE_LLAMADAS}) llamadas = ${TOPE_LLAMADAS};
const out = [];
for (let i = 0; i < llamadas; i++) {
  const offset = i * ${POR_LLAMADA};
  out.push({ json: { offset: offset, cuerpo: cuerpo(offset, ${POR_LLAMADA}) } });
}
console.log('[autohero] ' + total + ' coches en ' + llamadas + ' llamadas de ${POR_LLAMADA}');
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "autohero-transformar.js"), "utf8");

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
// 8:50 y 20:50: huecos libres. No pisa a OcasionPlus (8:40 y 20:40), ni a
// AutoScout24 DE (8:40), ni a Autocasión (8:20 y 19:20).
const CRON = "2 veces/día (8:50 y 20:50)";
const nodos = [
  { parameters: {}, id: "ah-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-820, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 50 8,20 * * *" }] } },
    id: "ah-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-820, 400] },
  { parameters: { jsCode: CODE_CONTAR }, id: "ah-cuerpo-contar",
    name: "Code: Cuerpo de la llamada que cuenta",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-620, 300] },
  { parameters: { method: "POST", url: API, sendBody: true, specifyBody: "json",
      jsonBody: "={{ $json.cuerpo }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "ah-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-420, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "ah-paginas", name: "Code: Generar llamadas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-220, 300] },
  { parameters: { options: {} }, id: "ah-loop", name: "Loop: cien en cien",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [0, 300] },
  { parameters: { method: "POST", url: API, sendBody: true, specifyBody: "json",
      jsonBody: "={{ $json.cuerpo }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "ah-http", name: "HTTP: Cien coches de su API",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [240, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "ah-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [480, 420] },
  { parameters: condicion("ah-c-sql", "sql"), id: "ah-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [720, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ah-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [960, 340],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente": { main: [[L("Code: Cuerpo de la llamada que cuenta")]] },
  [CRON]:                 { main: [[L("Code: Cuerpo de la llamada que cuenta")]] },
  "Code: Cuerpo de la llamada que cuenta": { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo": { main: [[L("Code: Generar llamadas")]] },
  "Code: Generar llamadas":   { main: [[L("Loop: cien en cien")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada llamada. Tenerlas al
  // revés dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de
  // Autocasión.
  "Loop: cien en cien":       { main: [[], [L("HTTP: Cien coches de su API")]] },
  "HTTP: Cien coches de su API": { main: [[L("Code: Transformar ofertas")]] },
  "Code: Transformar ofertas": { main: [[L("IF: ¿hay ofertas?")]] },
  // Una llamada que falla no para la pasada: vuelve al bucle y sigue. El IF es
  // el que impide mandar a Postgres un SQL vacío.
  "IF: ¿hay ofertas?":        { main: [[L("PG: Upsert ofertas")], [L("Loop: cien en cien")]] },
  "PG: Upsert ofertas":       { main: [[L("Loop: cien en cien")]] },
};

const wf = {
  name: "Autohero – Scraper (mercado)",
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

const destino = path.join(RAIZ, "n8n-workflows", "autohero-scraper-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  25 llamadas de " + POR_LLAMADA + " para 2.407 coches: el catálogo entero en 82 s");
console.log("  arregla el combustible de 839 coches (el 56 % de los vivos)");
