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

// Correr así es seguro y está medido: una ráfaga a este ritmo contra el portal
// dio 28 doscientos, 8 trescientosuno y 4 cuatrocientosdiez, ni un 403, con la
// latencia BAJANDO de 192 a 155 ms, y su robots.txt no declara Crawl-delay. Aun
// así, lo que lo hace seguro de verdad es el cortacircuitos de bloqueo: si un
// día nos cierran la puerta, la pasada se para a los 50 intentos.
//
// LOTE CORTO A PROPÓSITO.
//
// El 16-sep dos pasadas de 10.000 llevaban 5 y 4 horas con dieciocho
// ejecuciones esperando detrás. Midiendo media hora a media hora, las dos daban
// la misma curva:
//
//     50 → 50 → 40 → 33 → 29 → 26 → 23 → 22 → 20 → 19 ofertas/min
//
// n8n guarda en memoria la salida de cada vuelta del bucle, así que cuantas más
// lleva, más cuesta la siguiente. Una pasada larga no tarda más: hace el trabajo
// MÁS CARO. Los primeros 1.500 van a ~50/min y los últimos a 19.
//
// Con 1.500 la pasada dura ~30 min sin salir de la zona rápida, y seis pasadas
// cortas rinden más que una larga y además no taponan la cola.
const LOTE = 1500;
// Lo medido el 15-sep sin nodo Wait, redondeado hacia arriba. Lo usan el
// resumen de aquí abajo y el test, que comprueba que una pasada cabe en su
// hueco: si un día esto se queda viejo otra vez, salta el test y no el workflow.
const SEGUNDOS_POR_OFERTA = 0.5;
// Solo para el parte: ya no hay nodo Wait.
const ESPERA_SEGUNDOS = 0;
// El cortacircuitos. Con 100 activas miradas ya se puede juzgar, y por encima
// del 60% de mortandad lo que ha pasado no es que España haya vendido su parque
// móvil: es que el portal ha cambiado algo y lo estamos leyendo mal.
const MINIMO_PARA_JUZGAR = 100;
// El segundo cortacircuitos, el de bloqueo. Va sobre INTENTOS, no sobre ofertas
// miradas: un 403 no llega a mirarse. 50 intentos son 23 segundos al ritmo
// actual, así que se entera enseguida sin dispararse por tres timeouts seguidos.
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;
// 0,8 aquí, no 0,6 como en Alemania, y por una razón concreta: en Alemania el
// mercado lleva semanas verificándose y una pasada normal encuentra un 10% de
// bajas. Aquí no se ha verificado NUNCA y el dato lleva 28 días parado, así que
// la mortandad de verdad es enorme. Medido el 14 y el 15-sep sobre ofertas
// viejas al azar:
//
//     5 de 12 muertas   (42%)
//     6 de 10 muertas   (60%)
//
// Con el tope en 0,6 el verificador se pararía solo a los 100 coches creyendo
// que el portal ha cambiado, cuando lo que pasa es que la basura es real. A 0,8
// sigue cazando el caso que importa -leer mal el portal da 100%- sin cortar la
// limpieza. Cuando la primera vuelta esté hecha, esto vuelve a 0,6.
const TOPE_MORTANDAD = 0.8;

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
  s.es_intentos = 0;
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

// ── fallo pasajero, y el freno por bloqueo ─────────────────────────────────
// Un 429 o un 503 no dicen nada del coche, dicen algo de nosotros. Se rota la
// fecha para que la cola siga girando y no se toca is_active.
//
// Pero UNO es un fallo y MIL son una puerta cerrada. El cortacircuitos de
// mortandad no ve esto -un 403 no es una venta-, así que sin este segundo
// freno una pasada bloqueada se gastaría las ${LOTE} ofertas poniendo fechas sin
// mirar nada, y solo se sabría después leyendo el parte.
//
// El listón está alto a propósito: en las pasadas alemanas del 14-sep los
// pasajeros fueron 5 de 2.995 (0,2%). Un bloqueo de verdad da el 100%.
s.es_intentos = (s.es_intentos || 0) + 1;
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.es_fallos = (s.es_fallos || 0) + 1;
  const intentos = s.es_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.es_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.es_parado = true;
    s.es_motivo = Math.round(100 * s.es_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[as24-es] PARADO: ' + s.es_motivo + '. Bajar el ritmo antes de volver.');
  }
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
console.log('  fallos pasajeros : ' + (s.es_fallos || 0)
  + ' de ' + (s.es_intentos || 0) + ' intentos');
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
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 25 8,10,12,20,22,23 * * *" }] } },
    id: "ev-cron", name: "6 veces/día (8:25 a 23:25)",
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
  // Sin nodo Wait: ver la nota del lote. Cada oferta vuelve al bucle en cuanto
  // se ha guardado su veredicto.
  { parameters: { jsCode: CODE_RESUMEN }, id: "ev-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ev-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const CRON = "6 veces/día (8:25 a 23:25)";
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
// Las pasadas se cuentan del propio cron: llevarlas a mano es como se quedan
// viejas los números de los comentarios.
const PASADAS = String(((nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2])).split(",").length;
console.log("  " + nodos.length + " nodos, HEAD, " + LOTE + " por pasada, " + PASADAS
  + " pasadas/día = " + (LOTE * PASADAS).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60)
  + " min, y entre una y la siguiente hay 120");
console.log("  cortacircuitos: para si más del " + (TOPE_MORTANDAD * 100)
  + "% de las ACTIVAS miradas sale de baja, tras " + MINIMO_PARA_JUZGAR);

// Que las barras hayan sobrevivido a vivir dentro de una cadena: "\d" es "d".
const gen = JSON.parse(fs.readFileSync(destino, "utf8"));
const js = gen.nodes.find((n) => n.name === "Code: Veredicto").parameters.jsCode;
const bien = js.indexOf("/\\/lst/") >= 0 && js.indexOf("[0-9a-f]{8}-") >= 0;
console.log("  " + (bien ? "ok   " : "MAL  ") + "los regex del veredicto conservan sus barras");
if (!bien) process.exit(1);
