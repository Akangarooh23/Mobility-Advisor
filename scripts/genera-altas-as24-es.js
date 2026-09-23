/**
 * AutoScout24 España – Altas nuevas
 *
 * El origen de n8n-workflows/autoscout24-altas-es.json.
 *
 *   node scripts/genera-altas-as24-es.js
 *   npm run test:as24-altas
 *
 * ── EL PROBLEMA QUE RESUELVE ───────────────────────────────────────────────
 *
 * Cruzando nuestras filas con un volcado del portal del 21-sep-2026:
 *
 *     0-7 días    faltan 34.086 de 40.218    85 %
 *     7-30        faltan 11.764 de 72.463    16 %
 *     30-90       faltan  4.462 de 92.700     5 %
 *     más de 90   faltan  2.965 de 62.329     5 %
 *
 * De los anuncios con menos de una semana solo teníamos el 15 %. No es que no
 * lleguemos: llegamos tarde. El barrido gradual lleva 45 marcas a razón de 4 al
 * día, así que a cada marca le toca cada once días, y para entonces sus altas
 * ya no están en las primeras páginas.
 *
 * Y los anuncios recién puestos son justo los comparables que mejor dicen el
 * precio de hoy.
 *
 * Medido hoy contra el portal, ordenando por edad y mirando la página 1 y la
 * 10 de seis marcas -las 200 ofertas más nuevas de cada una-:
 *
 *     Volkswagen  19.781 ofertas   nos faltan 20/20 y 20/20
 *     Peugeot     22.895                      20/20 y 20/20
 *     Mercedes    20.354                      20/20 y 20/20
 *     Audi        16.625                      20/20 y 20/20
 *     BMW         16.337                      20/20 y 20/20
 *     Ford        14.920                      20/20 y 20/20
 *
 * Doscientas de doscientas. Y no es que no tengamos esas marcas: de Volkswagen
 * tenemos 15.296 vivas de 19.781, el 77 %. Lo que tenemos es el fondo; lo que
 * no tenemos es lo de arriba. Así de limpio sale el corte.
 *
 * ── POR QUÉ ESTE FLUJO Y NO SUBIR EL OTRO ──────────────────────────────────
 *
 * Se probaron las dos salidas obvias y ninguna vale:
 *
 *   - Subir MARCAS_POR_PASADA. Con tres marcas la pasada del barrido pasa de
 *     2h50 a más de cuatro horas y la de las 16:30 arranca encima de la de las
 *     13:30. Ya pasó una vez.
 *
 *   - Añadir pasadas al barrido. El día está lleno: OCHO flujos nuestros le
 *     piden cosas a autoscout24.es -dos scrapers de tres horas, dos
 *     verificadores y dos enriquecedores, entre españoles y alemanes-. El
 *     hueco libre más grande son 2h25, menos que una pasada.
 *
 * La salida está en que la url YA pide sort=age&desc=1: las altas de cada
 * segmento están en su PÁGINA 1. No hace falta recorrer los 5.950 coches de
 * una marca para encontrar sus 130 altas.
 *
 * ── CUÁNTAS PÁGINAS, Y POR QUÉ ESAS ────────────────────────────────────────
 *
 * Las marcas son muy desiguales. Preguntándole a las 45 -las 45 responden, y
 * suman 271.553 ofertas, o sea que la lista cubre el portal entero-:
 *
 *     Peugeot        22.891        Iveco      246
 *     Mercedes-Benz  20.367        Lancia     244
 *     Volkswagen     19.773        Infiniti   155
 *     Audi           16.624        Chrysler    79
 *     BMW            16.340        Isuzu        14
 *
 * De Peugeot a Isuzu hay un factor de 1.600. Pedirle a todas el mismo número
 * de páginas sería quedarse corto con Peugeot y gastar de más con Isuzu.
 *
 * Así que las páginas salen del propio tamaño de la marca, que la página 1 ya
 * nos dice: una página por cada 800 ofertas, con suelo de 2 y techo de 30.
 *
 *     Peugeot     22.891 ofertas  ->  29 páginas  (580 anuncios)
 *     Volkswagen  19.773          ->  25          (500)
 *     una de 4.000                ->   5
 *     Isuzu             14        ->   2          (el suelo)
 *
 * El 800 no es redondo por casualidad: el portal recibe unas 5.700 altas al día
 * sobre 271.553 ofertas, o sea el 2,1 % diario. Una marca de N ofertas recibe
 * N x 0,021 altas al día, que caben en N/950 páginas de veinte. Pedir una por
 * cada 800 deja margen para el día que a una marca le entren más de la cuenta.
 *
 * Sumadas las 45 marcas salen 376 páginas al día = 7.520 anuncios mirados
 * contra ~5.700 altas: un 32 % de margen.
 *
 * El techo de 30 hoy no lo toca nadie -Peugeot, la mayor, se queda en 29- y
 * está ahí por si una marca crece de golpe o si algún día una búsqueda devuelve
 * una cifra absurda. El suelo de 2 es para que una marca pequeña no se quede
 * sin su segunda página el día que le entren veinticinco coches juntos.
 *
 * ── EL PESO, QUE ES LO QUE MANDA EN EL REPARTO ─────────────────────────────
 *
 * Cada página del listado son 635 KB -medido sobre las 45- y n8n guarda en
 * memoria la salida de cada vuelta del bucle. Las 376 de golpe serían 233 MB
 * retenidos, y ahí el proceso se cae.
 *
 * Por eso van 15 marcas por pasada -126 páginas, 78 MB- y tres pasadas al día
 * cubren las 45. Cada pasada son unos cinco minutos: 126 páginas a medio
 * segundo de respuesta más el segundo de espera entre una y otra.
 *
 * El cursor vive en Postgres, como el del barrido, para que sobreviva a
 * reimportar y a que se caiga una pasada a medias.
 *
 * ── LO QUE NO HACE ─────────────────────────────────────────────────────────
 *
 * No sustituye al barrido gradual: ese sigue haciendo falta para el fondo del
 * catálogo y para los cambios de precio de los anuncios viejos. Este solo se
 * ocupa de que una alta de hoy esté hoy.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const MARCAS_POR_PASADA = 15;
const OFERTAS_POR_PAGINA_PEDIDA = 800;   // una página por cada 800 ofertas
const PAGINAS_MIN = 2;
const PAGINAS_MAX = 30;

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
  timeout: 45000,
  redirect: { redirect: { followRedirects: true } },
};

// Sin tramos de precio: aquí solo interesan las altas, y con sort=age&desc=1
// están todas arriba. El barrido gradual sí los usa, para pasar del tope de
// resultados por búsqueda y llegar al fondo.
const URL = "=https://www.autoscout24.es/lst?atype=C&ustate=N,U&sort=age&desc=1"
  + "&cy=E&powertype=kw&mmvmk0={{ $json.mk }}&page={{ $json.page }}";

const CURSOR_SQL = `-- Por dónde iba la última pasada de altas, sembrando la fila si no existe.
--
-- En Postgres y no en $getWorkflowStaticData: la memoria del workflow se
-- reinicia al reimportar, y entonces tres reimportaciones seguidas repiten las
-- mismas quince marcas y las otras treinta no se miran.
--
-- La clave es distinta de la del barrido gradual a propósito: son dos rondas
-- independientes y compartir cursor haría que una arrastrara a la otra.
--
-- Va como INSERT y no como SELECT porque la fila 'as24_es_altas' no existe
-- todavía, y un SELECT sin resultados devuelve CERO items: en n8n un nodo sin
-- items de entrada no se ejecuta, así que el flujo se pararía aquí mismo, en
-- verde y sin un solo error.
--
-- El DO UPDATE es un no-op -reescribe la clave consigo misma- y está solo para
-- que el RETURNING dispare también cuando la fila YA existe; con DO NOTHING no
-- devolvería nada y tendríamos el mismo problema a partir de la segunda
-- pasada. El valor no se toca.
INSERT INTO moveadvisor_cursores (clave, valor) VALUES ('as24_es_altas', 0)
ON CONFLICT (clave) DO UPDATE SET clave = EXCLUDED.clave
RETURNING valor::int AS cursor`;

const CODE_MARCAS = `// Las marcas de esta pasada, y la petición de conteo de cada una.
//
// Los ids son los mismos que usa el barrido gradual: son los de AutoScout24,
// no los nuestros.
const makes = [9,13,47,74,64,60,55,21,54,29,70,39,33,52,28,16360,65,73,46,31,16338,51802,38,15641,43,68,50,6,16415,37,57,51520,15525,67,66,48,19,20,16396,45,27,42,16355,35,14882];
const MARCAS_POR_PASADA = ${MARCAS_POR_PASADA};

const fila = $('PG: Por dónde íbamos').first().json || {};
let cursor = Number(fila.cursor);
if (!Number.isFinite(cursor) || cursor < 0 || cursor >= makes.length) cursor = 0;

const siguiente = (cursor + MARCAS_POR_PASADA) % makes.length;
// Se apunta ANTES de pedir nada: si la pasada se cae a la mitad, la siguiente
// avanza en vez de repetir lo mismo.
const sqlCursor = "UPDATE moveadvisor_cursores SET valor = " + siguiente
  + ", actualizado = NOW() WHERE clave = 'as24_es_altas'";

const out = [];
for (let m = 0; m < MARCAS_POR_PASADA; m++) {
  const mk = makes[(cursor + m) % makes.length];
  // page 1 sirve de conteo Y de primera página de datos: no se desperdicia.
  out.push({ json: { mk: mk, page: 1, sqlCursor: sqlCursor } });
}
console.log('[as24-altas] marcas ' + cursor + '..' + (cursor + MARCAS_POR_PASADA - 1)
  + ' de ' + makes.length + '. La próxima empieza en la ' + siguiente + '.');
return out;`;

const CODE_PAGINAS = `// Cuántas páginas pedirle a ESTA marca, a partir de lo grande que sea.
const seg = $('Loop: marca por marca').first().json;
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no
// en 'body'. Mirar solo 'body' dejó 4.484 ofertas de Wallapop sin clasificar.
const html = String(res.data || res.body || '');

let resultados = 0;
try {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) {
    const pp = JSON.parse(m[1]).props.pageProps;
    resultados = Number(pp.numberOfResults || 0);
  }
} catch (e) { resultados = 0; }

/*
 * Ojo con devolver [] cuando no hay resultados: el bucle de páginas no se
 * ejecutaría, su salida «terminado» no dispararía, y el bucle de MARCAS no
 * volvería a arrancar nunca. Una marca que fallara se llevaría por delante a
 * las catorce siguientes, y la ejecución acabaría en verde habiendo hecho una
 * de quince.
 *
 * Así que si no hay resultados legibles -página caída, bloqueo, HTML
 * cambiado- se sigue con el mínimo de páginas. Cuesta una petición de más y
 * mantiene viva la cadena.
 */
if (!resultados) console.log('[as24-altas] marca ' + seg.mk + ': sin resultados legibles');

/*
 * Una página por cada ${OFERTAS_POR_PAGINA_PEDIDA} ofertas de la marca.
 *
 * El portal recibe unas 5.700 altas al día repartidas más o menos en
 * proporción a lo grande que es cada marca, así que pedir en proporción al
 * tamaño es pedir en proporción a las altas.
 *
 * El techo de ${PAGINAS_MAX} está para que una marca enorme no se lleve la pasada entera,
 * y el suelo de ${PAGINAS_MIN} para que una pequeña no se quede sin su segunda página el día
 * que le entren veinticinco coches de golpe.
 */
let paginas = Math.ceil(resultados / ${OFERTAS_POR_PAGINA_PEDIDA});
if (paginas < ${PAGINAS_MIN}) paginas = ${PAGINAS_MIN};
if (paginas > ${PAGINAS_MAX}) paginas = ${PAGINAS_MAX};

const out = [];
// Desde la 2: la 1 ya la tenemos y se transforma aparte.
for (let p = 2; p <= paginas; p++) out.push({ json: { mk: seg.mk, page: p } });
console.log('[as24-altas] marca ' + seg.mk + ': ' + resultados + ' ofertas -> '
  + paginas + ' páginas');
return out;`;

const CODE_TRANSFORMAR = fs.readFileSync(
  path.join(RAIZ, "scripts", "lib", "as24-es-transformar.js"), "utf8");

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
/*
 * 11:30, 12:30 y 19:30.
 *
 * Los tres huecos que deja el resto de lo nuestro contra autoscout24.es:
 *
 *   8:15-11:05  el scraper ALEMÁN
 *   13:30-19:20 el barrido gradual español (dos pasadas)
 *   20:15-23:05 otra vez el alemán
 *
 * Son pasadas cortas -unos doce minutos- así que caben en los huecos sin
 * rozar a nadie. Ponerlas dentro de las ventanas de los scrapers sería
 * pegarle al portal desde dos sitios a la vez, que es la forma más rápida de
 * que nos corten.
 */
const CRON = "3 veces/día (11:30, 12:30 y 19:30)";
const nodos = [
  { parameters: {}, id: "aa-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-820, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 30 11,12,19 * * *" }] } },
    id: "aa-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-820, 400] },
  { parameters: { operation: "executeQuery", query: CURSOR_SQL, options: {} },
    id: "aa-cursor", name: "PG: Por dónde íbamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-620, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_MARCAS }, id: "aa-marcas", name: "Code: Marcas de esta pasada",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-420, 300] },
  // Cuelga del Code EN PARALELO al bucle, no en medio. Con executeOnce el nodo
  // procesa el primer item y saca UNO solo: puesto en serie delante del bucle,
  // las quince marcas se quedarían en una. El apunte es un callejón sin salida
  // a propósito. El barrido gradual lo tiene igual, por lo mismo.
  { parameters: { operation: "executeQuery", query: "={{ $json.sqlCursor }}", options: {} },
    id: "aa-apunta", name: "PG: Apuntar dónde nos quedamos",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-220, 140],
    executeOnce: true, credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "aa-loop-marca", name: "Loop: marca por marca",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-20, 300] },
  { parameters: { url: URL, ...CABECERAS, options: OPCIONES_HTTP },
    id: "aa-http1", name: "HTTP: Página 1 de la marca",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [220, 420] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "aa-transf1",
    name: "Code: Transformar la página 1",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [440, 300] },
  { parameters: condicion("aa-c-sql1", "sql"), id: "aa-if1", name: "IF: ¿hay ofertas? (1)",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [640, 300] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "aa-pg1", name: "PG: Upsert de la página 1",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [840, 220],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_PAGINAS }, id: "aa-paginas",
    name: "Code: Cuántas páginas más",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [440, 560] },
  { parameters: { options: {} }, id: "aa-loop-pag", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [640, 560] },
  { parameters: { url: URL, ...CABECERAS, options: OPCIONES_HTTP },
    id: "aa-http", name: "HTTP: Resto de páginas",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [880, 660] },
  { parameters: { jsCode: CODE_TRANSFORMAR }, id: "aa-transf",
    name: "Code: Transformar ofertas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1100, 660] },
  { parameters: condicion("aa-c-sql", "sql"), id: "aa-if", name: "IF: ¿hay ofertas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1300, 660] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "aa-pg", name: "PG: Upsert ofertas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1500, 580],
    credentials: PG_CRED, ...REINTENTA },
  // La unidad hay que escribirla: n8n borra los valores por defecto al
  // importar y la unidad por defecto del Wait son HORAS. Con «amount: 1» a
  // secas, el enriquecedor de CanalCar hizo UNA ficha y se quedó esperando
  // sesenta minutos a la siguiente, en verde y sin decir nada.
  { parameters: { amount: 1, unit: "seconds" }, id: "aa-esperar", name: "Esperar 1s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1700, 580],
    webhookId: "aa-esperar-as24-altas" },
];

const conexiones = {
  "Ejecutar manualmente":   { main: [[L("PG: Por dónde íbamos")]] },
  [CRON]:                   { main: [[L("PG: Por dónde íbamos")]] },
  "PG: Por dónde íbamos":   { main: [[L("Code: Marcas de esta pasada")]] },
  "Code: Marcas de esta pasada": { main: [[L("Loop: marca por marca"), L("PG: Apuntar dónde nos quedamos")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada marca. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: marca por marca":  { main: [[], [L("HTTP: Página 1 de la marca")]] },
  // La página 1 se usa para DOS cosas: se transforma -porque ya trae los
  // veinte anuncios más nuevos- y se mide para saber cuántas más pedir.
  "HTTP: Página 1 de la marca": { main: [[L("Code: Transformar la página 1"), L("Code: Cuántas páginas más")]] },
  "Code: Transformar la página 1": { main: [[L("IF: ¿hay ofertas? (1)")]] },
  "IF: ¿hay ofertas? (1)":  { main: [[L("PG: Upsert de la página 1")], []] },
  "Code: Cuántas páginas más": { main: [[L("Loop: página por página")]] },
  // Al terminar las páginas de esta marca, se vuelve al bucle de marcas.
  "Loop: página por página": { main: [[L("Loop: marca por marca")], [L("HTTP: Resto de páginas")]] },
  "HTTP: Resto de páginas": { main: [[L("Code: Transformar ofertas")]] },
  "Code: Transformar ofertas": { main: [[L("IF: ¿hay ofertas?")]] },
  "IF: ¿hay ofertas?":      { main: [[L("PG: Upsert ofertas")], [L("Esperar 1s")]] },
  "PG: Upsert ofertas":     { main: [[L("Esperar 1s")]] },
  "Esperar 1s":             { main: [[L("Loop: página por página")]] },
};

const wf = {
  // Dieciséis caracteres, ni uno más: es el formato de id que usa n8n. Sin id,
  // importar sobre un workflow que ya tiene nodos los AÑADE en vez de
  // sustituirlos, y se queda con dos copias completas, cada una con su cron,
  // pidiéndole al portal lo mismo dos veces. Con id, reimportar actualiza.
  id: "AltasAS24ES0001x",
  name: "AutoScout24 ES – Altas nuevas",
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

const destino = path.join(RAIZ, "n8n-workflows", "autoscout24-altas-es.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, 3 pasadas/día, " + MARCAS_POR_PASADA + " marcas por pasada");
console.log("  las 45 marcas cada día: 376 páginas, 126 por pasada (78 MB retenidos, ~5 min)");

/*
 * La comprobación de las barras, que aquí es obligatoria.
 *
 * El regex de __NEXT_DATA__ viaja dentro de una cadena de JavaScript y de un
 * JSON. Si pierde una barra, deja de casar y el flujo sigue corriendo en verde
 * leyendo cero ofertas. Se ejecuta el regex ya generado contra un HTML de
 * mentira: que esté escrito no basta, tiene que casar.
 */
const generado = JSON.parse(fs.readFileSync(destino, "utf8"));
const codPaginas = generado.nodes.find((n) => n.name === "Code: Cuántas páginas más").parameters.jsCode;
const m = codPaginas.match(/html\.match\((\/[\s\S]*?\/)\);/);
if (!m) { console.error("  FALLA: no encuentro el regex en el nodo generado"); process.exit(1); }
const prueba = "<script id=\"__NEXT_DATA__\" type=\"application/json\">"
  + "{\"props\":{\"pageProps\":{\"numberOfResults\":19776}}}</script>";
// eslint-disable-next-line no-eval
const casa = prueba.match(eval(m[1]));
if (!casa) { console.error("  FALLA: el regex generado NO casa con un HTML de verdad"); process.exit(1); }
console.log("  ok  el regex de __NEXT_DATA__ casa de verdad (no solo está escrito)");
