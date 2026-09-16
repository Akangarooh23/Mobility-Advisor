/**
 * Autocasión – Verificar ofertas activas
 *
 * El origen de n8n-workflows/autocasion-verificar-activas.json.
 *
 *   node scripts/genera-verificador-autocasion.js
 *   npm run test:autocasion-verificar
 *
 * ── Por qué hace falta ─────────────────────────────────────────────────────
 *
 * Autocasión son 145.671 ofertas dadas por activas y el 9% de los comparables
 * que ponen precio al escaparate de importación. Nadie las ha comprobado nunca:
 * si una está vendida y sigue contando, la mediana española con la que decimos
 * «ahorras 8.000 €» está hecha con coches que ya no se pueden comprar.
 *
 * ── Cómo dice Autocasión que un coche ya no está ───────────────────────────
 *
 * Por el código de estado, NUNCA por el HTML. Medido el 15-sep-2026 sobre 14
 * fichas -6 recientes y 8 de agosto-, con HEAD y GET, sin seguir redirecciones:
 *
 *     HEAD y GET coinciden en 14 de 14
 *
 *     200                                    sigue publicada        10
 *     301 -> /coches-segunda-mano/bmw-x...   vendida                 4
 *
 * Con HEAD basta, y ahorra el 95% del tráfico. Eso no se da por supuesto: en
 * Wallapop HEAD devuelve 404 sobre ofertas vivas. Se mide portal por portal.
 *
 * ── Lo que este verificador NO puede mirar ─────────────────────────────────
 *
 * 35.518 ofertas de julio y agosto tienen como URL un listado de provincia
 * -«/coches-segunda-mano/peugeot-2008-ocasion/madrid»- en vez de la ficha del
 * coche; 301 ofertas distintas comparten esa misma dirección. Pedirla devuelve
 * un listado vivo SIEMPRE, diga lo que diga el coche.
 *
 * Así que la cola las salta, y hay que saber que quedan ahí: son el 24% del
 * portal contando como activas sin que nadie pueda desmentirlas. Lo que las
 * limpiará es el scraper, que ahora resucita lo que ve en el listado y deja de
 * ver lo que ya no está; cuando haya dado una vuelta completa -5 días- se podrá
 * dar de baja por antigüedad con seguridad. Hoy no: casi todo el portal lleva
 * 29 días sin verse y se retiraría medio catálogo vivo.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };
const ERROR_WF = "9BwKOPMIzjj3owho";

// 10.000 por pasada y sin nodo Wait, como el español de AutoScout24: allí está
// medido que así salen ~130 ofertas por minuto, o sea unos 77 minutos.
const LOTE = 10000;
const SEGUNDOS_POR_OFERTA = 0.5;
const ESPERA_SEGUNDOS = 0;

// El cortacircuitos de mortandad. Aquí en 0,8 y no en 0,6 por la misma razón
// que en España: el dato lleva 29 días sin verificarse y la mortandad real va a
// ser enorme en las primeras vueltas. Sobre 8 ofertas de agosto salieron 2
// muertas (25%), pero la muestra es pequeña y el catálogo entero puede dar
// mucho más. Cuando la primera vuelta esté hecha, esto baja a 0,6.
const MINIMO_PARA_JUZGAR = 100;
const TOPE_MORTANDAD = 0.8;
// Y el de bloqueo, sobre INTENTOS: un 403 no es una venta, es una puerta
// cerrada, y el de mortandad no lo ve.
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las ofertas de Autocasión que toca comprobar.
--
-- SOLO las que tienen URL de ficha -acaban en refNNNNNN-. Las otras 35.518
-- apuntan a un listado de provincia que responde 200 esté el coche o no:
-- preguntarle por ellas no es que dé una respuesta mala, es que da SIEMPRE la
-- misma. Ver la cabecera del generador.
--
-- Las ACTIVAS cada día; las que ya constan de baja, una vez por semana, para
-- que una que se diera por muerta por error pueda volver sola.
SELECT id, url, is_active
FROM moveadvisor_market_offers
WHERE portal = 'autocasion'
  AND url ~ 'ref[0-9]{6,}$'
  AND (
    (is_active AND (last_checked_at IS NULL
                    OR last_checked_at < NOW() - INTERVAL '20 hours'))
    OR
    (NOT is_active AND (last_checked_at IS NULL
                        OR last_checked_at < NOW() - INTERVAL '7 days'))
  )
-- Las activas primero, y al azar dentro de cada grupo.
--
-- Primero las activas porque si una pasada se corta -por un fallo de red o por
-- el propio cortacircuitos- lo que tiene que estar comprobado es lo que damos
-- por bueno, no el cementerio.
--
-- Y al azar porque el orden por antigüedad pone delante justo las que el
-- scraper dejó de ver, o sea las vendidas: el frente de la cola sería 100% de
-- mortandad por construcción y el cortacircuitos no mediría nada. Pasó en
-- Gamboa tres días seguidos.
ORDER BY is_active DESC, random()
LIMIT ${LOTE}`;

const CODE_TOCA = `// Arranque de la pasada, cortacircuitos y guarda de cola vacía.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.ac_run || s.ac_run !== $execution.id) {
  s.ac_run = $execution.id;
  s.ac_parado = false;
  s.ac_vistas = 0;
  s.ac_vivas = 0;
  s.ac_bajas = 0;
  s.ac_raras = 0;
  s.ac_fallos = 0;
  s.ac_intentos = 0;
  s.ac_motivo = '';
  s.ac_activas_vistas = 0;
  s.ac_bajas_nuevas = 0;
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle igual que una oferta y revienta el nodo HTTP con "URL parameter must be
// a string, got undefined". Así cayeron cuatro ejecuciones de Gamboa el
// 2026-09-07, y era el caso normal: no había nada que hacer.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[autocasion-v] no hay nada que verificar ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { saltar: true }) }];
}

return [{ json: Object.assign({}, item, { saltar: !!s.ac_parado }) }];`;

const CODE_VEREDICTO = `// El veredicto sobre UNA ficha de Autocasión.
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
const codigo = Number(res.statusCode || 0);
const cabeceras = res.headers || {};
const destino = String(cabeceras.location || cabeceras.Location || '');

const s = $getWorkflowStaticData('global');
const id = String(oferta.id || '');
const eraActiva = oferta.is_active !== false;
if (!id) return [{ json: { sql: null } }];

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const soloFecha = (veredicto) => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET last_checked_at = NOW() WHERE id = ' + esc(id),
  veredicto: veredicto,
} }];

// ── fallo pasajero, y el freno por bloqueo ─────────────────────────────────
// Un 429 o un 503 no dicen nada del coche, dicen algo de nosotros.
s.ac_intentos = (s.ac_intentos || 0) + 1;
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.ac_fallos = (s.ac_fallos || 0) + 1;
  const intentos = s.ac_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.ac_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.ac_parado = true;
    s.ac_motivo = Math.round(100 * s.ac_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[autocasion-v] PARADO: ' + s.ac_motivo + '. Bajar el ritmo antes de volver.');
  }
  return soloFecha('pasajero');
}

s.ac_vistas = (s.ac_vistas || 0) + 1;
if (eraActiva) s.ac_activas_vistas = (s.ac_activas_vistas || 0) + 1;

// ── sigue publicada ────────────────────────────────────────────────────────
if (codigo === 200) {
  s.ac_vivas = (s.ac_vivas || 0) + 1;
  const sets = eraActiva
    ? 'last_checked_at = NOW(), last_seen_at = NOW()'
    : 'is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()';
  return [{ json: { sql: 'UPDATE moveadvisor_market_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: eraActiva ? 'viva' : 'resucitada' } }];
}

// ── la web arregla su propia URL ───────────────────────────────────────────
// Un 3xx cuyo destino conserva el refNNNNNN del coche no es una venta: es el
// portal cambiando el slug. Se guarda la URL nueva y no se toca nada más. En
// Gamboa esto mismo dejaba muertas para siempre a 90 ofertas vivas.
const ref = (String(oferta.url || '').match(/ref[0-9]{6,}/) || [])[0] || '';
const esRedirect = codigo >= 300 && codigo < 400;
if (esRedirect && ref && destino.indexOf(ref) !== -1) {
  s.ac_urls = (s.ac_urls || 0) + 1;
  const abs = destino.indexOf('http') === 0 ? destino : ('https://www.autocasion.com' + destino);
  console.log('[autocasion-v] ' + id + ': URL nueva -> ' + abs);
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET url = ' + esc(abs)
      + ', last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'url nueva',
  } }];
}

// ── vendida ────────────────────────────────────────────────────────────────
// 410 y 404 son explícitos. Y un 301 al listado -/coches-segunda-mano/bmw-x3-
// ocasion- es la forma que tiene Autocasión de decir "ese coche ya no está,
// mira estos".
const alListado = esRedirect && (/\\/coches-segunda-mano/.test(destino)
  || /\\/coches-ocasion/.test(destino) || destino === '/'
  || /autocasion\\.com\\/?$/i.test(destino));
const esBaja = codigo === 404 || codigo === 410 || codigo === 451 || alListado;

if (esBaja) {
  s.ac_bajas = (s.ac_bajas || 0) + 1;
  if (eraActiva) s.ac_bajas_nuevas = (s.ac_bajas_nuevas || 0) + 1;

  // Cortacircuitos, sobre ACTIVAS miradas y muertes NUEVAS. Contar las
  // reconfirmaciones hacía que una pasada sin novedades pareciera una matanza.
  const activas = s.ac_activas_vistas || 0;
  const nuevas = s.ac_bajas_nuevas || 0;
  if (activas >= ${MINIMO_PARA_JUZGAR} && (nuevas / activas) > ${TOPE_MORTANDAD}) {
    s.ac_parado = true;
    s.ac_motivo = 'mortandad del ' + Math.round(100 * nuevas / activas) + '% en ' + activas + ' activas';
    console.log('[autocasion-v] PARADO: ' + s.ac_motivo + '. Eso no es que Autocasión haya'
      + ' vendido su catálogo: es que ha cambiado algo en el portal.');
    return soloFecha('parado');
  }

  // Si ya constaba de baja no se toca updated_at: reescribirlo cada semana
  // borra el único rastro de cuándo cayó el anuncio.
  const sets = eraActiva
    ? 'is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()'
    : 'last_checked_at = NOW()';
  return [{ json: { sql: 'UPDATE moveadvisor_market_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: 'baja' } }];
}

// ── ni una cosa ni la otra ─────────────────────────────────────────────────
// No se toca is_active: se apunta y se mira el parte. Equivocarse por no dar de
// baja se arregla mañana; vaciar el mercado por una corazonada, no.
s.ac_raras = (s.ac_raras || 0) + 1;
console.log('[autocasion-v] RARA ' + id + ' (HTTP ' + codigo + (destino ? ' -> ' + destino : '') + ')');
return soloFecha('rara');`;

const CODE_RESUMEN = `// El parte de la pasada, a moveadvisor_verify_runs.
const s = $getWorkflowStaticData('global');
const vistas = s.ac_vistas || 0;
const activas = s.ac_activas_vistas || 0;

console.log('[autocasion-v] ── resumen ──');
console.log('  fichas miradas   : ' + vistas + ' (' + activas + ' estaban activas)');
console.log('  siguen publicadas: ' + (s.ac_vivas || 0));
console.log('  BAJAS NUEVAS     : ' + (s.ac_bajas_nuevas || 0));
console.log('  bajas ya sabidas : ' + ((s.ac_bajas || 0) - (s.ac_bajas_nuevas || 0)));
console.log('  URLs corregidas  : ' + (s.ac_urls || 0));
console.log('  sin clasificar   : ' + (s.ac_raras || 0));
console.log('  fallos pasajeros : ' + (s.ac_fallos || 0) + ' de ' + (s.ac_intentos || 0) + ' intentos');
if (s.ac_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.ac_motivo);
if (!s.ac_parado && activas === 0 && vistas > 0) {
  console.log('  OJO: no se ha mirado NI UNA oferta activa.');
}
if ((s.ac_raras || 0) > vistas * 0.1) {
  console.log('  OJO: más del 10% sin clasificar. O Autocasión ha cambiado algo,');
  console.log('  o hay un estado que no conocemos. Mirar esas URLs.');
}

const n = v => String(Number(v) || 0);
// En 'deactivated' van las bajas NUEVAS: contar ahí las reconfirmaciones haría
// que una pasada sin novedades pareciera una matanza.
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('autocasion', NOW(), " + n(vistas) + ', ' + n(s.ac_vivas) + ', '
  + n(s.ac_bajas_nuevas) + ', ' + n(s.ac_raras) + ', ' + n(s.ac_fallos) + ', '
  + (s.ac_parado ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS})';

return [{ json: { sql: sql, vistas: vistas, activas: activas, vivas: s.ac_vivas || 0,
  bajas: s.ac_bajas_nuevas || 0, urls: s.ac_urls || 0,
  raras: s.ac_raras || 0, fallos: s.ac_fallos || 0, parado: !!s.ac_parado } }];`;

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

const condicionBooleana = (id, campo) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id, leftValue: "={{ $json." + campo + " }}", rightValue: true,
      operator: { type: "boolean", operation: "true", singleValue: true } }],
    combinator: "and",
  },
  looseTypeValidation: true,
  options: {},
});

const CRON = "4 veces/día (10:10, 12:10, 18:10 y 22:10)";
const nodos = [
  { parameters: {}, id: "av-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // Fuera de las dos pasadas del scraper de Autocasión (8:20-9:50 y 19:20-20:50)
  // y del enriquecedor (9:50, 12:50, 17:50, 22:50). Cada pasada son ~77 min.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 10 10,12,18,22 * * *" }] } },
    id: "av-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "av-cola", name: "PG: Cola a verificar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "av-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "av-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicionBooleana("av-c-saltar", "saltar"), id: "av-if-saltar",
    name: "IF: ¿nos hemos parado?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [340, 420] },
  { parameters: {
      url: "={{ $json.url }}",
      method: "HEAD",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        // SIN seguir redirecciones: el 301 ES la señal. Siguiéndola, un coche
        // vendido acaba en el listado del modelo, que responde 200, y lo
        // daríamos por vivo.
        redirect: { redirect: { followRedirects: false } },
        timeout: 20000,
      },
    }, id: "av-http", name: "HTTP: ¿sigue la ficha?",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "av-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("av-c-sql", "sql"), id: "av-if-sql", name: "IF: ¿hay veredicto?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "av-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "av-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "av-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":    { main: [[L("PG: Cola a verificar")]] },
  [CRON]:                    { main: [[L("PG: Cola a verificar")]] },
  "PG: Cola a verificar":    { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta": { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":    { main: [[L("IF: ¿nos hemos parado?")]] },
  "IF: ¿nos hemos parado?":  { main: [[L("Loop: oferta por oferta")], [L("HTTP: ¿sigue la ficha?")]] },
  "HTTP: ¿sigue la ficha?":  { main: [[L("Code: Veredicto")]] },
  "Code: Veredicto":         { main: [[L("IF: ¿hay veredicto?")]] },
  "IF: ¿hay veredicto?":     { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":   { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":           { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Autocasión – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "autocasion-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, HEAD, " + LOTE + " por pasada, 4 pasadas/día = "
  + (LOTE * 4).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");
console.log("  cortacircuitos: mortandad > " + (TOPE_MORTANDAD * 100) + "% tras "
  + MINIMO_PARA_JUZGAR + " activas, o bloqueo > " + (TOPE_BLOQUEO * 100) + "% tras "
  + MINIMO_PARA_BLOQUEO + " intentos");

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Veredicto").parameters.jsCode;
const bien = js.indexOf("/\\/coches-segunda-mano/") >= 0 && js.indexOf("ref[0-9]{6,}") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "los regex del veredicto conservan sus barras");
if (!bien) process.exit(1);
