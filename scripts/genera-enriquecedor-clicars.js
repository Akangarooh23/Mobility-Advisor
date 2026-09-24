/**
 * Clicars – Enriquecer (plazas, CO₂, consumo, etiqueta)
 *
 * El origen de n8n-workflows/clicars-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-clicars.js
 *   npm run test:clicars-enrich
 *
 * ── Qué se puede rellenar, y qué no ────────────────────────────────────────
 *
 * Medido leyendo fichas de verdad, no suponiendo. La ficha tiene una sección
 * «Datos del vehículo» y otra «Prestaciones, consumo y emisiones» con esto:
 *
 *     Nº plazas 5
 *     Etiqueta medioambiental C
 *     Consumo mixto 4.3 l/100
 *     Emisiones 99 CO2          <- de esta columna tenemos el 0 %
 *
 * En el TEXTO de la ficha no hay color, puertas, carrocería, cilindrada ni
 * combustible. Las palabras «Gasolina» y «GLP» sí aparecen, pero en la letra
 * pequeña de la garantía —«Sistema de GLP/GNC (si el vehículo lo equipa)»—, no
 * como dato del coche. Buscarlas sin mirar el contexto habría puesto
 * combustible a coches eléctricos.
 *
 * PERO SÍ ESTÁN EN EL JSON-LD, y eso se descubrió el 24-sep-2026. El mismo
 * bloque que se cogía solo para comprobar el `sku` es un Vehicle de schema.org
 * y trae en limpio:
 *
 *     fuelType        Gasolina
 *     bodyType        Furgoneta
 *     numberOfDoors   5
 *     image           la foto de verdad
 *
 * Así que ahora llena ocho columnas. Hacía falta: de las 1.400 filas vivas de
 * Clicars había 1.069 sin combustible, 1.302 sin carrocería ni puertas y 1.009
 * sin foto —y sin foto el consejero no puede enseñar la oferta, así que de
 * Clicars solo mostraba el 28 %—.
 *
 * La tarjeta del LISTADO no sirve para esto, también se miró: solo lleva el
 * cambio y un distintivo en svg, ni combustible ni puertas ni la foto.
 *
 * ── Y se pregunta por el id ────────────────────────────────────────────────
 *
 * La url guardada en 2.083 de las 2.788 filas es la página de la VERSIÓN,
 * compartida por hasta 18 coches. Preguntándole, 10 de cada 30 devolvían la
 * ficha de OTRO coche, y este workflow ESCRIBE: habría metido las plazas y el
 * CO₂ de un coche en otro. Se construye la url con el id y además se comprueba
 * el `sku` antes de escribir nada.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const REINTENTA_ESCRITURA = { retryOnFail: true, maxTries: 5, waitBetweenTries: 15000,
  onError: "continueRegularOutput" };
const ERROR_WF = "9BwKOPMIzjj3owho";

// 400 por pasada: la ficha son 215 KB, así que son unos 85 MB por pasada.
const LOTE = 400;
const SEGUNDOS_POR_OFERTA = 0.9;
const MINIMO_PARA_BLOQUEO = 50;
const TOPE_BLOQUEO = 0.3;

const COLA = `-- Las de Clicars a las que les falta algo de la ficha.
--
-- Solo lo VISTO VIVO hace poco: last_seen_at, no last_checked_at. La diferencia
-- es que la primera dice «lo vimos vivo» y la segunda solo «lo intentamos», y
-- gastar 215 KB en un coche vendido es tirarlos. Lo aprendimos en AutoScout24
-- España, donde la primera versión de la cola traía seis coches muertos de cada
-- seis.
SELECT id,
       COALESCE(seats, 0) AS seats,
       COALESCE(co2, '') AS co2,
       COALESCE(consumption, 0) AS consumption,
       COALESCE(environmental_label, '') AS environmental_label
FROM moveadvisor_market_offers
WHERE portal = 'clicars'
  AND is_active
  -- UNA SEGUNDA VUELTA, Y SOLO UNA.
  --
  -- Hasta el 24-sep-2026 aqui ponia «enrich_tried_at IS NULL» a secas, y hacia
  -- bien: sin eso, una ficha que no da un dato vuelve en cada pasada y la cola
  -- no avanza nunca.
  --
  -- Pero ese dia el enriquecedor aprendio a leer cuatro columnas mas del
  -- JSON-LD -combustible, carroceria, puertas y foto-, y 1.324 de las 1.400
  -- filas vivas ya estaban marcadas como intentadas: no habrian vuelto jamas y
  -- el cambio no habria servido de nada.
  --
  -- La fecha fija da exactamente una pasada mas a las de antes y luego vuelve a
  -- comportarse como siempre. NO se pone un intervalo movil -«hace mas de 30
  -- dias»- a proposito: eso seria repetir las mismas fichas para siempre a
  -- cambio de nada.
  AND (enrich_tried_at IS NULL OR enrich_tried_at < '2026-09-24'::date)
  AND (seats IS NULL OR seats = 0
       OR COALESCE(co2, '') = ''
       OR COALESCE(consumption, 0) = 0
       OR COALESCE(environmental_label, '') = ''
       -- Las cuatro nuevas, que si no una fila con plazas y CO2 completos
       -- pero sin foto no entraria en la cola.
       OR COALESCE(fuel, '') = ''
       OR COALESCE(body_type, '') = ''
       OR doors IS NULL OR doors = 0
       OR COALESCE(image_url, '') = '')
ORDER BY (last_seen_at > NOW() - INTERVAL '2 days') DESC, scraped_at DESC
LIMIT ${LOTE}`;

const CODE_TOCA = `// Cortacircuitos, guarda de cola vacía y la url por id.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.ce_run || s.ce_run !== $execution.id) {
  s.ce_run = $execution.id;
  s.ce_parado = false;
  s.ce_intentos = 0;
  s.ce_fallos = 0;
  s.ce_leidas = 0;
  s.ce_otro = 0;
  s.ce_motivo = '';
}

// Una cola vacía NO llega como "nada": n8n manda UN ITEM VACÍO, que recorre el
// bucle y revienta el HTTP con "URL parameter must be a string, got undefined".
// Así cayeron cuatro ejecuciones de Gamboa el 2026-09-07.
if (!item || !item.id) {
  console.log('[cl-enrich] no hay nada que enriquecer ahora mismo.');
  return [{ json: { url: '', id: '' } }];
}
if (s.ce_parado) return [{ json: { url: '', id: String(item.id) } }];

// La url se construye con el id: la guardada puede ser la de la versión, que
// comparten hasta 18 coches.
const numero = String(item.id).split('_')[1] || '';
if (!numero) return [{ json: { url: '', id: String(item.id) } }];
return [{ json: Object.assign({}, item, {
  id: String(item.id),
  url: 'https://www.clicars.com/coches-segunda-mano-ocasion/comprar-coche-' + numero,
}) }];`;

const CODE = `// Clicars - de la ficha a plazas, CO2, consumo y etiqueta.
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const id = String(oferta.id || '');
const s = $getWorkflowStaticData('global');

const esc = v => (v === null || v === undefined || v === '') ? 'NULL'
  : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

// enrich_tried_at se mueve pase lo que pase: sin eso, una ficha que falla vuelve
// en cada pasada y la cola no avanza nunca.
const soloIntento = (motivo) => [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(id),
  veredicto: motivo,
} }];

if (!id) return [{ json: { sql: null, veredicto: 'sin id' } }];
s.ce_intentos = (s.ce_intentos || 0) + 1;

// Un 403, un 429 o un 500 no dicen nada de la oferta: NO gastan su intento.
if (codigo === 0 || codigo === 403 || codigo === 429 || codigo >= 500) {
  s.ce_fallos = (s.ce_fallos || 0) + 1;
  const intentos = s.ce_intentos || 0;
  if (intentos >= ${MINIMO_PARA_BLOQUEO} && (s.ce_fallos / intentos) > ${TOPE_BLOQUEO}) {
    s.ce_parado = true;
    s.ce_motivo = Math.round(100 * s.ce_fallos / intentos) + '% de respuestas cerradas en '
      + intentos + ' intentos: nos han bloqueado';
    console.log('[cl-enrich] PARADO: ' + s.ce_motivo);
  }
  return [{ json: { sql: null, veredicto: 'pasajero' } }];
}
if (codigo !== 200 || !cuerpo) return soloIntento('sin ficha');

// El bloque JSON-LD del coche, que es el único que lleva sku.
let ld = null;
for (const trozo of cuerpo.split('application/ld+json').slice(1)) {
  const ini = trozo.indexOf('>');
  const fin = trozo.indexOf('</script>');
  if (ini === -1 || fin === -1) continue;
  let j = null;
  try { j = JSON.parse(trozo.slice(ini + 1, fin).trim()); } catch (e) { continue; }
  if (j && j.sku !== undefined) { ld = j; break; }
}
if (!ld) return soloIntento('la url ya no lleva a ningún coche');

/*
 * Que la ficha sea la de NUESTRO coche, antes de escribir nada.
 *
 * Preguntando por la url guardada, 10 de cada 30 devolvían la ficha de otro.
 * Aquí se pregunta por el id, así que no debería pasar; pero esto ESCRIBE, y
 * meterle a un coche las plazas y el CO₂ de otro no se deshace.
 */
const numero = id.split('_')[1] || '';
if (String(ld.sku) !== numero) {
  s.ce_otro = (s.ce_otro || 0) + 1;
  return soloIntento('la ficha es de otro coche (' + ld.sku + ')');
}
s.ce_leidas = (s.ce_leidas || 0) + 1;

/*
 * Los datos están en el texto de la ficha, no en el JSON-LD.
 *
 * Se quitan las etiquetas y se leen los números que van detrás de cada título.
 * Sin expresiones regulares: este código viaja dentro de una cadena y dentro de
 * un JSON, y por el camino las barras se pierden. Hoy ha pasado cuatro veces.
 */
const texto = cuerpo.split('<').join(' <').split('>').join('> ')
  .split(/<[^>]*>/).join(' ').split(/\\s+/).join(' ');

/** Los dígitos que siguen a un título, con su parte decimal si la tiene. */
const numeroTras = (titulo) => {
  const i = texto.indexOf(titulo);
  if (i === -1) return null;
  const trozo = texto.slice(i + titulo.length, i + titulo.length + 24);
  let n = '', visto = false;
  for (let k = 0; k < trozo.length; k++) {
    const ch = trozo.charAt(k);
    if (ch >= '0' && ch <= '9') { n += ch; visto = true; }
    else if ((ch === '.' || ch === ',') && visto && n.indexOf('.') === -1) n += '.';
    else if (visto) break;
  }
  if (!n || n.charAt(n.length - 1) === '.') n = n.split('.')[0];
  return n ? Number(n) : null;
};

const entre = (x, min, max) => (x !== null && x >= min && x <= max) ? x : null;

// Filtro de cordura: un 100 en plazas es basura, y guardarla es peor que no
// guardar nada.
const plazas = entre(numeroTras('Nº plazas'), 2, 9);
const consumo = entre(numeroTras('Consumo mixto'), 0.5, 30);

/*
 * El CO₂, y el 2 que no es un dato.
 *
 * La ficha escribe «Emisiones 99 CO 2» —el subíndice del CO₂ sale como un 2
 * suelto—. Cuando el coche NO trae el dato queda «Emisiones CO 2», y leer «el
 * primer número tras Emisiones» devolvía 2: un coche con 2 g/km, que es el
 * tramo más limpio de cualquier filtro. Salió en la tercera ficha que probé.
 *
 * Así que el número tiene que estar ENTRE «Emisiones» y el «CO» que va detrás.
 * Si entre los dos no hay dígitos, es que no hay dato.
 */
let co2 = null;
const iEmis = texto.indexOf('Emisiones');
if (iEmis !== -1) {
  const desde = iEmis + 9;
  const iCO = texto.indexOf('CO', desde);
  if (iCO !== -1 && iCO - desde < 20) {
    let n = '';
    for (let k = desde; k < iCO; k++) {
      const ch = texto.charAt(k);
      if (ch >= '0' && ch <= '9') n += ch;
    }
    co2 = n ? entre(Number(n), 1, 500) : null;
  }
}

/*
 * La etiqueta de la DGT: «Etiqueta medioambiental C».
 *
 * Es una letra, no un número, así que se lee el primer carácter que no sea un
 * espacio y se comprueba contra las cuatro que existen.
 */
const ETIQUETAS = { '0': '0 Emisiones', 'ECO': 'ECO', 'C': 'C', 'B': 'B' };
let etiqueta = '';
const iEtq = texto.indexOf('Etiqueta medioambiental');
if (iEtq !== -1) {
  const trozo = texto.slice(iEtq + 23, iEtq + 32).trim();
  const primera = trozo.split(' ')[0].toUpperCase();
  etiqueta = ETIQUETAS[primera] || '';
}

/*
 * Y AHORA LO QUE ESTABA EN EL JSON-LD Y NO SE LEIA.
 *
 * Arriba se coge el bloque ld solo para comprobar el sku y se dice que "los
 * datos estan en el texto de la ficha, no en el JSON-LD". Eso vale para las
 * plazas, el CO2 y el consumo, pero ese mismo bloque es un Vehicle de
 * schema.org y trae ademas, en limpio:
 *
 *     fuelType                "Gasolina"
 *     bodyType                "Furgoneta"
 *     numberOfDoors           5
 *     image                   la foto de verdad
 *
 * Y hacian falta las cuatro. De las 1.400 filas vivas de Clicars: 1.069 sin
 * combustible, 1.302 sin carroceria ni puertas y 1.009 sin foto. Sin foto el
 * consejero no la puede ensenar, asi que de Clicars solo mostraba el 28 %.
 *
 * No es que el lector estuviera roto: es que nunca se le pidio esto. El flujo
 * se llama "Enriquecer (plazas, CO2, consumo, etiqueta)" y hacia exactamente
 * esas cuatro cosas.
 *
 * Cero peticiones nuevas: la ficha ya se descarga.
 *
 * Comprobado contra una ficha real el 24-sep-2026. La tarjeta del LISTADO no
 * sirve para esto -se miro tambien-: solo lleva el cambio y un distintivo en
 * svg, ni combustible ni puertas ni la foto del coche.
 */
const COMBUSTIBLES = {
  'gasolina': 'Gasolina', 'diesel': 'Diesel', 'diésel': 'Diesel',
  'eléctrico': 'Eléctrico', 'electrico': 'Eléctrico',
  'híbrido': 'Híbrido', 'hibrido': 'Híbrido',
  'híbrido enchufable': 'Híbrido', 'hibrido enchufable': 'Híbrido',
  'glp': 'Gas', 'gnc': 'Gas',
};
const crudoFuel = String(ld.fuelType || '').trim().toLowerCase();
const combustible = COMBUSTIBLES[crudoFuel] || '';

const carroceria = String(ld.bodyType || '').trim().slice(0, 80);

let puertas = parseInt(ld.numberOfDoors, 10);
if (isNaN(puertas) || puertas < 2 || puertas > 7) puertas = null;

// ld.image puede venir como texto o como lista.
let foto = ld.image;
if (Array.isArray(foto)) foto = foto[0];
foto = String(foto || '').trim();
if (foto.indexOf('http') !== 0) foto = '';

// Todo con COALESCE: lo que ya hubiera manda. Esto rellena huecos, no corrige.
const sets = ['enrich_tried_at = NOW()'];
if (combustible) sets.push("fuel = COALESCE(NULLIF(fuel, ''), " + esc(combustible) + ')');
if (carroceria) sets.push("body_type = COALESCE(NULLIF(body_type, ''), " + esc(carroceria) + ')');
if (puertas !== null) sets.push('doors = COALESCE(NULLIF(doors, 0), ' + puertas + ')');
if (foto) sets.push("image_url = COALESCE(NULLIF(image_url, ''), " + esc(foto.slice(0, 2000)) + ')');
if (plazas !== null) sets.push('seats = COALESCE(NULLIF(seats, 0), ' + plazas + ')');
if (co2 !== null) sets.push("co2 = COALESCE(NULLIF(co2, ''), '" + co2 + "')");
if (consumo !== null) sets.push('consumption = COALESCE(NULLIF(consumption, 0), '
  + (Math.round(consumo * 100) / 100) + ')');
if (etiqueta) sets.push("environmental_label = COALESCE(NULLIF(environmental_label, ''), "
  + esc(etiqueta) + ')');

// updated_at NO se toca: enriquecer no es que el anuncio haya cambiado, es que
// nosotros nos hemos puesto al día. Y updated_at ordena el escaparate.
console.log('[cl-enrich] ' + id + ': plazas=' + (plazas === null ? '-' : plazas)
  + ' co2=' + (co2 === null ? '-' : co2) + ' consumo=' + (consumo === null ? '-' : consumo)
  + ' etiqueta=' + (etiqueta || '-')
  + ' combustible=' + (combustible || '-') + ' carroceria=' + (carroceria || '-')
  + ' puertas=' + (puertas === null ? '-' : puertas) + ' foto=' + (foto ? 'si' : '-'));

return [{ json: {
  sql: 'UPDATE moveadvisor_market_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: sets.length > 1 ? 'enriquecida' : 'sin datos nuevos',
  plazas: plazas, co2: co2, consumo: consumo, etiqueta: etiqueta,
} }];`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');
const leidas = s.ce_leidas || 0;

console.log('[cl-enrich] ── resumen ──');
console.log('  fichas pedidas : ' + (s.ce_intentos || 0));
console.log('  leídas         : ' + leidas);
console.log('  era otro coche : ' + (s.ce_otro || 0));
console.log('  sin poder leer : ' + (s.ce_fallos || 0));
if (s.ce_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.ce_motivo);
// Una pasada que no lee ni una ficha no es un éxito, es una cola vacía o algo
// roto. En Gamboa eso pasó tres días seguidos sin que lo dijera nadie.
if (!s.ce_parado && (s.ce_intentos || 0) > 0 && leidas === 0) {
  console.log('  OJO: ni una ficha leída. O el portal ha cambiado, o nos han cerrado.');
}

const n = v => String(Number(v) || 0);
// Se reaprovecha la tabla de los verificadores con portal='clicars-enrich':
//     checked  fichas pedidas   alive  leídas
//     deactivated  0            unclassified  era otro coche
//     transient  sin poder leer
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('clicars-enrich', NOW(), " + n(s.ce_intentos) + ', ' + n(leidas) + ', 0, '
  + n(s.ce_otro) + ', ' + n(s.ce_fallos) + ', ' + (s.ce_parado ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, pedidas: s.ce_intentos || 0, leidas: leidas,
  eraOtro: s.ce_otro || 0, fallos: s.ce_fallos || 0, parado: !!s.ce_parado };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('ce_') === 0) delete s[k]; }
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
// Lejos del scraper (9:35 y 21:35) y del verificador (11:50, 14:50, 17:50 y
// 22:50), que comparten dominio.
const CRON = "3 veces/día (13:05, 16:05 y 19:05)";
const nodos = [
  { parameters: {}, id: "ce-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-560, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 5 13,16,19 * * *" }] } },
    id: "ce-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-560, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ce-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-320, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { options: {} }, id: "ce-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [-100, 300] },
  { parameters: { jsCode: CODE_TOCA }, id: "ce-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 420] },
  { parameters: condicion("ce-c-url", "url"), id: "ce-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [340, 420] },
  { parameters: {
      url: "={{ $json.url }}",
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ] },
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        timeout: 30000,
        // SIGUIENDO las redirecciones, como el verificador: Clicars redirige a
        // la ficha del mismo coche para normalizar la url, y no seguirla sería
        // perder fichas que están perfectamente.
        redirect: { redirect: { followRedirects: true } },
      },
    }, id: "ce-http", name: "HTTP: Ficha de Clicars",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [560, 540] },
  { parameters: { jsCode: CODE }, id: "ce-code",
    name: "Code: Extraer plazas, CO2, consumo y etiqueta",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [780, 540] },
  { parameters: condicion("ce-c-sql", "sql"), id: "ce-if-sql",
    name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1000, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ce-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, 460],
    credentials: PG_CRED, ...REINTENTA_ESCRITURA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "ce-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [120, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ce-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [340, 160],
    credentials: PG_CRED, ...REINTENTA },
];

const NOMBRE_CODE = "Code: Extraer plazas, CO2, consumo y etiqueta";
const conexiones = {
  "Ejecutar manualmente":      { main: [[L("PG: Cola a enriquecer")]] },
  [CRON]:                      { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":     { main: [[L("Loop: oferta por oferta")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada item. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: oferta por oferta":   { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: ¿toca pedirla?":      { main: [[L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de Clicars")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de Clicars":    { main: [[L(NOMBRE_CODE)]] },
  [NOMBRE_CODE]:               { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Loop: oferta por oferta")]] },
  "PG: Actualizar oferta":     { main: [[L("Loop: oferta por oferta")]] },
  "Code: Resumen":             { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "Clicars – Enriquecer (plazas, CO₂, consumo, etiqueta)",
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

const destino = path.join(RAIZ, "n8n-workflows", "clicars-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + LOTE + " fichas por pasada, " + PASADAS
  + " pasadas/día = " + (LOTE * PASADAS).toLocaleString("es") + " al día");
console.log("  cada pasada tarda unos " + Math.round(LOTE * SEGUNDOS_POR_OFERTA / 60) + " min");
