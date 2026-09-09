/**
 * El origen de n8n-workflows/milanuncios-verificar-por-listado.json.
 *
 * El workflow se genera en vez de escribirse a mano por una razon practica: el
 * codigo de sus nodos lleva expresiones regulares, y dentro de un JSON hay que
 * escribirlas doblemente escapadas. Ahi es donde se pierden las barras y donde
 * una \d se convierte en una d sin que nadie se entere hasta que el workflow
 * lleva una semana sin sacar potencias.
 *
 * Si hay que tocar el verificador, se toca AQUI y se vuelve a generar:
 *
 *   node scripts/genera-verificador-milanuncios-listado.js
 *   npm run test:milanuncios-listado
 *
 * Editar el JSON a mano funciona, pero el siguiente que regenere se llevara el
 * cambio por delante.
 *
 * ── Como reparte la noche ──────────────────────────────────────────────────
 *
 * El cupo de Milanuncios es de ~9-10 peticiones por ventana. La primera version
 * de esto gastaba las 9 en una sola marca, y si la marca tenia 200 paginas se
 * iban las 9 sin poder verificar nada.
 *
 * Ahora la libreta (moveadvisor_brand_sweeps) sabe cuantas paginas tiene cada
 * marca, asi que la noche se empaqueta: entran tantas marcas como quepan
 * enteras, y lo que sobre se gasta en sondear una pagina de las marcas que
 * todavia no se han medido. Una noche puede verificar Ineos, Dongfeng, Tata y
 * Daewoo enteras y aun sondear dos marcas nuevas.
 *
 * Nunca se empieza una marca que no cabe entera: media marca barrida no permite
 * dar de baja a nadie, asi que serian peticiones tiradas.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// Peticiones por ejecucion. Sale de lo medido: el scraper lleva 32 noches
// haciendo 7 seguidas sin que le pase nada, y por encima de ~10 empiezan los
// bloqueos. Este numero aparece tambien en la cola SQL, y los dos tienen que
// decir lo mismo.
const PRESUPUESTO = 9;

// typeVersion 4 lee las cabeceras de headerParameters.parameters. Puestas en
// options.headers.values no se manda ninguna, en silencio.
const CABECERAS = () => ({
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
    { name: "Referer", value: "https://www.milanuncios.com/" },
  ]},
  options: {
    response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
    timeout: 30000,
    redirect: { redirect: { followRedirects: true } },
  },
});

const COLA = `-- Las marcas candidatas de esta noche, en el orden en que interesan. No se
-- elige una: se devuelven todas y el planificador mete las que quepan en el
-- cupo de ~9 peticiones.
--
-- El orden NO puede salir de "la oferta mas antigua sin comprobar". Una marca
-- de 200 paginas no cabe en el cupo, asi que nunca llega a verificarse entera,
-- sus ofertas siguen siendo las mas viejas y se llevaria el turno todas las
-- noches para siempre sin dar de baja a nadie. Por eso manda la libreta de
-- barridos, que sabe el tamaño de cada marca:
--
--   0. las medidas que caben enteras: son las unicas donde verificar es real
--   1. las demas, por si toca sondearlas
--
-- 'sondear' marca las que hay que ir a medir: las que no se han visto nunca y
-- las que se midieron grandes hace mas de 30 dias, por si han encogido. Una
-- sonda cuesta una sola peticion, la de la pagina 1.
--
-- El 9 de aqui es el PRESUPUESTO del planificador. Si se cambia uno hay que
-- cambiar el otro.
SELECT lower(o.brand)                  AS marca,
       count(*)                        AS activas,
       s.total_pages                   AS paginas,
       s.swept_at                      AS ultimo_barrido,
       (s.swept_at IS NULL
        OR (COALESCE(s.total_pages, 0) > 9
            AND s.swept_at < NOW() - INTERVAL '30 days')) AS sondear
FROM moveadvisor_market_offers o
LEFT JOIN moveadvisor_brand_sweeps s
       ON s.portal = 'milanuncios'
      AND s.brand  = lower(o.brand)
WHERE o.portal = 'milanuncios'
  AND o.is_active
  -- 'otros coches' no es una marca y no tiene listado propio.
  AND lower(o.brand) <> 'otros coches'
  -- Ya barrida hoy: no se repite. Misma idea que en el verificador de Wallapop.
  AND (s.swept_at IS NULL OR s.swept_at < NOW() - INTERVAL '20 hours')
GROUP BY 1, s.total_pages, s.swept_at
ORDER BY
  CASE WHEN s.total_pages IS NOT NULL AND s.total_pages <= 9 THEN 0 ELSE 1 END,
  s.swept_at ASC NULLS FIRST
LIMIT 40`;

const CODE_PLAN = `// Reparte el cupo de la noche entre varias marcas.
//
// Dos pasadas, en este orden:
//
//   1. Marcas ya medidas que caben ENTERAS en lo que queda de cupo. Se barren
//      de la pagina 1 a la ultima. Solo aqui se puede dar de baja por ausencia.
//   2. Con lo que sobre, una sonda -pagina 1 y nada mas- de las marcas sin
//      medir. No verifica nada: sirve para aprender su tamaño y que la noche
//      siguiente el reparto sea bueno.
//
// Media marca no se empieza nunca: sin el listado entero no se puede deducir
// ninguna baja, asi que serian peticiones tiradas.
const PRESUPUESTO = ${PRESUPUESTO};

const candidatas = $input.all().map(i => i.json);
const s = $getWorkflowStaticData('global');
s.mil_inicio = new Date().toISOString();
s.mil_bloqueo = false;
s.mil_marcas = {};

const slugDe = m => String(m).toLowerCase().replace(/\\s+/g, '-');
const urlDe = (slug, n) => 'https://www.milanuncios.com/' + slug + '-de-segunda-mano/'
  + (n > 1 ? '?pagina=' + n : '');

let queda = PRESUPUESTO;
const peticiones = [];

function abre(marca, esperadas, sonda) {
  s.mil_marcas[marca] = {
    esperadas: esperadas, leidas: 0, vistos: 0,
    totalPaginas: 0, bloqueo: false, sonda: !!sonda,
  };
}

// --- pasada 1: las que caben enteras -----------------------------------------
for (const c of candidatas) {
  const paginas = Number(c.paginas || 0);
  if (!paginas || paginas > queda) continue;
  abre(c.marca, paginas, false);
  const slug = slugDe(c.marca);
  for (let n = 1; n <= paginas; n++) {
    peticiones.push({ marca: c.marca, pagina: n, url: urlDe(slug, n), sonda: false });
  }
  queda -= paginas;
}

// --- pasada 2: sondas de las que no sabemos cuanto miden ----------------------
for (const c of candidatas) {
  if (queda <= 0) break;
  if (!c.sondear) continue;
  if (s.mil_marcas[c.marca]) continue;   // ya entera en la pasada 1
  abre(c.marca, 1, true);
  peticiones.push({ marca: c.marca, pagina: 1, url: urlDe(slugDe(c.marca), 1), sonda: true });
  queda -= 1;
}

const enteras = Object.keys(s.mil_marcas).filter(m => !s.mil_marcas[m].sonda);
const sondas = Object.keys(s.mil_marcas).filter(m => s.mil_marcas[m].sonda);
console.log('[mil-verificar] ' + candidatas.length + ' candidatas. '
  + peticiones.length + ' peticiones de ' + PRESUPUESTO + ': '
  + enteras.length + ' marcas enteras (' + (enteras.join(', ') || '-') + ')'
  + ' y ' + sondas.length + ' sondas (' + (sondas.join(', ') || '-') + ')');

return peticiones.map(p => ({ json: p }));`;

const CODE_TOCA = `// Si ya nos han bloqueado, las peticiones que quedan no se piden. Insistir
// alarga el bloqueo, y de una pagina bloqueada no se saca nada.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;
return [{ json: Object.assign({}, item, { saltar: !!s.mil_bloqueo }) }];`;

// El lector de __INITIAL_PROPS__: el mismo que el del scraper, ya probado.
const LEER_PROPS = `function props(html) {
  let i = html.indexOf('window.__INITIAL_PROPS__');
  if (i < 0) return null;
  i = html.indexOf('"', i);
  let out = '', escapando = false;
  for (let j = i + 1; j < html.length; j++) {
    const c = html[j];
    if (escapando) { out += c; escapando = false; }
    else if (c === '\\\\') { out += c; escapando = true; }
    else if (c === '"') break;
    else out += c;
  }
  try { return JSON.parse(JSON.parse('"' + out + '"')); } catch (e) { return null; }
}`;

const CODE_PROCESAR = `// Cada pagina sella como publicado lo que trae. La base hace de acumulador, asi
// no hay que arrastrar listas entre vueltas del bucle.
const item = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
const cuerpo = String(res.body || '');
const codigo = Number(res.statusCode || 0);

const s = $getWorkflowStaticData('global');
const m = s.mil_marcas[item.marca];

// Imperva sirve la pantalla de bloqueo con HTTP 200: hay que mirar el cuerpo.
if (codigo !== 200 || /Pardon Our Interruption/i.test(cuerpo)) {
  console.log('[mil-verificar] BLOQUEADO en ' + item.marca + ' pagina ' + item.pagina
    + ' (HTTP ' + codigo + '). Se deja de pedir por esta noche.');
  s.mil_bloqueo = true;
  if (m) m.bloqueo = true;
  return [{ json: { sql: null } }];
}

${LEER_PROPS}

const p = props(cuerpo);
const lista = (p && p.adListPagination) || {};
const anuncios = (lista.adList && lista.adList.ads) || [];
const totalPaginas = Number((lista.pagination && lista.pagination.totalPages) || 0);

if (m) {
  m.leidas += 1;
  // El tamaño se relee de cada respuesta, no se fia del que habia apuntado: si
  // la marca ha crecido desde el ultimo barrido, leidas se quedara por debajo
  // de totalPaginas y el barrido no contara como completo. Se corrige solo.
  if (totalPaginas > 0) m.totalPaginas = totalPaginas;
}

const ids = anuncios.filter(a => a && a.id).map(a => 'mil_' + a.id);
if (!ids.length) {
  console.log('[mil-verificar] ' + item.marca + ' pagina ' + item.pagina + ': sin anuncios.');
  return [{ json: { sql: null } }];
}
if (m) m.vistos += ids.length;

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";

// updated_at no se toca: volver a ver un anuncio no es un cambio del anuncio.
// Lo que cambia es cuando lo vimos, y para eso estan last_seen_at y
// last_checked_at.
//
// Tampoco se reactiva nada. Un anuncio reservado sigue apareciendo en el
// listado, asi que verlo aqui prueba que sigue publicado, no que este
// disponible. Quien decide is_active = true es el scraper, que si lee isReserved.
const sql = 'UPDATE moveadvisor_market_offers'
  + ' SET last_checked_at = NOW(), last_seen_at = NOW()'
  + " WHERE portal = 'milanuncios' AND id IN (" + ids.map(esc).join(', ') + ')';

console.log('[mil-verificar] ' + item.marca + ' pagina ' + item.pagina + '/' + totalPaginas
  + ': ' + ids.length + ' anuncios publicados');
return [{ json: { sql: sql, marca: item.marca, pagina: item.pagina, vistos: ids.length } }];`;

const CODE_VEREDICTO = `// Fin de la noche. Se cierra marca por marca, y de cada una salen dos cosas:
//
//   1. El apunte en la libreta, que pasa SIEMPRE. Aunque no se haya podido
//      verificar nada, ese apunte es lo que hace rotar el turno y lo que deja
//      escrito hasta donde llega lo que sabemos de esa marca.
//   2. Las bajas, solo si se vio el listado ENTERO y ninguna pagina vino
//      bloqueada.
//
// No hace falta la lista de ausentes: las ofertas que se han visto llevan
// last_checked_at sellado durante este barrido y las que no conservan el valor
// viejo. La propia fecha las separa.
const s = $getWorkflowStaticData('global');
const inicio = String(s.mil_inicio || '');
const marcas = s.mil_marcas || {};
if (!inicio) return [];

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const num = v => (Number.isFinite(Number(v)) ? String(Number(v)) : 'NULL');

const salida = [];
for (const marca of Object.keys(marcas)) {
  const m = marcas[marca];

  // Ni una sola pagina leida: no se apunta nada, para que la marca siga en
  // cabeza del turno manana en vez de figurar como mirada.
  if (!m.leidas) continue;

  const completo = !m.bloqueo && m.totalPaginas > 0 && m.leidas >= m.totalPaginas;

  const apunte = (bajas) =>
    'INSERT INTO moveadvisor_brand_sweeps'
    + ' (portal, brand, swept_at, total_pages, pages_read, complete, seen_count, deactivated, blocked)'
    + " SELECT 'milanuncios', " + esc(marca) + ', NOW(), '
    + num(m.totalPaginas) + ', ' + num(m.leidas) + ', '
    + (completo ? 'TRUE' : 'FALSE') + ', ' + num(m.vistos) + ', '
    + bajas + ', ' + (m.bloqueo ? 'TRUE' : 'FALSE')
    + ' ON CONFLICT (portal, brand) DO UPDATE SET'
    + ' swept_at = EXCLUDED.swept_at, total_pages = EXCLUDED.total_pages,'
    + ' pages_read = EXCLUDED.pages_read, complete = EXCLUDED.complete,'
    + ' seen_count = EXCLUDED.seen_count, deactivated = EXCLUDED.deactivated,'
    + ' blocked = EXCLUDED.blocked';

  if (!completo) {
    const motivo = m.bloqueo ? 'bloqueo a mitad'
      : (m.sonda ? 'era solo una sonda: ' + m.totalPaginas + ' paginas'
                 : 'leidas ' + m.leidas + ' de ' + m.totalPaginas + ' paginas');
    console.log('[mil-verificar] ' + marca + ': ' + m.vistos + ' anuncios refrescados, '
      + motivo + '. No se da de baja a nadie.');
    salida.push({ json: { sql: apunte('0'), marca: marca, bajas: false } });
    continue;
  }

  // El UPDATE va dentro de un CTE de la MISMA sentencia que el apunte: asi el
  // numero de bajas que queda escrito es el de verdad, no una estimacion, y si
  // algo falla no queda ni el apunte ni las bajas a medias.
  const sql = 'WITH bajas AS ('
    + ' UPDATE moveadvisor_market_offers'
    + ' SET is_active = false, updated_at = NOW()'
    + " WHERE portal = 'milanuncios'"
    + ' AND lower(brand) = ' + esc(marca)
    + ' AND is_active'
    + ' AND (last_checked_at IS NULL OR last_checked_at < ' + esc(inicio) + ')'
    + ' RETURNING 1'
    + ') ' + apunte('(SELECT count(*) FROM bajas)');

  console.log('[mil-verificar] ' + marca + ': barrido completo de ' + m.totalPaginas
    + ' paginas, ' + m.vistos + ' anuncios vistos. Se dan de baja las activas'
    + ' que no han aparecido.');
  salida.push({ json: { sql: sql, marca: marca, bajas: true } });
}

return salida;`;

const condicionBooleana = (id, campo) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{
      id: id,
      leftValue: "={{ $json." + campo + " }}",
      rightValue: "",
      operator: { type: "boolean", operation: "true", singleValue: true },
    }],
    combinator: "and",
  },
  looseTypeValidation: true,
  options: {},
});

const condicionSql = (id) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{
      id: id,
      leftValue: "={{ $json.sql }}",
      rightValue: "",
      operator: { type: "string", operation: "notEmpty", singleValue: true },
    }],
    combinator: "and",
  },
  looseTypeValidation: true,
  options: {},
});

const nodos = [
  { parameters: {}, id: "mv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-400, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 0 13 * * *" }] } },
    id: "mv-cron", name: "Cada día a las 13:00",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-400, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "mv-cola", name: "PG: Marcas candidatas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-160, 300], credentials: PG_CRED },
  { parameters: { jsCode: CODE_PLAN }, id: "mv-plan", name: "Code: Repartir la noche",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [60, 300] },
  { parameters: { options: {} }, id: "mv-loop", name: "Loop: pagina por pagina",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [280, 300] },

  // rama de salida del bucle: cerrar la noche
  { parameters: { jsCode: CODE_VEREDICTO }, id: "mv-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "mv-pg-apunte", name: "PG: Apuntar barrido y dar de baja",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [740, 160], credentials: PG_CRED },

  // rama del bucle: pedir la pagina
  { parameters: { jsCode: CODE_TOCA }, id: "mv-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 440] },
  { parameters: condicionBooleana("mv-c-saltar", "saltar"), id: "mv-if-toca", name: "IF: ¿nos han bloqueado?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [740, 440] },
  { parameters: Object.assign({ url: "={{ $json.url }}" }, CABECERAS()),
    id: "mv-http", name: "HTTP: Página del listado",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [960, 540] },
  { parameters: { jsCode: CODE_PROCESAR }, id: "mv-procesar", name: "Code: Procesar página",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1180, 540] },
  { parameters: condicionSql("mv-c-sellar"), id: "mv-if-sellar", name: "IF: ¿hay que sellar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1400, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "mv-pg-sellar", name: "PG: Sellar página",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1620, 460], credentials: PG_CRED },
  { parameters: { amount: 15, unit: "seconds" }, id: "mv-wait", name: "Esperar 15s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1840, 540], webhookId: "b7c1e0a4-mil-verificar" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":     { main: [[L("PG: Marcas candidatas")]] },
  "Cada día a las 13:00":     { main: [[L("PG: Marcas candidatas")]] },
  "PG: Marcas candidatas":    { main: [[L("Code: Repartir la noche")]] },
  "Code: Repartir la noche":  { main: [[L("Loop: pagina por pagina")]] },
  // salida 0 del bucle = terminado, salida 1 = siguiente pagina
  "Loop: pagina por pagina":  { main: [[L("Code: Veredicto")], [L("Code: ¿toca pedirla?")]] },
  "Code: Veredicto":          { main: [[L("PG: Apuntar barrido y dar de baja")]] },
  "Code: ¿toca pedirla?":     { main: [[L("IF: ¿nos han bloqueado?")]] },
  // rama true = saltar (vuelve al bucle sin pedir ni esperar), false = pedirla
  "IF: ¿nos han bloqueado?":  { main: [[L("Loop: pagina por pagina")], [L("HTTP: Página del listado")]] },
  "HTTP: Página del listado": { main: [[L("Code: Procesar página")]] },
  "Code: Procesar página":    { main: [[L("IF: ¿hay que sellar?")]] },
  "IF: ¿hay que sellar?":     { main: [[L("PG: Sellar página")], [L("Esperar 15s")]] },
  "PG: Sellar página":        { main: [[L("Esperar 15s")]] },
  "Esperar 15s":              { main: [[L("Loop: pagina por pagina")]] },
};

const wf = {
  name: "Milanuncios – Verificar ofertas activas",
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: "9BwKOPMIzjj3owho",
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "milanuncios-verificar-por-listado.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, presupuesto de " + PRESUPUESTO + " peticiones por ejecucion");
