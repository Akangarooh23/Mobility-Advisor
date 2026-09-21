/**
 * Clicars – Scraper (mercado)
 *
 * El origen de n8n-workflows/clicars-scraper-offers.json.
 *
 *   node scripts/genera-scraper-clicars.js
 *   npm run test:clicars
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * Llevaba parado desde el 17 de agosto, y el portal ha cambiado debajo. De 30
 * ofertas nuestras tomadas al azar hoy:
 *
 *     6   siguen vivas                 20 %
 *    13   vendidas                     43 %
 *    10   su url la tiene otro coche   33 %
 *     1   redirige                      3 %
 *
 * Damos 2.788 por vivas y el portal declara 1.257. Y no es solo catálogo: son
 * comparables españoles, de su mediana sale market_price_es y de ahí el margen
 * de cada coche alemán.
 *
 * ── La url que guardábamos no era de un coche ──────────────────────────────
 *
 * Clicars sirve dos formas, y solo una identifica a un coche:
 *
 *     /coches-segunda-mano-ocasion/comprar-toyota-yaris-...-2015-139250
 *     /coches-segunda-mano-ocasion/toyota/yaris/yaris-1-0-city-...
 *
 * La segunda es la página de la VERSIÓN. En nuestra base hay 18 coches
 * distintos compartiendo una sola, y 2.083 de las 2.788 filas la tienen
 * guardada. Ese era el «33 % de urls que tiene otro coche»: nunca fueron
 * nuestras. La primera acaba en el id y es la que se guarda ahora.
 *
 * Además, el portal resuelve por el id: comprar-coche-139250 devuelve la ficha
 * correcta. Eso es lo que hace posibles el verificador y el enriquecedor, que
 * se construyen la url con el id sin depender de lo que haya guardado.
 *
 * ── Por dónde entra ────────────────────────────────────────────────────────
 *
 * Por el listado, en tarjetas <article data-vehicle-web-id="139250"> con todo
 * dentro: marca, modelo, versión, año, kilómetros, potencia, cambio, imagen y
 * los cuatro precios. Doce por página; 1.257 coches son 105 páginas, o sea una
 * vuelta entera en medio minuto.
 *
 * No hace falta partirlo en orquestador y segmento como en Flexicar o
 * AutoScout24: allí son 660 y 1.900 páginas y el bucle se come la memoria;
 * aquí son 105.
 *
 * ── Su robots.txt ──────────────────────────────────────────────────────────
 *
 * No declara Crawl-delay para nadie, y no prohíbe ni el listado ni las fichas.
 * (En OcasionPlus leí un Crawl-delay que resultó ser solo para tres
 * rastreadores de SEO; aquí lo he mirado grupo por grupo.)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// El id de la credencial que EXISTE en n8n.
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const BASE = "https://www.clicars.com/coches-segunda-mano-ocasion";
const POR_PAGINA = 12;
const TOPE_PAGINAS = 400;   // freno por si el contador se vuelve loco

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

const CODE_PAGINAS = `// Cuántas páginas hay hoy, y la lista de urls.
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const html = String(res.data || res.body || '');

/*
 * El total, de la frase «1.257 coches» del propio listado.
 *
 * Sin expresión regular: este código viaja dentro de una cadena y dentro de un
 * JSON, y por el camino las barras se pierden. Ha pasado cuatro veces hoy.
 */
let total = 0;
const i = html.indexOf(' coches');
if (i !== -1) {
  let n = '';
  for (let k = i - 1; k >= 0 && k > i - 12; k--) {
    const ch = html.charAt(k);
    if (ch >= '0' && ch <= '9') n = ch + n;
    else if (ch === '.') continue;
    else break;
  }
  total = Number(n) || 0;
}

let paginas = total > 0 ? Math.ceil(total / ${POR_PAGINA}) : 0;
if (paginas > ${TOPE_PAGINAS}) paginas = ${TOPE_PAGINAS};
if (!(paginas > 0)) {
  // Sin medida no se inventa un número: una pasada que no hace nada y lo dice
  // es mejor que una que recorre cuatrocientas páginas vacías.
  console.log('[clicars] el listado no dice cuántos coches tiene. Nada que hacer.');
  return [];
}

const out = [];
for (let p = 1; p <= paginas; p++) {
  out.push({ json: { page: p, url: p === 1 ? '${BASE}' : '${BASE}?page=' + p } });
}
console.log('[clicars] ' + total + ' coches en ' + paginas + ' páginas');
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "clicars-transformar.js"), "utf8");

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
// 9:35 y 21:35: huecos libres. No pisa a Flexicar (9:10 y 21:10), ni a
// OcasionPlus (8:40 y 20:40), ni a AutoScout24 (8:15 y 20:15).
const CRON = "2 veces/día (9:35 y 21:35)";
const nodos = [
  { parameters: {}, id: "cl-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-600, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 35 9,21 * * *" }] } },
    id: "cl-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-600, 400] },
  { parameters: { url: BASE, ...CABECERAS, options: OPCIONES_HTTP },
    id: "cl-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-400, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "cl-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-200, 300] },
  { parameters: { options: {} }, id: "cl-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [0, 300] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "cl-http", name: "HTTP: Página del listado",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [240, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "cl-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [480, 420] },
  { parameters: condicion("cl-c-sql", "sql"), id: "cl-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [720, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cl-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [960, 340],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":      { main: [[L("HTTP: Contar el catálogo")]] },
  [CRON]:                      { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo":  { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":     { main: [[L("Loop: página por página")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada página. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: página por página":   { main: [[], [L("HTTP: Página del listado")]] },
  "HTTP: Página del listado":  { main: [[L("Code: Transformar ofertas")]] },
  "Code: Transformar ofertas": { main: [[L("IF: ¿hay ofertas?")]] },
  "IF: ¿hay ofertas?":         { main: [[L("PG: Upsert ofertas")], [L("Loop: página por página")]] },
  "PG: Upsert ofertas":        { main: [[L("Loop: página por página")]] },
};

const wf = {
  name: "Clicars – Scraper (mercado)",
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

const destino = path.join(RAIZ, "n8n-workflows", "clicars-scraper-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  ~105 páginas de " + POR_PAGINA + " coches: cada pasada recorre el catálogo entero");
