/**
 * El origen de n8n-workflows/modrive-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-modrive.js
 *   npm run test:modrive-enrich
 *
 * ── De dónde sale cada cosa ────────────────────────────────────────────────
 *
 * Modrive publica JSON-LD y además renderiza la ficha entera en el servidor,
 * así que no hace falta tocar el payload de Nuxt -que va minificado, con los
 * valores sustituidos por variables de una letra, y que habría que evaluar como
 * código para leerlo-.
 *
 *   del JSON-LD : descripción, matrícula, carrocería, puertas
 *   del HTML    : plazas, cilindrada, equipamiento
 *
 * La matrícula viene en `identifier` y es la que el propio anuncio publica.
 * Ya la usa el stock propio (portal 'marketplace-vo'), así que la columna tiene
 * dueño y significado.
 *
 * Las plazas hay que sacarlas de la línea «Cinco plazas ( 2+3 )» del bloque de
 * equipamiento, y hay que exigir el paréntesis: sin él, la primera coincidencia
 * de /(n) plazas/ es «Asientos traseros de tres plazas», que da 3 en un coche
 * de 5 y, en el X-Trail de 7, daba 2 -«dos plazas» de una frase sobre los
 * asientos delanteros-. Se probó en tres fichas y con el paréntesis salen 5, 5
 * y 7, que es lo correcto.
 *
 * La cilindrada sale de «Motor de 1,0 litros ( 998 cc )». Ojo al separador de
 * miles: «( 1.598 cc )» son 1598, no 1.
 *
 * ── Lo que NO se rellena, y por qué ────────────────────────────────────────
 *
 * `color` no existe en la ficha. La tabla de características que enseña Modrive
 * es Kilómetros, Transmisión, Matrícula, Combustible, Fecha de matriculación,
 * Potencia, Consumo y Etiqueta. No hay color por ninguna parte, ni en el
 * JSON-LD ni en el HTML.
 *
 * `provincia` y `location` tampoco. Las provincias que aparecen en la ficha
 * -Alicante, Almería, Madrid, Murcia, Valencia- son enlaces del pie y son
 * IDÉNTICAS en las tres fichas que se compararon: es el menú de navegación, no
 * dónde está el coche. Guardarlas sería inventarse la ubicación.
 *
 * `warranty_months` tampoco. Modrive dice «Hasta 5 años de garantía» en una
 * franja de propaganda que sale en todas las fichas, y en el desglose del
 * precio pone «Garantía» sin número. No declara meses por coche.
 *
 * `price_new` tampoco: los 17.500 € del «precio al contado» son el precio de
 * ESTE coche usado, no el PVP de nuevo.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// 1.988 activas, la ficha pesa 137 KB. A 300 por pasada son 41 MB acumulados en
// memoria -VIAN aguanta 200 fichas de 653 KB, o sea 130 MB- y unos 10 minutos.
// Con 6 pasadas al día la primera barrida entera se hace en poco más de un día;
// a partir de ahí solo quedan las nuevas y el repaso a los 30 días.
const LOTE = 300;
const ESPERA_SEGUNDOS = 2;

const COLA = `-- Las ofertas de Modrive a las que les falta pasar por la ficha.
--
-- No es un ciclo diario a proposito: carroceria, puertas, plazas, cilindrada,
-- matricula y equipamiento no cambian nunca. Quien SI tiene que pasar cada dia
-- es el verificador; y el precio lo refresca el scraper cada manana.
SELECT id, source_url, brand, model
FROM moveadvisor_marketplace_vo_offers
WHERE portal = 'modrive'
  AND is_active
  AND COALESCE(source_url, '') <> ''
  AND (enrich_tried_at IS NULL
       OR enrich_tried_at < NOW() - INTERVAL '30 days')
ORDER BY enrich_tried_at ASC NULLS FIRST
LIMIT ${LOTE}`;

const CODE = `// Modrive - de la ficha a las columnas.
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
  sql: 'UPDATE moveadvisor_marketplace_vo_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(id),
  veredicto: 'sin datos',
} }];

if (!id) return [{ json: { sql: null } }];
if (codigo !== 200 || !cuerpo) {
  console.log('[modrive-enrich] ' + id + ': sin ficha (HTTP ' + codigo + ')');
  return soloIntento();
}

const limpia = s => String(s)
  .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
  .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
  .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
  .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&euro;/g, '€')
  .replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();

// ── el JSON-LD ─────────────────────────────────────────────────────────────
let v = null;
for (const m of cuerpo.matchAll(/<script[^>]*application\\/ld\\+json[^>]*>([\\s\\S]*?)<\\/script>/gi)) {
  try {
    const j = JSON.parse(m[1].trim());
    const arr = Array.isArray(j) ? j : (j['@graph'] || [j]);
    for (const o of arr) if (o && (o['@type'] === 'Vehicle' || o['@type'] === 'Car')) { v = o; break; }
  } catch (e) { /* un bloque que no parsea no es motivo para tirar la ficha */ }
  if (v) break;
}
if (!v) {
  console.log('[modrive-enrich] ' + id + ': la ficha no trae JSON-LD de vehiculo');
  return soloIntento();
}

const num = x => {
  const n = Number(String(x === null || x === undefined ? '' : x).replace(/\\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

const carroc  = String(v.bodyType || '').trim();
const puertas = num(v.numberOfDoors);

// La matricula es lo que Modrive publica en 'identifier' y en la tabla de
// caracteristicas de la ficha. Formato espanol: 4 cifras y 3 letras.
let matricula = String(v.identifier || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
if (!/^\\d{4}[A-Z]{3}$/.test(matricula)) matricula = '';

// La descripcion es el texto que escribe el concesionario que vende. Lleva
// propaganda suya, pero la primera linea describe ESTE coche -"KIA STONIC 1.0
// T-GDI MHEV IMT 74KW DRIVE 5P - Mat. 2022"- y la referencia del final es la
// suya. No es como VIAN, donde el parrafo era palabra por palabra el mismo en
// las 609 fichas.
const descripcion = String(v.description || '')
  .replace(/\\r/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();

// ── el texto plano de la ficha, sin los <script> ───────────────────────────
// El payload de Nuxt lleva dentro palabras como "plazas" y "cilindrada", pero
// son los nombres de los filtros del buscador, no los valores de este coche.
const texto = limpia(cuerpo.replace(/<script[\\s\\S]*?<\\/script>/gi, ' '));

// Plazas: "Cinco plazas ( 2+3 )". El parentesis es obligatorio, ver la cabecera.
const PALABRA = { una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9 };
let plazas = null;
const mp = texto.match(/\\b(Una|Dos|Tres|Cuatro|Cinco|Seis|Siete|Ocho|Nueve)\\s+plazas\\s*\\(/i);
if (mp) plazas = PALABRA[mp[1].toLowerCase()] || null;

// Cilindrada: "Motor de 1,0 litros ( 998 cc )" -> 998. Y "( 1.598 cc )" -> 1598.
let cilin = null;
const mc = texto.match(/Motor de [\\d,.]+ litros?\\s*\\(\\s*([\\d.]+)\\s*cc\\s*\\)/i);
if (mc) { const n = num(mc[1]); if (n && n >= 500 && n <= 8000) cilin = n; }

// ── el equipamiento ────────────────────────────────────────────────────────
// Un acordeon: <header role="tab">...<h4>GRUPO</h4></header>
//              <div class="card-body"><div class="info-item__body-text"><p>...</p>
// En las fichas miradas salen cuatro grupos -Ficha tecnica, Acabado interior,
// Multimedia y sonido, Confort- y unas 60 lineas.
const grupos = {};
let nItems = 0;
const iEq = cuerpo.indexOf('Equipamiento de este coche');
if (iEq >= 0) {
  const trozo = cuerpo.slice(iEq, iEq + 120000);
  const partes = trozo.split(/<header[^>]*role="tab"/);
  for (const p of partes.slice(1)) {
    const g = limpia((p.match(/<h4[^>]*>([\\s\\S]*?)<\\/h4>/) || [])[1] || '');
    const cg = (p.match(/info-item__body-text[^>]*>([\\s\\S]*?)<\\/div>/) || [])[1] || '';
    const ps = [];
    for (const li of cg.matchAll(/<p[^>]*>([\\s\\S]*?)<\\/p>/g)) {
      const t = limpia(li[1]);
      if (t && t.length < 800) ps.push(t);
    }
    if (g && ps.length) { grupos[g] = ps; nItems += ps.length; }
  }
}
// Mismo formato que Gamboa -grupos con nombre-, no el de VIAN, que es una lista
// plana. Modrive no publica opcionales, asi que solo hay 'serie'.
const equipo = nItems ? JSON.stringify({ serie: grupos }) : '';

// ── el UPDATE ──────────────────────────────────────────────────────────────
// COALESCE con NULLIF, no COALESCE a secas: en esta tabla hay columnas que
// llegan a CERO o a cadena vacia en vez de a NULL, y un COALESCE normal no entra
// nunca sobre un 0.
//
// ── updated_at no se toca aqui, y esto es lo importante del nodo ───────────
//
// El escaparate ordena por portal_score y, como los tres concesionarios valen
// 80, el desempate real es updated_at DESC
// (carswise-erp-backoffice apps/api/src/routes/marketplace.ts:570).
//
// Enriquecer NO es que el anuncio haya cambiado: es que nosotros nos hemos
// puesto al dia. El cliente no nota nada porque le rellenemos la carroceria, y
// sin embargo eso bastaba para poner a Modrive por delante de Gamboa y de VIAN.
// El 2026-09-09, con solo 952 de las 1.988 enriquecidas, Modrive ya ocupaba de
// la posicion 1 a la 696; al terminar las habria ocupado todas y los otros dos
// habrian empezado en la 1.989.
//
// Al principio esto llevaba un CASE que movia updated_at solo si algun campo
// cambiaba de verdad. Era mejor que sellarlo siempre, pero seguia estando mal:
// la PRIMERA pasada cambia campos por definicion -estan todos vacios-, asi que
// el CASE se cumplia en las 1.988 igual. La unica respuesta correcta es no
// tocarlo nunca.
//
// Quien mueve updated_at es el scraper, y solo cuando cambia precio,
// kilometros, titulo o version, que es lo que un cliente nota.
//
// COALESCE con NULLIF, y no COALESCE a secas: en esta tabla hay columnas que
// llegan a CERO o a cadena vacia en vez de a NULL, y un COALESCE normal no
// entra nunca sobre un 0.
const sets = ['enrich_tried_at = NOW()'];
const pon = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + " = COALESCE(NULLIF(" + col + ", ''), " + esc(val) + ')'); };
const ponNum = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = COALESCE(NULLIF(' + col + ', 0), ' + esc(val) + ')'); };
const pisa = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = ' + esc(val)); };

pon('body_type', carroc);
ponNum('doors', puertas);
ponNum('seats', plazas);
ponNum('displacement', cilin);
pon('matricula', matricula);
// La descripcion y el equipamiento los escribe el concesionario y los puede
// cambiar. El listado no puede darlos, asi que lo de aqui es siempre mejor que
// lo que hubiera.
if (descripcion) pisa('description', descripcion);
if (equipo) pisa('equipment', equipo);

// La ficha esta delante: verla es prueba de que el coche sigue publicado. Pero
// solo se sella si de verdad ha salido algo, para no certificar como vivo lo
// que no hemos sabido leer.
const hayDato = sets.length > 1;
// updated_at NO se toca NUNCA aqui. Ver la nota de arriba.
if (hayDato) sets.push('last_seen_at = NOW()', 'last_checked_at = NOW()');

console.log('[modrive-enrich] ' + id + ': carroceria=' + (carroc || '-')
  + ' puertas=' + (puertas || '-') + ' plazas=' + (plazas || '-')
  + ' cc=' + (cilin || '-') + ' matricula=' + (matricula || '-')
  + ' descripcion=' + descripcion.length + ' equipamiento=' + nItems);

return [{ json: {
  sql: 'UPDATE moveadvisor_marketplace_vo_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: hayDato ? 'enriquecida' : 'sin datos',
  plazas: plazas, cilindrada: cilin, matricula: matricula, equipamiento: nItems,
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
  { parameters: {}, id: "me-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-380, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 50 1,5,9,13,17,21 * * *" }] } },
    id: "me-cron", name: "6 veces/día (cada 4 h)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-380, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "me-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-140, 300], credentials: PG_CRED },
  { parameters: { options: {} }, id: "me-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [80, 300] },
  // Una cola vacia llega como UN ITEM VACIO, no como "nada". Sin este IF, ese
  // item recorre el bucle y revienta el nodo HTTP con "URL parameter must be a
  // string, got undefined", que es como cayeron los dos workflows de Gamboa la
  // madrugada del 2026-09-07 -y era el caso normal: no habia nada que hacer-.
  { parameters: condicionNoVacia("me-c-url", "source_url"), id: "me-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [300, 300] },
  { parameters: {
      url: "={{ $json.source_url }}",
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
    }, id: "me-http", name: "HTTP: Ficha de Modrive",
    // neverError solo calla los codigos HTTP; un corte de red sigue matando el
    // nodo. Sin esto, la pasada de 1.988 se cae por la ficha 139 como pasó en
    // Milanuncios -"connection closed unexpectedly"- y se pierde el trabajo.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [520, 420] },
  { parameters: { jsCode: CODE }, id: "me-code", name: "Code: Extraer de la ficha",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [740, 420] },
  { parameters: condicionNoVacia("me-c-sql", "sql"), id: "me-if-sql", name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [960, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "me-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1180, 340], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "me-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1400, 420],
    webhookId: "b2e9c7d1-modrive-enrich" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Cola a enriquecer")]] },
  "6 veces/día (cada 4 h)":     { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":      { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":    { main: [[], [L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?":  { main: [[L("HTTP: Ficha de Modrive")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de Modrive":     { main: [[L("Code: Extraer de la ficha")]] },
  "Code: Extraer de la ficha":  { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":      { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
};

const wf = {
  name: "Modrive – Enriquecer (carrocería, plazas, cilindrada, matrícula, descripción, equipamiento)",
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

const destino = path.join(RAIZ, "n8n-workflows", "modrive-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " por pasada, espera de " + ESPERA_SEGUNDOS + "s");
