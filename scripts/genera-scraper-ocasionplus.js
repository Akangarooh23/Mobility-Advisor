/**
 * OcasionPlus – scraper de mercado (orquestador + segmento)
 *
 * Genera LOS DOS ficheros, porque van juntos.
 *
 *   node scripts/genera-scraper-ocasionplus.js
 *   npm run enlaza-segmento-ocasionplus     (tras importar el segmento)
 *   npm run test:ocasionplus
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * El que había llevaba parado desde el 17 de agosto y arrastraba lo de siempre:
 * cron a las 23:00 en un solo tirón, sin reintentos en Postgres, sin onError y
 * sin aviso por correo. Pero sobre todo, un mes parado deja el portal así:
 *
 *     dábamos por vivas      10.209
 *     siguen en su catálogo   8.036
 *     vendidas                2.173   (el verificador ya las retira)
 *     suyas que no tenemos    4.702   <- esto es lo que arregla el scraper
 *
 * Y no es solo catálogo: son comparables españoles. De su mediana sale
 * market_price_es y de ahí el margen de cada coche alemán.
 *
 * ── Por dónde entra ────────────────────────────────────────────────────────
 *
 * Por el listado, que publica sus coches en un bloque JSON-LD de tipo ItemList:
 * veinte por página, con marca, modelo, versión, año, kilómetros, precio,
 * combustible, cambio, imagen y url. La potencia va dentro del nombre —«Toyota
 * C-HR 1.8 125H Advance (122 CV)»— y se saca de ahí.
 *
 * 13.191 coches son unas 660 páginas. Cada pasada las recorre todas.
 *
 * OJO CON LA PÁGINA 1: es la url base. `?page=1` devuelve 404, así que la
 * primera se pide sin parámetro. Eso ya estaba en el scraper viejo y se
 * conserva.
 *
 * ── Su robots.txt ──────────────────────────────────────────────────────────
 *
 * Prohíbe las urls con filtros —marca, modelo, precio, orden— y las de pedir
 * cita. Nada de eso se usa aquí: solo `?page=N`, que no está prohibido, y las
 * fichas, que tampoco.
 *
 * Su `Crawl-delay: 60` es solo para dotbot, AhrefsBot y SemrushBot. Al grupo
 * «*» no le pide ninguna espera. (Lo leí mal la primera vez y diseñé el
 * verificador creyendo que nos afectaba; está corregido allí.)
 *
 * ── El reparto en segmentos ────────────────────────────────────────────────
 *
 * n8n guarda en memoria la salida de cada vuelta del bucle, así que 660 vueltas
 * en una sola ejecución es lo que tumbó el proceso el 17-sep con «possible
 * out-of-memory». Por eso el trabajo va en sub-workflow: ventanas de 100
 * páginas, y la memoria de cada segmento se libera al acabar.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// El id de la credencial que EXISTE en n8n. La plantilla de la que salieron
// estos generadores llevaba otro que no existe en esta máquina, y los nodos
// entraban sin credencial: dos triángulos de aviso y nada que escribiera.
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// El id del workflow «OcasionPlus – Segmento (páginas)» YA IMPORTADO en n8n.
// Se rellena solo con:  npm run enlaza-segmento-ocasionplus
const ID_SEGMENTO = "PENDIENTE_DE_ENLAZAR";

const BASE = "https://www.ocasionplus.com/coches-segunda-mano";
const POR_PAGINA = 20;
const PAGINAS_POR_SEGMENTO = 100;
const SEGMENTOS_POR_PASADA = 8;   // 800 páginas: las ~660 del catálogo caben
const TOPE_PAGINAS = 2000;        // freno por si el contador se vuelve loco

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

// ══ EL ORQUESTADOR ═════════════════════════════════════════════════════════
const CURSOR_SQL = `-- Por dónde iba la última pasada y cuántas páginas tenía el portal.
--
-- En Postgres y no en $getWorkflowStaticData, que se reinicia al reimportar.
SELECT clave, valor FROM moveadvisor_cursores
WHERE clave IN ('ocasionplus_pagina', 'ocasionplus_paginas')`;

const CODE_SEGMENTOS = `// Reparte el catálogo en ventanas de páginas.
const PAGINAS = ${PAGINAS_POR_SEGMENTO};
const SEGMENTOS = ${SEGMENTOS_POR_PASADA};
const TOPE = ${TOPE_PAGINAS};
const POR_PAGINA = ${POR_PAGINA};

const filas = $('PG: Por dónde íbamos').all().map(x => x.json);
const mapa = {};
for (const f of filas) mapa[f.clave] = Number(f.valor);

// Cuántos coches tiene HOY, medido en vivo: lo dice su propio JSON-LD, en el
// bloque Product, como offerCount.
const res = $input.first().json;
const html = String(res.data || res.body || '');
let total = 0;
for (const trozo of html.split('application/ld+json').slice(1)) {
  const ini = trozo.indexOf('>');
  const fin = trozo.indexOf('</script>');
  if (ini === -1 || fin === -1) continue;
  let j = null;
  try { j = JSON.parse(trozo.slice(ini + 1, fin).trim()); } catch (e) { continue; }
  if (j && j['@type'] === 'Product' && j.offers && Number(j.offers.offerCount) > 0) {
    total = Number(j.offers.offerCount);
    break;
  }
}

let paginas = total > 0 ? Math.ceil(total / POR_PAGINA) : 0;
// Si el portal no contesta, se tira del último número conocido: quedarse sin
// medida no debe dejar la pasada sin hacer nada.
if (!(paginas > 0)) paginas = Number(mapa['ocasionplus_paginas']) || 0;
paginas = Math.min(paginas, TOPE);

if (!(paginas > 0)) {
  console.log('[ocasionplus] no sé cuántas páginas hay y no había número guardado. Nada que repartir.');
  return [{ json: { desde: 0, hasta: 0, sqlCursor: null } }];
}

let pag = Number(mapa['ocasionplus_pagina']);
if (!Number.isFinite(pag) || pag < 1 || pag > paginas) pag = 1;

const out = [];
while (out.length < SEGMENTOS && pag <= paginas) {
  out.push({ json: { desde: pag, hasta: Math.min(pag + PAGINAS - 1, paginas) } });
  pag += PAGINAS;
}
// Si se ha llegado al final, la próxima empieza otra vez por el principio.
const siguiente = pag > paginas ? 1 : pag;

// Se apunta ANTES de scrapear: si la pasada se cae a la mitad, la siguiente
// sigue avanzando en vez de repetir lo mismo.
const sqlCursor = "INSERT INTO moveadvisor_cursores (clave, valor, actualizado) VALUES "
  + "('ocasionplus_pagina', " + siguiente + ", NOW()), "
  + "('ocasionplus_paginas', " + paginas + ", NOW())"
  + " ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = NOW()";
for (const o of out) o.json.sqlCursor = sqlCursor;

console.log('[ocasionplus] ' + total + ' coches en ' + paginas + ' páginas. ' + out.length
  + ' ventanas de ' + PAGINAS + ', de la ' + out[0].json.desde + ' a la '
  + out[out.length - 1].json.hasta + '. La próxima pasada empieza en la ' + siguiente + '.');
return out;`;

// ══ EL SEGMENTO ════════════════════════════════════════════════════════════
const CODE_PARAMS = `const inp = $input.item.json || {};

// SIN ventana no se hace nada. En Autocasión había aquí un valor por defecto y
// el 15-sep, al recibir un segmento vacío, se puso a scrapear otra marca por su
// cuenta: 360 ofertas saltándose el cursor. Un defecto esconde el fallo.
const desde = Number(inp.desde);
const hasta = Number(inp.hasta);
if (!(desde > 0) || !(hasta >= desde)) {
  console.log('[ocasionplus] segmento sin ventana de páginas: no hay nada que hacer.');
  return [];
}
return [{ json: { desde: desde, hasta: hasta } }];`;

const CODE_PAGINAS = `// Las páginas de esta ventana, una por item.
//
// La página 1 es la url base: «?page=1» devuelve 404. Ya estaba así en el
// scraper viejo y se conserva.
const seg = $input.first().json;
const out = [];
for (let p = seg.desde; p <= seg.hasta; p++) {
  out.push({ json: {
    page: p,
    url: p === 1 ? '${BASE}' : '${BASE}?page=' + p,
  } });
}
console.log('[ocasionplus] ventana ' + seg.desde + '-' + seg.hasta + ': ' + out.length + ' páginas');
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "ocasionplus-transformar.js"), "utf8");

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
// 8:40 y 20:40: huecos que no pisan a los demás scrapers (AutoScout24 a las
// 8:15 y 20:15, Autocasión a las 8:20 y 19:20, Flexicar a las 9:10 y 21:10,
// coches.com a las 11:40 y 23:40).
const CRON_ORQ = "2 veces/día (8:40 y 20:40)";
const nodosOrq = [
  { parameters: {}, id: "op-o-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-600, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 40 8,20 * * *" }] } },
    id: "op-o-cron", name: CRON_ORQ,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-600, 400] },
  { parameters: { operation: "executeQuery", query: CURSOR_SQL, options: {} },
    id: "op-o-cursor", name: "PG: Por dónde íbamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-400, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { url: BASE, ...CABECERAS, options: OPCIONES_HTTP },
    id: "op-o-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-200, 300] },
  { parameters: { jsCode: CODE_SEGMENTOS }, id: "op-o-gen",
    name: "Code: Generar segmentos (ventanas de páginas)",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [0, 300] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sqlCursor }}", options: {} },
    id: "op-o-guardar", name: "PG: Apuntar dónde nos quedamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [200, 140],
    credentials: PG_CRED, ...REINTENTA, executeOnce: true },
  { parameters: { options: {} }, id: "op-o-loop", name: "Loop: segmento por segmento",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [200, 340] },
  { parameters: condicion("op-o-c-desde", "desde"), id: "op-o-if",
    name: "IF: ¿hay ventana que scrapear?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [400, 440] },
  // typeVersion 1 quiere el id COMO TEXTO: con la forma de objeto n8n lo
  // interpola como "[object Object]" y dice «Workflow does not exist».
  //
  // Y ESPERA a cada segmento: sin esto dispara las ventanas de golpe.
  { parameters: { workflowId: ID_SEGMENTO, options: { waitForSubWorkflow: true } },
    id: "op-o-sub", name: "Scrapear segmento (OcasionPlus – Segmento)",
    type: "n8n-nodes-base.executeWorkflow", typeVersion: 1, position: [600, 440] },
];

const conexionesOrq = {
  "Ejecutar manualmente": { main: [[L("PG: Por dónde íbamos")]] },
  [CRON_ORQ]:             { main: [[L("PG: Por dónde íbamos")]] },
  "PG: Por dónde íbamos": { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo": { main: [[L("Code: Generar segmentos (ventanas de páginas)")]] },
  "Code: Generar segmentos (ventanas de páginas)": {
    main: [[L("PG: Apuntar dónde nos quedamos"), L("Loop: segmento por segmento")]] },
  "Loop: segmento por segmento": { main: [[], [L("IF: ¿hay ventana que scrapear?")]] },
  "IF: ¿hay ventana que scrapear?": {
    main: [[L("Scrapear segmento (OcasionPlus – Segmento)")], [L("Loop: segmento por segmento")]] },
  "Scrapear segmento (OcasionPlus – Segmento)": { main: [[L("Loop: segmento por segmento")]] },
};

// ── el segmento ────────────────────────────────────────────────────────────
const nodosSeg = [
  { parameters: {}, id: "op-s-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: {}, id: "op-s-trigger", name: "Llamada desde orquestador",
    type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { jsCode: CODE_PARAMS }, id: "op-s-params", name: "Params",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-340, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "op-s-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-120, 300] },
  { parameters: { options: {} }, id: "op-s-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [120, 300] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "op-s-http", name: "HTTP: Página del listado",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [360, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "op-s-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [600, 420] },
  { parameters: condicion("op-s-c-sql", "sql"), id: "op-s-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [840, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "op-s-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1080, 340],
    credentials: PG_CRED, ...REINTENTA },
];

const conexionesSeg = {
  "Ejecutar manualmente":      { main: [[L("Params")]] },
  "Llamada desde orquestador": { main: [[L("Params")]] },
  "Params":                    { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":     { main: [[L("Loop: página por página")]] },
  "Loop: página por página":   { main: [[], [L("HTTP: Página del listado")]] },
  "HTTP: Página del listado":  { main: [[L("Code: Transformar ofertas")]] },
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

escribe("ocasionplus-scraper-offers.json", {
  name: "OcasionPlus – Scraper (orquestador)",
  nodes: nodosOrq, connections: conexionesOrq, settings: ajustes, pinData: {},
});
escribe("ocasionplus-segmento.json", {
  name: "OcasionPlus – Segmento (páginas)",
  nodes: nodosSeg, connections: conexionesSeg, settings: ajustes, pinData: {},
});

const porPasada = SEGMENTOS_POR_PASADA * PAGINAS_POR_SEGMENTO;
console.log("  " + SEGMENTOS_POR_PASADA + " ventanas x " + PAGINAS_POR_SEGMENTO + " páginas = "
  + porPasada + " páginas por pasada (" + (porPasada * POR_PAGINA).toLocaleString("es") + " coches)");
console.log("  el catálogo son ~660 páginas: cada pasada lo recorre ENTERO");
if (ID_SEGMENTO === "PENDIENTE_DE_ENLAZAR") {
  console.log("  OJO: el orquestador todavía no sabe a quién llamar.");
  console.log("       Importa el segmento y lanza: npm run enlaza-segmento-ocasionplus");
}
