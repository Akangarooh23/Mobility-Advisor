/**
 * CanalCar – Scraper (mercado)
 *
 * El origen de n8n-workflows/canalcar-scraper-offers.json.
 *
 *   node scripts/genera-scraper-canalcar.js
 *   npm run test:canalcar
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * Porque el que había NO ESTABA CORRIENDO. En n8n no había ni un flujo de
 * CanalCar: los dos JSON que hay en el repo llevaban una credencial de Postgres
 * de otra instalación, que aquí no existe, y por eso nunca llegaron a
 * importarse. La última vez que vimos un coche de este portal fue el 1 de
 * septiembre; hoy es el 22.
 *
 * Tres semanas sin mirar se notan: de las 459 que damos por vivas, 103 ya no
 * están en su catálogo y 98 coches suyos no los tenemos.
 *
 * ── Por dónde entra ────────────────────────────────────────────────────────
 *
 * Por el listado, en tarjetas <article class="vehicle"> con todo dentro:
 * data-coche-id, ruta, título, versión, año, kilómetros, combustible, cambio,
 * ubicación, foto, precio al contado y cuota mensual.
 *
 * 71 por página y 454 coches: siete páginas, o sea el catálogo entero en
 * menos de diez segundos. No hace falta partirlo en orquestador y segmento
 * como en Flexicar o AutoScout24.
 *
 * ── Lo que esto arregla, medido ────────────────────────────────────────────
 *
 * De las 459 filas vivas de hoy:
 *
 *     provincia        0 %   ->  la tarjeta la trae ("Madrid", las 454)
 *     cuota mensual    0 %   ->  la tarjeta la trae ("442 €/mes")
 *     combustible          ->  ya estaba al 100 %, se mantiene
 *
 * Lo que la tarjeta NO trae -color, puertas, plazas, carrocería, potencia- se
 * queda como está: de eso se encarga el enriquecedor.
 *
 * ── El id no está en la url ────────────────────────────────────────────────
 *
 * En CanalCar la url es /coches-ocasion/marca/modelo/version-en-texto, sin
 * número. El id vive en el atributo data-coche-id de la tarjeta, y es lo único
 * que identifica al coche: 11 de las 454 tarjetas enlazan a una ruta cuyo
 * último tramo es de OTRA versión. Por eso el verificador cruza por id y no
 * por url -haciéndolo por url, su sitemap daba por muertos 51 coches que
 * siguen a la venta-.
 *
 * ── Su robots.txt ──────────────────────────────────────────────────────────
 *
 * No declara Crawl-delay para nadie. Solo prohíbe /aviso-legal, /privacidad y
 * /politica-cookies. Mirado grupo por grupo, no de un vistazo: en OcasionPlus
 * leí un Crawl-delay que resultó ser solo para tres rastreadores de SEO.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

/*
 * La credencial de Postgres que EXISTE en esta instalación de n8n.
 *
 * Los JSON viejos de CanalCar traían otra, de una instalación anterior, y por
 * eso nunca llegaron a importarse. n8n ya no casa las credenciales por nombre:
 * si el id no existe, los nodos entran SIN credencial, corren y no escriben
 * nada. Un workflow así no falla a gritos, parece que va bien.
 *
 * Aquí no se escribe el id viejo, y es a propósito: este fichero ya tuvo un
 * find/replace de un id por otro que alcanzó también a los comentarios que
 * hablaban del malo, y durante días dijeron que la credencial buena «no
 * existe» justo encima de la línea que la usa.
 */
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const BASE = "https://www.canalcar.es/coches-ocasion";
const POR_PAGINA = 71;
const TOPE_PAGINAS = 40;   // freno: 2.840 coches de margen sobre los 454 de hoy

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
 * Dos medidas, y se hace caso a la mayor.
 *
 * (1) LOS ENLACES DE PAGINACIÓN. El listado enlaza todas sus páginas,
 *     ?page=2 ... ?page=7. El número más alto es la última página.
 * (2) EL CAMPO OCULTO <input id="resultado-total-coches" value="454">, que da
 *     el total de coches.
 *
 * Se usa la mayor de las dos porque fallan de maneras distintas: si un día
 * dejan de pintar los enlaces queda el total, y si le cambian el nombre al
 * campo quedan los enlaces. Quedarse corto significa no ver los coches de las
 * últimas páginas, y eso no se nota: la pasada termina en verde.
 *
 * (El total también está escrito en prosa, «Mostrando del 1 al 71 de 454 de
 * segunda mano». No se lee de ahí: buscar el número detrás del último ' de '
 * cae en «de segunda mano» y da cero. Lo intenté y eso hacía.)
 *
 * Sin expresiones regulares: este código viaja dentro de una cadena y dentro
 * de un JSON, y por el camino las barras se pierden. Ha pasado seis veces.
 */
let porEnlaces = 0;
{
  let i = 0;
  for (;;) {
    const j = html.indexOf('page=', i);
    if (j === -1) break;
    let n = '';
    for (let k = j + 5; k < j + 11; k++) {
      const ch = html.charAt(k);
      if (ch >= '0' && ch <= '9') n += ch; else break;
    }
    if (n && Number(n) > porEnlaces) porEnlaces = Number(n);
    i = j + 1;
  }
}

let total = 0;
{
  const i = html.indexOf('resultado-total-coches');
  if (i !== -1) {
    // El value puede ir detrás del id o delante; se mira a los dos lados.
    let j = html.indexOf('value="', i);
    if (j === -1 || j - i > 60) j = html.lastIndexOf('value="', i);
    if (j !== -1 && Math.abs(j - i) < 120) {
      let n = '';
      for (let k = j + 7; k < j + 20; k++) {
        const ch = html.charAt(k);
        if (ch >= '0' && ch <= '9') n += ch;
        else if (ch === '.') continue;
        else break;
      }
      total = Number(n) || 0;
    }
  }
}

const porTotal = total > 0 ? Math.ceil(total / ${POR_PAGINA}) : 0;
let paginas = Math.max(porEnlaces, porTotal);
if (paginas > ${TOPE_PAGINAS}) paginas = ${TOPE_PAGINAS};
if (!(paginas > 0)) {
  // Sin medida no se inventa un número: una pasada que no hace nada y lo dice
  // es mejor que una que recorre cuarenta páginas vacías.
  console.log('[canalcar] el listado no dice cuántas páginas tiene. Nada que hacer.');
  return [];
}

const out = [];
for (let p = 1; p <= paginas; p++) {
  out.push({ json: { page: p, url: p === 1 ? '${BASE}' : '${BASE}?page=' + p } });
}
console.log('[canalcar] ' + (total || '?') + ' coches; ' + paginas + ' páginas'
  + ' (los enlaces dicen ' + porEnlaces + ', el total dice ' + porTotal + ')');
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "canalcar-transformar.js"), "utf8");

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
// 11:15 y 23:15: huecos libres. No pisa a Importación-daños (11:05), ni a
// coches.com (11:40 y 23:40), ni a Clicars verificar (11:50), ni a
// AutoScout24 verificar (23:25).
const CRON = "2 veces/día (11:15 y 23:15)";
const nodos = [
  { parameters: {}, id: "cc-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-600, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 15 11,23 * * *" }] } },
    id: "cc-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-600, 400] },
  { parameters: { url: BASE, ...CABECERAS, options: OPCIONES_HTTP },
    id: "cc-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-400, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "cc-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-200, 300] },
  { parameters: { options: {} }, id: "cc-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [0, 300] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "cc-http", name: "HTTP: Página del listado",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [240, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "cc-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [480, 420] },
  { parameters: condicion("cc-c-sql", "sql"), id: "cc-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [720, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cc-pg", name: "PG: Upsert ofertas",
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
  // Una página sin tarjetas -la 8 devuelve un 520- no para la pasada: vuelve al
  // bucle y sigue. El IF es el que impide mandar a Postgres un SQL vacío.
  "IF: ¿hay ofertas?":         { main: [[L("PG: Upsert ofertas")], [L("Loop: página por página")]] },
  "PG: Upsert ofertas":        { main: [[L("Loop: página por página")]] },
};

const wf = {
  // El id que n8n le dio la primera vez. Sin el, importar no actualiza:
  // crea una copia con su propio cron y n8n lo da por bueno. Y NO vale
  // inventarse uno: tiene que ser este, o la copia se crea igual.
  id: "YkWL92848ZH87dAI",
  name: "CanalCar – Scraper (mercado)",
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

const destino = path.join(RAIZ, "n8n-workflows", "canalcar-scraper-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  7 páginas de " + POR_PAGINA + " coches: cada pasada recorre el catálogo entero");
