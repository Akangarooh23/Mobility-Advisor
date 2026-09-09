/**
 * El origen de n8n-workflows/autoscout24-de-verificar-activas.json.
 *
 *   node scripts/genera-verificador-as24-de.js
 *   npm run test:as24-de-verificar
 *
 * ── Cómo dice AutoScout24 que un coche ya no está ──────────────────────────
 *
 * Medido el 2026-09-09 sobre 60 fichas alemanas al azar, con HEAD y sin seguir
 * redirecciones:
 *
 *     34   HTTP 200                        sigue publicada        57%
 *     16   HTTP 301 -> /lst/seat/leon      vendida                27%
 *      9   HTTP 410                        vendida                15%
 *      1   HTTP 308 -> la misma ficha      URL normalizada         2%
 *
 * Son cuatro casos y hay que distinguirlos: un 301 al listado del modelo es una
 * venta, pero un 308 que conserva el uuid del coche es la web arreglando su
 * propia URL. Confundirlos es dar de baja coches vivos, que es exactamente lo
 * que nos pasó en Gamboa.
 *
 * ── Lo que NO se mira, y es lo importante ──────────────────────────────────
 *
 * El texto «ya no está disponible».
 *
 * scripts/as24-verify-liveness.js lo buscaba con body.includes(). Parece
 * razonable hasta que se mira una ficha viva: la frase está en el diccionario de
 * traducciones que AutoScout24 envía en TODAS sus páginas,
 *
 *     "detailpage.gonePage.title":"Este vehículo ya no está disponible."
 *
 * o sea la etiqueta de la pantalla de «no disponible», no el estado del coche.
 * La comprobación acertaba siempre. Se ejecutó a mano el 2026-08-16 y dio de
 * baja 24.746 ofertas de una sentada; midiendo después, el 45% de ellas seguía
 * publicada.
 *
 * De ahí la regla de esta casa: la señal es el CÓDIGO DE ESTADO, no el HTML. El
 * maquetado de un portal cambia; un 410 significa lo mismo siempre.
 *
 * ── Por qué HEAD ───────────────────────────────────────────────────────────
 *
 * Una ficha alemana pesa 344 KB y n8n guarda en memoria la salida de cada vuelta
 * del bucle. Con GET, 3.000 fichas por pasada son un gigabyte.
 *
 * Con HEAD el cuerpo pesa 0. Pero eso NO se supone: en Wallapop, HEAD devuelve
 * 404 sobre ofertas VIVAS. Aquí se comprobó sobre 15 fichas -5 recién publicadas
 * y 10 nuestras de julio- y HEAD y GET devolvieron el MISMO código en las 15.
 *
 * Y su forma de equivocarse es la buena: si algún día AutoScout24 sirviera una
 * pantalla de «no disponible» con código 200, la daríamos por viva. Preferimos
 * quedarnos con un coche vendido de más que borrar uno que se puede vender.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// 8.692 activas hoy, y subirán cuando se rescaten las que se dieron de baja mal.
// A 3.000 por pasada y 5 pasadas al día son 15.000 comprobaciones diarias, que
// cubren el catálogo activo entero todos los días con margen para que crezca.
const LOTE = 3000;
const ESPERA_SEGUNDOS = 1;

// El cortacircuitos. Cuenta MUERTES NUEVAS sobre ACTIVAS miradas, no sobre todo
// lo mirado: reconfirmar un coche que ya sabíamos vendido no es mortandad. Con
// el total, una cola llena de bajas ya sabidas daba 100% y cortaba la pasada
// antes de comprobar una sola oferta viva. Pasó en Gamboa tres días seguidos.
const MINIMO_PARA_JUZGAR = 100;
const TOPE_MORTANDAD = 0.6;

const COLA = `-- Las ofertas alemanas que toca comprobar.
--
-- Las ACTIVAS cada dia: son las que sostienen las valoraciones. Las que ya
-- constan de baja, una vez por semana, solo para que una que se diera por
-- muerta por error pueda volver sola.
--
-- Los dos ritmos separados no son un capricho. En Gamboa iban con el mismo
-- filtro y la cola acababa llena de muertas: el cortacircuitos leia 100% de
-- mortandad y cortaba la pasada antes de mirar una sola oferta viva.
SELECT id, url, is_active
FROM moveadvisor_market_offers
WHERE portal = 'autoscout24'
  AND country = 'DE'
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
-- Y al azar porque el orden por antiguedad pone delante justo las que el
-- scraper dejo de ver, o sea las vendidas: el frente de la cola seria 100% de
-- mortandad por construccion y el cortacircuitos no mediria nada.
ORDER BY is_active DESC, random()
LIMIT ${LOTE}`;

const CODE_TOCA = `// Arranque de la pasada, cortacircuitos y guarda de cola vacia.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.de_run || s.de_run !== $execution.id) {
  s.de_run = $execution.id;
  s.de_parado = false;
  s.de_vistas = 0;
  s.de_vivas = 0;
  s.de_bajas = 0;
  s.de_raras = 0;
  s.de_fallos = 0;
  s.de_urls = 0;
  s.de_motivo = '';
  // Las dos que miden la mortandad de verdad.
  s.de_activas_vistas = 0;
  s.de_bajas_nuevas = 0;
}

// Una cola vacia NO llega como "nada": n8n manda UN ITEM VACIO, que recorre el
// bucle igual que una oferta y revienta el nodo HTTP con "URL parameter must be
// a string, got undefined". Asi cayeron cuatro ejecuciones programadas de
// Gamboa la madrugada del 2026-09-07, y era el caso normal: no habia nada que
// hacer.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[as24-de] no hay nada que verificar ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { saltar: true }) }];
}

return [{ json: Object.assign({}, item, { saltar: !!s.de_parado }) }];`;

const CODE_VEREDICTO = `// El veredicto sobre UNA ficha alemana.
//
// La señal es el codigo de estado, nunca el HTML. Ver la cabecera del generador:
// buscar "ya no esta disponible" en el cuerpo dio de baja 24.746 ofertas de las
// que el 45% seguia publicada, porque esa frase viaja en el diccionario de
// traducciones de todas las paginas.
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
  s.de_fallos = (s.de_fallos || 0) + 1;
  return soloFecha('pasajero');
}

s.de_vistas = (s.de_vistas || 0) + 1;
if (eraActiva) s.de_activas_vistas = (s.de_activas_vistas || 0) + 1;

// ── sigue publicada ────────────────────────────────────────────────────────
if (codigo === 200) {
  s.de_vivas = (s.de_vivas || 0) + 1;
  const sets = eraActiva
    ? 'last_checked_at = NOW(), last_seen_at = NOW()'
    : 'is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()';
  return [{ json: { sql: 'UPDATE moveadvisor_market_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: eraActiva ? 'viva' : 'resucitada' } }];
}

// ── la web normaliza su propia URL ─────────────────────────────────────────
// Un 3xx cuyo destino conserva el uuid del coche no es una venta: es
// AutoScout24 arreglando su enlace. Se guarda la URL nueva y no se toca nada
// mas. En Gamboa esto mismo dejaba muertas para siempre a 90 ofertas vivas.
const uuidDe = (String(oferta.url || '').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0] || '';
const esRedirect = codigo >= 300 && codigo < 400;
if (esRedirect && uuidDe && destino.toLowerCase().indexOf(uuidDe.toLowerCase()) !== -1) {
  s.de_urls = (s.de_urls || 0) + 1;
  const abs = destino.indexOf('http') === 0 ? destino : ('https://www.autoscout24.es' + destino);
  console.log('[as24-de] ' + id + ': URL normalizada -> ' + abs);
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET url = ' + esc(abs)
      + ', last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'url nueva',
  } }];
}

// ── vendida ────────────────────────────────────────────────────────────────
// 410 y 404 son explicitos. Y un 301 al listado del modelo -/lst/seat/leon- es
// la forma que tiene AutoScout24 de decir "ese coche ya no esta, mira estos".
const alListado = esRedirect && (/\\/lst/.test(destino) || destino === '/'
  || /autoscout24\\.[a-z]+\\/?$/i.test(destino));
const esBaja = codigo === 404 || codigo === 410 || codigo === 451 || alListado;

if (esBaja) {
  s.de_bajas = (s.de_bajas || 0) + 1;
  if (eraActiva) s.de_bajas_nuevas = (s.de_bajas_nuevas || 0) + 1;

  // Cortacircuitos, sobre ACTIVAS miradas y muertes NUEVAS.
  const activas = s.de_activas_vistas || 0;
  const nuevas = s.de_bajas_nuevas || 0;
  if (activas >= ${MINIMO_PARA_JUZGAR} && (nuevas / activas) > ${TOPE_MORTANDAD}) {
    s.de_parado = true;
    s.de_motivo = 'mortandad del ' + Math.round(100 * nuevas / activas) + '% en ' + activas + ' activas';
    console.log('[as24-de] PARADO: ' + s.de_motivo + '. Eso no es que Alemania haya'
      + ' vendido su parque movil: es que ha cambiado algo en el portal.');
    return soloFecha('parado');
  }

  // Si ya constaba de baja no se toca updated_at: reescribirlo cada semana
  // borra el unico rastro de cuando cayo el anuncio.
  const sets = eraActiva
    ? 'is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()'
    : 'last_checked_at = NOW()';
  return [{ json: { sql: 'UPDATE moveadvisor_market_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: 'baja' } }];
}

// ── ni una cosa ni la otra ─────────────────────────────────────────────────
// Un 3xx que no va al listado y no conserva el uuid, o un codigo que no
// esperabamos. No se toca is_active: se apunta y se mira el parte. Equivocarse
// por no dar de baja se arregla manana; vaciar el mercado por una corazonada,
// no.
s.de_raras = (s.de_raras || 0) + 1;
console.log('[as24-de] RARA ' + id + ' (HTTP ' + codigo + (destino ? ' -> ' + destino : '') + ')');
return soloFecha('rara');`;

const CODE_RESUMEN = `// El parte de la pasada, a moveadvisor_verify_runs.
const s = $getWorkflowStaticData('global');
const vistas = s.de_vistas || 0;
const activas = s.de_activas_vistas || 0;

console.log('[as24-de] ── resumen ──');
console.log('  fichas miradas   : ' + vistas + ' (' + activas + ' estaban activas)');
console.log('  siguen publicadas: ' + (s.de_vivas || 0));
console.log('  BAJAS NUEVAS     : ' + (s.de_bajas_nuevas || 0));
console.log('  bajas ya sabidas : ' + ((s.de_bajas || 0) - (s.de_bajas_nuevas || 0)));
console.log('  URLs corregidas  : ' + (s.de_urls || 0));
console.log('  sin clasificar   : ' + (s.de_raras || 0));
console.log('  fallos pasajeros : ' + (s.de_fallos || 0));
if (s.de_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.de_motivo);
// Una pasada que no mira ni una activa deja el mercado sin verificar ese dia
// aunque el parte salga limpio. Es lo que pasaba en Gamboa y no lo dijo nadie.
if (!s.de_parado && activas === 0 && vistas > 0) {
  console.log('  OJO: no se ha mirado NI UNA oferta activa.');
}
if ((s.de_raras || 0) > vistas * 0.1) {
  console.log('  OJO: mas del 10% sin clasificar. O AutoScout24 ha cambiado algo,');
  console.log('  o hay un estado que no conocemos. Mirar esas URLs.');
}

const n = v => String(Number(v) || 0);
// En 'deactivated' van las bajas NUEVAS. Contar ahi las reconfirmaciones hacia
// que una pasada sin novedades pareciera una matanza.
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('autoscout24-de', NOW(), " + n(vistas) + ', ' + n(s.de_vivas) + ', '
  + n(s.de_bajas_nuevas) + ', ' + n(s.de_raras) + ', ' + n(s.de_fallos) + ', '
  + (s.de_parado ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS})';

return [{ json: { sql: sql, vistas: vistas, activas: activas, vivas: s.de_vivas || 0,
  bajas: s.de_bajas_nuevas || 0, urls: s.de_urls || 0,
  raras: s.de_raras || 0, fallos: s.de_fallos || 0, parado: !!s.de_parado } }];`;

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
  { parameters: {}, id: "dv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // 5 pasadas dentro de la franja de 8:00 a 00:00, y en el minuto 40 para no
  // pisarse con nadie: tres verificadores dispararon a la vez el 2026-09-09 a
  // las 12:00 y los tres murieron con "Connection timed out" contra Postgres.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 40 8,11,14,17,20 * * *" }] } },
    id: "dv-cron", name: "5 veces/día (8:40 a 20:40)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "dv-cola", name: "PG: Cola a verificar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300], credentials: PG_CRED },
  { parameters: { options: {} }, id: "dv-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "dv-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicionBooleana("dv-c-saltar", "saltar"), id: "dv-if-saltar",
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
        // SIN seguir redirecciones: el 301 y el 410 SON la señal. Siguiendolas,
        // un coche vendido acaba en el listado del modelo, que responde 200, y
        // lo dariamos por vivo.
        redirect: { redirect: { followRedirects: false } },
        timeout: 20000,
      },
    }, id: "dv-http", name: "HTTP: ¿sigue la ficha?",
    // neverError solo calla los codigos; un corte de red seguiria matando el
    // nodo y con el la pasada de 3.000.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "dv-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("dv-c-sql", "sql"), id: "dv-if-sql", name: "IF: ¿hay veredicto?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "dv-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "dv-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1440, 540],
    webhookId: "a7c3e910-as24-de-verificar" },
  { parameters: { jsCode: CODE_RESUMEN }, id: "dv-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "dv-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160], credentials: PG_CRED },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":        { main: [[L("PG: Cola a verificar")]] },
  "5 veces/día (8:40 a 20:40)":  { main: [[L("PG: Cola a verificar")]] },
  "PG: Cola a verificar":        { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":     { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":        { main: [[L("IF: ¿nos hemos parado?")]] },
  "IF: ¿nos hemos parado?":      { main: [[L("Loop: oferta por oferta")], [L("HTTP: ¿sigue la ficha?")]] },
  "HTTP: ¿sigue la ficha?":      { main: [[L("Code: Veredicto")]] },
  "Code: Veredicto":             { main: [[L("IF: ¿hay veredicto?")]] },
  "IF: ¿hay veredicto?":         { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":       { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":               { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "AutoScout24 DE – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "autoscout24-de-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, HEAD, " + LOTE + " por pasada, 5 pasadas/día");
console.log("  cortacircuitos: para si mas del " + (TOPE_MORTANDAD * 100)
  + "% de las ACTIVAS miradas sale de baja, tras " + MINIMO_PARA_JUZGAR);
