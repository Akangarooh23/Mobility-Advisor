/**
 * El origen de n8n-workflows/autoscout24-de-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-as24-de.js
 *   npm run test:as24-de-enrich
 *
 * ── Qué falta, y para qué sirve ────────────────────────────────────────────
 *
 * De las 138.577 ofertas alemanas activas, el scraper deja llenas url, precio,
 * año, km, combustible, potencia y color. Lo que falta, y a cuántas les falta:
 *
 *     doors                  4 / 138.577
 *     seats                  4
 *     co2                    4
 *     consumption            4
 *     traction              20
 *     displacement         239
 *     body_type            421
 *
 * No son campos de adorno. El scoring de importación -que es para lo que existe
 * el dato alemán- usa CO2 nueve veces, cilindrada nueve y carrocería cinco: el
 * impuesto de matriculación español va por gramos de CO2, así que sin ese dato
 * no se puede calcular lo que cuesta traer un coche de Alemania.
 *
 * ── De dónde sale ──────────────────────────────────────────────────────────
 *
 * Todo del mismo sitio: `__NEXT_DATA__.props.pageProps.listingDetails.vehicle`.
 * Nada de raspar HTML.
 *
 *     body_type      vehicle.bodyType                     "Familiar"
 *     doors          vehicle.numberOfDoors                4
 *     seats          vehicle.numberOfSeats                5
 *     displacement   vehicle.rawDisplacementInCCM         2299
 *     co2            vehicle.wltp.co2EmissionsCombinedWithFallback.raw   177
 *     consumption    vehicle.wltp.consumptionCombinedWithFallback.raw   7.1
 *
 * El CO2 hay que buscarlo en varios sitios por orden. La ruta wltp la traen
 * 10 de cada 10 fichas recientes; la de primer nivel, solo 1 de cada 6. Ver
 * el comentario del nodo.
 *     traction       vehicle.driveTrain                   "Tracción delantera"
 *
 * La cilindrada se pide igual aunque el listado ya la traiga: el scraper la
 * coge de ahí a partir de ahora, pero las 138.000 que ya están guardadas no la
 * tienen y esta es la vía para rellenarlas.
 *
 * ── Lo que NO se rellena, y por qué ────────────────────────────────────────
 *
 * `environmental_label`. AutoScout24 da la norma europea -«Euro 6», en
 * `vehicle.environmentEuDirective.formatted`- y esa columna guarda la etiqueta
 * de la DGT: C, ECO, B, 0 Emisiones. Son cosas distintas. Meter «Euro 6» ahí
 * habría contaminado 138.000 filas con un valor que ningún filtro entiende, y
 * encima parecería que el campo está relleno. La etiqueta la deriva el workflow
 * «Universal – Derivar», que sabe traducir de norma y motorización a etiqueta.
 *
 * `warranty_months`: la ficha trae `warranty: null` y `warrantyExists: false`.
 * No lo declara.
 *
 * `next_itv`: existe -`vehicle.nextVehicleSafetyInspection`- pero es la HU
 * alemana, no la ITV española. Un coche importado empieza su ciclo de ITV aquí.
 *
 * ── El ritmo, y por qué es el que es ───────────────────────────────────────
 *
 * Una ficha alemana pesa 350 KB y n8n acumula en memoria la salida de cada
 * vuelta del bucle. A 400 por pasada son 140 MB, que es el mismo orden que
 * aguanta el enriquecedor de VIAN (200 fichas de 653 KB). Subir de ahí es
 * pedirle al proceso que se caiga a mitad de pasada.
 *
 * Eso da 2.000 al día, o sea que las 138.577 tardarían más de dos meses en
 * entrar. Por eso la cola va por ORDEN DE UTILIDAD y no por antigüedad: primero
 * las que el scoring ya ha marcado como candidatas a importar, y después las más
 * recientes. Los datos que saca no cambian nunca en la vida de un anuncio, así
 * que cada oferta se enriquece UNA vez y no vuelve.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// Los nodos de Postgres reintentan: esta base corta conexiones y un corte no
// puede tirar una pasada de 400 fichas.
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };

const LOTE = 400;
const ESPERA_SEGUNDOS = 1;

const COLA = `-- Las ofertas alemanas a las que les falta pasar por la ficha.
--
-- Por orden de UTILIDAD, no de antiguedad. Con 138.577 pendientes y 2.000 al
-- dia, el orden decide que se rellena esta semana y que dentro de dos meses:
--
--   1. las que el scoring ya ha marcado como candidatas a importar, que son
--      las unicas sobre las que alguien va a tomar una decision
--   2. despues las mas recientes, que son las que siguen a la venta
--
-- Lo que saca este workflow -puertas, plazas, carroceria, cilindrada, CO2- no
-- cambia nunca en la vida de un anuncio. Cada oferta pasa UNA vez y no vuelve:
-- por eso no hay ventana de refresco como en los otros enriquecedores.
SELECT id, url
FROM moveadvisor_market_offers
WHERE portal = 'autoscout24'
  AND country = 'DE'
  AND is_active
  AND COALESCE(url, '') <> ''
  AND enrich_tried_at IS NULL
ORDER BY import_score DESC NULLS LAST, scraped_at DESC
LIMIT ${LOTE}`;

const CODE = `// AutoScout24 DE - de la ficha a las columnas.
const oferta = $('Loop: oferta por oferta').item.json;
const res = $input.first().json;
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const id = String(oferta.id || '');

const esc = v => (v === null || v === undefined || v === '') ? 'NULL'
  : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

// enrich_tried_at se mueve pase lo que pase: sin eso, una ficha que falla se
// reintenta en cada pasada y atasca la cola para siempre.
const soloIntento = () => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(id),
  veredicto: 'sin datos',
} }];

if (!id) return [{ json: { sql: null } }];
if (codigo !== 200 || !cuerpo) {
  console.log('[as24-de-enrich] ' + id + ': sin ficha (HTTP ' + codigo + ')');
  return soloIntento();
}

// ── el JSON de la pagina ───────────────────────────────────────────────────
// Se guardan los dos niveles: 'raiz' es listingDetails, donde vive el bloque de
// precios, y 'v' es el vehiculo. El precio hace falta para saber si el anunciado
// lleva IVA o es neto.
let raiz = null;
try {
  const m = cuerpo.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/);
  if (m) raiz = ((JSON.parse(m[1]).props || {}).pageProps || {}).listingDetails;
} catch (e) { raiz = null; }
const v = (raiz && raiz.vehicle) ? raiz.vehicle : null;

if (!v) {
  console.log('[as24-de-enrich] ' + id + ': la ficha no trae datos de vehiculo');
  return soloIntento();
}

const entero = x => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const decimal = x => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

const carroc  = String(v.bodyType || '').trim();
const puertas = entero(v.numberOfDoors);
const plazas  = entero(v.numberOfSeats);
const cilin   = entero(v.rawDisplacementInCCM);

// ── el CO2, que es el dato que decide el impuesto ──────────────────────────
//
// Vive en varios sitios segun la ficha y hay que probarlos por orden. Medido
// sobre 10 fichas vivas el 2026-09-10:
//
//     wltp.co2EmissionsCombinedWithFallback        10 de 10
//     co2emissionInGramPerKmWithFallback            1 de 6   <- la que use al principio
//
// Empezar por la de primer nivel dejaba sin CO2 a cinco de cada seis ofertas, o
// sea sin poder calcular el impuesto de matriculacion de casi todo el catalogo.
//
// El envoltorio es {raw, formatted, isFallback}. isFallback avisa de que
// AutoScout24 lo ha estimado en vez de declararlo; se guarda igual -para el
// impuesto es lo unico que hay- pero se apunta en el log.
const primero = (...candidatos) => {
  for (const x of candidatos) {
    if (x && typeof x === 'object' && x.raw !== null && x.raw !== undefined) return x;
  }
  return {};
};
const wltp = v.wltp || {};
const extra = (Array.isArray(v.additionalFuel) ? v.additionalFuel[0] : null) || {};

const co2obj = primero(
  wltp.co2EmissionsCombinedWithFallback,
  v.co2emissionInGramPerKmWithFallback,
  extra.co2emissionInGramPerKmWithFallback);
// CERO ES UN VALOR VALIDO: un electrico emite 0 g/km, y ese 0 es justo lo que
// lo mete en el tramo del 0% del impuesto. Descartarlo por "vacio" seria
// tratarlos como si no tuvieramos el dato.
const co2raw = Number(co2obj.raw);
const co2 = Number.isFinite(co2raw) && co2raw >= 0 ? Math.round(co2raw) : null;

const consObj = primero(
  wltp.consumptionCombinedWithFallback,
  v.fuelConsumptionCombined,
  extra.consumptionCombined);
const consumo = decimal(consObj.raw);

// La traccion hay que traducirla al vocabulario de la tabla. AutoScout24 dice
// "Traccion delantera"; nosotros guardamos "Delantera", "Trasera", "Total" y
// "4x4", que es lo que entienden los filtros.
let traccion = '';
const dt = String(v.driveTrain || '').toLowerCase();
if (dt.indexOf('delanter') !== -1) traccion = 'Delantera';
else if (dt.indexOf('traser') !== -1) traccion = 'Trasera';
else if (dt.indexOf('total') !== -1 || dt.indexOf('4x4') !== -1 || dt.indexOf('integral') !== -1) traccion = 'Total';

// ── si el coche esta danado, y si el precio lleva IVA ──────────────────────
//
// Esto es lo que decide si una oferta se puede ensenar a un cliente, y no se
// puede sacar del titulo. El 2026-09-10, al abrir el escaparate por debajo de
// 12.000 EUR, entraban 1.003 ofertas alemanas. Por el titulo se detectaba un 5%
// de siniestrados y un 4% de "motor roto", pero el primero de la lista -un
// Mercedes E 300 de 2024 a 11.900- no decia nada en el titulo y su ficha si:
//
//     damageConditions : ["Danado"]
//     isFinalPrice     : false
//     netPrice         : 10.000    (el anunciado lleva 19% de IVA deducible)
//
// Lo del IVA importa tanto como el dano: un precio neto comparado contra
// precios espanoles con IVA se inventa un 19% de ahorro que no existe. Es tipico
// de furgonetas y vehiculos comerciales, que es justo lo que llenaba esa franja.
const danos = Array.isArray(v.damageConditions) ? v.damageConditions.filter(Boolean) : [];
const notaDano = danos.join(', ').slice(0, 200);
// Un coche sin danos declarados trae la lista vacia; uno que no hemos sabido
// leer no trae la clave. Se distingue: null es "no lo se", false es "no".
const danado = ('damageConditions' in v) ? (danos.length > 0) : null;
const accidente = (typeof v.hadAccident === 'boolean') ? v.hadAccident : null;

const precios = (raiz && raiz.prices) || (raiz && raiz.price) || {};
const publico = precios.public || precios;
const esNeto = (typeof publico.isFinalPrice === 'boolean')
  ? (publico.isFinalPrice === false && Number(publico.netPriceRaw) > 0)
  : null;

// ── el UPDATE ──────────────────────────────────────────────────────────────
// COALESCE con NULLIF, no COALESCE a secas: hay columnas que llegan a CERO o a
// cadena vacia en vez de a NULL, y un COALESCE normal no entra nunca sobre un 0.
//
// updated_at NO se toca. Este workflow no cambia el anuncio, solo lo que
// nosotros sabemos de el.
const sets = ['enrich_tried_at = NOW()'];
const pon = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + " = COALESCE(NULLIF(" + col + ", ''), " + esc(val) + ')'); };
const ponNum = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = COALESCE(NULLIF(' + col + ', 0), ' + esc(val) + ')'); };

// OJO CON LOS TIPOS. No todas estas columnas son numericas, aunque lo parezcan:
//
//     doors          integer
//     seats          integer
//     consumption    numeric
//     co2            character varying   <- guarda "126", como texto
//     displacement   character varying   <- guarda "1984", como texto
//     body_type      character varying
//     traction       character varying
//
// Usar NULLIF(col, 0) sobre una varchar da "operator does not exist: character
// varying = integer" y tumba el UPDATE entero. Sobre 138.577 ofertas eso es una
// pasada que no guarda nada y falla en cada ficha.
pon('body_type', carroc);
ponNum('doors', puertas);
ponNum('seats', plazas);
ponNum('consumption', consumo);
pon('displacement', cilin === null ? '' : String(cilin));
// Ojo: co2 puede ser 0 y hay que escribirlo. String(0) es '0', que no es
// cadena vacia, asi que pon() lo acepta. Si fuera un ponNum sobre columna
// numerica, el 0 se perderia por el NULLIF.
pon('co2', co2 === null ? '' : String(co2));
pon('traction', traccion);

// Los danos y el IVA se ESCRIBEN SIEMPRE que la ficha los declare, sin COALESCE:
// son el estado del coche hoy, no un hueco que rellenar. Si un anuncio pasa de
// sano a danado -o al reves, porque lo hayan reparado-, queremos el valor nuevo.
if (danado !== null) sets.push('is_damaged = ' + (danado ? 'TRUE' : 'FALSE'));
if (accidente !== null) sets.push('had_accident = ' + (accidente ? 'TRUE' : 'FALSE'));
if (esNeto !== null) sets.push('price_is_net = ' + (esNeto ? 'TRUE' : 'FALSE'));
if (notaDano) pon('damage_note', notaDano);

// environmental_label NO se toca aqui: ver la cabecera del generador. La ficha
// da "Euro 6", que es la norma europea, y esa columna guarda la etiqueta de la
// DGT -C, ECO, B, 0 Emisiones-. Son cosas distintas.

const hayDato = sets.length > 1;

console.log('[as24-de-enrich] ' + id + ': carroceria=' + (carroc || '-')
  + ' puertas=' + (puertas || '-') + ' plazas=' + (plazas || '-')
  + ' cc=' + (cilin || '-') + ' co2=' + (co2 || '-')
  + (co2 && co2obj.isFallback ? '(estimado)' : '')
  + ' consumo=' + (consumo || '-') + ' traccion=' + (traccion || '-')
  + (danado ? ' DANADO(' + notaDano + ')' : '')
  + (esNeto ? ' PRECIO-NETO' : ''));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: hayDato ? 'enriquecida' : 'sin datos',
  co2: co2, co2Estimado: !!co2obj.isFallback, carroceria: carroc,
  puertas: puertas, plazas: plazas, cilindrada: cilin, traccion: traccion,
  danado: danado, accidente: accidente, precioNeto: esNeto, notaDano: notaDano,
} }];`;

const condicionNoVacia = (id, campo) => ({
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
  { parameters: {}, id: "de-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-380, 200] },
  // Dentro de la franja de 8:00 a 00:00, y en el minuto 25 para no pisarse con
  // nadie: el 2026-09-09 tres verificadores dispararon a la vez en punto y los
  // tres murieron con "Connection timed out" contra Postgres.
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 25 9,12,15,18,21 * * *" }] } },
    id: "de-cron", name: "5 veces/día (9:25 a 21:25)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-380, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "de-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-140, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "de-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [80, 300] },
  // Una cola vacia llega como UN ITEM VACIO, no como "nada". Sin este IF, ese
  // item recorre el bucle y revienta el nodo HTTP con "URL parameter must be a
  // string, got undefined", que es como cayeron los dos workflows de Gamboa la
  // madrugada del 2026-09-07 -y era el caso normal: no habia nada que hacer-.
  { parameters: condicionNoVacia("de-c-url", "url"), id: "de-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [300, 300] },
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
    }, id: "de-http", name: "HTTP: Ficha de AutoScout24",
    // neverError solo calla los codigos HTTP; un corte de red sigue matando el
    // nodo y con el la pasada entera.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [520, 420] },
  { parameters: { jsCode: CODE }, id: "de-code", name: "Code: Extraer de la ficha",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [740, 420] },
  { parameters: condicionNoVacia("de-c-sql", "sql"), id: "de-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [960, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "de-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1180, 340],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "de-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1400, 420],
    webhookId: "c4f81a35-as24-de-enrich" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Cola a enriquecer")]] },
  "5 veces/día (9:25 a 21:25)": { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":      { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":    { main: [[], [L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?":  { main: [[L("HTTP: Ficha de AutoScout24")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de AutoScout24": { main: [[L("Code: Extraer de la ficha")]] },
  "Code: Extraer de la ficha":  { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":      { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
};

const wf = {
  name: "AutoScout24 DE – Enriquecer (carrocería, plazas, cilindrada, CO₂, consumo)",
  nodes: nodos,
  connections: conexiones,
  settings: {
    executionOrder: "v1",
    saveManualExecutions: true,
    saveDataSuccessExecution: "all",
    saveDataErrorExecution: "all",
    callerPolicy: "workflowsFromSameOwner",
    errorWorkflow: "9BwKOPMIzjj3owho",
  },
  pinData: {},
};

const destino = path.join(RAIZ, "n8n-workflows", "autoscout24-de-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " por pasada, 5 pasadas/día = "
  + (LOTE * 5).toLocaleString("es") + " al día");
