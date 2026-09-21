/**
 * Flexicar – Verificar ofertas activas (por catálogo)
 *
 * El origen de n8n-workflows/flexicar-verificar-activas.json.
 *
 *   node scripts/genera-verificador-flexicar.js
 *   npm run test:flexicar-verify
 *
 * ── Por qué este NO pide ficha por ficha ───────────────────────────────────
 *
 * Los otros verificadores preguntan por cada oferta: 24.391 peticiones para
 * Flexicar, y aun así el tamaño obliga a repartirlas en días -en AutoScout24
 * España la vuelta completa tarda tres semanas-.
 *
 * Aquí no hace falta. El scraper recorre el catálogo ENTERO dos veces al día
 * -1.904 páginas, unos 10 minutos- y estampa last_seen_at en todo lo que
 * encuentra. Así que la pregunta «¿sigue viva?» ya está contestada: lo que no
 * aparece en una vuelta completa ya no está en el catálogo.
 *
 * Eso convierte 24.391 peticiones en CERO y, sobre todo, cambia «una vuelta
 * cada 24 días» por «todas, todos los días».
 *
 * Es la misma idea que el verificador por listado de Milanuncios, llevada al
 * caso en que el listado es el catálogo completo.
 *
 * ── Lo que puede salir mal, y los tres frenos ──────────────────────────────
 *
 * El peligro es obvio: si el scraper falla o el portal devuelve medio catálogo,
 * «no lo he visto» deja de significar «no está» y esto daría de baja miles de
 * coches vivos de un golpe. Tres frenos, y hacen falta los tres:
 *
 *   1. EL SCRAPER TIENE QUE HABER PASADO. Si la última vez que se vio algo del
 *      catálogo es de hace más de 14 horas, no se da ni una baja: el silencio
 *      del scraper no es prueba de nada.
 *
 *   2. TECHO DE MORTANDAD. Si las candidatas pasan del 35% de las activas, se
 *      para. Hoy son el 7% -1.678 de 24.391, y todas restos de agosto-. Un 90%
 *      no sería una mala mañana del mercado: sería el scraper roto.
 *
 *   3. UNA CATA, ANTES DE TOCAR NADA. Se cogen 40 candidatas al azar y se le
 *      pregunta a la API por ellas, una a una. Tienen que estar muertas de
 *      verdad -404-. Si un cuarto o más siguen vivas, el scraper se ha dejado
 *      páginas y la baja masiva no se hace.
 *
 * 40 peticiones para decidir sobre 24.391. Ese es todo el coste.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

// El id de la credencial que EXISTE en n8n. La plantilla de la que salieron
// estos generadores llevaba otro que no existe en esta maquina, y los nodos
// entraron sin credencial: dos triangulos de aviso y nada que escribiera.
const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// Sin ver en una vuelta y media larga del scraper (pasa a las 9:10 y 21:10).
const HORAS_PARA_DARLA_POR_MUERTA = 26;
// Si el scraper lleva más de esto sin ver NADA, es que no ha pasado.
const HORAS_SIN_SCRAPER = 14;
const TOPE_MORTANDAD = 0.35;
const MUESTRA = 40;
const TOPE_VIVAS_EN_LA_CATA = 0.25;

const SALUD = `-- ¿Ha pasado el scraper, y cuántas llevan sin aparecer?
--
-- Todo en una consulta: son tres números sobre la misma tabla y pedirlos por
-- separado deja hueco a que cambien entre medias.
SELECT
  count(*) FILTER (WHERE is_active)::int AS activas,
  count(*) FILTER (WHERE is_active
    AND last_seen_at < NOW() - INTERVAL '${HORAS_PARA_DARLA_POR_MUERTA} hours')::int AS candidatas,
  COALESCE(EXTRACT(EPOCH FROM (NOW() - max(last_seen_at))) / 3600, 9999)::numeric(10,2) AS horas_sin_ver
FROM moveadvisor_market_offers
WHERE portal = 'flexicar'`;

const MUESTRA_SQL = `-- Las que se van a dar de baja, para preguntarle a la API por unas pocas.
-- Al azar y no las primeras: si el scraper se dejara un trozo del catálogo,
-- las candidatas estarían agrupadas y una muestra ordenada las tomaría todas
-- del mismo sitio.
SELECT id FROM moveadvisor_market_offers
WHERE portal = 'flexicar'
  AND is_active
  AND last_seen_at < NOW() - INTERVAL '${HORAS_PARA_DARLA_POR_MUERTA} hours'
ORDER BY random()
LIMIT ${MUESTRA}`;

const CODE_SALUD = `// Los dos primeros frenos, antes de mirar nada.
const s = $getWorkflowStaticData('global');
const f = $input.first().json || {};

// La memoria es del workflow, no de la pasada.
s.fv_run = $execution.id;
s.fv_activas = Number(f.activas) || 0;
s.fv_candidatas = Number(f.candidatas) || 0;
s.fv_horas = Number(f.horas_sin_ver) || 9999;
s.fv_vivas = 0;
s.fv_muertas = 0;
s.fv_catadas = 0;
s.fv_bajas = 0;
s.fv_motivo = '';

const pct = s.fv_activas ? (s.fv_candidatas / s.fv_activas) : 0;
console.log('[fx-verify] ' + s.fv_activas + ' activas, ' + s.fv_candidatas
  + ' sin aparecer (' + Math.round(pct * 100) + '%), el catálogo se vio hace '
  + s.fv_horas + ' h');

// Freno 1: sin scraper reciente, «no lo he visto» no prueba nada.
if (s.fv_horas > ${HORAS_SIN_SCRAPER}) {
  s.fv_motivo = 'el scraper lleva ' + s.fv_horas + ' h sin ver el catálogo';
  console.log('[fx-verify] NO SE DAN BAJAS: ' + s.fv_motivo);
  return [{ json: { seguir: '' } }];
}
// Freno 2: una mortandad imposible es el scraper roto, no el mercado.
if (pct > ${TOPE_MORTANDAD}) {
  s.fv_motivo = 'el ' + Math.round(pct * 100) + '% del catálogo ha desaparecido de golpe';
  console.log('[fx-verify] NO SE DAN BAJAS: ' + s.fv_motivo);
  return [{ json: { seguir: '' } }];
}
if (!s.fv_candidatas) {
  s.fv_motivo = 'no hay ninguna que dar de baja';
  console.log('[fx-verify] nada que hacer: todo el catálogo se ha visto hoy.');
  return [{ json: { seguir: '' } }];
}
return [{ json: { seguir: 'si' } }];`;

const CODE_CATA_URL = `// La URL de la API para una candidata de la cata.
const item = $input.first().json || {};
const s = $getWorkflowStaticData('global');
// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
if (!item.id) return [{ json: { url: '', id: '' } }];
return [{ json: {
  id: String(item.id),
  url: 'https://services.flexicar.es/api/v1/vehicles/' + String(item.id),
} }];`;

const CODE_CATA = `// ¿Está muerta de verdad?
const s = $getWorkflowStaticData('global');
const res = $input.first().json;
const codigo = Number(res.statusCode || 0);
const id = String(($('Code: URL de la cata').item.json || {}).id || '');
if (!id) return [{ json: { id: '', estado: 'sin id' } }];

s.fv_catadas = (s.fv_catadas || 0) + 1;
// 404 es la respuesta limpia de esta API a un coche que ya no está.
if (codigo === 404) {
  s.fv_muertas = (s.fv_muertas || 0) + 1;
  return [{ json: { id: id, estado: 'muerta' } }];
}
if (codigo === 200) {
  s.fv_vivas = (s.fv_vivas || 0) + 1;
  console.log('[fx-verify] OJO: ' + id + ' sigue VIVA y el scraper no la vio');
  return [{ json: { id: id, estado: 'VIVA' } }];
}
// Un 403 o un fallo de red no dicen nada: ni viva ni muerta, no cuenta.
s.fv_catadas = s.fv_catadas - 1;
return [{ json: { id: id, estado: 'no contesta (' + codigo + ')' } }];`;

const CODE_VEREDICTO = `// Freno 3: la cata manda. Y si pasa, aquí se arma la baja.
const s = $getWorkflowStaticData('global');
const catadas = s.fv_catadas || 0;
const vivas = s.fv_vivas || 0;
const proporcion = catadas ? (vivas / catadas) : 0;

console.log('[fx-verify] cata: ' + (s.fv_muertas || 0) + ' muertas y ' + vivas
  + ' vivas de ' + catadas + ' preguntadas');

// Si la API no contestó a ninguna, no hay cata y por tanto no hay permiso.
if (catadas === 0) {
  s.fv_motivo = 'la cata no obtuvo ni una respuesta';
  console.log('[fx-verify] NO SE DAN BAJAS: ' + s.fv_motivo);
  return [{ json: { sql: null } }];
}
// Mayor O IGUAL: en un freno, el límite exacto tiene que parar. Con «mayor
// que», una cata con 10 vivas de 40 -un cuarto entero- daba las bajas por
// buenas por un pelo.
if (proporcion >= ${TOPE_VIVAS_EN_LA_CATA}) {
  s.fv_motivo = Math.round(proporcion * 100) + '% de la cata seguía viva: el scraper se ha dejado páginas';
  console.log('[fx-verify] NO SE DAN BAJAS: ' + s.fv_motivo);
  return [{ json: { sql: null } }];
}

s.fv_bajas = s.fv_candidatas || 0;
// Dos escrituras en una: la baja de las que no aparecen, y la marca de
// comprobado en TODAS las demás. Lo segundo es lo que permite decir «hoy se ha
// mirado el catálogo entero» mirando la base, sin creerse un log.
const sql = "WITH bajas AS ("
  + "  UPDATE moveadvisor_market_offers"
  + "     SET is_active = FALSE, last_checked_at = NOW()"
  + "   WHERE portal = 'flexicar' AND is_active"
  + "     AND last_seen_at < NOW() - INTERVAL '${HORAS_PARA_DARLA_POR_MUERTA} hours'"
  + "  RETURNING 1"
  + "), vivas AS ("
  + "  UPDATE moveadvisor_market_offers"
  + "     SET last_checked_at = NOW()"
  + "   WHERE portal = 'flexicar' AND is_active"
  + "     AND last_seen_at >= NOW() - INTERVAL '${HORAS_PARA_DARLA_POR_MUERTA} hours'"
  + "  RETURNING 1"
  + ") SELECT (SELECT count(*) FROM bajas)::int AS bajas,"
  + "         (SELECT count(*) FROM vivas)::int AS confirmadas";
return [{ json: { sql: sql } }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
let bajas = 0, confirmadas = 0;
try {
  const r = $('PG: Dar de baja y confirmar').first().json || {};
  bajas = Number(r.bajas) || 0;
  confirmadas = Number(r.confirmadas) || 0;
} catch (e) { bajas = 0; confirmadas = 0; }

console.log('[fx-verify] ── resumen ──');
console.log('  activas al empezar : ' + (s.fv_activas || 0));
console.log('  sin aparecer       : ' + (s.fv_candidatas || 0));
console.log('  cata               : ' + (s.fv_muertas || 0) + ' muertas, '
  + (s.fv_vivas || 0) + ' vivas de ' + (s.fv_catadas || 0));
console.log('  BAJAS              : ' + bajas);
console.log('  confirmadas vivas  : ' + confirmadas);
if (s.fv_motivo) console.log('  NO SE DIERON BAJAS: ' + s.fv_motivo);

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores:
//     checked  las que se han mirado (todo el catálogo activo)
//     alive  confirmadas vivas    deactivated  bajas
//     unclassified  candidatas que no se llegaron a dar de baja
//     transient  las de la cata que no contestaron
//     blocked  TRUE si algún freno paró la pasada
const paradas = s.fv_motivo ? (s.fv_candidatas || 0) : 0;
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('flexicar', NOW(), " + n(s.fv_activas) + ', ' + n(confirmadas) + ', '
  + n(bajas) + ', ' + n(paradas) + ', ' + n(${MUESTRA} - (s.fv_catadas || 0)) + ', '
  + (s.fv_motivo ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, activas: s.fv_activas || 0, candidatas: s.fv_candidatas || 0,
  bajas: bajas, confirmadas: confirmadas, vivasEnLaCata: s.fv_vivas || 0,
  catadas: s.fv_catadas || 0, motivo: s.fv_motivo || '' };
for (const k of Object.keys(s)) { if (k.indexOf('fv_') === 0) delete s[k]; }
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
// Después de cada pasada del scraper (9:10 y 21:10, ~10 min), con margen.
const CRON = "2 veces/día (12:50 y 22:50)";
const nodos = [
  { parameters: {}, id: "fv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-680, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 50 12,22 * * *" }] } },
    id: "fv-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-680, 400] },
  { parameters: { operation: "executeQuery", query: SALUD, options: {} },
    id: "fv-salud", name: "PG: ¿Cómo está el catálogo?",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-480, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_SALUD }, id: "fv-code-salud",
    name: "Code: ¿Se puede dar de baja?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-280, 300] },
  { parameters: condicion("fv-c-seguir", "seguir"), id: "fv-if-seguir",
    name: "IF: ¿hay permiso?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [-80, 300] },
  { parameters: { operation: "executeQuery", query: MUESTRA_SQL, options: {} },
    id: "fv-muestra", name: "PG: Muestra de candidatas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [120, 220],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "fv-loop", name: "Loop: cata una a una",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [320, 220] },
  { parameters: { jsCode: CODE_CATA_URL }, id: "fv-url", name: "Code: URL de la cata",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 340] },
  { parameters: condicion("fv-c-url", "url"), id: "fv-if-url",
    name: "IF: ¿hay ficha que preguntar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [720, 340] },
  { parameters: {
      url: "={{ $json.url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "application/json" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
        { name: "Origin", value: "https://www.flexicar.es" },
        { name: "Referer", value: "https://www.flexicar.es/" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 25000,
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "fv-http", name: "HTTP: ¿Sigue en la API?",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [920, 440] },
  { parameters: { jsCode: CODE_CATA }, id: "fv-code-cata", name: "Code: ¿Muerta de verdad?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1120, 440] },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "fv-veredicto", name: "Code: Veredicto de la cata",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 100] },
  { parameters: condicion("fv-c-sql", "sql"), id: "fv-if-sql", name: "IF: ¿se dan las bajas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [720, 100] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "fv-pg-bajas", name: "PG: Dar de baja y confirmar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [920, 40],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "fv-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "fv-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1320, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: ¿Cómo está el catálogo?")]] },
  [CRON]:                       { main: [[L("PG: ¿Cómo está el catálogo?")]] },
  "PG: ¿Cómo está el catálogo?": { main: [[L("Code: ¿Se puede dar de baja?")]] },
  "Code: ¿Se puede dar de baja?": { main: [[L("IF: ¿hay permiso?")]] },
  // Sin permiso se va directo al parte: una pasada que no da bajas también se
  // apunta, y con el motivo, que si no el silencio parece que todo va bien.
  "IF: ¿hay permiso?":          { main: [[L("PG: Muestra de candidatas")], [L("Code: Resumen")]] },
  "PG: Muestra de candidatas":  { main: [[L("Loop: cata una a una")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada item. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: cata una a una":       { main: [[L("Code: Veredicto de la cata")], [L("Code: URL de la cata")]] },
  "Code: URL de la cata":       { main: [[L("IF: ¿hay ficha que preguntar?")]] },
  "IF: ¿hay ficha que preguntar?": { main: [[L("HTTP: ¿Sigue en la API?")], [L("Loop: cata una a una")]] },
  "HTTP: ¿Sigue en la API?":    { main: [[L("Code: ¿Muerta de verdad?")]] },
  "Code: ¿Muerta de verdad?":   { main: [[L("Loop: cata una a una")]] },
  "Code: Veredicto de la cata": { main: [[L("IF: ¿se dan las bajas?")]] },
  "IF: ¿se dan las bajas?":     { main: [[L("PG: Dar de baja y confirmar")], [L("Code: Resumen")]] },
  "PG: Dar de baja y confirmar": { main: [[L("Code: Resumen")]] },
  "Code: Resumen":              { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Flexicar – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "flexicar-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
// Las pasadas se cuentan del propio cron: llevarlas a mano es como se quedan
// viejos los números de los comentarios.
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  " + MUESTRA + " peticiones por pasada para decidir sobre TODO el catálogo");
console.log("  frenos: sin scraper en " + HORAS_SIN_SCRAPER + " h, más del "
  + (TOPE_MORTANDAD * 100) + "% de mortandad, o más del "
  + (TOPE_VIVAS_EN_LA_CATA * 100) + "% de la cata viva");
