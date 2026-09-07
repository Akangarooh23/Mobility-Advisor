/**
 * El origen de n8n-workflows/gamboa-enrich-offers.json.
 *
 * Se genera en vez de escribirse a mano porque el codigo del nodo lleva
 * expresiones regulares, y dentro de un JSON hay que escribirlas doblemente
 * escapadas. Ahi es donde se pierden las barras.
 *
 *   node scripts/genera-enriquecedor-gamboa.js
 *   npm run test:gamboa-enrich
 *
 * ── Que saca, y de donde ───────────────────────────────────────────────────
 *
 * El scraper lee el LISTADO, que da titulo, marca, modelo, version, precio,
 * combustible, cambio, ubicacion y una foto. Bien, pero se queda corto: color
 * al 0%, garantia al 0%, descripcion al 0% y UNA sola foto por coche.
 *
 * La ficha da catorce campos mas, en un formato muy regular:
 *
 *   <div class="item"><span class="label">Color</span>
 *                     <span class="resultado">Gris</span></div>
 *
 * ── Las dos garantias ──────────────────────────────────────────────────────
 *
 * En la misma pagina conviven dos numeros, y confundirlos es prometerle a un
 * cliente cinco años de lo que tiene uno:
 *
 *   - Ficha tecnica, junto a Puertas:  "Garantia = 60 meses"  -> es la de la
 *     MARCA (un Hyundai de 2026 con 550 km).
 *   - Pegado al precio, como reclamo:  "12 meses de garantia, 100% cubierto
 *     con la garantia Gamboa"          -> es la del CONCESIONARIO.
 *
 * La que vale para quien compra en nuestro escaparate es la segunda, y esa va
 * a `warranty_months`. La de la marca no se tira: va a `brand_warranty_months`.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// 960 ofertas activas. Con 200 por pasada y 6 pasadas al dia se repasan todas
// cada dia y sobra sitio para que el concesionario crezca.
//
// El lote no se sube: las fichas de Gamboa pesan 200 KB, diez veces mas que las
// de Wallapop, y n8n acumula en memoria la salida de cada vuelta del bucle. El
// verificador de Wallapop se colgo por eso a la vuelta 1.551 con cuerpos de
// 13 KB; aqui el techo esta mucho antes.
const LOTE = 200;
const ESPERA_SEGUNDOS = 2;

const COLA = `-- Las ofertas de Gamboa a las que les falta pasar por la ficha.
--
-- Esto NO es un ciclo diario, y es a proposito. Lo que saca este workflow
-- -color, carroceria, puertas, plazas, equipamiento, garantia- no cambia nunca
-- en la vida de un anuncio. Lo unico que cambia es el precio, y de eso ya se
-- encarga el scraper todas las mañanas.
--
-- Releerlas todas cada dia serian 1.200 peticiones diarias a un concesionario
-- pequeño para volver a copiar lo mismo. Asi son unas 60: las que entran nuevas
-- -unas 28 al dia- y la treintava parte del catalogo que toca refrescar.
--
-- Quien SI tiene que pasar cada dia por todas es el verificador, porque lo que
-- el mira -si el coche sigue existiendo- cambia constantemente.
SELECT id, source_url
FROM moveadvisor_marketplace_vo_offers
WHERE portal = 'gamboa'
  AND is_active
  AND COALESCE(source_url, '') <> ''
  AND (enrich_tried_at IS NULL
       OR enrich_tried_at < NOW() - INTERVAL '30 days')
ORDER BY enrich_tried_at ASC NULLS FIRST
LIMIT ${LOTE}`;

const CODE = `// Gamboa - de la ficha a las columnas.
const oferta = $('Loop: oferta por oferta').item.json;
const res = $input.first().json;
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const id = String(oferta.id || '');
const BASE = 'https://www.gamboaocasion.com';

const esc = v => (v === null || v === undefined || v === '') ? 'NULL'
  : (typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

// enrich_tried_at se mueve pase lo que pase: sin eso, una ficha que falla se
// reintenta en cada pasada y atasca la cola para siempre.
const soloIntento = () => [{ json: {
  sql: 'UPDATE moveadvisor_marketplace_vo_offers SET enrich_tried_at = NOW() WHERE id = ' + esc(id),
  veredicto: 'sin datos',
} }];

if (!id) return [{ json: { sql: null } }];

// Un coche vendido no da 404: Gamboa redirige su ficha al listado de la
// categoria. Por eso este nodo pide SIN seguir redirects, igual que el
// verificador, y un 3xx se trata como "ya no esta".
//
// Siguiendo el redirect pasaba algo peor que perder el dato: la pagina de
// categoria contiene class="resultado" 48 veces -los mismos marcadores que una
// ficha viva-, asi que el filtro de abajo la daba por buena, no sacaba ningun
// campo... y aun asi sellaba last_seen_at. O sea que el enriquecedor certificaba
// como vivos coches vendidos, peleandose con el verificador: uno los daba de
// baja y el otro los resucitaba.
//
// Aqui no se da de baja a nadie -de eso se encarga el verificador, que es quien
// mira eso a proposito-. Solo se apunta que se intento.
const esRedirect = codigo >= 300 && codigo < 400;
if (esRedirect || codigo !== 200 || !cuerpo || !/class="resultado/.test(cuerpo)) {
  console.log('[gamboa-enrich] ' + id + ': sin ficha util (HTTP ' + codigo + ')');
  return soloIntento();
}

// ── los pares etiqueta/valor de la ficha tecnica ───────────────────────────
const limpia = s => String(s)
  .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
  .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&euro;/g, '€')
  .replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();

const ficha = {};
for (const m of cuerpo.matchAll(/<span class="label[^"]*">([\\s\\S]*?)<\\/span>\\s*<span class="resultado[^"]*">([\\s\\S]*?)<\\/span>/g)) {
  const k = limpia(m[1]).toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
    .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n');
  ficha[k] = limpia(m[2]);
}

const numero = v => { const m = String(v || '').replace(/\\./g, '').match(/(\\d+)/); return m ? Number(m[1]) : null; };
const siNo = v => { const s = String(v || '').toLowerCase(); return s === 'si' || s === 'sí' ? true : (s === 'no' ? false : null); };

const color   = ficha['color'] || '';
const anio    = numero(ficha['ano'] || ficha['año']);
const kms     = numero(ficha['kilometros']);
const carroc  = ficha['carroceria'] || '';
const plazas  = numero(ficha['plazas']);
const puertas = numero(ficha['puertas']);
const dueños  = numero(ficha['n dueños anteriores'] || ficha['n duenos anteriores'] || ficha['no dueños anteriores']);
const libro   = siNo(ficha['libro de servicio']);
const nacion  = siNo(ficha['nacional']);

// La garantia de la ficha tecnica es la de la MARCA.
const garantiaMarca = numero(ficha['garantia']);

// ── la garantia del concesionario, que es la que vale para el cliente ──────
// Vive en el bloque comercial pegado al precio: "12 meses de garantia,
// 100% cubierto con la garantia Gamboa".
let garantiaGamboa = null;
for (const m of cuerpo.matchAll(/<div class="descripcion">([\\s\\S]*?)<\\/div>/g)) {
  const txt = limpia(m[1]);
  const g = txt.match(/(\\d{1,3})\\s*meses?\\s+de\\s+garant/i);
  if (g) { garantiaGamboa = Number(g[1]); break; }
}

// ── las fotos ──────────────────────────────────────────────────────────────
// El listado solo daba una. La ficha trae la galeria entera, pero repartida
// entre data-src, srcset y src segun si la imagen entra en el carrusel o carga
// despues. Mirar solo data-src devolvia 3 de las 19 que tiene un coche normal.
// Por eso se busca la ruta directamente, venga en el atributo que venga.
//
// Y se filtra por el numero de ESTE coche: la ficha incluye tambien fotos de
// los "coches similares" del final -/img/coches/32256/, /img/coches/32253/...-
// y sin filtrar se colarian en la galeria del que estamos mirando.
const numeroCoche = (String(oferta.source_url || '').match(/(\\d{4,})\\s*$/) || [])[1] || '';
const fotos = numeroCoche
  ? [...new Set(
      [...cuerpo.matchAll(new RegExp('/img/coches/' + numeroCoche + '/[A-Za-z0-9_]+_l\\\\.(?:jpg|jpeg|png|webp)', 'gi'))]
        .map(m => BASE + m[0])
    )].slice(0, 30)
  : [];

// ── el equipamiento ────────────────────────────────────────────────────────
// Dos pestañas, serie y opcional, cada una con categorias plegables. La
// separacion vale dinero: un extra opcional montado es lo que diferencia dos
// coches del mismo precio, y por eso no se mezclan en una sola lista.
//
// Los contenedores se llaman 'equipamiento-serie' y 'equipamiento-extra'. Ojo
// con el segundo: la pestaña se titula "Opcional" pero el id dice "extra", y
// buscar 'equipamiento-opcional' devuelve vacio sin dar ningun error.
function pestaña(idPanel, idSiguiente) {
  const i = cuerpo.indexOf('id="' + idPanel + '"');
  if (i < 0) return null;
  // Se corta donde empieza la otra pestaña -o donde acaba la seccion- para que
  // una no se lleve los paneles de la otra.
  let fin = Math.min(cuerpo.length, i + 80000);
  const j = idSiguiente ? cuerpo.indexOf('id="' + idSiguiente + '"', i + 1) : -1;
  if (j > i) fin = Math.min(fin, j);
  const k = cuerpo.indexOf('</section>', i + 1);
  if (k > i) fin = Math.min(fin, k);
  const trozo = cuerpo.slice(i, fin);
  const cats = {};
  const paneles = [...trozo.matchAll(/<h4 class="panel-title">[\\s\\S]*?<a[^>]*>([\\s\\S]*?)<\\/a>[\\s\\S]*?<ul>([\\s\\S]*?)<\\/ul>/g)];
  for (const p of paneles) {
    const nombre = limpia(p[1]);
    const items = [...p[2].matchAll(/<li>([\\s\\S]*?)<\\/li>/g)].map(x => limpia(x[1])).filter(Boolean);
    if (nombre && items.length) cats[nombre] = items;
  }
  return Object.keys(cats).length ? cats : null;
}
const serie = pestaña('equipamiento-serie', 'equipamiento-extra');
const opcional = pestaña('equipamiento-extra', null);
const equipo = (serie || opcional) ? JSON.stringify({ serie: serie || {}, opcional: opcional || {} }) : '';

// ── el UPDATE ──────────────────────────────────────────────────────────────
// Cada campo va con COALESCE sobre lo que ya hay: el enriquecedor rellena
// huecos, no pisa lo que el scraper trajo del listado. La excepcion son las
// fotos y el equipamiento, que el listado no puede dar y aqui son mejores por
// definicion.
const sets = ['enrich_tried_at = NOW()'];

// COALESCE solo sustituye NULL, y esta tabla tiene columnas que llegan a CERO
// o a cadena vacia en vez de a NULL. warranty_months es el caso claro: tiene
// DEFAULT 0, asi que las 960 filas valen 0 y un COALESCE a secas no entra
// jamas. La primera version de esto se paso una ejecucion entera sin guardar
// una sola garantia, y sin dar ningun error.
//
// De ahi las tres formas:
const pon = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + " = COALESCE(NULLIF(" + col + ", ''), " + esc(val) + ')'); };
const ponNum = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = COALESCE(NULLIF(' + col + ', 0), ' + esc(val) + ')'); };
// Para lo que un cero SI significa algo. Un coche con cero dueños anteriores es
// un coche nuevo, no un dato que falte.
const ponCeroValido = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = COALESCE(' + col + ', ' + esc(val) + ')'); };
const pisa = (col, val) => { if (val !== null && val !== undefined && val !== '')
  sets.push(col + ' = ' + esc(val)); };

pon('color', color);
ponNum('year', anio);
ponNum('mileage', kms);
pon('body_type', carroc);
ponNum('seats', plazas);
ponNum('doors', puertas);
ponCeroValido('previous_owners', dueños);
if (libro !== null) sets.push('has_service_book = COALESCE(has_service_book, ' + (libro ? 'TRUE' : 'FALSE') + ')');
if (nacion !== null) sets.push('is_national = COALESCE(is_national, ' + (nacion ? 'TRUE' : 'FALSE') + ')');

// Las dos garantias, cada una a la suya. La de Gamboa es la que ve el cliente.
// Van con ponNum a proposito: warranty_months tiene DEFAULT 0 y sin NULLIF no
// se escribiria nunca.
ponNum('warranty_months', garantiaGamboa);
ponNum('brand_warranty_months', garantiaMarca);

if (fotos.length) pisa('image_urls', JSON.stringify(fotos));
if (equipo) pisa('equipment', equipo);

// last_seen_at solo se toca si de verdad se ha leido la ficha del coche.
//
// Sellarlo por el mero hecho de haber recibido una pagina fue el fallo de la
// primera version: a un coche vendido le ponia "visto vivo hoy" y dejaba al
// verificador peleandose con el. Si de aqui no ha salido ni un campo, lo unico
// honesto es apuntar que se intento.
const hayDato = sets.length > 1;
if (hayDato) {
  sets.push('last_seen_at = NOW()', 'last_checked_at = NOW()');
  // updated_at tambien: ese campo ordena el escaparate, y tocarlo cada dia sin
  // motivo reordenaria la tienda entera por nada.
  sets.push('updated_at = NOW()');
}

console.log('[gamboa-enrich] ' + id + ': color=' + (color || '-')
  + ' garantia=' + (garantiaGamboa || '-') + '/' + (garantiaMarca || '-') + 'm'
  + ' fotos=' + fotos.length
  + ' equipamiento=' + (serie ? Object.keys(serie).length : 0) + '+' + (opcional ? Object.keys(opcional).length : 0));

return [{ json: {
  sql: 'UPDATE moveadvisor_marketplace_vo_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: hayDato ? 'enriquecida' : 'sin datos',
  fotos: fotos.length,
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
const condicionSql = (id) => condicionNoVacia(id, "sql");

const nodos = [
  { parameters: {}, id: "ge-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-380, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 30 1,5,9,13,17,21 * * *" }] } },
    id: "ge-cron", name: "6 veces/día (cada 4 h)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-380, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ge-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-140, 300], credentials: PG_CRED },
  { parameters: { options: {} }, id: "ge-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [80, 300] },
  // Una cola vacia no llega como "nada": cuando la consulta no devuelve filas,
  // n8n manda UN ITEM VACIO, que recorre el bucle y llega al HTTP sin url. Eso
  // tumbo las ejecuciones de la 01:30 y las 05:30 del 2026-09-07 con "URL
  // parameter must be a string, got undefined", y era el caso NORMAL: el
  // catalogo estaba al dia y con el ciclo de 30 dias no habia nada que
  // enriquecer. Sin oferta no se pide nada y se vuelve al bucle.
  { parameters: condicionNoVacia("ge-c-url", "source_url"), id: "ge-if-url",
    name: "IF: ¿hay ficha que pedir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [320, 300] },
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
        // SIN seguir redirects: un 3xx significa que el coche se ha vendido.
        // Siguiendolo se llega al listado de la categoria, que trae los mismos
        // marcadores que una ficha viva y hacia que este workflow sellara
        // last_seen_at sobre coches que ya no existen.
        redirect: { redirect: { followRedirects: false } },
      },
    }, id: "ge-http", name: "HTTP: Ficha de Gamboa",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [320, 420] },
  { parameters: { jsCode: CODE }, id: "ge-code", name: "Code: Extraer de la ficha",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [540, 420] },
  { parameters: condicionSql("ge-c-sql"), id: "ge-if", name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [760, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ge-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [980, 340], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "ge-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1200, 420],
    webhookId: "d4a2b190-gamboa-enrich" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":     { main: [[L("PG: Cola a enriquecer")]] },
  "6 veces/día (cada 4 h)":   { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":    { main: [[L("Loop: oferta por oferta")]] },
  // salida 0 = terminado (no hay nada mas que hacer), salida 1 = siguiente oferta
  "Loop: oferta por oferta":  { main: [[], [L("IF: ¿hay ficha que pedir?")]] },
  // true = tiene url y se pide; false = item vacio de una cola sin filas, se
  // devuelve al bucle sin pedir nada.
  "IF: ¿hay ficha que pedir?": { main: [[L("HTTP: Ficha de Gamboa")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de Gamboa":    { main: [[L("Code: Extraer de la ficha")]] },
  "Code: Extraer de la ficha":{ main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":    { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
};

const wf = {
  name: "Gamboa – Enriquecer (color, garantía, fotos, equipamiento)",
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

const destino = path.join(RAIZ, "n8n-workflows", "gamboa-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " ofertas por pasada, espera de " + ESPERA_SEGUNDOS + "s");
console.log("  " + LOTE * 6 + " al dia para 960 activas; cada pasada dura ~"
  + (LOTE * ESPERA_SEGUNDOS / 60).toFixed(0) + " min de las 240 que hay entre una y otra");
