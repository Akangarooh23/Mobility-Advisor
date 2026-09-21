/**
 * Flexicar – scraper de mercado (orquestador + segmento)
 *
 * Genera LOS DOS ficheros, porque van juntos.
 *
 *   node scripts/genera-scraper-flexicar.js
 *   npm run enlaza-segmento-flexicar     (tras importar el segmento)
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * El que había no llegó a importarse nunca en n8n, y arrastraba todo lo que
 * hemos aprendido desde entonces: cron a las 3:00 -fuera de la franja de 8:00
 * a 00:00-, sin cabeceras, sin reintentos en Postgres, sin onError.
 *
 * Pero sobre todo, entraba por la puerta equivocada. Flexicar rompió la
 * paginación del listado -?page=2 y ?page=50 devuelven los mismos 12 coches,
 * comprobado hoy- y aquel scraper se apañaba con un truco de facetas: pedía
 * ~92 «rodajas» (marca, carrocería, combustible) y se quedaba con los 12
 * destacados de cada una. Unas 1.100 URLs por vuelta de un catálogo de 22.833.
 *
 * ── La puerta buena ────────────────────────────────────────────────────────
 *
 * El navegador no usa el listado: pide los coches a una API propia, que estaba
 * escondida en el bundle de Next (módulo 75459, BASE_URL).
 *
 *     https://services.flexicar.es/api/v1/vehicles?page=N
 *
 * Devuelve {results, page, pages, total, hasNext}, 12 por página, y pagina de
 * verdad hasta el final: medido hoy, la 1.903 trae 7 coches y hasNext false, y
 * la 1.904 viene vacía. Entre 100 y 350 ms por página.
 *
 * 1.903 páginas a ese ritmo son unos 8 minutos, así que aquí NO hay ventana ni
 * cursor que reparta días: CADA PASADA RECORRE EL CATÁLOGO ENTERO. Eso es lo
 * que hace barato el verificador -lo que no aparece en una vuelta completa
 * está vendido- en vez de tener que pedir ficha por ficha.
 *
 * El cursor se queda igualmente, pero solo para dos cosas: apuntar cuántas
 * páginas tiene el portal hoy y por dónde seguir si una pasada se corta.
 *
 * ── El reparto en segmentos ────────────────────────────────────────────────
 *
 * n8n guarda en memoria la salida de cada vuelta del bucle, así que 1.903
 * vueltas en una sola ejecución es justo lo que tumbó el proceso el 17-sep con
 * «possible out-of-memory». Por eso el trabajo va en sub-workflow: 20 ventanas
 * de 100 páginas, y la memoria de cada segmento se libera al acabar.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// El id del workflow «Flexicar – Segmento (páginas)» YA IMPORTADO en n8n.
// Se rellena solo con:  npm run enlaza-segmento-flexicar
const ID_SEGMENTO = "gNOj8nuSxuRP3Hxd";

const PAGINAS_POR_SEGMENTO = 100;
const SEGMENTOS_POR_PASADA = 20;   // 2.000 páginas: el catálogo entero cabe
// Sin nodo Wait: en Autocasión costaba casi 4 segundos por vuelta -no el 1 que
// declaraba, porque n8n guarda el estado de la ejecución para poder reanudarla.
const TOPE_PAGINAS = 4000;         // freno por si la API se vuelve loca

const API = "https://services.flexicar.es/api/v1/vehicles";

// La API no es el sitio web: pide Accept de JSON y mira de dónde viene.
const CABECERAS_API = {
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "application/json" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
    { name: "Origin", value: "https://www.flexicar.es" },
    { name: "Referer", value: "https://www.flexicar.es/" },
  ] },
};
const CABECERAS_WEB = {
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
  ] },
};
// responseFormat 'text' y no 'json' a propósito: así el cuerpo llega igual que
// en todos los demás -en 'data'- y el Code decide cuándo parsear. Con 'json' un
// día que la API devuelva HTML de error, el nodo peta antes de llegar al Code.
const OPCIONES_HTTP = {
  response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
  timeout: 30000,
  redirect: { redirect: { followRedirects: true } },
};

// ══ EL ORQUESTADOR ═════════════════════════════════════════════════════════
const CURSOR_SQL = `-- Por dónde iba la última pasada y cuántas páginas tenía el portal.
--
-- En Postgres y no en $getWorkflowStaticData, que se reinicia al reimportar.
--
-- El filtro va con '=' y no con LIKE: en LIKE el «_» es un comodín de un
-- carácter, y 'flexicar_pag_%' casaría también con 'flexicar_pagina'. Eso
-- contaba una marca de más en Autocasión.
SELECT clave, valor FROM moveadvisor_cursores
WHERE clave IN ('flexicar_pagina', 'flexicar_paginas')`;

const CODE_SEGMENTOS = `// Reparte el catálogo en ventanas de páginas.
const PAGINAS = ${PAGINAS_POR_SEGMENTO};
const SEGMENTOS = ${SEGMENTOS_POR_PASADA};
const TOPE = ${TOPE_PAGINAS};

const filas = $('PG: Por dónde íbamos').all().map(x => x.json);
const mapa = {};
for (const f of filas) mapa[f.clave] = Number(f.valor);

// Cuántas páginas hay HOY, medido en vivo: la API lo dice en 'pages'.
const res = $input.first().json;
const cuerpo = String(res.data || res.body || '');
let paginas = 0;
let total = 0;
let provincias = {};
try {
  const j = JSON.parse(cuerpo);
  paginas = Number(j.pages) || 0;
  total = Number(j.total) || 0;
} catch (e) { paginas = 0; }

// Si la API no contesta, se tira del último número conocido. Quedarse sin
// medida no debe dejar la pasada sin hacer nada.
if (!(paginas > 0)) paginas = Number(mapa['flexicar_paginas']) || 0;
paginas = Math.min(paginas, TOPE);

if (!(paginas > 0)) {
  console.log('[flexicar] la API no dice cuántas páginas hay y no había número guardado. Nada que repartir.');
  return [{ json: { desde: 0, hasta: 0, provincias: {}, sqlCursor: null } }];
}

// El mapa slug -> provincia, del propio listado. La API de vehículos no trae
// provincia, solo el nombre del concesionario.
try {
  const web = $('HTTP: Listado (provincias)').first().json;
  const html = String(web.data || web.body || '');
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\\/script>/);
  if (m) {
    const pp = JSON.parse(m[1]).props.pageProps;
    for (const d of (pp.dealerships || [])) {
      const clave = String(d.value || '');
      if (clave && d.province) provincias[clave] = String(d.province);
    }
  }
} catch (e) { provincias = {}; }
console.log('[flexicar] ' + Object.keys(provincias).length + ' concesionarios con provincia');

// Dónde empieza esta pasada. Normalmente en 1: el catálogo entero cabe en una.
let pag = Number(mapa['flexicar_pagina']);
if (!Number.isFinite(pag) || pag < 1 || pag > paginas) pag = 1;

const out = [];
while (out.length < SEGMENTOS && pag <= paginas) {
  out.push({ json: {
    desde: pag,
    hasta: Math.min(pag + PAGINAS - 1, paginas),
    provincias: provincias,
  } });
  pag += PAGINAS;
}
// Si se ha llegado al final, la próxima empieza otra vez por el principio.
const siguiente = pag > paginas ? 1 : pag;

// Se apunta ANTES de scrapear: si la pasada se cae a la mitad, la siguiente
// sigue avanzando en vez de repetir lo mismo.
const sqlCursor = "INSERT INTO moveadvisor_cursores (clave, valor, actualizado) VALUES "
  + "('flexicar_pagina', " + siguiente + ", NOW()), "
  + "('flexicar_paginas', " + paginas + ", NOW())"
  + " ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = NOW()";
for (const o of out) o.json.sqlCursor = sqlCursor;

console.log('[flexicar] ' + total + ' coches en ' + paginas + ' páginas. '
  + out.length + ' ventanas de ' + PAGINAS + ', de la ' + out[0].json.desde
  + ' a la ' + out[out.length - 1].json.hasta
  + '. La próxima pasada empieza en la ' + siguiente + '.');
return out;`;

// ══ EL SEGMENTO ════════════════════════════════════════════════════════════
const CODE_PARAMS = `const inp = $input.item.json || {};

// SIN ventana no se hace nada. En Autocasión había aquí un valor por defecto y
// el 15-sep, al recibir un segmento vacío, se puso a scrapear otra marca por su
// cuenta: 360 ofertas saltándose el cursor. Un defecto esconde el fallo.
const desde = Number(inp.desde);
const hasta = Number(inp.hasta);
if (!(desde > 0) || !(hasta >= desde)) {
  console.log('[flexicar] segmento sin ventana de páginas: no hay nada que hacer.');
  return [];
}

return [{ json: {
  desde: desde,
  hasta: hasta,
  provincias: inp.provincias || {},
} }];`;

const CODE_PAGINAS = `// Las páginas de esta ventana, una por item.
const seg = $input.first().json;
const out = [];
for (let p = seg.desde; p <= seg.hasta; p++) {
  out.push({ json: { page: p, url: '${API}?page=' + p } });
}
console.log('[flexicar] ventana ' + seg.desde + '-' + seg.hasta + ': ' + out.length + ' páginas');
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "flexicar-transformar.js"), "utf8");

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

// ── el orquestador ─────────────────────────────────────────────────────────
// 9:10 y 21:10: huecos libres. No pisa al scraper de Autocasión (8:20 y 19:20),
// ni al alemán (8:15 y 20:15), ni al español de AutoScout24 (13:30 y 16:30),
// ni a coches.com (11:40 y 23:40).
const CRON_ORQ = "2 veces/día (9:10 y 21:10)";
const nodosOrq = [
  { parameters: {}, id: "fx-o-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-620, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 10 9,21 * * *" }] } },
    id: "fx-o-cron", name: CRON_ORQ,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-620, 400] },
  { parameters: { operation: "executeQuery", query: CURSOR_SQL, options: {} },
    id: "fx-o-cursor", name: "PG: Por dónde íbamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-440, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { url: "https://www.flexicar.es/coches-segunda-mano/", ...CABECERAS_WEB, options: OPCIONES_HTTP },
    id: "fx-o-web", name: "HTTP: Listado (provincias)",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-260, 300] },
  { parameters: { url: API + "?page=1", ...CABECERAS_API, options: OPCIONES_HTTP },
    id: "fx-o-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-80, 300] },
  { parameters: { jsCode: CODE_SEGMENTOS }, id: "fx-o-gen",
    name: "Code: Generar segmentos (ventanas de páginas)",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [100, 300] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sqlCursor }}", options: {} },
    id: "fx-o-guardar", name: "PG: Apuntar dónde nos quedamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [300, 140],
    credentials: PG_CRED, ...REINTENTA, executeOnce: true },
  { parameters: { options: {} }, id: "fx-o-loop", name: "Loop: segmento por segmento",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [300, 340] },
  { parameters: condicion("fx-o-c-desde", "desde"), id: "fx-o-if",
    name: "IF: ¿hay ventana que scrapear?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [480, 440] },
  // typeVersion 1 quiere el id COMO TEXTO: con la forma de objeto n8n lo
  // interpola como "[object Object]" y dice «Workflow does not exist».
  //
  // Y ESPERA a cada segmento: sin esto dispara las 20 ventanas de golpe y deja
  // veinte ejecuciones en paralelo. El 16-sep eso hundió el verificador de
  // Autocasión a 17 ofertas/min.
  { parameters: { workflowId: ID_SEGMENTO, options: { waitForSubWorkflow: true } },
    id: "fx-o-sub", name: "Scrapear segmento (Flexicar – Segmento)",
    type: "n8n-nodes-base.executeWorkflow", typeVersion: 1, position: [680, 440] },
];

const conexionesOrq = {
  "Ejecutar manualmente": { main: [[L("PG: Por dónde íbamos")]] },
  [CRON_ORQ]:             { main: [[L("PG: Por dónde íbamos")]] },
  "PG: Por dónde íbamos": { main: [[L("HTTP: Listado (provincias)")]] },
  "HTTP: Listado (provincias)": { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo": { main: [[L("Code: Generar segmentos (ventanas de páginas)")]] },
  "Code: Generar segmentos (ventanas de páginas)": {
    main: [[L("PG: Apuntar dónde nos quedamos"), L("Loop: segmento por segmento")]] },
  "Loop: segmento por segmento": { main: [[], [L("IF: ¿hay ventana que scrapear?")]] },
  "IF: ¿hay ventana que scrapear?": {
    main: [[L("Scrapear segmento (Flexicar – Segmento)")], [L("Loop: segmento por segmento")]] },
  "Scrapear segmento (Flexicar – Segmento)": { main: [[L("Loop: segmento por segmento")]] },
};

// ── el segmento ────────────────────────────────────────────────────────────
const nodosSeg = [
  { parameters: {}, id: "fx-s-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: {}, id: "fx-s-trigger", name: "Llamada desde orquestador",
    type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { jsCode: CODE_PARAMS }, id: "fx-s-params", name: "Params",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-340, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "fx-s-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-120, 300] },
  { parameters: { options: {} }, id: "fx-s-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [120, 300] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS_API, options: OPCIONES_HTTP },
    id: "fx-s-http", name: "HTTP: Página de la API",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [360, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "fx-s-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [600, 420] },
  { parameters: condicion("fx-s-c-sql", "sql"), id: "fx-s-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [840, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "fx-s-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1080, 340],
    credentials: PG_CRED, ...REINTENTA },
];

const conexionesSeg = {
  "Ejecutar manualmente":      { main: [[L("Params")]] },
  "Llamada desde orquestador": { main: [[L("Params")]] },
  "Params":                    { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":     { main: [[L("Loop: página por página")]] },
  "Loop: página por página":   { main: [[], [L("HTTP: Página de la API")]] },
  "HTTP: Página de la API":    { main: [[L("Code: Transformar ofertas")]] },
  "Code: Transformar ofertas": { main: [[L("IF: ¿hay ofertas?")]] },
  "IF: ¿hay ofertas?":         { main: [[L("PG: Upsert ofertas")], [L("Loop: página por página")]] },
  "PG: Upsert ofertas":        { main: [[L("Loop: página por página")]] },
};

const ajustes = {
  executionOrder: "v1",
  saveManualExecutions: true,
  saveDataSuccessExecution: "none",
  saveDataErrorExecution: "all",
  callerPolicy: "workflowsFromSameOwner",
  errorWorkflow: ERROR_WF,
};

const escribe = (fichero, wf) => {
  const destino = path.join(RAIZ, "n8n-workflows", fichero);
  fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
  console.log("escrito  " + destino + "   (" + wf.nodes.length + " nodos)");
};

escribe("flexicar-scraper-offers.json", {
  name: "Flexicar – Scraper (orquestador)",
  nodes: nodosOrq, connections: conexionesOrq, settings: ajustes, pinData: {},
});
escribe("flexicar-segmento.json", {
  name: "Flexicar – Segmento (páginas)",
  nodes: nodosSeg, connections: conexionesSeg, settings: ajustes, pinData: {},
});

const porPasada = SEGMENTOS_POR_PASADA * PAGINAS_POR_SEGMENTO;
console.log("  " + SEGMENTOS_POR_PASADA + " ventanas x " + PAGINAS_POR_SEGMENTO
  + " páginas = " + porPasada + " páginas por pasada (" + (porPasada * 12).toLocaleString("es") + " coches)");
console.log("  el catálogo son ~1.903 páginas: cada pasada lo recorre ENTERO");
if (ID_SEGMENTO === "PENDIENTE_DE_ENLAZAR") {
  console.log("  OJO: el orquestador todavía no sabe a quién llamar.");
  console.log("       Importa el segmento y lanza: npm run enlaza-segmento-flexicar");
}

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "flexicar-scraper-offers.json"), "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Generar segmentos (ventanas de páginas)").parameters.jsCode;
const bien = js.indexOf("[\\s\\S]*?") >= 0 && js.indexOf("<\\/script>") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "el regex del __NEXT_DATA__ conserva sus barras");
if (!bien) process.exit(1);
