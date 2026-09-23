/**
 * Importación – Comprobar daños (DE)
 *
 * POR QUE EXISTE ESTE WORKFLOW
 *
 * Desde el 2026-09-10 el escaparate de importación no publica nada sin saber si
 * está dañado: la regla es «is_damaged IS NOT NULL AND is_damaged = FALSE».
 * Vino de un Range Rover Sport que salió publicado diciendo en su propia ficha
 * «Dañado, No apto para circular».
 *
 * El dato lo saca el enriquecedor al pasar por la ficha, pero su cola va por
 * «enrich_tried_at IS NULL» y con 208.000 pendientes tarda meses. El 2026-09-13:
 *
 *     1.647 candidatas con buen margen y sin saber si están dañadas
 *       1.335 nunca han pasado por la ficha
 *         312 pasaron y no dieron el dato  <- el enriquecedor no vuelve NUNCA
 *
 * Esas 312 son el agujero: la ficha murió con un 410, o el JSON no traía
 * damageConditions, y como enrich_tried_at ya está puesto nadie las mira otra
 * vez. Se quedan sin publicar para siempre siendo buenas ofertas.
 *
 * Este workflow tiene su propia cola, su propia marca (damage_checked_at) y
 * mira SOLO lo que importa: lo que el escaparate publicaría y lo que ya tiene
 * publicado. No son 208.000 ofertas, son unas 1.600 y luego un goteo.
 *
 * SOLO PARA ALEMANIA, y a propósito. El 2026-09-13, de 530.000 anuncios
 * españoles activos, los que se declaran dañados son CERO: ningún portal
 * español trae el dato, ni en el título ni estructurado. El único que lo
 * parecía era Modrive con 1.295, y era su propio texto diciendo lo contrario:
 * «Certificado de no siniestralidad (CARFAX)». Además el mercado español no se
 * publica, solo sirve de comparable: un dañado ahí abarata la mediana española
 * y nos hace publicar menos, no publicar basura.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
// Escribir oferta a oferta aguanta más: el 2026-09-13 el verificador alemán
// murió con «Connection terminated unexpectedly» teniendo 3 intentos de 5 s.
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };

const LOTE = 500;
const ESPERA_SEGUNDOS = 1;
// El cortacircuitos: si AutoScout24 nos bloquea, TODAS las fichas vuelven sin
// dato. Sin freno gastaríamos las 500 de la pasada y, peor, les pondríamos la
// marca de «ya mirada», retrasándolas tres días. Con freno paramos a las 30.
const MINIMO_PARA_JUZGAR = 30;
const TOPE_SIN_DATO = 0.5;
/*
 * Y el otro freno: dar de baja media cola no es que Alemania haya vendido su
 * parque móvil.
 *
 * Un 404 se toma por «ese coche ya no está» y desactiva la oferta. Pero si
 * AutoScout24 cambia el formato de la URL de ficha —ya pasó con .es y .de— o
 * un servidor suyo empieza a contestar 404, esta pasada desactivaría las 500
 * de golpe, dos veces al día, y las publicadas saldrían del escaparate. El
 * verificador del mismo portal tiene este freno desde entonces; aquí faltaba.
 */
const TOPE_BAJAS = 0.6;

// ── la cola ────────────────────────────────────────────────────────────────
const COLA = `-- Solo lo que decide algo hoy: lo publicado y lo publicable.
--
-- Orden:
--   1. lo que YA está en el escaparate. Un anuncio se puede editar para
--      declarar el daño después; ahí es donde más duele no enterarse.
--   2. las candidatas, por ahorro. Si la pasada no llega a todas, que se
--      queden fuera las que menos se echan de menos.
--
-- El umbral de aquí (comparables, horquilla de precio y 6.000 € de ahorro) es
-- a propósito más ancho que la regla de publicación del scoring: comprobar de
-- más cuesta una ficha; comprobar de menos deja una oferta buena sin publicar.
SELECT id, url, import_published
FROM moveadvisor_market_offers
WHERE portal = 'autoscout24'
  AND country = 'DE'
  AND is_active
  AND COALESCE(url, '') <> ''
  -- Se reintenta a los 3 días: recupera las caídas pasajeras sin repetir en
  -- cada pasada las fichas que de verdad no traen el dato.
  AND (damage_checked_at IS NULL OR damage_checked_at < NOW() - INTERVAL '3 days')
  AND (
    import_published
    OR (
      is_damaged IS NULL
      AND price BETWEEN 4000 AND 100000
      AND import_comps >= 15
      AND market_price_es IS NOT NULL
      AND market_price_es - price >= 6000
    )
  )
ORDER BY import_published DESC, (market_price_es - price) DESC NULLS LAST
LIMIT ${LOTE}`;

// ── ¿toca pedirla, o nos hemos parado? ─────────────────────────────────────
const CODE_TOCA = `// El cortacircuitos, antes de gastar la ficha.
const s = $getWorkflowStaticData('global');
const oferta = $input.first().json;

if (s.dd_parado) return [{ json: { saltar: true, url: '', id: oferta.id } }];

const pedidas = s.dd_pedidas || 0;
const sinDato = s.dd_sin_dato || 0;
const vendidas = s.dd_vendidas || 0;

// Las vendidas no cuentan para juzgar si nos bloquean: contestaron, y lo que
// contestaron es «este coche ya no está». Metiéndolas en el denominador, una
// pasada con la mitad vendidas y la mitad bloqueadas no llegaba nunca al tope
// y se gastaba entera marcando fichas que nadie pudo leer.
const leidas = pedidas - vendidas;
if (leidas >= ${MINIMO_PARA_JUZGAR} && sinDato / leidas > ${TOPE_SIN_DATO}) {
  s.dd_parado = true;
  s.dd_motivo = sinDato + ' de ' + leidas + ' fichas sin dato: parece bloqueo';
  console.log('[danos-de] PARADO: ' + s.dd_motivo);
  return [{ json: { saltar: true, url: '', id: oferta.id } }];
}

// Y si lo que pasa es que casi todas «ya no están», tampoco se sigue: eso no
// es que Alemania haya vendido su parque móvil, es que ha cambiado algo.
if (pedidas >= ${MINIMO_PARA_JUZGAR} && vendidas / pedidas > ${TOPE_BAJAS}) {
  s.dd_parado = true;
  s.dd_motivo = vendidas + ' de ' + pedidas + ' fichas dadas por vendidas: parece un cambio del portal';
  console.log('[danos-de] PARADO: ' + s.dd_motivo);
  return [{ json: { saltar: true, url: '', id: oferta.id } }];
}
return [{ json: { saltar: false, url: oferta.url, id: oferta.id,
  publicada: !!oferta.import_published } }];`;

// ── de la ficha a las columnas ─────────────────────────────────────────────
const CODE = `// AutoScout24 DE - solo el bloque de daños y el de precio.
//
// Es la misma lectura que hace el enriquecedor, a propósito: si un día cambia
// el JSON de AutoScout24, los dos se rompen igual y el test lo dice.
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no
// en 'body'. Mirar solo 'body' fue lo que dejó 4.484 ofertas sin clasificar.
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const id = String(oferta.id || '');
const s = $getWorkflowStaticData('global');
s.dd_pedidas = (s.dd_pedidas || 0) + 1;

const esc = v => (v === null || v === undefined || v === '') ? 'NULL'
  : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

// La marca se mueve pase lo que pase. Sin eso, una ficha que no da el dato
// vuelve en cada pasada y la cola no avanza nunca.
const soloMarca = motivo => {
  s.dd_sin_dato = (s.dd_sin_dato || 0) + 1;
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET damage_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: motivo,
  } }];
};

if (!id) return [{ json: { sql: null, veredicto: 'sin id' } }];

// Un 410 no es un fallo: es un anuncio que ya no existe, o sea un coche
// vendido. Y son el 20% de la cola -medido el 18-sep sobre 25 fichas: 20
// doscientos con dato y 5 cuatrocientosdiez, ni un 403.
//
// Contarlos como «sin dato» hacia saltar el cortacircuitos en pasadas sanas:
// el 17-sep paro a las 131 fichas con 66 «fallos» que eran ventas. El freno
// esta para los bloqueos, y un bloqueo no devuelve 410 ficha a ficha.
//
// Ya que lo sabemos, se aprovecha: la oferta se da por muerta aqui mismo en
// vez de esperar al verificador. Respeta import_locked, como todo lo demas.
if (codigo === 410 || codigo === 404) {
  s.dd_vendidas = (s.dd_vendidas || 0) + 1;
  console.log('[danos-de] ' + id + ': vendida (HTTP ' + codigo + ')');
  return [{ json: {
    sql: 'UPDATE moveadvisor_market_offers SET damage_checked_at = NOW()'
      + ', is_active = FALSE, last_checked_at = NOW()'
      + ', import_published = CASE WHEN import_locked THEN import_published ELSE FALSE END'
      + ' WHERE id = ' + esc(id),
    veredicto: 'vendida',
  } }];
}

if (codigo !== 200 || !cuerpo) {
  s.dd_fallos = (s.dd_fallos || 0) + 1;
  console.log('[danos-de] ' + id + ': sin ficha (HTTP ' + codigo + ')');
  return soloMarca('sin ficha');
}

let raiz = null;
try {
  const m = cuerpo.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) raiz = ((JSON.parse(m[1]).props || {}).pageProps || {}).listingDetails;
} catch (e) { raiz = null; }
const v = (raiz && raiz.vehicle) ? raiz.vehicle : null;
if (!v) return soloMarca('ficha sin vehiculo');

// Un coche sin daños declarados trae la lista vacía; uno que no hemos sabido
// leer no trae la clave. NULL es "no lo sé", FALSE es "no".
const danos = Array.isArray(v.damageConditions) ? v.damageConditions.filter(Boolean) : [];
const notaDano = danos.join(', ').slice(0, 200);
const danado = ('damageConditions' in v) ? (danos.length > 0) : null;
const accidente = (typeof v.hadAccident === 'boolean') ? v.hadAccident : null;

// El IVA importa tanto como el daño: un precio neto alemán comparado contra
// precios españoles con IVA se inventa un 19% de ahorro que no existe.
const precios = (raiz && raiz.prices) || (raiz && raiz.price) || {};
const publico = precios.public || precios;
const esNeto = (typeof publico.isFinalPrice === 'boolean')
  ? (publico.isFinalPrice === false && Number(publico.netPriceRaw) > 0)
  : null;

if (danado === null && accidente === null && esNeto === null) {
  return soloMarca('ficha sin el dato');
}

const sets = ['damage_checked_at = NOW()'];
if (danado !== null) sets.push('is_damaged = ' + (danado ? 'TRUE' : 'FALSE'));
if (accidente !== null) sets.push('had_accident = ' + (accidente ? 'TRUE' : 'FALSE'));
if (notaDano) sets.push('damage_note = ' + esc(notaDano));
if (esNeto !== null) sets.push('price_is_net = ' + (esNeto ? 'TRUE' : 'FALSE'));

// Si está publicado y resulta que está dañado o su precio es neto, se retira
// AQUÍ, sin esperar al scoring de mañana. Un día de más en el escaparate es un
// día en que alguien puede llamar por un coche que no le vamos a vender.
// Respeta import_locked porque el scoring también lo respeta: si una persona ha
// decidido a mano que esa oferta va, no se la quitamos por la espalda.
const retirar = (danado === true) || (esNeto === true);
if (retirar && oferta.publicada) {
  sets.push('import_published = CASE WHEN import_locked THEN import_published ELSE FALSE END');
}

// updated_at NO se toca: es lo que ordena el escaparate, y moverlo subiría a
// los primeros puestos justo a los coches que acabamos de mirar.
if (danado === true) s.dd_danados = (s.dd_danados || 0) + 1;
else if (danado === false) s.dd_sanos = (s.dd_sanos || 0) + 1;
if (esNeto === true) s.dd_netos = (s.dd_netos || 0) + 1;
if (retirar && oferta.publicada) s.dd_retiradas = (s.dd_retiradas || 0) + 1;

console.log('[danos-de] ' + id + ': '
  + (danado === null ? 'dano desconocido' : (danado ? 'DANADO (' + notaDano + ')' : 'sano'))
  + (accidente ? ' accidentado' : '')
  + (esNeto ? ' PRECIO-NETO' : '')
  + (retirar && oferta.publicada ? ' -> RETIRADA DEL ESCAPARATE' : ''));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: danado === null ? 'sin dato de dano' : (danado ? 'danado' : 'sano'),
  danado: danado, accidente: accidente, precioNeto: esNeto, notaDano: notaDano,
  retirada: retirar && oferta.publicada,
} }];`;

// ── el parte ───────────────────────────────────────────────────────────────
const CODE_RESUMEN = `// El parte de la pasada, a moveadvisor_verify_runs.
//
// Se reaprovecha la tabla de los verificadores con portal='danos-de'. Las
// columnas no significan aquí lo mismo, y conviene saberlo:
//     checked      fichas miradas
//     alive        salieron sanas
//     deactivated  salieron DANADAS
//     unclassified la ficha no traía el dato
//     transient    la ficha ni siquiera respondió
const s = $getWorkflowStaticData('global');
const pedidas = s.dd_pedidas || 0;

console.log('[danos-de] ── resumen ──');
console.log('  fichas miradas   : ' + pedidas);
console.log('  sanas            : ' + (s.dd_sanos || 0));
console.log('  DANADAS          : ' + (s.dd_danados || 0));
console.log('  precio neto (IVA): ' + (s.dd_netos || 0));
console.log('  retiradas del escaparate: ' + (s.dd_retiradas || 0));
console.log('  sin el dato      : ' + (s.dd_sin_dato || 0));
// Las vendidas van aparte a proposito: son la mayoria de lo que antes contaba
// como fallo, y verlas mezcladas hacia parecer que el portal nos bloqueaba.
console.log('  vendidas (410)   : ' + (s.dd_vendidas || 0));
console.log('  fichas caidas    : ' + (s.dd_fallos || 0));
if (s.dd_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.dd_motivo);
// Una pasada que no mira ni una ficha no es un éxito, es una cola vacía o una
// consulta rota. En Gamboa eso pasó tres días seguidos sin que lo dijera nadie.
if (!s.dd_parado && pedidas === 0) {
  console.log('  OJO: no se ha mirado NI UNA ficha. O no hay cola, o algo falla.');
}

const n = v => String(Number(v) || 0);
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('danos-de', NOW(), " + n(pedidas) + ', ' + n(s.dd_sanos) + ', '
  + n(s.dd_danados) + ', ' + n(s.dd_sin_dato) + ', ' + n(s.dd_fallos) + ', '
  + (s.dd_parado ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS})';

// La memoria es del workflow, no de la pasada: sin limpiarla, el cortacircuitos
// de hoy seguiría parado mañana.
const parte = { sql: sql, miradas: pedidas, sanos: s.dd_sanos || 0,
  danados: s.dd_danados || 0, netos: s.dd_netos || 0,
  retiradas: s.dd_retiradas || 0, sinDato: s.dd_sin_dato || 0,
  fallos: s.dd_fallos || 0, parado: !!s.dd_parado };
for (const k of Object.keys(s)) { if (k.indexOf('dd_') === 0) delete s[k]; }
return [{ json: parte }];`;

// ── los nodos ──────────────────────────────────────────────────────────────
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

const nodos = [
  { parameters: {}, id: "dd-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  // A las 11:05 y a las 18:05, que son huecos libres de verdad: el scraper
  // alemán ocupa de 8:15 a 11:00 y de 20:15 a 23:00, el verificador alemán de
  // 11:40 a 12:35, y el scoring de 13:10 a 13:23. La de la mañana va ANTES del
  // scoring a propósito: lo que se compruebe a las 11 se publica ese mismo día.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 5 11,18 * * *" }] } },
    id: "dd-cron", name: "2 veces/día (11:05 y 18:05)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "dd-cola", name: "PG: Cola a comprobar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "dd-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "dd-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  // Una cola vacía llega como UN ITEM VACÍO, no como "nada". Sin este IF ese
  // item recorre el bucle y revienta el HTTP con "URL parameter must be a
  // string, got undefined", que es como cayeron los dos de Gamboa el 2026-09-07.
  // El cortacircuitos sale por aquí también: al pararse deja la url vacía.
  { parameters: condicion("dd-c-url", "url"), id: "dd-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [340, 420] },
  { parameters: {
      url: "={{ $json.url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ]},
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 25000,
        redirect: { redirect: { followRedirects: true } },
      },
    }, id: "dd-http", name: "HTTP: Ficha de AutoScout24",
    // neverError solo calla los códigos HTTP; un corte de red seguiría matando
    // el nodo y con él la pasada entera.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "dd-code", name: "Code: ¿está dañado?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("dd-c-sql", "sql"), id: "dd-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "dd-pg", name: "PG: Guardar el veredicto",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "dd-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1440, 540],
    webhookId: "b2e47d61-danos-de" },
  { parameters: { jsCode: CODE_RESUMEN }, id: "dd-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "dd-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":        { main: [[L("PG: Cola a comprobar")]] },
  "2 veces/día (11:05 y 18:05)": { main: [[L("PG: Cola a comprobar")]] },
  "PG: Cola a comprobar":        { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":     { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":        { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?":   { main: [[L("HTTP: Ficha de AutoScout24")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de AutoScout24":  { main: [[L("Code: ¿está dañado?")]] },
  "Code: ¿está dañado?":         { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?":  { main: [[L("PG: Guardar el veredicto")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Guardar el veredicto":    { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":               { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Importación – Comprobar daños (DE)",
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

const destino = path.join(RAIZ, "n8n-workflows", "importacion-danos-de.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, 2 pasadas/día = "
  + (LOTE * 2).toLocaleString("es") + " al día");
console.log("  cortacircuitos: para si más del " + (TOPE_SIN_DATO * 100)
  + "% de las fichas leídas viene sin dato, o más del " + (TOPE_BAJAS * 100)
  + "% se da por vendida, tras " + MINIMO_PARA_JUZGAR);
