/**
 * coches.com – scraper de mercado (orquestador + segmento)
 *
 * Genera LOS DOS ficheros, porque van juntos.
 *
 *   node scripts/genera-scraper-cochescom.js
 *   npm run enlaza-segmento-cochescom     (tras importar el segmento)
 *   npm run test:cochescom
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * 52.137 ofertas dadas por activas, paradas desde el 17 de agosto, y el portal
 * declara 85.252: nos falta un tercio del catálogo y sobra lo que se haya
 * vendido en un mes.
 *
 * El scraper que había arrastraba lo mismo que los otros: cabeceras en
 * options.headers -que typeVersion 4 IGNORA, o sea pedir sin User-Agent-, sin
 * onError, sin reintentos en Postgres, sin aviso por correo, y el cron a las
 * 3:00, fuera de la franja de 8:00 a 00:00.
 *
 * Y dos cosas de fondo:
 *
 *   - REPARTÍA LAS MARCAS POR DÍA DE LA SEMANA (i % 7 === día). Si una noche
 *     fallaba, esas trece marcas no se volvían a mirar hasta la semana
 *     siguiente. Ahora hay cursor en Postgres, como en Alemania y Autocasión.
 *   - Hacía TODAS las páginas de una marca en una sola ejecución. Peugeot son
 *     382 páginas y n8n guarda en memoria la salida de cada vuelta del bucle.
 *     Ahora el segmento recibe una ventana de 25.
 *
 * ── El tamaño ──────────────────────────────────────────────────────────────
 *
 * Medido el 16-sep: 85.252 coches, 20 por página, o sea ~4.263 páginas. Por
 * marca: Peugeot 382, Kia 274, BMW 176.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// El id del workflow «coches.com – Segmento (marca)» YA IMPORTADO en n8n.
// Se rellena solo con:  npm run enlaza-segmento-cochescom
const ID_SEGMENTO = "P8MP2HvH1haNFC8i";

const PAGINAS_POR_SEGMENTO = 25;
const SEGMENTOS_POR_PASADA = 20;
// Sin nodo Wait: en Autocasión costaba casi 4 segundos por vuelta -no el 1 que
// declaraba, porque n8n guarda el estado de la ejecución para poder reanudarla-.
const ESPERA_SEGUNDOS = 0;

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

// Las 94 marcas del portal, en orden fijo: el índice es la clave con la que se
// guarda cuántas páginas tiene cada una.
const MARCAS = ["peugeot", "mercedes", "kia", "citroen", "volkswagen", "ford", "opel", "renault",
  "audi", "seat", "bmw", "toyota", "hyundai", "nissan", "fiat", "dacia", "skoda", "volvo",
  "mazda", "mini", "land-rover", "jeep", "honda", "suzuki", "mitsubishi", "lexus", "porsche",
  "alfa-romeo", "jaguar", "cupra", "ds", "smart", "subaru", "ssangyong", "tesla", "abarth",
  "lancia", "chevrolet", "chrysler", "dodge", "infiniti", "isuzu", "maserati", "bentley",
  "ferrari", "lamborghini", "aston-martin", "lotus", "alpine", "polestar", "mg", "byd",
  "omoda", "gwm", "leapmotor", "xpeng", "seres", "maxus", "genesis", "iveco", "man",
  "rolls-royce", "mclaren", "morgan", "caterham", "dfsk", "great-wall", "haval", "hummer",
  "ineos", "jaecoo", "lada", "lifan", "lotus-cars", "mahindra", "microcar", "nio", "opel-vivaro",
  "piaggio", "rover", "saab", "santana", "tata", "think", "triumph", "voyah", "wey",
  "lynk-co", "ora", "aiways", "dr", "ebro", "skywell", "sportequipe"];

// ══ EL ORQUESTADOR ═════════════════════════════════════════════════════════
const CURSOR_SQL = `-- Por dónde iba la última pasada, y cuántas páginas tiene cada marca.
--
-- En Postgres y no en $getWorkflowStaticData, que se reinicia al reimportar.
-- Antes ni siquiera había cursor: repartía las marcas por día de la semana, así
-- que una noche que fallara se saltaba trece marcas hasta la semana siguiente.
--
-- El filtro va con expresión regular y no con LIKE: en LIKE el «_» es un
-- comodín de un carácter, y 'cochescom_pag_%' casaría también con
-- 'cochescom_pagina'. Contaba una marca de más en Autocasión.
SELECT clave, valor FROM moveadvisor_cursores
WHERE clave IN ('cochescom_marca', 'cochescom_pagina')
   OR clave ~ '^cochescom_pag_[0-9]+$'`;

const CODE_MARCA_DE_TURNO = `// Qué marca toca, para poder preguntarle cuántas páginas tiene.
const marcas = ${JSON.stringify(MARCAS)};
const filas = $input.all().map(x => x.json);
const mapa = {};
for (const f of filas) mapa[f.clave] = Number(f.valor);

let idx = Number(mapa['cochescom_marca']);
let pag = Number(mapa['cochescom_pagina']);
if (!Number.isFinite(idx) || idx < 0 || idx >= marcas.length) idx = 0;
if (!Number.isFinite(pag) || pag < 1) pag = 1;

return [{ json: { marca: idx, pagina: pag, marcaDeTurno: marcas[idx], paginas: mapa } }];`;

const CODE_SEGMENTOS = `// Reparte ventanas de 25 páginas, encadenando marcas hasta gastar la pasada.
const marcas = ${JSON.stringify(MARCAS)};
const PAGINAS = ${PAGINAS_POR_SEGMENTO};
const SEGMENTOS = ${SEGMENTOS_POR_PASADA};
// coches.com corta la paginación en la 250.
const TOPE_PAGINA = 250;

const turno = $('Code: Qué marca toca').first().json || {};
let idx = Number(turno.marca);
let pag = Number(turno.pagina);
if (!Number.isFinite(idx) || idx < 0 || idx >= marcas.length) idx = 0;
if (!Number.isFinite(pag) || pag < 1) pag = 1;

// Cuántas páginas tiene cada marca. La de turno se vuelve a medir aquí, en
// vivo, leyendo classifieds.total del JSON de su página 1.
const paginasDe = Object.assign({}, turno.paginas || {});
const conteo = $('HTTP: Contar la marca de turno').first().json || {};
const htmlConteo = String(conteo.data || conteo.body || '');
let medida = 0;
try {
  const m = htmlConteo.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) {
    const pp = JSON.parse(m[1]).props.pageProps;
    const total = (pp.classifieds && pp.classifieds.total) || 0;
    if (total > 0) medida = Math.min(Math.ceil(total / 20), TOPE_PAGINA);
  }
} catch (e) { medida = 0; }
if (medida > 0) paginasDe['cochescom_pag_' + idx] = medida;

// Si no sabemos cuántas tiene, se asume UNA ventana: quedarse corto cuesta
// esperar al turno siguiente; pasarse cuesta peticiones tiradas.
const cuantas = (i) => {
  const v = Number(paginasDe['cochescom_pag_' + i]);
  return Number.isFinite(v) && v > 0 ? v : PAGINAS;
};

const out = [];
let vueltas = 0;
while (out.length < SEGMENTOS && vueltas <= marcas.length) {
  const tope = cuantas(idx);
  if (pag > tope) { pag = 1; idx = (idx + 1) % marcas.length; vueltas++; continue; }
  out.push({ json: { brand: marcas[idx], desde: pag, hasta: Math.min(pag + PAGINAS - 1, tope) } });
  pag += PAGINAS;
}

// Se apunta ANTES de scrapear: si la pasada se cae a la mitad, la siguiente
// sigue avanzando en vez de repetir lo mismo. Con UPSERT, así que crea las
// filas si no existen y no hace falta migración.
const guardar = [
  "('cochescom_marca', " + idx + ", NOW())",
  "('cochescom_pagina', " + pag + ", NOW())",
];
if (medida > 0) guardar.push("('cochescom_pag_" + Number(turno.marca) + "', " + medida + ", NOW())");
const sqlCursor = "INSERT INTO moveadvisor_cursores (clave, valor, actualizado) VALUES "
  + guardar.join(", ")
  + " ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = NOW()";
for (const o of out) o.json.sqlCursor = sqlCursor;

if (!out.length) {
  console.log('[cochescom] nada que repartir. La próxima empieza en ' + idx + ':' + pag + '.');
  return [{ json: { brand: '', desde: 0, hasta: 0, sqlCursor: sqlCursor } }];
}

const cuantasMarcas = new Set(out.map(o => o.json.brand));
console.log('[cochescom] ' + out.length + ' ventanas de ' + cuantasMarcas.size + ' marca(s): '
  + [...cuantasMarcas].join(', ') + '. Empieza en ' + out[0].json.brand + ' p' + out[0].json.desde
  + ' y la próxima pasada en ' + marcas[idx] + ' p' + pag + '.');
return out;`;

// ══ EL SEGMENTO ════════════════════════════════════════════════════════════
const CODE_PARAMS = `const inp = $input.item.json || {};

// SIN marca no se hace nada. En Autocasión había aquí un valor por defecto y el
// 15-sep, al recibir un segmento vacío, se puso a scrapear otra marca por su
// cuenta: 360 ofertas saltándose el cursor. Un defecto esconde el fallo.
if (!inp.brand || !String(inp.brand).trim()) {
  console.log('[cochescom] segmento sin marca: no hay nada que hacer.');
  return [];
}

return [{ json: {
  brand: String(inp.brand),
  desde: Number(inp.desde) > 0 ? Number(inp.desde) : 1,
  hasta: Number(inp.hasta) > 0 ? Number(inp.hasta) : 25,
} }];`;

const CODE_PAGINAS = `// Cuántas páginas tiene esta marca, y cuáles tocan en esta ventana.
const seg = $('Params').item.json;
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const html = String(res.data || res.body || '');

let maxPage = 1;
try {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) {
    const pp = JSON.parse(m[1]).props.pageProps;
    const total = (pp.classifieds && pp.classifieds.total) || 0;
    if (total > 0) maxPage = Math.min(Math.ceil(total / 20), 250);
  }
} catch (e) { maxPage = 1; }

const hasta = Math.min(seg.hasta, maxPage);
const out = [];
for (let p = seg.desde; p <= hasta; p++) {
  out.push({ json: {
    brand: seg.brand, page: p,
    url: 'https://www.coches.com/coches-segunda-mano/' + seg.brand + '.htm?page=' + p,
  } });
}
if (!out.length) {
  console.log('[cochescom] ' + seg.brand + ': la ventana ' + seg.desde + '-' + seg.hasta
    + ' está más allá de su última página (' + maxPage + ').');
}
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "cochescom-transformar.js"), "utf8");

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
const CRON_ORQ = "2 veces/día (11:40 y 23:40)";
const nodosOrq = [
  { parameters: {}, id: "cc-o-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // 11:40 y 23:40: huecos que no pisan ni al scraper de Autocasión (8:20 y
  // 19:20) ni al alemán (8:15 y 20:15) ni al español de AutoScout24 (13:30 y
  // 16:30). Antes iba a las 3:00, fuera de la franja de 8:00 a 00:00.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 40 11,23 * * *" }] } },
    id: "cc-o-cron", name: CRON_ORQ,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: CURSOR_SQL, options: {} },
    id: "cc-o-cursor", name: "PG: Por dónde íbamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-400, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_MARCA_DE_TURNO }, id: "cc-o-marca",
    name: "Code: Qué marca toca",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-280, 300] },
  { parameters: {
      url: "=https://www.coches.com/coches-segunda-mano/{{ $json.marcaDeTurno }}.htm",
      ...CABECERAS, options: OPCIONES_HTTP,
    }, id: "cc-o-contar", name: "HTTP: Contar la marca de turno",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-160, 300] },
  { parameters: { jsCode: CODE_SEGMENTOS }, id: "cc-o-gen",
    name: "Code: Generar segmentos (marca x páginas)",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-20, 300] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sqlCursor }}", options: {} },
    id: "cc-o-guardar", name: "PG: Apuntar dónde nos quedamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [160, 140],
    credentials: PG_CRED, ...REINTENTA, executeOnce: true },
  { parameters: { options: {} }, id: "cc-o-loop", name: "Loop: segmento por segmento",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [160, 340] },
  { parameters: condicion("cc-o-c-marca", "brand"), id: "cc-o-if-marca",
    name: "IF: ¿hay marca que scrapear?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [320, 440] },
  // typeVersion 1 quiere el id COMO TEXTO: con la forma de objeto n8n lo
  // interpola como "[object Object]" y dice «Workflow does not exist».
  //
  // Y ESPERA a cada segmento: sin esto dispara las 20 ventanas de golpe y deja
  // veinte ejecuciones en paralelo. El 16-sep eso hundió el verificador de
  // Autocasión a 17 ofertas/min.
  { parameters: { workflowId: ID_SEGMENTO, options: { waitForSubWorkflow: true } },
    id: "cc-o-sub", name: "Scrapear segmento (coches.com – Segmento)",
    type: "n8n-nodes-base.executeWorkflow", typeVersion: 1, position: [520, 440] },
];

const conexionesOrq = {
  "Ejecutar manualmente": { main: [[L("PG: Por dónde íbamos")]] },
  [CRON_ORQ]:             { main: [[L("PG: Por dónde íbamos")]] },
  "PG: Por dónde íbamos": { main: [[L("Code: Qué marca toca")]] },
  "Code: Qué marca toca": { main: [[L("HTTP: Contar la marca de turno")]] },
  "HTTP: Contar la marca de turno": { main: [[L("Code: Generar segmentos (marca x páginas)")]] },
  "Code: Generar segmentos (marca x páginas)": {
    main: [[L("PG: Apuntar dónde nos quedamos"), L("Loop: segmento por segmento")]] },
  "Loop: segmento por segmento": { main: [[], [L("IF: ¿hay marca que scrapear?")]] },
  "IF: ¿hay marca que scrapear?": {
    main: [[L("Scrapear segmento (coches.com – Segmento)")], [L("Loop: segmento por segmento")]] },
  "Scrapear segmento (coches.com – Segmento)": { main: [[L("Loop: segmento por segmento")]] },
};

// ── el segmento ────────────────────────────────────────────────────────────
const nodosSeg = [
  { parameters: {}, id: "cc-s-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: {}, id: "cc-s-trigger", name: "Llamada desde orquestador",
    type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { jsCode: CODE_PARAMS }, id: "cc-s-params", name: "Params",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-320, 300] },
  { parameters: {
      url: "=https://www.coches.com/coches-segunda-mano/{{ $json.brand }}.htm",
      ...CABECERAS, options: OPCIONES_HTTP,
    }, id: "cc-s-contar", name: "HTTP: Contar (pág 1)",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-80, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "cc-s-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [160, 300] },
  { parameters: { options: {} }, id: "cc-s-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [400, 300] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "cc-s-http", name: "HTTP: Página coches.com",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [640, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "cc-s-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [880, 420] },
  { parameters: condicion("cc-s-c-sql", "sql"), id: "cc-s-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1120, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cc-s-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1360, 340],
    credentials: PG_CRED, ...REINTENTA },
];

const conexionesSeg = {
  "Ejecutar manualmente":      { main: [[L("Params")]] },
  "Llamada desde orquestador": { main: [[L("Params")]] },
  "Params":                    { main: [[L("HTTP: Contar (pág 1)")]] },
  "HTTP: Contar (pág 1)":      { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":     { main: [[L("Loop: página por página")]] },
  "Loop: página por página":   { main: [[], [L("HTTP: Página coches.com")]] },
  "HTTP: Página coches.com":   { main: [[L("Code: Transformar ofertas")]] },
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

escribe("cochescom-scraper-offers.json", {
  name: "coches.com – Scraper por marcas (orquestador)",
  nodes: nodosOrq, connections: conexionesOrq, settings: ajustes, pinData: {},
});
escribe("cochescom-segmento.json", {
  name: "coches.com – Segmento (marca)",
  nodes: nodosSeg, connections: conexionesSeg, settings: ajustes, pinData: {},
});

console.log("  " + MARCAS.length + " marcas, " + SEGMENTOS_POR_PASADA + " ventanas x "
  + PAGINAS_POR_SEGMENTO + " páginas = " + (SEGMENTOS_POR_PASADA * PAGINAS_POR_SEGMENTO)
  + " páginas por pasada");
console.log("  2 pasadas/día contra ~4.263 páginas = vuelta completa en "
  + Math.ceil(4263 / (SEGMENTOS_POR_PASADA * PAGINAS_POR_SEGMENTO * 2)) + " días");
if (ID_SEGMENTO === "PENDIENTE_DE_ENLAZAR") {
  console.log("  OJO: el orquestador todavía no sabe a quién llamar.");
  console.log("       Importa el segmento y lanza: npm run enlaza-segmento-cochescom");
}

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "cochescom-segmento.json"), "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Generar páginas").parameters.jsCode;
const bien = js.indexOf('application\\/json') >= 0 && js.indexOf("[\\s\\S]*?") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "el regex del __NEXT_DATA__ conserva sus barras");
if (!bien) process.exit(1);
