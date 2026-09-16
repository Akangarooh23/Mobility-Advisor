/**
 * Autocasión – scraper de mercado (orquestador + segmento)
 *
 * Genera LOS DOS ficheros, porque van juntos: el orquestador reparte ventanas de
 * páginas y llama al segmento una vez por (marca × ventana).
 *
 *   node scripts/genera-scraper-autocasion.js
 *   npm run enlaza-segmento-autocasion     (tras importar el segmento)
 *   npm run test:autocasion
 *
 * ── Por qué se rehace ──────────────────────────────────────────────────────
 *
 * Autocasión son 133.848 ofertas activas y el 9% de los comparables que ponen
 * precio al escaparate de importación. El 15-sep-2026 llevaban 28 días sin
 * tocarse, y sus dos scrapers arrastraban lo mismo que arrastraba el español de
 * AutoScout24 antes de arreglarlo:
 *
 *   - El orquestador llamaba al segmento con el id en forma de objeto y
 *     typeVersion 1 -la combinación que da «Workflow does not exist»- y encima
 *     el id era el literal REEMPLAZA_CON_ID_DEL_SEGMENTO_AC.
 *   - Las cabeceras iban en options.headers, que typeVersion 4 IGNORA en
 *     silencio: se pedía sin User-Agent.
 *   - Sin onError en los HTTP: un corte de red tumbaba la pasada entera.
 *   - Sin reintentos en Postgres y sin aviso por correo: fallaba a oscuras.
 *   - El cursor de marcas vivía en $getWorkflowStaticData, que se reinicia al
 *     reimportar. En Alemania eso costó tres re-scrapeos seguidos de Audi.
 *
 * ── El tamaño manda el diseño ──────────────────────────────────────────────
 *
 * Medido el 15-sep: el portal declara 119.890 coches, una página trae 25 y pesa
 * ~900 KB, y tarda ~1 s. O sea unas 4.800 páginas para barrerlo entero.
 *
 * Eso NO cabe en un segmento por marca, que es como estaba: BMW tiene 340
 * páginas y n8n guarda en memoria la salida de cada vuelta del bucle. 340 × 900
 * KB son 306 MB en una sola ejecución. Por eso aquí el segmento recibe una
 * VENTANA de páginas -25- y no una marca entera: 22 MB por ejecución.
 *
 * El listado genérico no vale como atajo: se corta en la página 625, o sea
 * 15.625 coches de 119.890. Hay que ir marca por marca.
 *
 * ── Lo que NO arregla esto ─────────────────────────────────────────────────
 *
 * 35.518 ofertas guardadas en julio y agosto tienen como URL un listado de
 * provincia -«/coches-segunda-mano/peugeot-2008-ocasion/madrid»- en vez de la
 * ficha del coche. 301 ofertas distintas comparten esa misma dirección.
 *
 * No es culpa del scraper de hoy: se comprobó el 15-sep pidiendo el listado
 * genérico y el de marca, y los dos devolvieron 25 de 25 URLs buenas. Son
 * herencia. Sirven como comparables -todas tienen precio, año y kilómetros-
 * pero NO se pueden verificar una a una, y por eso el verificador las salta.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// El id del workflow «Autocasión – Segmento (marca)» YA IMPORTADO en n8n.
// Mientras sea el placeholder, el orquestador no puede llamar a nadie. Se
// rellena solo con:  npm run enlaza-segmento-autocasion
const ID_SEGMENTO = "qrYv93PTSa5xuR5s";

// 25 páginas por segmento: 22 MB de memoria por ejecución.
const PAGINAS_POR_SEGMENTO = 25;
// 20 segmentos por pasada = 500 páginas.
//
// CUÁNTO TARDA DE VERDAD: unos 90 minutos, no los 17 que puse al principio.
// Cronometrado el 15-sep, cada página cuesta:
//
//     pedirla al portal   1,3 s
//     leer su JSON-LD     0,00 s
//     guardar las 25      0,15 s
//                         ──────
//                          1,5 s   ->  40 páginas/min
//
// y n8n hace 5,5. O sea que el cuello de botella no es el portal ni la base:
// son los ~10 segundos por vuelta que se lleva el propio n8n en mover los datos
// de un nodo a otro. Quitar el nodo Wait ayudó, pero no era toda la causa: lo
// di por resuelto antes de medirlo.
//
// El plan no cambia por eso: 500 páginas por pasada y dos pasadas al día siguen
// siendo 1.000 al día, y las ~4.800 del portal se barren en 5 días.
const SEGMENTOS_POR_PASADA = 20;
// SIN nodos Wait, ni entre páginas ni entre segmentos.
//
// La primera pasada real, el 15-sep, se quedó colgada: escribió 2.925 ofertas
// -117 páginas de las 338 que tiene Audi- y luego pasó media hora en «running»
// sin tocar la base. No era memoria: n8n estaba en 537 MB con 3,9 GB libres.
//
// El Wait es el sospechoso, y con motivo: ese mismo día se midió que cuesta
// casi 4 segundos por uso -no el 1 que declara, porque n8n guarda el estado de
// la ejecución para poder reanudarla- y quitarlo hizo los verificadores ocho
// veces más rápidos.
//
// Sin él, el ritmo lo marca la propia página: ~1 s cada una, que es el mismo
// ritmo al que se midió el portal a mano sin que nos frenara.
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

// ══ EL ORQUESTADOR ═════════════════════════════════════════════════════════
const CURSOR_SQL = `-- Por dónde iba la última pasada: índice de marca y página.
--
-- En Postgres y no en $getWorkflowStaticData, que se reinicia al reimportar: el
-- 2026-09-09 se reimportó el alemán tres veces y las tres pasadas volvieron a
-- empezar por Audi, que ya estaba entero.
--
-- Van en DOS filas porque moveadvisor_cursores.valor es un integer y aquí hacen
-- falta dos números. Con COALESCE la primera pasada arranca en 0:1 sin que nadie
-- tenga que crear las filas a mano.
-- Devuelve el cursor Y cuántas páginas tiene cada marca, que es lo que permite
-- encadenar marcas dentro de una misma pasada. Los números los siembra
-- scripts/mide-paginas-autocasion.js y los refresca el propio workflow.
--
-- El filtro va con expresión regular y no con LIKE a propósito: en LIKE el «_»
-- es un comodín de un carácter, así que 'autocasion_pag_%' casa también con
-- 'autocasion_pagina' -el «_» hace de la «i»-. Inofensivo aquí, porque las
-- claves se buscan exactas, pero contaba 62 marcas donde hay 61.
SELECT clave, valor FROM moveadvisor_cursores
WHERE clave IN ('autocasion_marca', 'autocasion_pagina')
   OR clave ~ '^autocasion_pag_[0-9]+$'`;

// Las marcas, en un solo sitio: las usan el nodo que decide cuál toca y el que
// reparte las ventanas, y si se separan el reparto pide una y cuenta otra.
const MARCAS = ["audi","bmw","mercedes-benz","volkswagen","peugeot","renault","seat","citroen","ford","opel","toyota","kia","hyundai","nissan","fiat","dacia","skoda","volvo","mazda","mini","land-rover","jeep","honda","suzuki","mitsubishi","lexus","porsche","alfa-romeo","jaguar","cupra","ds","smart","subaru","ssangyong","tesla","abarth","lancia","chevrolet","chrysler","dodge","infiniti","isuzu","maserati","bentley","ferrari","lamborghini","aston-martin","lotus","alpine","polestar","mg","byd","omoda","ebro","gwm","leapmotor","xpeng","zeekr","seres","maxus","genesis"];

const CODE_MARCA_DE_TURNO = `// Qué marca toca, para poder preguntarle cuántas páginas tiene.
//
// La consulta del cursor devuelve MUCHAS filas -el cursor y las páginas de cada
// marca-, así que aquí se aplanan a un objeto.
const marcas = ${JSON.stringify(MARCAS)};
const filas = $input.all().map(x => x.json);
const mapa = {};
for (const f of filas) mapa[f.clave] = Number(f.valor);

let idx = Number(mapa['autocasion_marca']);
let pag = Number(mapa['autocasion_pagina']);
if (!Number.isFinite(idx) || idx < 0 || idx >= marcas.length) idx = 0;
if (!Number.isFinite(pag) || pag < 1) pag = 1;

return [{ json: { marca: idx, pagina: pag, marcaDeTurno: marcas[idx], paginas: mapa } }];`;

const CODE_SEGMENTOS = `// Reparte ventanas de 25 páginas de UNA marca para esta pasada.
const marcas = ${JSON.stringify(MARCAS)};

const PAGINAS = ${PAGINAS_POR_SEGMENTO};
const SEGMENTOS = ${SEGMENTOS_POR_PASADA};
// 625 es donde Autocasión corta la paginación. Ninguna marca pasa de ahí.
const TOPE_PAGINA = 625;

const turno = $('Code: Qué marca toca').first().json || {};
let idx = Number(turno.marca);
let pag = Number(turno.pagina);
if (!Number.isFinite(idx) || idx < 0 || idx >= marcas.length) idx = 0;
if (!Number.isFinite(pag) || pag < 1) pag = 1;

// Cuántas páginas tiene cada marca. Las de la base las sembró
// scripts/mide-paginas-autocasion.js; la de turno se vuelve a medir aquí, en
// vivo, para que el número no envejezca.
const paginasDe = Object.assign({}, turno.paginas || {});
const conteo = $('HTTP: Contar la marca de turno').first().json || {};
const htmlConteo = String(conteo.data || conteo.body || '');
let medida = 0;
try {
  const nums = [...htmlConteo.matchAll(/[?&]page=([0-9]+)/g)].map(m => parseInt(m[1], 10)).filter(n => !isNaN(n));
  if (nums.length) medida = Math.min(Math.max(...nums), TOPE_PAGINA);
} catch (e) { medida = 0; }
if (medida > 0) paginasDe['autocasion_pag_' + idx] = medida;

// Cuántas páginas creemos que tiene una marca. Si no lo sabemos todavía se
// asume UNA ventana: se queda corto a propósito, porque pasarse cuesta una
// petición tirada por ventana, y la medimos de verdad cuando le toque el turno.
const cuantas = (i) => {
  const v = Number(paginasDe['autocasion_pag_' + i]);
  return Number.isFinite(v) && v > 0 ? v : ${PAGINAS_POR_SEGMENTO};
};

// ENCADENA MARCAS hasta gastar el presupuesto de la pasada.
//
// Antes se plantaba al acabar la marca de turno, y eso convertía las 61 marcas
// en 30 días de vuelta completa en vez de 5: BMW usa 14 ventanas de las 20 y
// Lamborghini gasta una pasada entera para una sola. Arreglé el desperdicio de
// peticiones y me cargué el rendimiento sin darme cuenta.
const out = [];
let vueltas = 0;
while (out.length < SEGMENTOS && vueltas <= marcas.length) {
  const tope = cuantas(idx);
  if (pag > tope) { pag = 1; idx = (idx + 1) % marcas.length; vueltas++; continue; }
  out.push({ json: { brand: marcas[idx], desde: pag, hasta: Math.min(pag + PAGINAS - 1, tope) } });
  pag += PAGINAS;
}

// Se apunta ANTES de scrapear, a propósito: si la pasada se cae a la mitad, la
// siguiente sigue avanzando en vez de repetir media hora de lo mismo. Y va con
// UPSERT, así que crea las filas si no existen: ni migración ni mantenimiento.
const guardar = [
  "('autocasion_marca', " + idx + ", NOW())",
  "('autocasion_pagina', " + pag + ", NOW())",
];
if (medida > 0) guardar.push("('autocasion_pag_" + Number(turno.marca) + "', " + medida + ", NOW())");
const sqlCursor = "INSERT INTO moveadvisor_cursores (clave, valor, actualizado) VALUES "
  + guardar.join(", ")
  + " ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado = NOW()";
for (const o of out) o.json.sqlCursor = sqlCursor;

// Una pasada sin nada que hacer tiene que apuntar el cursor igual, o se queda
// clavada en la misma marca para siempre. Va con brand vacío: el segmento no
// llega a pedir nada porque el IF de la cola vacía lo para antes.
if (!out.length) {
  console.log('[autocasion] nada que repartir. La próxima empieza en ' + idx + ':' + pag + '.');
  return [{ json: { brand: '', desde: 0, hasta: 0, sqlCursor: sqlCursor } }];
}

const cuantasMarcas = new Set(out.map(o => o.json.brand));
console.log('[autocasion] ' + out.length + ' ventanas de ' + cuantasMarcas.size + ' marca(s): '
  + [...cuantasMarcas].join(', ') + '. Empieza en ' + out[0].json.brand + ' p' + out[0].json.desde
  + ' y la próxima pasada en ' + marcas[idx] + ' p' + pag + '.');
return out;`;

// ══ EL SEGMENTO ════════════════════════════════════════════════════════════
const CODE_PARAMS = `const inp = $input.item.json || {};

// SIN marca no se hace nada, y este return vacío no es una formalidad.
//
// Antes había aquí un «: 'peugeot'» como valor por defecto. El 15-sep el
// orquestador mandó un segmento vacío -el cursor iba por la página 501 de Audi,
// que solo tiene 338- y el segmento, al no recibir marca, se puso a scrapear
// PEUGEOT por su cuenta: 360 ofertas de una marca que no tocaba, saltándose el
// cursor. Un valor por defecto escondió el error en vez de enseñarlo.
if (!inp.brand || !String(inp.brand).trim()) {
  console.log('[autocasion] segmento sin marca: no hay nada que hacer.');
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
  const nums = [...html.matchAll(/[?&]page=(\\d+)/g)].map(m => parseInt(m[1], 10)).filter(n => !isNaN(n));
  if (nums.length) maxPage = Math.min(Math.max(...nums), 625);
} catch (e) { maxPage = 1; }

const hasta = Math.min(seg.hasta, maxPage);
const out = [];
for (let p = seg.desde; p <= hasta; p++) out.push({ json: { brand: seg.brand, page: p } });

if (!out.length) {
  console.log('[autocasion] ' + seg.brand + ': la ventana ' + seg.desde + '-' + seg.hasta
    + ' está más allá de su última página (' + maxPage + '). Nada que hacer.');
}
return out;`;

// El lector del listado se mantiene TAL CUAL estaba: lee el JSON-LD de la
// página y ya miraba 'data' antes que 'body'. Si funciona, no se toca.
const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "autocasion-transformar.js"), "utf8");

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

// ── nodos del orquestador ──────────────────────────────────────────────────
const CRON_ORQ = "2 veces/día (8:20 y 19:20)";
const nodosOrq = [
  { parameters: {}, id: "ac-o-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // 8:20 -> 9:50 y 19:20 -> 20:50, que son 90 minutos cada una.
  //
  // No a las 22:00 como antes: a esa hora arranca el scraper alemán de
  // importación. Y no a las 21:20 como puse ayer: con 90 minutos reales
  // -no los 17 que calculé- la segunda pasada acababa a las 22:50, justo encima
  // del enriquecedor de Autocasión.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 20 8,19 * * *" }] } },
    id: "ac-o-cron", name: CRON_ORQ,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: CURSOR_SQL, options: {} },
    id: "ac-o-cursor", name: "PG: Por dónde íbamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-400, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_MARCA_DE_TURNO }, id: "ac-o-marca",
    name: "Code: Qué marca toca",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-280, 300] },
  { parameters: {
      url: "=https://www.autocasion.com/coches-segunda-mano/{{ $json.marcaDeTurno }}-ocasion",
      ...CABECERAS, options: OPCIONES_HTTP,
    }, id: "ac-o-contar", name: "HTTP: Contar la marca de turno",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-160, 300] },
  { parameters: { jsCode: CODE_SEGMENTOS }, id: "ac-o-gen",
    name: "Code: Generar segmentos (marca x páginas)",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-80, 300] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sqlCursor }}", options: {} },
    id: "ac-o-guardar", name: "PG: Apuntar dónde nos quedamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [160, 140],
    credentials: PG_CRED, ...REINTENTA, executeOnce: true },
  { parameters: { options: {} }, id: "ac-o-loop", name: "Loop: segmento por segmento",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [160, 340] },
  // typeVersion 1 quiere el id COMO TEXTO. Con la forma de objeto -{__rl,value,
  // mode}- n8n lo interpola como "[object Object]" y dice «Workflow does not
  // exist». Pasó con el alemán el 2026-09-09.
  { parameters: condicion("ac-o-c-marca", "brand"), id: "ac-o-if-marca",
    name: "IF: ¿hay marca que scrapear?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [320, 440] },
  { parameters: { workflowId: ID_SEGMENTO, options: {} },
    id: "ac-o-sub", name: "Scrapear segmento (Autocasión – Segmento)",
    type: "n8n-nodes-base.executeWorkflow", typeVersion: 1, position: [400, 440] },
  // Sin nodo Wait entre segmentos: ver la nota de ESPERA_SEGUNDOS.
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexionesOrq = {
  "Ejecutar manualmente": { main: [[L("PG: Por dónde íbamos")]] },
  [CRON_ORQ]:             { main: [[L("PG: Por dónde íbamos")]] },
  "PG: Por dónde íbamos": { main: [[L("Code: Qué marca toca")]] },
  "Code: Qué marca toca": { main: [[L("HTTP: Contar la marca de turno")]] },
  "HTTP: Contar la marca de turno": { main: [[L("Code: Generar segmentos (marca x páginas)")]] },
  "Code: Generar segmentos (marca x páginas)": {
    main: [[L("PG: Apuntar dónde nos quedamos"), L("Loop: segmento por segmento")]] },
  "Loop: segmento por segmento": { main: [[], [L("IF: ¿hay marca que scrapear?")]] },
  // Dos redes para lo mismo: aquí no se llama al segmento sin marca, y el
  // segmento tampoco se inventa una si llega sin ella.
  "IF: ¿hay marca que scrapear?": {
    main: [[L("Scrapear segmento (Autocasión – Segmento)")], [L("Loop: segmento por segmento")]] },
  "Scrapear segmento (Autocasión – Segmento)": { main: [[L("Loop: segmento por segmento")]] },
};

// ── nodos del segmento ─────────────────────────────────────────────────────
const nodosSeg = [
  { parameters: {}, id: "ac-s-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: {}, id: "ac-s-trigger", name: "Llamada desde orquestador",
    type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { jsCode: CODE_PARAMS }, id: "ac-s-params", name: "Params",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-320, 300] },
  { parameters: {
      url: "=https://www.autocasion.com/coches-segunda-mano/{{ $json.brand }}-ocasion",
      ...CABECERAS, options: OPCIONES_HTTP,
    }, id: "ac-s-contar", name: "HTTP: Contar (pág 1)",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-80, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "ac-s-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [160, 300] },
  { parameters: { options: {} }, id: "ac-s-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [400, 300] },
  { parameters: {
      url: "=https://www.autocasion.com/coches-segunda-mano/{{ $json.brand }}-ocasion?page={{ $json.page }}",
      ...CABECERAS, options: OPCIONES_HTTP,
    }, id: "ac-s-http", name: "HTTP: Listado Autocasión",
    // neverError solo calla los códigos HTTP; un corte de red seguiría matando
    // el nodo y con él la ventana entera.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [640, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "ac-s-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [880, 420] },
  { parameters: condicion("ac-s-c-sql", "sql"), id: "ac-s-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1120, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ac-s-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1360, 340],
    credentials: PG_CRED, ...REINTENTA },
  // Sin nodo Wait entre páginas: ver la nota de ESPERA_SEGUNDOS.
];

const conexionesSeg = {
  "Ejecutar manualmente":     { main: [[L("Params")]] },
  "Llamada desde orquestador": { main: [[L("Params")]] },
  "Params":                   { main: [[L("HTTP: Contar (pág 1)")]] },
  "HTTP: Contar (pág 1)":     { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":    { main: [[L("Loop: página por página")]] },
  "Loop: página por página":  { main: [[], [L("HTTP: Listado Autocasión")]] },
  "HTTP: Listado Autocasión": { main: [[L("Code: Transformar ofertas")]] },
  "Code: Transformar ofertas": { main: [[L("IF: ¿hay ofertas?")]] },
  "IF: ¿hay ofertas?":        { main: [[L("PG: Upsert ofertas")], [L("Loop: página por página")]] },
  "PG: Upsert ofertas":       { main: [[L("Loop: página por página")]] },
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

escribe("autocasion-scraper-brands.json", {
  name: "Autocasión – Scraper por marcas (orquestador)",
  nodes: nodosOrq, connections: conexionesOrq, settings: ajustes, pinData: {},
});
escribe("autocasion-segmento.json", {
  name: "Autocasión – Segmento (marca)",
  nodes: nodosSeg, connections: conexionesSeg, settings: ajustes, pinData: {},
});

console.log("  " + SEGMENTOS_POR_PASADA + " segmentos x " + PAGINAS_POR_SEGMENTO
  + " páginas = " + (SEGMENTOS_POR_PASADA * PAGINAS_POR_SEGMENTO) + " páginas por pasada");
console.log("  2 pasadas/día contra ~4.800 páginas = vuelta completa en "
  + Math.ceil(4800 / (SEGMENTOS_POR_PASADA * PAGINAS_POR_SEGMENTO * 2)) + " días");
if (ID_SEGMENTO === "PENDIENTE_DE_ENLAZAR") {
  console.log("  OJO: el orquestador todavía no sabe a quién llamar.");
  console.log("       Importa el segmento y lanza: npm run enlaza-segmento-autocasion");
}

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", "autocasion-segmento.json"), "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Generar páginas").parameters.jsCode;
const bien = js.indexOf("page=(\\d+)") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "el regex de la paginación conserva su barra");
if (!bien) process.exit(1);
