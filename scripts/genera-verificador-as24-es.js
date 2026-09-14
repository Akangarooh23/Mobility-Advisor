/**
 * AutoScout24 España – Verificar ofertas activas
 *
 * El origen de n8n-workflows/autoscout24-verificar-activas.json.
 *
 * POR QUE HACE FALTA
 *
 * De las 314.322 ofertas españolas de AutoScout24 salen el 86% de los
 * comparables que ponen precio a cada oferta alemana del escaparate. Si una
 * está vendida y sigue contando, la mediana española que usamos para decir
 * «ahorras 8.000 €» está hecha con coches que ya no se pueden comprar.
 *
 * El 14-sep-2026, sobre 12 ofertas de hace 28 días elegidas al azar, CINCO
 * estaban muertas: un 42%. Esa es la basura que esto va a ir quitando.
 *
 * COMO SE SABE QUE UNA ESTA VENDIDA
 *
 * Por el código de estado, NUNCA por el HTML. En Alemania, buscar «ya no está
 * disponible» en el cuerpo dio de baja 24.746 ofertas de las que el 45% seguía
 * publicada: esa frase viaja en el diccionario de traducciones de todas las
 * páginas, esté o no el coche.
 *
 * Medido en .es el 14-sep-2026 sobre 20 ofertas (8 recién vistas + 12 viejas):
 *
 *     HEAD y GET coinciden en 19 de 20
 *     -la única discrepancia fue un GET que falló de red, no un HEAD mintiendo-
 *
 *     200                      sigue publicada
 *     301 -> /lst/marca/modelo vendida: «ese coche ya no está, mira estos»
 *     410                      vendida, explícito
 *
 * Con HEAD basta, y ahorra el 95% del tráfico. Eso no se da por supuesto: en
 * Wallapop HEAD devuelve 404 sobre ofertas vivas. Se mide portal por portal.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };

const LOTE = 3000;
const ESPERA_SEGUNDOS = 1;
// El cortacircuitos. Con 100 activas miradas ya se puede juzgar, y por encima
// del 60% de mortandad lo que ha pasado no es que España haya vendido su parque
// móvil: es que el portal ha cambiado algo y lo estamos leyendo mal.
const MINIMO_PARA_JUZGAR = 100;
const TOPE_MORTANDAD = 0.6;

const COLA = `-- Las ofertas españolas que toca comprobar.
--
-- Las ACTIVAS cada día: son las que sostienen las valoraciones. Las que ya
-- constan de baja, una vez por semana, solo para que una que se diera por
-- muerta por error pueda volver sola.
--
-- Los dos ritmos separados no son un capricho. En Gamboa iban con el mismo
-- filtro y la cola acababa llena de muertas: el cortacircuitos leía 100% de
-- mortandad y cortaba la pasada antes de mirar una sola oferta viva.
SELECT id, url, is_active
FROM moveadvisor_market_offers
WHERE portal = 'autoscout24'
  AND COALESCE(country, 'ES') = 'ES'
  AND COALESCE(url, '') <> ''
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
-- mortandad por construcción y el cortacircuitos no mediría nada.
ORDER BY is_active DESC, random()
LIMIT ${LOTE}`;

const CODE_TOCA = `// Arranque de la pasada, cortacircuitos y guarda de cola vacía.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.es_run || s.es_run !== $execution.id) {
  s.es_run = $execution.id;
  s.es_parado = false;
  s.es_vistas = 0;
  s.es_vivas = 0;
  s.es_bajas = 0;
  s.es_raras = 0;
  s.es_fallos = 0;
  s.es_urls = 0;
  s.es_motivo = '';
  // Las dos que miden la mortandad de verdad.
  s.es_activas_vistas = 0;
  s.es_bajas_nuevas = 0;
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle igual que una oferta y revienta el nodo HTTP con "URL parameter must be
// a string, got undefined". Así cayeron cuatro ejecuciones de Gamboa la
// madrugada del 2026-09-07, y era el caso normal: no había nada que hacer.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[as24-es] no hay nada que verificar ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { saltar: true }) }];
}

return [{ json: Object.assign({}, item, { saltar: !!s.es_parado }) }];`;

const CODE_VEREDICTO = `// El veredicto sobre UNA ficha española.
//
// La señal es el código de estado, nunca el HTML: ver la cabecera del generador.
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

// ── fallo pasajero ─────────────────────────────────────────────────────────
// Un 429 o un 503 no dicen nada del coche, dicen algo de nosotros. Se rota la
// fecha para que la cola siga girando y no se toca is_active.
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.es_fallos = (s.es_fallos || 0) + 1;
  return soloFecha('pasajero');
}

s.es_vistas = (s.es_vistas || 0) + 1;
if (eraActiva) s.es_activas_vistas = (s.es_activas_vistas || 0) + 1;

// ── sigue publicada ────────────────────────────────────────────────────────
if (codigo === 200) {
  s.es_vivas = (s.es_vivas || 0) + 1;
  const sets = eraActiva
    ? 'last_checked_at = NOW(), last_seen_at = NOW()'
    : 'is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()';
  return [{ json: { sql: 'UPDATE moveadvisor_market_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: eraActiva ? 'viva' : 'resucitada' } }];
}

// ── la web normaliza su propia URL ─────────────────────────────────────────
// Un 3xx cuyo destino conserva el uuid del coche no es una venta: es
// AutoScout24 arreglando su enlace. Se guarda la URL nueva y no se toca nada
// más. En Gamboa esto mismo dejaba muertas para siempre a 90 ofertas vivas.
const uuid = (String(oferta.url || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0] || '';
const esRedirect = codigo >= 300 && codigo < 400;
if (esRedirect && uuid && destino.toLowerCase().indexOf(uuid.toLowerCase()) !== -1) {
  s.es_urls = (s.es_urls || 0) + 1;
  const abs = destino.indexOf('http') === 0 ? destino : ('https://www.autoscout24.es' + destino);
  console.log('[as24-es] ' + id + ': URL normalizada -> ' + abs);
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET url = ' + esc(abs)
      + ', last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'url nueva',
  } }];
}

// ── vendida ────────────────────────────────────────────────────────────────
// 410 y 404 son explícitos. Y un 301 al listado del modelo -/lst/seat/leon- es
// la forma que tiene AutoScout24 de decir "ese coche ya no está, mira estos".
const alListado = esRedirect && (/\\/lst/.test(destino) || destino === '/'
  || /autoscout24\\.[a-z]+\\/?$/i.test(destino));
const esBaja = codigo === 404 || codigo === 410 || codigo === 451 || alListado;

if (esBaja) {
  s.es_bajas = (s.es_bajas || 0) + 1;
  if (eraActiva) s.es_bajas_nuevas = (s.es_bajas_nuevas || 0) + 1;

  // Cortacircuitos, sobre ACTIVAS miradas y muertes NUEVAS.
  const activas = s.es_activas_vistas || 0;
  const nuevas = s.es_bajas_nuevas || 0;
  if (activas >= ${MINIMO_PARA_JUZGAR} && (nuevas / activas) > ${TOPE_MORTANDAD}) {
    s.es_parado = true;
    s.es_motivo = 'mortandad del ' + Math.round(100 * nuevas / activas) + '% en ' + activas + ' activas';
    console.log('[as24-es] PARADO: ' + s.es_motivo + '. Eso no es que España haya'
      + ' vendido su parque móvil: es que ha cambiado algo en el portal.');
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
// Un 3xx que no va al listado y no conserva el uuid, o un código que no
// esperábamos. No se toca is_active: se apunta y se mira el parte. Equivocarse
// por no dar de baja se arregla mañana; vaciar el mercado por una corazonada,
// no.
s.es_raras = (s.es_raras || 0) + 1;
console.log('[as24-es] RARA ' + id + ' (HTTP ' + codigo + (destino ? ' -> ' + destino : '') + ')');
return soloFecha('rara');`;

const CODE_RESUMEN = `// El parte de la pasada, a moveadvisor_verify_runs.
const s = $getWorkflowStaticData('global');
const vistas = s.es_vistas || 0;
const activas = s.es_activas_vistas || 0;

console.log('[as24-es] ── resumen ──');
console.log('  fichas miradas   : ' + vistas + ' (' + activas + ' estaban activas)');
console.log('  siguen publicadas: ' + (s.es_vivas || 0));
console.log('  BAJAS NUEVAS     : ' + (s.es_bajas_nuevas || 0));
console.log('  bajas ya sabidas : ' + ((s.es_bajas || 0) - (s.es_bajas_nuevas || 0)));
console.log('  URLs corregidas  : ' + (s.es_urls || 0));
console.log('  sin clasificar   : ' + (s.es_raras || 0));
console.log('  fallos pasajeros : ' + (s.es_fallos || 0));
if (s.es_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.es_motivo);
// Una pasada que no mira ni una activa deja el mercado sin verificar ese día
// aunque el parte salga limpio. Es lo que pasaba en Gamboa y no lo dijo nadie.
if (!s.es_parado && activas === 0 && vistas > 0) {
  console.log('  OJO: no se ha mirado NI UNA oferta activa.');
}
if ((s.es_raras || 0) > vistas * 0.1) {
  console.log('  OJO: más del 10% sin clasificar. O AutoScout24 ha cambiado algo,');
  console.log('  o hay un estado que no conocemos. Mirar esas URLs.');
}

const n = v => String(Number(v) || 0);
// En 'deactivated' van las bajas NUEVAS. Contar ahí las reconfirmaciones haría
// que una pasada sin novedades pareciera una matanza.
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('autoscout24-es', NOW(), " + n(vistas) + ', ' + n(s.es_vivas) + ', '
  + n(s.es_bajas_nuevas) + ', ' + n(s.es_raras) + ', ' + n(s.es_fallos) + ', '
  + (s.es_parado ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS})';

return [{ json: { sql: sql, vistas: vistas, activas: activas, vivas: s.es_vivas || 0,
  bajas: s.es_bajas_nuevas || 0, urls: s.es_urls || 0,
  raras: s.es_raras || 0, fallos: s.es_fallos || 0, parado: !!s.es_parado } }];`;

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

const nodos = [
  { parameters: {}, id: "ev-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // Cuatro pasadas, todas FUERA de la ventana del scraper español (13:30 a
  // 19:15): dos workflows pidiéndole a autoscout24.es a la vez es la forma más
  // rápida de que nos corten. Minuto 25 para no coincidir con nadie en punto:
  // el 2026-09-09 tres verificadores dispararon a las 12:00 y los tres
  // murieron con "Connection timed out" contra Postgres.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 25 9,11,19,21 * * *" }] } },
    id: "ev-cron", name: "4 veces/día (9:25, 11:25, 19:25 y 21:25)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ev-cola", name: "PG: Cola a verificar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "ev-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "ev-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicionBooleana("ev-c-saltar", "saltar"), id: "ev-if-saltar",
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
        // SIN seguir redirecciones: el 301 y el 410 SON la señal. Siguiéndolas,
        // un coche vendido acaba en el listado del modelo, que responde 200, y
        // lo daríamos por vivo.
        redirect: { redirect: { followRedirects: false } },
        timeout: 20000,
      },
    }, id: "ev-http", name: "HTTP: ¿sigue la ficha?",
    // neverError solo calla los códigos; un corte de red seguiría matando el
    // nodo y con él la pasada de 3.000.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "ev-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("ev-c-sql", "sql"), id: "ev-if-sql", name: "IF: ¿hay veredicto?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ev-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "ev-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1440, 540],
    webhookId: "f6b2d418-as24-es-verificar" },
  { parameters: { jsCode: CODE_RESUMEN }, id: "ev-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ev-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const CRON = "4 veces/día (9:25, 11:25, 19:25 y 21:25)";
const conexiones = {
  "Ejecutar manualmente":    { main: [[L("PG: Cola a verificar")]] },
  [CRON]:                    { main: [[L("PG: Cola a verificar")]] },
  "PG: Cola a verificar":    { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta": { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":    { main: [[L("IF: ¿nos hemos parado?")]] },
  "IF: ¿nos hemos parado?":  { main: [[L("Loop: oferta por oferta")], [L("HTTP: ¿sigue la ficha?")]] },
  "HTTP: ¿sigue la ficha?":  { main: [[L("Code: Veredicto")]] },
  "Code: Veredicto":         { main: [[L("IF: ¿hay veredicto?")]] },
  "IF: ¿hay veredicto?":     { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":   { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":           { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "AutoScout24 – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "autoscout24-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, HEAD, " + LOTE + " por pasada, 4 pasadas/día = "
  + (LOTE * 4).toLocaleString("es") + " al día");
console.log("  cortacircuitos: para si más del " + (TOPE_MORTANDAD * 100)
  + "% de las ACTIVAS miradas sale de baja, tras " + MINIMO_PARA_JUZGAR);

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Veredicto").parameters.jsCode;
const bien = js.indexOf("/\\/lst/") >= 0 && js.indexOf("[0-9a-f]{8}-") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "los regex del veredicto conservan sus barras");
if (!bien) process.exit(1);
