/**
 * El origen de n8n-workflows/modrive-verificar-activas.json.
 *
 *   node scripts/genera-verificador-modrive.js
 *   npm run test:modrive-verificar
 *
 * ── Cómo se sabe que un coche de Modrive ha caído ──────────────────────────
 *
 * Desapareciendo del sitemap. Se midió portal por portal y cada uno lo dice de
 * una manera distinta:
 *
 *   Gamboa   la ficha responde 301 y redirige a la categoría
 *   VIAN     la ficha sigue devolviendo 200; hay que barrer el listado
 *   Modrive  la ficha sigue en pie, pero el coche sale del sitemap
 *
 * Eso hace que este sea, con diferencia, el verificador más barato que tenemos:
 * DOS peticiones al día -una por pasada- comprueban las 1.988 ofertas de golpe.
 * Milanuncios necesita una petición por oferta y no llega a cubrirlas en cinco
 * días; aquí el catálogo entero entra en un fichero de 217 KB.
 *
 * Y por eso va dos veces al día en vez de una: cuesta lo mismo que no hacerlo.
 *
 * ── Por qué el sitemap y no la ficha ───────────────────────────────────────
 *
 * Porque la ficha de un coche vendido sigue devolviendo 200 con todo su
 * contenido. Comprobarla una por una daría «viva» a las 1.988 siempre, que es
 * exactamente la trampa en la que cayó el primer verificador de Gamboa: miraba
 * el contenido de la página en vez del código de estado, y la página de
 * categoría a la que redirigía contenía el marcador que buscaba. Habría dado
 * por vivas todas las muertas, en silencio y para siempre.
 *
 * El sitemap es además la misma fuente que usa el scraper, así que las dos
 * cosas no se pueden contradecir.
 *
 * ── El cortacircuitos ──────────────────────────────────────────────────────
 *
 * Esto retira coches del escaparate. Si el sitemap trae de golpe menos de la
 * mitad de lo que tenemos activo, eso no es que Modrive haya vendido mil coches
 * en un día: es que el sitemap ha cambiado de sitio o de forma. Se para y no se
 * toca nada.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

const SITEMAP = "https://www.modrive.com/sitemap-vehicles.xml";

// Los ids se sellan en bloques. 1.988 ids en un solo IN() son unos 40 KB de SQL
// metidos en una expresión de n8n; en bloques de 500 son 10 KB y da igual que
// el catálogo crezca.
const BLOQUE = 500;

// Si aparece menos de la mitad de lo que tenemos activo, no se da de baja nada.
const TOPE_MORTANDAD = 0.5;

const CONTAR = `-- Cuantas tenemos por activas ahora mismo. Es la referencia del
-- cortacircuitos: si el sitemap trae mucho menos que esto, algo se ha roto.
SELECT count(*)::int AS activas
FROM moveadvisor_marketplace_vo_offers
WHERE portal = 'modrive' AND is_active`;

const CODE_PLAN = `// Del sitemap salen todos los coches publicados, de una vez.
const res = $input.first().json;
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);

const s = $getWorkflowStaticData('global');
s.modrive_inicio = new Date().toISOString();
s.modrive_fallo = false;
s.modrive_vistos = 0;
s.modrive_activas = Number(($('PG: Cuántas tenemos activas').first().json || {}).activas || 0);

// Si el sitemap no viene, se sigue adelante con la lista vacia PERO marcando el
// fallo: el bucle tiene que correr igual para que el veredicto llegue a
// escribirse, y el veredicto vera el fallo y no dara de baja a nadie.
//
// Devolver [] aqui seria peor: un splitInBatches sin items no dispara su salida
// de 'terminado', asi que el veredicto no correria y la pasada desapareceria sin
// dejar ni el parte.
if (codigo !== 200 || !cuerpo) {
  s.modrive_fallo = true;
  console.log('[modrive-verificar] el sitemap no vino (HTTP ' + codigo + '). No se da de baja a nadie.');
  return [{ json: { ids: [], bloque: 0 } }];
}

const ids = [];
const vistos = {};
for (const m of cuerpo.matchAll(/<loc>\\s*([^<\\s]+)\\s*<\\/loc>/gi)) {
  const u = String(m[1]);
  const im = u.match(/-(\\d+)\\/?\$/);
  if (!im) continue;
  const id = 'modrive_' + im[1];
  if (vistos[id]) continue;
  vistos[id] = true;
  ids.push(id);
}

if (!ids.length) {
  s.modrive_fallo = true;
  console.log('[modrive-verificar] el sitemap vino con 0 coches. Eso no es un catalogo vacio,'
    + ' es que ha cambiado de forma. No se da de baja a nadie.');
  return [{ json: { ids: [], bloque: 0 } }];
}

s.modrive_total = ids.length;
const bloques = [];
for (let i = 0; i < ids.length; i += ${BLOQUE}) {
  bloques.push({ json: { ids: ids.slice(i, i + ${BLOQUE}), bloque: bloques.length + 1 } });
}
console.log('[modrive-verificar] el sitemap publica ' + ids.length + ' coches; tenemos '
  + s.modrive_activas + ' por activos. Se sellan en ' + bloques.length + ' bloques.');
return bloques;`;

const CODE_SELLAR = `// Sellar los que sí están en el sitemap.
const bloque = $('Loop: bloque por bloque').item.json;
const ids = bloque.ids || [];
if (!ids.length) return [{ json: { sql: null } }];

const s = $getWorkflowStaticData('global');
s.modrive_vistos = (s.modrive_vistos || 0) + ids.length;

// Se sella por la CLAVE PRIMARIA, no por una expresion sobre la URL. Modrive ya
// nos cambio las rutas una vez -de /coches-segunda-mano/ a /coches-ocasion/- y
// un sellado que dependiera de la ruta habria dejado de casar ese dia, dando de
// baja el catalogo entero.
const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const sql = 'UPDATE moveadvisor_marketplace_vo_offers'
  + ' SET last_seen_at = NOW(), last_checked_at = NOW()'
  + ' WHERE id IN (' + ids.map(esc).join(', ') + ')';

console.log('[modrive-verificar] bloque ' + bloque.bloque + ': ' + ids.length + ' sellados');
return [{ json: { sql: sql, n: ids.length } }];`;

const CODE_VEREDICTO = `// Las que no han aparecido en el sitemap se dan de baja.
const s = $getWorkflowStaticData('global');
const inicio = String(s.modrive_inicio || '');
if (!inicio) return [];

const vistos = s.modrive_vistos || 0;
const activas = Number(s.modrive_activas || 0);
const fallo = !!s.modrive_fallo;

const n = v => String(Number(v) || 0);
const apunte = (bajas, vivas) =>
  'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " SELECT 'modrive', NOW(), " + n(vistos) + ', ' + vivas + ', ' + bajas
  + ', 0, 0, ' + (fallo ? 'TRUE' : 'FALSE') + ', 0';

if (fallo || !vistos) {
  console.log('[modrive-verificar] el sitemap no se pudo leer. No se da de baja a nadie.');
  return [{ json: { sql: apunte('0', '0'), bajas: false } }];
}

// El UPDATE va dentro de un CTE de la MISMA sentencia que el apunte: asi el
// numero de bajas que queda escrito es el de verdad, y si algo falla no queda ni
// el apunte ni las bajas a medias.
const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const sql = 'WITH bajas AS ('
  + ' UPDATE moveadvisor_marketplace_vo_offers'
  + ' SET is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()'
  + " WHERE portal = 'modrive' AND is_active"
  + ' AND (last_checked_at IS NULL OR last_checked_at < ' + esc(inicio) + ')'
  + ' RETURNING 1'
  + '), vivas AS ('
  + ' UPDATE moveadvisor_marketplace_vo_offers'
  + ' SET is_active = TRUE, updated_at = NOW()'
  + " WHERE portal = 'modrive' AND is_active IS FALSE"
  + ' AND last_checked_at >= ' + esc(inicio)
  + ' RETURNING 1'
  + ') ' + apunte('(SELECT count(*) FROM bajas)', n(vistos));

console.log('[modrive-verificar] ' + vistos + ' coches en el sitemap de ' + activas
  + ' que teniamos activos. Se dan de baja los que no han aparecido.');
return [{ json: { sql: sql, bajas: true } }];`;

const CODE_FRENO = `// El cortacircuitos, antes de aplicar nada.
//
// Este workflow retira coches del escaparate. Si el sitemap trae menos de la
// mitad de lo que tenemos activo, eso no es que Modrive haya vendido mil coches
// en un dia: es que el sitemap ha cambiado de sitio o de forma. Mejor quedarse
// corto y que lo miremos.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;
const vistos = s.modrive_vistos || 0;
const activas = Number(s.modrive_activas || 0);

if (item.bajas && activas > 0 && vistos < activas * ${1 - TOPE_MORTANDAD}) {
  console.log('[modrive-verificar] PARADO: tenemos ' + activas + ' por activas y el sitemap'
    + ' solo trae ' + vistos + '. Eso no es una liquidacion, es que el sitemap ha cambiado.');
  return [{ json: { sql: null, parado: true } }];
}
return [{ json: item }];`;

const condicionSql = (id) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id, leftValue: "={{ $json.sql }}", rightValue: "",
      operator: { type: "string", operation: "notEmpty", singleValue: true } }],
    combinator: "and",
  },
  looseTypeValidation: true,
  options: {},
});

const nodos = [
  { parameters: {}, id: "mv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 30 7,19 * * *" }] } },
    id: "mv-cron", name: "2 veces/día (7:30 y 19:30)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: CONTAR, options: {} },
    id: "mv-contar", name: "PG: Cuántas tenemos activas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300], credentials: PG_CRED },
  { parameters: {
      url: SITEMAP,
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "application/xml,text/xml,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 30000,
      },
    }, id: "mv-http", name: "HTTP: Sitemap de Modrive",
    // neverError solo calla los codigos HTTP; un corte de red sigue matando el
    // nodo. Con esto, un sitemap que no viene llega como codigo 0 y el
    // veredicto decide no dar de baja a nadie, en vez de que la pasada muera.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-100, 300] },
  { parameters: { jsCode: CODE_PLAN }, id: "mv-plan", name: "Code: Leer el sitemap",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 300] },
  { parameters: { options: {} }, id: "mv-loop", name: "Loop: bloque por bloque",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [340, 300] },
  { parameters: { jsCode: CODE_SELLAR }, id: "mv-sellar", name: "Code: Sellar los vistos",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [560, 420] },
  { parameters: condicionSql("mv-c-sellar"), id: "mv-if-sellar", name: "IF: ¿hay bloque que sellar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [780, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "mv-pg-sellar", name: "PG: Sellar el bloque",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1000, 420], credentials: PG_CRED },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "mv-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [560, 180] },
  { parameters: { jsCode: CODE_FRENO }, id: "mv-freno", name: "Code: Cortacircuitos",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 180] },
  { parameters: condicionSql("mv-c-aplicar"), id: "mv-if-aplicar", name: "IF: ¿se aplica?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 180] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "mv-pg-aplicar", name: "PG: Bajas y parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 180], credentials: PG_CRED },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":        { main: [[L("PG: Cuántas tenemos activas")]] },
  "2 veces/día (7:30 y 19:30)":  { main: [[L("PG: Cuántas tenemos activas")]] },
  "PG: Cuántas tenemos activas": { main: [[L("HTTP: Sitemap de Modrive")]] },
  "HTTP: Sitemap de Modrive":    { main: [[L("Code: Leer el sitemap")]] },
  "Code: Leer el sitemap":       { main: [[L("Loop: bloque por bloque")]] },
  "Loop: bloque por bloque":     { main: [[L("Code: Veredicto")], [L("Code: Sellar los vistos")]] },
  "Code: Sellar los vistos":     { main: [[L("IF: ¿hay bloque que sellar?")]] },
  "IF: ¿hay bloque que sellar?": { main: [[L("PG: Sellar el bloque")], [L("Loop: bloque por bloque")]] },
  "PG: Sellar el bloque":        { main: [[L("Loop: bloque por bloque")]] },
  "Code: Veredicto":             { main: [[L("Code: Cortacircuitos")]] },
  "Code: Cortacircuitos":        { main: [[L("IF: ¿se aplica?")]] },
  "IF: ¿se aplica?":             { main: [[L("PG: Bajas y parte")], []] },
};

const wf = {
  name: "Modrive – Verificar ofertas activas (por el sitemap)",
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: false,
    saveDataSuccessExecution: "none",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: "9BwKOPMIzjj3owho",
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "modrive-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, bloques de " + BLOQUE
  + ", tope de mortandad " + (TOPE_MORTANDAD * 100) + "%");
console.log("  cuesta UNA peticion por pasada: cubre el catalogo entero");
