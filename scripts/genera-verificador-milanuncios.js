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
 * 3.594 ofertas activas. Con LOTE=620 y 6 ejecuciones al dia salen 3.720
 * comprobaciones diarias: todas, cada dia, con 126 de margen.
 *
 * El lote empezo en 560 para las 3.348 que habia al dimensionarlo. El scraper
 * metio 246 en una noche y el ciclo paso de un dia a 1,07 sin dar ningun error:
 * simplemente dejo de ser verdad que se repasaba todo cada dia. Es la tercera
 * vez que pasa lo mismo -Wallapop dos veces-, asi que conviene decirlo claro:
 * este numero caduca solo, y hay que rehacerlo cada vez que el catalogo crezca.
 *
 * Cada ejecucion tarda 620 x 20,8s = 3h35m medidos, y las ejecuciones van cada
 * 4 horas: quedan 25 minutos de holgura. Ese margen es lo que NO se puede tocar
 * sin pensar, porque dos ejecuciones solapadas doblan el ritmo contra el portal.
 * Si hace falta mas capacidad, lo que se baja es la espera, no lo que se sube es
 * el lote.
 *
 * ── El limite de fondo ─────────────────────────────────────────────────────
 *
 * A 20 segundos por ficha, repasar las 3.594 activas ocupa 20,8 de las 24 horas
 * del dia pidiendo sin parar. O sea que esto esta al borde de lo posible, no
 * comodo: cualquier crecimiento del catalogo lo rompe otra vez.
 *
 * La unica salida de verdad es bajar la espera -a 10 segundos serian 10,8 horas
 * y sitio para que el catalogo doble-, y para eso hace falta saber cuanto
 * aguanta el portal. Eso es lo que mide el parte.
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

const LOTE = 620;              // ofertas por ejecucion
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

s.mil_vistas = (s.mil_vistas || 0) + 1;

// ── 2. Ya no existe ─────────────────────────────────────────────────────────
if (codigo === 404 || codigo === 410) {
  s.mil_bajas = (s.mil_bajas || 0) + 1;
  console.log('[mil-verificar] BAJA ' + id + ' (HTTP ' + codigo + ')');
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET is_active = false,'
       + ' last_checked_at = NOW(), updated_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'baja',
  } }];
}

// ── 3. Fallo pasajero ───────────────────────────────────────────────────────
// Un 500 o un timeout no dicen nada de la oferta. Se mueve last_checked_at para
// que la cola siga girando y no se atasque en esta, pero no se toca is_active
// ni last_seen_at: no la hemos visto.
if (codigo === 0 || codigo >= 500) {
  s.mil_fallos = (s.mil_fallos || 0) + 1;
  console.log('[mil-verificar] fallo pasajero en ' + id + ' (HTTP ' + codigo + ')');
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'pasajero',
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
