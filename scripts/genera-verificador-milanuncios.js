/**
 * El origen de n8n-workflows/milanuncios-verificar-activas.json.
 *
 * Se genera en vez de escribirse a mano porque el codigo de los nodos lleva
 * expresiones regulares, y dentro de un JSON hay que escribirlas doblemente
 * escapadas. Ahi es donde se pierden las barras.
 *
 *   node scripts/genera-verificador-milanuncios.js
 *   npm run test:milanuncios
 *
 * ── Que hace ───────────────────────────────────────────────────────────────
 *
 * Va a la URL de cada oferta activa y mira si el anuncio sigue ahi. Igual que
 * el de Wallapop, y por la misma razon: es la unica forma de saber de VERDAD si
 * una oferta concreta sigue viva.
 *
 * robots.txt de Milanuncios permite las fichas de forma explicita
 * (`Allow: /*\/*.htm$`) y prohibe justo lo contrario, los listados paginados
 * (`Disallow: /*pagina=`). O sea que esta es ademas la via limpia.
 *
 * ── La aritmetica ──────────────────────────────────────────────────────────
 *
 * 3.594 ofertas activas, y NO se repasan todas cada dia. Con LOTE=120 y seis
 * pasadas salen 720 comprobaciones diarias: un ciclo de CINCO dias.
 *
 * Conviene decirlo claro, porque el requisito era diario y aqui no se cumple.
 *
 * ── Por que no se cumple ───────────────────────────────────────────────────
 *
 * No por el ritmo. Veinte segundos por ficha aguantan tres horas seguidas sin un
 * solo bloqueo: 138 fichas medidas el 2026-09-07.
 *
 * Es la MEMORIA. Una ficha de Milanuncios pesa 978 KB y n8n guarda la salida de
 * cada vuelta del bucle. Con 620 por pasada serian ~600 MB en un solo run; el
 * verificador de Wallapop ya se colgo con 20 MB, y la pasada que se intento
 * murio en la ficha 139 con ~135 MB encima. De ahi 120, que son ~120 MB.
 *
 * El lote habia pasado de 560 a 620 el dia anterior por otro motivo -el scraper
 * metio 246 ofertas en una noche y el ciclo dejo de ser diario sin dar ningun
 * error-. Aquella cuenta era correcta y la memoria la invalida: no vale de nada
 * dimensionar por cobertura si el run no llega vivo al final.
 *
 * ── La salida ──────────────────────────────────────────────────────────────
 *
 * HEAD, que no descarga cuerpo. Sin cuerpo no hay problema de memoria y el lote
 * puede subir a lo que haga falta.
 *
 * Pero eso hay que MEDIRLO en cada portal y no darlo por bueno. En Gamboa se
 * comprobo que HEAD y GET dicen lo mismo sobre ocho ofertas, cuatro vivas y
 * cuatro vendidas. En Wallapop se comprobo lo contrario: HEAD devuelve 404 sobre
 * ofertas VIVAS, y fiarse de el alli habria dado de baja el catalogo entero.
 *
 * En Milanuncios sigue sin medir. El intento del 2026-09-07 salio invalido
 * porque las propias peticiones de prueba -doce seguidas cada cuatro segundos-
 * dispararon el bloqueo del portal, y a partir de ahi el GET devolvia la
 * pantalla de Imperva en vez de la verdad.
 *
 * ── Sobre el ritmo, que es lo unico que no esta medido ─────────────────────
 *
 * Una peticion cada 20 segundos NO es un ritmo agresivo: el scraper ya sostiene
 * una cada 15. Lo que nunca se ha probado es mantenerlo durante horas.
 *
 * Lo que si se sabe es que nos quemo: universal-enrich-color pedia 400 fichas
 * al dia SIN nodo Wait, o sea disparadas uno detras de otro tan rapido como
 * podia. Eso es otra cosa distinta de un goteo.
 *
 * Por eso este workflow se mide a si mismo: en cuanto le llega la pantalla de
 * bloqueo PARA la ejecucion entera y deja escrito por cuantas ofertas habia
 * pasado. Si en el registro aparece que se corta siempre por la numero 40, ya
 * sabemos el limite y se sube la espera. Si nunca se corta, se puede bajar.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// El lote lo manda la MEMORIA, no el ritmo, y eso se midio el 2026-09-07: una
// ficha de Milanuncios pesa 978 KB. Con 620 por pasada n8n acumularia ~600 MB
// en un solo run -guarda la salida de cada vuelta del bucle-, y el verificador
// de Wallapop ya se colgo con 20 MB. La pasada que se intento murio en la ficha
// 139, con ~135 MB encima.
//
// Asi que 120, que son ~120 MB. Y hay que decir lo que eso cuesta: 120 x 6 son
// 720 comprobaciones al dia para 3.594 ofertas, o sea un ciclo de CINCO dias.
// El requisito de verificarlo todo cada dia NO se cumple en Milanuncios, y no
// por el ritmo -20 segundos aguantan- sino porque no caben en memoria los
// cuerpos de 1 MB.
//
// La salida es HEAD: sin cuerpo, el problema desaparece y el lote puede subir a
// lo que haga falta. En Gamboa se comprobo que HEAD y GET dicen lo mismo; en
// Wallapop se comprobo que HEAD MIENTE sobre ofertas vivas. Aqui esta sin medir
// -el intento del 2026-09-07 salio invalido porque las peticiones de prueba
// dispararon el bloqueo del portal-, y hasta medirlo no se sube.
const LOTE = 120;              // ofertas por ejecucion
const ESPERA_SEGUNDOS = 20;    // entre ficha y ficha

const COLA = `-- Las ofertas activas que llevan mas tiempo sin comprobar. Con ${LOTE} por
-- ejecucion y 6 ejecuciones al dia se repasan las 3.594 activas cada dia.
--
-- El filtro de 20 horas evita que una ejecucion repita lo que acaba de mirar
-- otra: reparte el catalogo entre las 6 pasadas del dia en vez de machacar
-- siempre las mismas. Misma idea que en el verificador de Wallapop.
SELECT id,
       url,
       lower(brand) AS marca
FROM moveadvisor_market_offers
WHERE portal = 'milanuncios'
  AND is_active
  AND COALESCE(url, '') <> ''
  AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL '20 hours')
ORDER BY last_checked_at ASC NULLS FIRST
LIMIT ${LOTE}`;

const CODE_TOCA = `// Si ya nos han bloqueado, las ofertas que quedan no se piden. Insistir alarga
// el bloqueo, y de una pagina bloqueada no se saca ningun veredicto.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.mil_run || s.mil_run !== $execution.id) {
  // Arranque de ejecucion. El contador vive en la memoria del workflow, asi que
  // hay que distinguir esta ejecucion de la anterior para no heredar su estado.
  s.mil_run = $execution.id;
  s.mil_bloqueo = false;
  s.mil_vistas = 0;
  s.mil_vivas = 0;
  s.mil_bajas = 0;
  s.mil_raras = 0;
  s.mil_fallos = 0;
}

// Una cola vacia no llega como "nada". Cuando la consulta no devuelve filas,
// n8n manda UN ITEM VACIO: recorre el bucle igual que una oferta, llega al nodo
// HTTP sin url y lo revienta con "URL parameter must be a string, got
// undefined". Le paso al verificador de Gamboa en sus cuatro ejecuciones
// programadas del 2026-09-07, y era el caso normal: con el filtro de 20 horas,
// en cuanto el catalogo esta al dia no queda nada elegible.
//
// Un item sin oferta se trata como si nos hubieran bloqueado: no se pide nada y
// el run termina limpio.
if (!item || !item.id || !String(item.url || '').trim()) {
  console.log('[mil-verificar] no hay nada que verificar ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { saltar: true }) }];
}

return [{ json: Object.assign({}, item, { saltar: !!s.mil_bloqueo }) }];`;

const CODE_VEREDICTO = `// El veredicto sobre UNA ficha. Aqui es donde este workflow puede hacer daño de
// verdad, asi que la regla es: solo se da de baja con una prueba clara, y
// cualquier otra cosa se deja como esta.
//
// El error que hay que no repetir: la pantalla de bloqueo de Imperva llega con
// un HTTP 200 y 96 KB de HTML. Un verificador que mire solo el codigo de estado
// la cuenta como "anuncio vivo" -o peor, si mirase el contenido al reves, daria
// de baja el catalogo entero-. Se mira el cuerpo SIEMPRE, y antes que nada.
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
const cuerpo = String(res.body || '');
const codigo = Number(res.statusCode || 0);

const s = $getWorkflowStaticData('global');
const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const id = String(oferta.id || '');
if (!id) return [{ json: { sql: null } }];

// ── 1. ¿Nos han bloqueado? ──────────────────────────────────────────────────
// No es un veredicto sobre la oferta: es que no hemos podido mirar. Se para la
// ejecucion entera y no se toca ni esta oferta ni ninguna.
if (/Pardon Our Interruption/i.test(cuerpo) || codigo === 403 || codigo === 429) {
  s.mil_bloqueo = true;
  console.log('[mil-verificar] BLOQUEADO tras ' + (s.mil_vistas || 0) + ' fichas'
    + ' (HTTP ' + codigo + '). Se para la ejecucion.');
  console.log('[mil-verificar] APUNTA ESTE NUMERO: es el limite real del portal'
    + ' con una espera de ${ESPERA_SEGUNDOS}s.');
  return [{ json: { sql: null, veredicto: 'bloqueado' } }];
}

// ── 2. Fallo pasajero ───────────────────────────────────────────────────────
// Un 500, un timeout o un corte de conexion no dicen nada de la oferta. Se mira
// ANTES de contar la ficha como mirada: si no, un run que se pasa media hora
// dando timeouts diria en el parte que ha revisado 60 ofertas.
//
// El corte de conexion llega aqui con codigo 0 porque el nodo HTTP va con
// onError: continueRegularOutput. Sin eso, un fallo de red suelto tumba la
// ejecucion entera: el 2026-09-07 se perdieron tres horas y 138 fichas ya
// verificadas por un unico error en la 139. neverError no basta -solo silencia
// los codigos de estado, no los fallos de red-.
if (codigo === 0 || codigo >= 500) {
  s.mil_fallos = (s.mil_fallos || 0) + 1;
  console.log('[mil-verificar] fallo pasajero en ' + id + ' (HTTP ' + codigo + ')');
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'pasajero',
  } }];
}

s.mil_vistas = (s.mil_vistas || 0) + 1;

// ── 3. Ya no existe ─────────────────────────────────────────────────────────
if (codigo === 404 || codigo === 410) {
  s.mil_bajas = (s.mil_bajas || 0) + 1;
  console.log('[mil-verificar] BAJA ' + id + ' (HTTP ' + codigo + ')');
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET is_active = false,'
       + ' last_checked_at = NOW(), updated_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'baja',
  } }];
}

// ── 4. Sigue publicada ──────────────────────────────────────────────────────
// La ficha de un anuncio vivo trae __INITIAL_PROPS__, igual que el listado. Es
// una señal mucho mas solida que buscar frases sueltas en el HTML.
if (codigo === 200 && /__INITIAL_PROPS__/.test(cuerpo)) {
  s.mil_vivas = (s.mil_vivas || 0) + 1;
  // is_active no se toca: un anuncio reservado sigue teniendo ficha, asi que
  // verla prueba que sigue publicado, no que este disponible. Y si estaba dada
  // de baja, reactivarla desde aqui seria adivinar.
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET last_checked_at = NOW(),'
       + ' last_seen_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'viva',
  } }];
}

// ── 5. Cualquier otra cosa ──────────────────────────────────────────────────
// Un 200 sin datos de anuncio puede ser la pagina de "ya no disponible", un
// redirect al listado, o algo que no hemos visto nunca. NO se da de baja por
// una corazonada: se apunta y se mira el registro.
//
// Si en las primeras ejecuciones salen muchas 'raras', ahi esta la firma del
// anuncio caducado, y entonces se añade su deteccion arriba con una prueba
// delante. Mientras tanto, equivocarse por no dar de baja se arregla; dar de
// baja medio catalogo por una corazonada, no.
s.mil_raras = (s.mil_raras || 0) + 1;
console.log('[mil-verificar] RARA ' + id + ' (HTTP ' + codigo + ', ' + cuerpo.length
  + ' bytes) ' + oferta.url);
return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET last_checked_at = NOW() WHERE id = ' + esc(id),
  veredicto: 'rara',
} }];`;

const CODE_RESUMEN = `// El parte de la ejecucion. Es lo que hay que leer para saber si el ritmo
// aguanta y si la deteccion de bajas funciona.
//
// Va a moveadvisor_verify_runs y no al registro de n8n a proposito: guardar las
// ejecuciones enteras obligaria a poner saveDataSuccessExecution a "all", y eso
// son 560 respuestas de 96 KB, unos 54 MB por ejecucion. Esto es una fila.
const s = $getWorkflowStaticData('global');
const vistas = s.mil_vistas || 0;

console.log('[mil-verificar] ── resumen ──');
console.log('  fichas miradas   : ' + vistas);
console.log('  siguen publicadas: ' + (s.mil_vivas || 0));
console.log('  dadas de baja    : ' + (s.mil_bajas || 0));
console.log('  sin clasificar   : ' + (s.mil_raras || 0));
console.log('  fallos pasajeros : ' + (s.mil_fallos || 0));

if (s.mil_bloqueo) {
  console.log('  BLOQUEADO por el portal tras ' + vistas + ' fichas con espera de ${ESPERA_SEGUNDOS}s.');
  console.log('  -> subir ESPERA_SEGUNDOS en scripts/genera-verificador-milanuncios.js');
} else {
  console.log('  sin bloqueos: el ritmo de ${ESPERA_SEGUNDOS}s aguanta ' + vistas + ' fichas seguidas.');
}
if ((s.mil_raras || 0) > vistas * 0.1) {
  console.log('  OJO: mas del 10% sin clasificar. Ahi esta la firma del anuncio');
  console.log('  caducado; mirar esas URLs y añadir su deteccion al veredicto.');
}

const n = v => String(Number(v) || 0);
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('milanuncios', NOW(), " + n(vistas) + ', ' + n(s.mil_vivas) + ', '
  + n(s.mil_bajas) + ', ' + n(s.mil_raras) + ', ' + n(s.mil_fallos) + ', '
  + (s.mil_bloqueo ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS})';

return [{ json: {
  sql: sql,
  vistas: vistas, vivas: s.mil_vivas || 0, bajas: s.mil_bajas || 0,
  raras: s.mil_raras || 0, fallos: s.mil_fallos || 0, bloqueado: !!s.mil_bloqueo,
} }];`;

const condicionBooleana = (id, campo) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id, leftValue: "={{ $json." + campo + " }}", rightValue: "",
      operator: { type: "boolean", operation: "true", singleValue: true } }],
    combinator: "and",
  },
  looseTypeValidation: true,
  options: {},
});

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
  { parameters: {}, id: "mvf-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-400, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 0 0,4,8,12,16,20 * * *" }] } },
    id: "mvf-cron", name: "6 veces/día (cada 4 h)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-400, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "mvf-cola", name: "PG: Cola a verificar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-160, 300], credentials: PG_CRED },
  { parameters: { options: { reset: false } }, id: "mvf-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [60, 300] },

  { parameters: { jsCode: CODE_RESUMEN }, id: "mvf-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [300, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "mvf-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [520, 160], credentials: PG_CRED },

  { parameters: { jsCode: CODE_TOCA }, id: "mvf-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [300, 440] },
  { parameters: condicionBooleana("mvf-c-saltar", "saltar"), id: "mvf-if-toca",
    name: "IF: ¿nos han bloqueado?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [520, 440] },
  { parameters: Object.assign({ url: "={{ $json.url }}" }, {
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
        { name: "Referer", value: "https://www.milanuncios.com/" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 25000,
        redirect: { redirect: { followRedirects: true } },
      },
    }), id: "mvf-http", name: "HTTP: ¿sigue la ficha?",
    // Un fallo de RED no puede tumbar el run. `neverError` solo silencia los
    // codigos de estado; un corte de conexion revienta el nodo igual. El
    // 2026-09-07 se perdieron tres horas y 138 fichas ya verificadas por un
    // unico error en la 139. Con esto, ese fallo llega al Code como codigo 0 y
    // se clasifica como pasajero, que es lo que es.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [740, 540] },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "mvf-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [960, 540] },
  { parameters: condicionSql("mvf-c-sql"), id: "mvf-if-sql", name: "IF: ¿hay veredicto?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1180, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "mvf-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1400, 460], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "mvf-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1620, 540],
    webhookId: "c3f9a712-mil-verificar-fichas" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":    { main: [[L("PG: Cola a verificar")]] },
  "6 veces/día (cada 4 h)":  { main: [[L("PG: Cola a verificar")]] },
  "PG: Cola a verificar":    { main: [[L("Loop: oferta por oferta")]] },
  // salida 0 del bucle = terminado, salida 1 = siguiente oferta
  "Loop: oferta por oferta": { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: Resumen":           { main: [[L("PG: Apuntar el parte")]] },
  "Code: ¿toca pedirla?":    { main: [[L("IF: ¿nos han bloqueado?")]] },
  // true = saltar: vuelve al bucle sin pedir ni esperar. false = pedirla.
  "IF: ¿nos han bloqueado?": { main: [[L("Loop: oferta por oferta")], [L("HTTP: ¿sigue la ficha?")]] },
  "HTTP: ¿sigue la ficha?":  { main: [[L("Code: Veredicto")]] },
  "Code: Veredicto":         { main: [[L("IF: ¿hay veredicto?")]] },
  "IF: ¿hay veredicto?":     { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":   { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
};

const wf = {
  name: "Milanuncios – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "milanuncios-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " ofertas por ejecucion, espera de "
  + ESPERA_SEGUNDOS + "s");
console.log("  " + LOTE * 6 + " comprobaciones al dia; cada ejecucion dura ~"
  + (LOTE * ESPERA_SEGUNDOS / 3600).toFixed(1) + "h de las 4h que hay entre una y otra");
