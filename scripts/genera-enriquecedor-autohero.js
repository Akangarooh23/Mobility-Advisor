/**
 * Autohero – Enriquecer (ITV y garantía, lo que su API no da)
 *
 * El origen de n8n-workflows/autohero-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-autohero.js
 *   npm run test:autohero-enrich
 *
 * ── Por qué este enriquecedor hace tan poco ────────────────────────────────
 *
 * Porque el scraper hace casi todo. Y eso merece explicación, porque el
 * enriquecedor viejo de este portal pedía la ficha para sacar «powerCv,
 * bodyType, imagen», y ya no hace falta:
 *
 * Su API tiene un campo 'fields' que es una PROYECCIÓN -no está documentado en
 * ninguna parte; salió probando nombres uno a uno-. Pidiéndole outerColor,
 * bodyType, doorCount y seatCount, los devuelve junto a los otros 49. O sea
 * que color, carrocería, puertas y plazas salen del scraper, en las mismas 25
 * llamadas que ya hacía.
 *
 * Lo que quedaba por comprobar era si alguna cosa NO estaba en la API. Le pedí
 * doce nombres más -warranty, warrantyMonths, itv, inspectionExpiryDate, vin,
 * licensePlate, equipment...- y los rechazó todos.
 *
 * Y una sí está en la ficha: inspectionExpiryDate, la fecha de la ITV. Va
 * dentro del JSON que la página lleva incrustado:
 *
 *     \"inspectionExpiryDate\":\"2026-10-28\"
 *
 * Y en su lista de titulares están los meses de garantía: «Garantía
 * Autohero: 12 Meses». Eso es todo lo que hace este flujo. Después de la
 * primera limpieza del verificador, de 2.419 coches vivos 833 tienen la ITV y
 * 160 la garantía, así que hay hueco real que llenar; pero conviene decir lo
 * que es: dos datos, no seis.
 *
 * ── Cuidado con el peso ────────────────────────────────────────────────────
 *
 * Cada ficha son unos 690 KB, y n8n guarda en memoria la salida de cada vuelta
 * del bucle. Eso hace que la pasada se vaya frenando sola. Medido el 23-sep
 * con lotes de 150, minuto a minuto:
 *
 *     29  ->  25  ->  18 fichas/min
 *
 * Un 38 % menos en tres minutos. La pasada entera tardó 10 min 9 s para 150
 * fichas: 15,9/min de media, cuando las dos primeras vueltas iban a 30.
 *
 * Por eso el lote es de 100 y no de 300 como en los demás portales. Con 100 la
 * pasada se queda en la parte rápida de la curva -unos 5 min y medio- y el
 * total para vaciar la cola baja de 90 a unos 70 minutos. Además retiene 67 MB
 * en vez de 106, y 400 fichas serían 270 MB y tumbarían el proceso.
 *
 * ── Que la ficha sea del coche que pedimos ─────────────────────────────────
 *
 * La url de Autohero lleva el uuid dentro (/es/marca-modelo/id/<uuid>/) y el
 * trozo del nombre da igual: pedí /es/ford-fiesta/id/<uuid-de-un-BMW>/ y me
 * devolvió el BMW. Aun así se comprueba que el uuid esté en la página antes de
 * escribir nada, que es barato y en Clicars 10 de cada 30 fichas eran de otro
 * coche.
 *
 * ── Lo que NO toca ─────────────────────────────────────────────────────────
 *
 * Ni is_active ni last_seen_at: de la vida y la muerte se encarga el
 * verificador, que mira su catálogo entero.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

// 100 x ~690 KB = 67 MB retenidos por el bucle. Ver la nota de arriba.
const POR_PASADA = 100;
const FALLOS_SEGUIDOS = 15;

const CABECERAS = {
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
  ] },
};
const OPCIONES_HTTP = {
  response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
  timeout: 45000,
  redirect: { redirect: { followRedirects: true } },
};

const COLA = `-- Las de Autohero a las que les falta la fecha de la ITV.
--
-- Solo lo que damos por vivo: gastar 724 KB en un coche vendido es tirarlos.
-- Lo aprendimos en AutoScout24 España, donde la primera versión de la cola
-- traía seis coches muertos de cada seis.
--
-- enrich_tried_at es lo que impide que la cola sea siempre la misma: sin él,
-- las fichas que no traen ITV se volverían a pedir cuatro veces al día para
-- siempre. Se reintenta a los treinta días, que es más que de sobra para un
-- dato que solo cambia una vez al año.
SELECT id, url
FROM moveadvisor_market_offers
WHERE portal = 'autohero'
  AND is_active
  AND COALESCE(url, '') <> ''
  -- LA COLA LA MANDA LA ITV, NO LA GARANTÍA.
  --
  -- La garantía se sigue escribiendo cuando se lee una ficha, pero no mete a
  -- nadie en la cola. La razón: de 2.698 fichas leídas, las 2.698 dicen 12
  -- meses. No es un dato por coche, es una constante de la casa.
  --
  -- Con la garantía en la condición había 672 coches que ya tenían la ITV y
  -- entraban solo por ella: 672 páginas de 690 KB, siete pasadas y cuarenta
  -- minutos, para volver a leer el mismo número. Sin ella la cola pasa de
  -- 2.243 a 1.553.
  --
  -- Si algún día dan 24 meses en algunos coches, se verá igual: cada ficha que
  -- se pida por la ITV trae su garantía. Lo que se pierde es enterarse en los
  -- que ya no hay que volver a pedir.
  AND COALESCE(next_itv, '') = ''
  AND (enrich_tried_at IS NULL OR enrich_tried_at < NOW() - INTERVAL '30 days')
ORDER BY (enrich_tried_at IS NULL) DESC, last_seen_at DESC
LIMIT ${POR_PASADA}`;

const CODE_TOCA = `// ¿Toca pedir esta ficha?
const s = $getWorkflowStaticData('global');
if (s.ae_run !== $execution.id) {
  // Arranque de pasada. La memoria es del workflow, no de la pasada.
  for (const k of Object.keys(s)) { if (k.indexOf('ae_') === 0) delete s[k]; }
  s.ae_run = $execution.id;
  s.ae_intentos = 0;
  s.ae_leidas = 0;
  s.ae_con_itv = 0;
  s.ae_otro = 0;
  s.ae_fallos = 0;
  s.ae_seguidos = 0;
  s.ae_parado = false;
  s.ae_motivo = '';
}

const o = $input.item.json;
const id = String(o.id || '');

// Una consulta que no devuelve filas hace que n8n emita UN ITEM VACÍO. Sin
// esta salida, el HTTP se dispararía con la url en blanco.
if (!id) return [{ json: { pedir: '', id: '', url: '' } }];

if (s.ae_parado) return [{ json: { pedir: '', id: id, url: '' } }];
if (s.ae_seguidos >= ${FALLOS_SEGUIDOS}) {
  s.ae_parado = true;
  s.ae_motivo = s.ae_seguidos + ' fichas seguidas sin poder leerse';
  console.log('[ah-enrich] PARADO: ' + s.ae_motivo);
  return [{ json: { pedir: '', id: id, url: '' } }];
}

// El uuid es lo que va detrás de 'ah_'.
const uuid = id.indexOf('_') !== -1 ? id.slice(id.indexOf('_') + 1) : '';
if (uuid.length !== 36) return [{ json: { pedir: '', id: id, url: '' } }];

/*
 * LA URL SE RECONSTRUYE SI LA GUARDADA NO SIRVE.
 *
 * 1.063 de nuestras filas tienen guardada una BÚSQUEDA
 * (/es/search/?brand0=peugeot...) en vez de una ficha. El scraper las corrige,
 * pero este flujo puede tocarle a una que todavía no haya pasado por él.
 *
 * Da igual qué nombre se ponga delante del /id/: su servidor resuelve por
 * uuid. Lo comprobé con cuatro nombres distintos, incluido el de otro coche.
 */
const guardada = String(o.url || '');
const url = guardada.indexOf('/id/' + uuid) !== -1
  ? guardada
  : 'https://www.autohero.com/es/coche/id/' + uuid + '/';

s.ae_intentos = (s.ae_intentos || 0) + 1;
return [{ json: { pedir: 'si', id: id, url: url, uuid: uuid } }];`;

const CODE_EXTRAER = `// Sacar de la ficha la ITV y los meses de garantía.
const s = $getWorkflowStaticData('global');
const pedida = $('Code: ¿toca pedirla?').item.json;
const id = String(pedida.id || '');
const uuid = String(pedida.uuid || '');

const res = $input.item.json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no
// en 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const html = typeof res === 'string' ? res : String(res.data || res.body || '');
const codigo = Number((res || {}).statusCode || 0);

function esc(v) {
  if (v === null || v === undefined || v === '') return null;
  return "'" + String(v).replace(/'/g, "''") + "'";
}
// Marcar el intento SIEMPRE, salga bien o mal: si no, la misma ficha sin ITV
// vuelve a la cola cuatro veces al día para siempre.
const soloIntento = { json: { sql: 'UPDATE moveadvisor_market_offers'
  + ' SET enrich_tried_at = NOW() WHERE id = ' + esc(id), itv: '', id: id } };

if (codigo !== 200 || !html) {
  s.ae_fallos = (s.ae_fallos || 0) + 1;
  s.ae_seguidos = (s.ae_seguidos || 0) + 1;
  return [soloIntento];
}

// ¿Es la ficha de este coche? El uuid tiene que estar en la página.
if (uuid && html.indexOf(uuid) === -1) {
  s.ae_otro = (s.ae_otro || 0) + 1;
  s.ae_seguidos = 0;   // contestó bien; no es la puerta cerrada
  console.log('[ah-enrich] ' + id + ': la ficha no es de este coche');
  return [soloIntento];
}
s.ae_seguidos = 0;
s.ae_leidas = (s.ae_leidas || 0) + 1;

/*
 * LA FECHA, SIN EXPRESIONES REGULARES.
 *
 * Este código viaja dentro de una cadena y dentro de un JSON, y por el camino
 * las barras se pierden. Ha pasado seis veces hoy.
 *
 * Se busca un AAAA-MM-DD mirando carácter a carácter. Y se salta la clave de
 * traducción: la página lleva un diccionario donde
 * "carDetails.features.list.inspectionExpiryDate" vale "ITV válida hasta",
 * que es la etiqueta, no la fecha. En OcasionPlus me creí dos veces que una
 * ficha «no tenía datos» porque estaba leyendo justo eso.
 */
function esDigito(ch) { return ch >= '0' && ch <= '9'; }
function fechaEn(t, desde) {
  for (let k = desde; k < t.length - 9; k++) {
    if (!esDigito(t.charAt(k))) continue;
    if (!esDigito(t.charAt(k + 1)) || !esDigito(t.charAt(k + 2)) || !esDigito(t.charAt(k + 3))) continue;
    if (t.charAt(k + 4) !== '-') continue;
    if (!esDigito(t.charAt(k + 5)) || !esDigito(t.charAt(k + 6))) continue;
    if (t.charAt(k + 7) !== '-') continue;
    if (!esDigito(t.charAt(k + 8)) || !esDigito(t.charAt(k + 9))) continue;
    return t.slice(k, k + 10);
  }
  return '';
}

const marca = 'inspectionExpiryDate';
let itv = '';
let i = 0;
for (;;) {
  const j = html.indexOf(marca, i);
  if (j === -1) break;
  i = j + marca.length;
  const antes = html.slice(Math.max(0, j - 40), j);
  // Las claves del diccionario de traducción empiezan por 'carDetails.' o
  // 'search.'. Esas no llevan fecha, llevan el texto de la etiqueta.
  if (antes.indexOf('carDetails.') !== -1 || antes.indexOf('search.') !== -1) continue;
  const f = fechaEn(html.slice(i, i + 40), 0);
  if (!f) continue;
  const anio = Number(f.slice(0, 4));
  // Una ITV con año 1998 o 2190 no es una ITV, es otro campo que se coló.
  if (anio >= 2000 && anio <= 2060) { itv = f; break; }
}

/*
 * Y LA GARANTÍA, que apareció mirando por qué fallaba una comprobación.
 *
 * La ficha lleva una lista de titulares donde el primero es «Garantía
 * Autohero: 12 Meses». warranty_months está hoy en 180 de 3.849 filas, así que
 * es el segundo hueco de verdad que tiene este portal.
 *
 * Se exige que detrás del número venga «Mes»: sin eso, cualquier cifra suelta
 * junto a la palabra «Garantía» -un precio, un teléfono- entraría como meses.
 */
let garantia = null;
{
  const marca = 'Garantía Autohero';
  let i = 0;
  for (;;) {
    const j = html.indexOf(marca, i);
    if (j === -1) break;
    i = j + marca.length;
    /*
     * SE MIRAN TODAS LAS APARICIONES, no la primera.
     *
     * La PRIMERA es un enlace del menú de cabecera, que está en las 2.400
     * fichas y no lleva ningún número:
     *
     *     Garantía Autohero</a><a class="linkItem___OIuu_" ...
     *
     * El dato va más abajo, en su lista de titulares: «Garantía Autohero: 12
     * Meses». Quedarse con la primera es lo que hizo que la primera pasada
     * sacara la ITV de 42 fichas de 43 y la garantía de NINGUNA.
     */
    const trozo = html.slice(i, i + 30);
    let n = '';
    let k = 0;
    while (k < trozo.length && !esDigito(trozo.charAt(k))) k++;
    while (k < trozo.length && esDigito(trozo.charAt(k))) { n += trozo.charAt(k); k++; }
    if (!n) continue;
    const meses = Number(n);
    // Detrás del número tiene que poner «meses», y 12 o 24 son los plazos que
    // dan; 0 o 600 serían otra cosa que se ha colado.
    if (meses >= 1 && meses <= 60 && trozo.slice(k, k + 12).toLowerCase().indexOf('mes') !== -1) {
      garantia = meses;
      break;
    }
  }
}

const sets = [];
if (itv) sets.push('next_itv = ' + esc(itv));
if (garantia !== null) sets.push('warranty_months = ' + garantia);
if (!sets.length) return [soloIntento];

if (itv) s.ae_con_itv = (s.ae_con_itv || 0) + 1;
if (garantia !== null) s.ae_con_garantia = (s.ae_con_garantia || 0) + 1;
sets.push('enrich_tried_at = NOW()', 'updated_at = NOW()');
return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  itv: itv,
  garantia: garantia,
  id: id,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.ae_leidas || 0;

console.log('[ah-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.ae_intentos || 0));
console.log('  leídas         : ' + leidas);
console.log('  con fecha de ITV: ' + (s.ae_con_itv || 0));
console.log('  con garantía    : ' + (s.ae_con_garantia || 0));
console.log('  era otro coche : ' + (s.ae_otro || 0));
console.log('  sin poder leer : ' + (s.ae_fallos || 0));
if (s.ae_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.ae_motivo);
// Una pasada que no lee ni una ficha no es un éxito, es una cola vacía o algo
// roto. En Gamboa eso pasó tres días seguidos sin que lo dijera nadie.
if (!s.ae_parado && (s.ae_intentos || 0) > 0 && leidas === 0) {
  console.log('  OJO: ni una ficha leída. O el portal ha cambiado, o nos han cerrado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='autohero-enrich':
//     checked  fichas pedidas   alive  leídas
//     deactivated  las que traían ITV   unclassified  era otro coche
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('autohero-enrich', NOW(), " + n(s.ae_intentos) + ', ' + n(leidas) + ', '
  + n(s.ae_con_itv) + ', ' + n(s.ae_otro) + ', ' + n(s.ae_fallos) + ', '
  + (s.ae_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.ae_intentos || 0, leidas: leidas,
  conItv: s.ae_con_itv || 0, eraOtro: s.ae_otro || 0, fallos: s.ae_fallos || 0,
  parado: !!s.ae_parado, motivo: s.ae_motivo || '' };
for (const k of Object.keys(s)) { if (k.indexOf('ae_') === 0) delete s[k]; }
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
// 4 veces al día, en huecos libres. 100 fichas por pasada = 400 al día.
const CRON = "4 veces/día (11:30, 15:30, 18:30 y 22:30)";
const nodos = [
  { parameters: {}, id: "ae-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-660, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 30 11,15,18,22 * * *" }] } },
    id: "ae-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-660, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ae-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-460, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "ae-loop", name: "Loop: coche por coche",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-240, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "ae-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [0, 420] },
  { parameters: condicion("ae-c-pedir", "pedir"), id: "ae-if-pedir",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [220, 420] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "ae-http", name: "HTTP: Ficha de Autohero",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [440, 500] },
  { parameters: { jsCode: CODE_EXTRAER }, id: "ae-extraer",
    name: "Code: Extraer la ITV y la garantía",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [660, 500] },
  { parameters: condicion("ae-c-sql", "sql"), id: "ae-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [880, 500] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ae-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1100, 580],
    credentials: PG_CRED, ...REINTENTA },
  // La unidad hay que escribirla: n8n borra los valores por defecto al
  // importar, y la unidad por defecto del Wait son HORAS. Con «amount: 1» a
  // secas, el enriquecedor de CanalCar hizo UNA ficha y se quedó esperando
  // sesenta minutos a la siguiente, en verde y sin decir nada.
  { parameters: { amount: 1, unit: "seconds" }, id: "ae-esperar", name: "Esperar 1s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1320, 580],
    webhookId: "ae-esperar-autohero" },
  { parameters: { jsCode: CODE_RESUMEN }, id: "ae-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [0, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ae-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [220, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":   { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                   { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":  { main: [[L("Loop: coche por coche")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada coche.
  "Loop: coche por coche":  { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":   { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de Autohero")], [L("Loop: coche por coche")]] },
  "HTTP: Ficha de Autohero": { main: [[L("Code: Extraer la ITV y la garantía")]] },
  "Code: Extraer la ITV y la garantía": { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: coche por coche")]] },
  "PG: Actualizar oferta":  { main: [[L("Esperar 1s")]] },
  "Esperar 1s":             { main: [[L("Loop: coche por coche")]] },
  "Code: Resumen":          { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Autohero – Enriquecer (ITV y garantía)",
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

const destino = path.join(RAIZ, "n8n-workflows", "autohero-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día, " + POR_PASADA + " fichas por pasada");
console.log("  ITV y garantía: color, carrocería, puertas y plazas ya los trae el scraper");
