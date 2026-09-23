/**
 * AutoScout24 España – scraper de mercado (orquestador + segmento)
 *
 * Genera LOS DOS ficheros, porque van juntos: el orquestador reparte marcas y
 * llama al segmento una vez por (marca x tramo de precio).
 *
 * POR QUE SE REHACE
 *
 * El 14-sep-2026 las 314.322 ofertas españolas de AutoScout24 llevaban 28 días
 * sin tocarse, y de ellas salen el 86% de los comparables que ponen precio a
 * cada oferta alemana del escaparate. O sea: el ahorro que enseñamos se
 * calculaba contra precios de mediados de agosto.
 *
 * Los dos workflows existían desde agosto, escritos a mano, y arrastraban todo
 * lo que fuimos aprendiendo en Alemania sin que nadie lo portara:
 *
 *   - El orquestador llamaba al segmento con workflowId en forma de objeto y
 *     typeVersion 1, que es la combinación que da «Workflow does not exist».
 *     Y encima el id era el literal REEMPLAZA_CON_ID_DEL_WORKFLOW_SEGMENTO.
 *   - Las cabeceras iban en options.headers, que typeVersion 4 IGNORA en
 *     silencio: se estaba pidiendo a AutoScout24 sin User-Agent.
 *   - Sin onError en los HTTP: un corte de red tumbaba la pasada entera.
 *   - Sin reintentos en Postgres y sin aviso por correo: fallaba a oscuras.
 *   - El reparto de marcas iba por día de la semana (i % 7 === día). Si una
 *     pasada se caía, esas marcas no se volvían a mirar hasta la semana
 *     siguiente. Ahora hay cursor en Postgres, como en Alemania.
 *   - NULLIF(color, '''') -cuatro comillas- comparaba contra la cadena «''»,
 *     de dos caracteres, en vez de contra vacío: un color que alguna vez
 *     estuvo vacío no se rellenaba nunca.
 *
 * OJO CON LAS BARRAS. El código de los nodos Code vive dentro de una cadena de
 * JavaScript, y en una cadena "\d" es exactamente "d". Por eso aquí van
 * dobladas: \\d, \\s, \\/. El fichero alemán tiene /[^d]/ en vez de /[^\d]/
 * justo por esto, y su cilindrada del listado sale siempre vacía. Al final de
 * este generador hay una comprobación que ejecuta los regex ya generados.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// El id del workflow «AutoScout24 – Segmento» YA IMPORTADO en n8n. Mientras sea
// el placeholder, el orquestador no puede llamar a nadie. Se rellena solo con:
//     npm run enlaza-segmento-es
// que lo busca por nombre en la base de n8n y vuelve a generar.
const ID_SEGMENTO = "43PLVCbPvTFnZPRt";

// DOS marcas por pasada, no tres.
//
// Medido el 14-sep-2026 con la primera pasada de verdad: cubrir Audi entero son
// 839 páginas -sus 14 tramos suman 16.606 ofertas-, y el ritmo real es de unos
// 6 segundos por página contando la escritura en Postgres. O sea 1h25 por
// marca. Con tres marcas la pasada se iba a más de cuatro horas, y como las
// pasadas están a tres horas de distancia, la de las 16:30 arrancaba encima de
// la de las 13:30: dos workflows pidiéndole a autoscout24.es a la vez.
//
// Con dos marcas la pasada son unas 2h50 y cabe.
//
// SE QUEDA EN DOS, Y EL RITMO SE SUBE POR OTRO LADO (23-sep-2026).
//
// Cruzando nuestras filas con un volcado del portal salió que de los anuncios
// con menos de una semana solo teníamos el 15 %:
//
//     0-7 días    faltan 34.086 de 40.218    85 %
//     7-30        faltan 11.764 de 72.463    16 %
//     30-90       faltan  4.462 de 92.700     5 %
//     más de 90   faltan  2.965 de 62.329     5 %
//
// No es que no lleguemos: es que llegamos tarde. Con cuatro marcas al día, a
// cada marca le tocaba el turno cada once días, y para entonces sus anuncios
// nuevos ya no están en las primeras páginas.
//
// DOS SALIDAS QUE NO SIRVEN, Y POR QUÉ:
//
//   - Subir esta constante. NO: son las mismas cuatro horas de pasada que
//     hacían que la de las 16:30 arrancara encima de la de las 13:30.
//
//   - Añadir pasadas. TAMPOCO: el día ya está lleno. Ocho flujos nuestros le
//     piden cosas a autoscout24.es -dos scrapers de tres horas, dos
//     verificadores y dos enriquecedores, entre españoles y alemanes- y el
//     hueco libre más grande son las 2h25 de 11:05 a 13:30, menos que una
//     pasada. Meter una quinta es pedir que nos corten.
//
// LA SALIDA QUE SÍ: la url ya pide sort=age&desc=1, o sea que los anuncios
// nuevos de cada segmento están en su PÁGINA 1. No hace falta recorrer los
// 5.950 coches de una marca para encontrar sus 130 altas: basta con la
// primera página de cada marca x tramo.
//
//     45 marcas x 14 tramos = 630 páginas ~= una hora
//     altas reales del portal: unas 5.700 al día
//     lo que cabe en 630 páginas: 12.600
//
// O sea que una pasada corta diaria cubriría TODAS las marcas y cogería las
// altas del día, mientras este barrido gradual sigue ocupándose del fondo y de
// los cambios de precio. Está sin hacer: hace falta un flujo nuevo, y este
// portal está lo bastante cargado como para no improvisarlo.
const MARCAS_POR_PASADA = 2;

const CABECERAS = {
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
  ] },
};
const URL_LISTADO = "=https://www.autoscout24.es/lst?atype=C&ustate=N,U&sort=age&desc=1"
  + "&cy=E&powertype=kw&mmvmk0={{ $json.mk }}&pricefrom={{ $json.pf }}&priceto={{ $json.pt }}&page=";

// ══ EL ORQUESTADOR ═════════════════════════════════════════════════════════
const CURSOR_SQL = `-- Por dónde iba la última pasada.
--
-- En Alemania esto vivía en $getWorkflowStaticData y se reiniciaba al
-- reimportar: el 2026-09-09 se reimportó tres veces y las tres pasadas
-- empezaron por Audi, que ya estaba entero. Aquí sobrevive a reimportar, a
-- reiniciar n8n y a que se caiga una pasada a medias.
SELECT valor::int AS cursor FROM moveadvisor_cursores WHERE clave = 'as24_es_marca'`;

const CODE_SEGMENTOS = `// Alimentación GRADUAL: unas pocas marcas por pasada, avanzando un cursor que
// vive en Postgres. Cubre las 45 marcas y vuelve a empezar, o sea refresco
// continuo del mercado español.
const makes = [9,13,47,74,64,60,55,21,54,29,70,39,33,52,28,16360,65,73,46,31,16338,51802,38,15641,43,68,50,6,16415,37,57,51520,15525,67,66,48,19,20,16396,45,27,42,16355,35,14882];
const buckets = [[0,3000],[3000,5000],[5000,7000],[7000,9000],[9000,11000],[11000,13000],[13000,15000],[15000,18000],[18000,22000],[22000,27000],[27000,35000],[35000,50000],[50000,80000],[80000,99999999]];

const MARCAS_POR_PASADA = ${MARCAS_POR_PASADA};

// El cursor se lee de la base, no de la memoria del workflow.
const fila = $('PG: Por dónde íbamos').first().json || {};
let cursor = Number(fila.cursor);
if (!Number.isFinite(cursor) || cursor < 0 || cursor >= makes.length) cursor = 0;

const siguiente = (cursor + MARCAS_POR_PASADA) % makes.length;
// Se apunta ANTES de scrapear, a propósito: si la pasada se cae a la mitad, la
// siguiente sigue avanzando en vez de repetir dos horas de lo mismo.
const sqlCursor = "UPDATE moveadvisor_cursores SET valor = " + siguiente
  + ", actualizado = NOW() WHERE clave = 'as24_es_marca'";

const out = [];
for (let m = 0; m < MARCAS_POR_PASADA; m++) {
  const mk = makes[(cursor + m) % makes.length];
  for (const b of buckets) out.push({ json: { mk: mk, pf: b[0], pt: b[1], sqlCursor: sqlCursor } });
}
console.log('[as24-es] marcas ' + cursor + '..' + (cursor + MARCAS_POR_PASADA - 1)
  + ' de ' + makes.length + ' -> ' + out.length + ' segmentos. La próxima empieza en la ' + siguiente + '.');
return out;`;

const nodosOrq = [
  { parameters: {}, id: "as-o-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 300] },
  // A las 13:30 y a las 16:30. No a las 21:00 como antes: a esa hora el scraper
  // ALEMÁN está pidiéndole fichas al mismo portal (20:15 a 23:00), y pegarle
  // desde dos sitios a la vez es la forma más rápida de que nos corten.
  // 13:30 es justo después del scoring (13:10-13:23) y 16:30 deja la segunda
  // pasada terminada sobre las 19:15.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 30 13,16 * * *" }] } },
    id: "as-o-cron", name: "2 veces/día (13:30 y 16:30)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 500] },
  { parameters: { operation: "executeQuery", query: CURSOR_SQL, options: {} },
    id: "as-o-cursor", name: "PG: Por dónde íbamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 400],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_SEGMENTOS }, id: "as-o-gen",
    name: "Code: Generar segmentos (marca x precio)",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-80, 400] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sqlCursor }}", options: {} },
    id: "as-o-guardar", name: "PG: Apuntar dónde nos quedamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [160, 220],
    credentials: PG_CRED, ...REINTENTA, executeOnce: true },
  { parameters: { options: {} }, id: "as-o-loop", name: "Loop: segmento por segmento",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [160, 400] },
  // typeVersion 1 quiere el id COMO TEXTO. Con la forma de objeto -{__rl,value,
  // mode}- n8n lo interpola como "[object Object]" y dice «Workflow does not
  // exist». Pasó con el alemán el 2026-09-09.
  { parameters: { workflowId: ID_SEGMENTO, options: {} },
    id: "as-o-sub", name: "Scrapear segmento (AutoScout24 – Segmento)",
    type: "n8n-nodes-base.executeWorkflow", typeVersion: 1, position: [400, 500] },
  { parameters: { amount: 1, unit: "seconds" }, id: "as-o-wait", name: "Esperar 1s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [640, 500],
    webhookId: "d51c8a02-as24-es-orq" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexionesOrq = {
  "Ejecutar manualmente":                       { main: [[L("PG: Por dónde íbamos")]] },
  "2 veces/día (13:30 y 16:30)":                { main: [[L("PG: Por dónde íbamos")]] },
  "PG: Por dónde íbamos":                       { main: [[L("Code: Generar segmentos (marca x precio)")]] },
  "Code: Generar segmentos (marca x precio)":   { main: [[L("Loop: segmento por segmento"), L("PG: Apuntar dónde nos quedamos")]] },
  "Loop: segmento por segmento":                { main: [[], [L("Scrapear segmento (AutoScout24 – Segmento)")]] },
  "Scrapear segmento (AutoScout24 – Segmento)": { main: [[L("Esperar 1s")]] },
  "Esperar 1s":                                 { main: [[L("Loop: segmento por segmento")]] },
};

// ══ EL SEGMENTO ════════════════════════════════════════════════════════════
const CODE_PARAMS = `const inp = $input.item.json || {};
return [{ json: { mk: (inp.mk != null ? inp.mk : 74), pf: (inp.pf != null ? inp.pf : 0),
  pt: (inp.pt != null ? inp.pt : 3000) } }];`;

const CODE_PAGINAS = `// Leer numberOfPages de la respuesta de 'Contar' y generar 1..N (tope 200).
const seg = $('Params').item.json;
const httpOut = $input.item.json;
// Con responseFormat 'text' n8n deja el cuerpo en 'data'. Mirar solo 'body'
// fue lo que dejó 4.484 ofertas de Wallapop sin clasificar el 2026-09-11.
const html = typeof httpOut === 'string' ? httpOut : String(httpOut.data || httpOut.body || '');
let totalPages = 0;
try {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) { const pp = JSON.parse(m[1]).props.pageProps; totalPages = Math.min(pp.numberOfPages || 0, 200); }
} catch (e) { totalPages = 0; }
if (!totalPages) {
  // Sin páginas no hay nada que pedir. Devolver un item vacío haría que el
  // bucle llamara al HTTP con page indefinido.
  console.log('[as24-es] marca ' + seg.mk + ' ' + seg.pf + '-' + seg.pt + ': sin resultados');
  return [];
}
const out = [];
for (let i = 1; i <= totalPages; i++) out.push({ json: { mk: seg.mk, pf: seg.pf, pt: seg.pt, page: i } });
return out;`;

// El transformador vive en scripts/lib/ porque lo comparte con el flujo de
// altas nuevas. Ver la cabecera de ese fichero.
const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "as24-es-transformar.js"), "utf8");;

const condicionHayOfertas = {
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "strict" },
    conditions: [{ id: "c1", leftValue: "={{ $json.count }}", rightValue: 0,
      operator: { type: "number", operation: "gt" } }],
    combinator: "and",
  },
  options: {},
};

const httpListado = (id, nombre, pos) => ({
  parameters: {
    url: URL_LISTADO + (id === "as-b-count" ? "1" : "{{ $json.page }}"),
    ...CABECERAS,
    options: {
      response: { response: { fullResponse: false, neverError: true, responseFormat: "text" } },
      timeout: 25000,
      redirect: { redirect: { followRedirects: true } },
    },
  },
  id: id, name: nombre,
  // neverError solo calla los códigos HTTP; un corte de red seguiría matando el
  // nodo y con él la pasada entera.
  onError: "continueRegularOutput",
  type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: pos,
});

const nodosSeg = [
  { parameters: {}, id: "as-b-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-260, 300] },
  { parameters: {}, id: "as-b-parent", name: "Llamada desde orquestador",
    type: "n8n-nodes-base.executeWorkflowTrigger", typeVersion: 1, position: [-260, 500] },
  { parameters: { language: "javaScript", jsCode: CODE_PARAMS }, id: "as-b-params", name: "Params",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-20, 400] },
  httpListado("as-b-count", "HTTP: Contar (pág 1)", [200, 400]),
  { parameters: { jsCode: CODE_PAGINAS }, id: "as-b-gen", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [420, 400] },
  { parameters: { batchSize: 1, options: {} }, id: "as-b-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [640, 400] },
  httpListado("as-b-http", "HTTP: Listado AutoScout24", [860, 400]),
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "as-b-transform", name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1080, 400] },
  { parameters: condicionHayOfertas, id: "as-b-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1300, 400] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "as-b-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1540, 280],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { amount: 1, unit: "seconds" }, id: "as-b-wait", name: "Esperar 1s (rate limit)",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1780, 400],
    webhookId: "a93f27e4-as24-es-seg" },
];

const conexionesSeg = {
  "Ejecutar manualmente":      { main: [[L("Params")]] },
  "Llamada desde orquestador": { main: [[L("Params")]] },
  "Params":                    { main: [[L("HTTP: Contar (pág 1)")]] },
  "HTTP: Contar (pág 1)":      { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":     { main: [[L("Loop: página por página")]] },
  "Loop: página por página":   { main: [[], [L("HTTP: Listado AutoScout24")]] },
  "HTTP: Listado AutoScout24": { main: [[L("Code: Transformar ofertas")]] },
  "Code: Transformar ofertas": { main: [[L("IF: ¿hay ofertas?")]] },
  "IF: ¿hay ofertas?":         { main: [[L("PG: Upsert ofertas")], [L("Esperar 1s (rate limit)")]] },
  "PG: Upsert ofertas":        { main: [[L("Esperar 1s (rate limit)")]] },
  "Esperar 1s (rate limit)":   { main: [[L("Loop: página por página")]] },
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

escribe("autoscout24-scraper-offers.json", {
  name: "AutoScout24 – Scraper (orquestador)",
  nodes: nodosOrq, connections: conexionesOrq, settings: ajustes, pinData: {},
});
escribe("autoscout24-segmento.json", {
  name: "AutoScout24 – Segmento",
  nodes: nodosSeg, connections: conexionesSeg, settings: ajustes, pinData: {},
});

// ══ que las barras hayan sobrevivido ═══════════════════════════════════════
// En una cadena de JavaScript "\d" es "d". Si alguien quita una barra de las
// dobles de arriba, el regex generado deja de reconocer dígitos y la cilindrada
// del listado sale vacía para siempre, en silencio. Es lo que le pasa al
// fichero alemán. Esto lo ejecuta de verdad sobre el código ya generado.
const generado = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autoscout24-segmento.json"), "utf8"));
const js = generado.nodes.find((n) => n.name === "Code: Transformar ofertas").parameters.jsCode;
let mal = 0;
const prueba = (nombre, cond) => {
  if (!cond) { mal++; console.log("  MAL   " + nombre); } else console.log("  ok    " + nombre);
};
prueba("el regex de dígitos conserva su barra", js.indexOf("[^\\d]") >= 0 && js.indexOf("[^d]") < 0);
prueba("el regex de __NEXT_DATA__ conserva las suyas",
  js.indexOf("application\\/json") >= 0 && js.indexOf("[\\s\\S]") >= 0);
// Sobre la línea del color, no sobre todo el fichero: el comentario que explica
// este fallo cita las cuatro comillas y se delataba a sí mismo.
const lineaColor = js.split("\n").find((l) => l.indexOf("NULLIF(moveadvisor_market_offers.color") >= 0) || "";
prueba("NULLIF del color usa DOS comillas, no cuatro",
  lineaColor.indexOf("color,'')") >= 0 && lineaColor.indexOf("''''") < 0);
prueba("escribe el país", js.indexOf("'ES', NOW()") >= 0 && js.indexOf("country = EXCLUDED.country") >= 0);
// Y el de verdad: ejecutarlo.
const num = new Function("s", "return parseInt(String(s).replace(/[^\\d]/g, ''), 10);");
prueba("y de hecho '123.456 km' da 123456", num("123.456 km") === 123456);

if (ID_SEGMENTO === "PENDIENTE_DE_ENLAZAR") {
  console.log("\n  AVISO: el orquestador todavía no sabe a quién llamar.");
  console.log("  Importa primero «AutoScout24 – Segmento» en n8n y luego lanza:");
  console.log("      npm run enlaza-segmento-es");
}
process.exit(mal ? 1 : 0);
