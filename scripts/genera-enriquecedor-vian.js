/**
 * El origen de n8n-workflows/vian-enrich-offers.json.
 *
 *   node scripts/genera-enriquecedor-vian.js
 *   npm run test:vian-enrich
 *
 * ── De dónde sale cada cosa ────────────────────────────────────────────────
 *
 * VIAN publica JSON-LD en la ficha, así que casi todo sale de ahí y no hay que
 * adivinar nada del HTML. De un solo bloque `Vehicle` salen seis columnas que
 * hoy están al 0%: carrocería, puertas, plazas, cilindrada, versión y provincia.
 *
 * La provincia está donde no se espera: dentro de `description`, que es un texto
 * generado que termina «... Cambio manual. En Madrid.». No hay campo de
 * ubicación en la ficha; las direcciones que aparecen son las de los
 * concesionarios, en el pie, y son las mismas en todas.
 *
 * Del HTML solo se saca lo que el JSON-LD no lleva: el equipamiento y el PVP de
 * nuevo.
 *
 * ── Lo que NO se rellena, y por qué ────────────────────────────────────────
 *
 * `description` se queda vacía. La pestaña «Observaciones» es el mismo párrafo
 * comercial en todas las fichas -«Disponemos de un stock muy amplio con más de
 * 3.000 vehículos...»-. Copiarlo dejaría 609 coches con el mismo texto, que es
 * peor que no tener nada: ocupa el sitio de una descripción de verdad y no dice
 * nada del coche.
 *
 * `warranty_months` tampoco. Se miró en seis fichas al azar y VIAN no declara
 * meses de garantía por coche: hay un enlace a /garantia, un icono y la frase
 * «totalmente revisados y con total garantía», igual en todas. En una ficha
 * aparecía «1 año de Garantía Premium», pero era parte de la oferta de
 * financiación de ESE coche y no salía en las otras cinco. Escribir 12 meses en
 * 609 fichas por eso sería prometerle a un cliente algo que el concesionario no
 * dice.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// 609 activas. Lo que saca este workflow -carrocería, puertas, plazas,
// cilindrada, equipamiento- no cambia en la vida de un anuncio, así que no hace
// falta un ciclo diario: basta con las nuevas y un repaso cada 30 días. El
// precio, que sí cambia, lo trae el scraper cada mañana.
const LOTE = 200;
const ESPERA_SEGUNDOS = 2;

const COLA = `-- Las ofertas de VIAN a las que les falta pasar por la ficha.
--
-- No es un ciclo diario a proposito: color, carroceria, puertas, plazas,
-- cilindrada y equipamiento no cambian nunca. Quien SI tiene que pasar cada dia
-- es el verificador.
SELECT id, source_url, brand, model
FROM moveadvisor_marketplace_vo_offers
WHERE portal = 'vian'
  AND is_active
  AND COALESCE(source_url, '') <> ''
  AND (enrich_tried_at IS NULL
       OR enrich_tried_at < NOW() - INTERVAL '30 days')
ORDER BY enrich_tried_at ASC NULLS FIRST
LIMIT ${LOTE}`;

const CODE = `// VIAN - de la ficha a las columnas.
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
  console.log('[vian-enrich] ' + id + ': sin ficha (HTTP ' + codigo + ')');
  return soloIntento();
}

const limpia = s => String(s)
  .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
  .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&euro;/g, '€')
  .replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim();

// ── el JSON-LD, que es de donde sale casi todo ─────────────────────────────
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
  console.log('[vian-enrich] ' + id + ': la ficha no trae JSON-LD de vehiculo');
  return soloIntento();
}

const num = x => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.round(n) : null; };

const carroc  = String(v.bodyType || '').trim();
const puertas = num(v.numberOfDoors);
const plazas  = num(v.vehicleSeatingCapacity);
const color   = String(v.color || '').trim();
const cilin   = num(((v.vehicleEngine || {}).engineDisplacement || {}).value);

// La version es el nombre menos la marca y el modelo: "Jeep Compass 1.6
// Multijet Longitude 4x2 96 kW (130 CV)" -> "1.6 Multijet Longitude 4x2 96 kW
// (130 CV)". Se usan la marca y el modelo del propio JSON-LD, no los nuestros,
// porque tienen que casar letra por letra con el principio del nombre.
const marca  = String((v.brand || {}).name || v.brand || '').trim();
const modelo = String(v.model || '').trim();
let version = String(v.name || '').trim();
for (const p of [marca, modelo]) {
  if (p) version = version.replace(new RegExp('^\\\\s*' + p.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + '\\\\s*', 'i'), '');
}
version = version.trim();

// La provincia vive dentro de la descripcion generada, al final: "... Cambio
// manual. En Madrid." No hay campo de ubicacion en la ficha.
let provincia = '';
const mp = String(v.description || '').match(/\\bEn\\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{2,30})\\s*\\.?\\s*\$/);
// El punto final se cuela en la captura porque la clase admite puntos -y tiene
// que admitirlos, por sitios como "S. Sebastian de los Reyes"-. Se quita aparte
// en vez de sacarlo de la clase: si no, "Madrid." acaba guardado tal cual y el
// filtro por provincia del escaparate no casa con "Madrid".
if (mp) provincia = mp[1].trim().replace(/[.,;\\s]+\$/, '');

// ── el PVP de nuevo, que el JSON-LD no lleva ───────────────────────────────
// "PVP nuevo en España (año 2022) ... <b>37.150 €</b>"
let pvp = null, pvpAnio = null;
const mpvp = cuerpo.match(/PVP nuevo en Espa(?:ñ|&ntilde;)a[^<]*\\(a(?:ñ|&ntilde;)o\\s*(\\d{4})\\)([\\s\\S]{0,600}?)<\\/div>/i);
if (mpvp) {
  pvpAnio = num(mpvp[1]);
  const me = mpvp[2].match(/([\\d.]+,\\d{2}|[\\d.]+)\\s*(?:€|&euro;)/);
  if (me) {
    const n = Number(String(me[1]).replace(/\\./g, '').replace(',', '.'));
    if (Number.isFinite(n) && n > 1000) pvp = n;
  }
}

// ── el equipamiento ────────────────────────────────────────────────────────
// De serie: <ul class="grid-1"><li class="col"><span>...</span></li>
const serie = [];
const mSerie = cuerpo.match(/<ul class="grid-1"[^>]*>([\\s\\S]*?)<\\/ul>/);
if (mSerie) {
  for (const li of mSerie[1].matchAll(/<li[^>]*>([\\s\\S]*?)<\\/li>/g)) {
    const txt = limpia(li[1]);
    if (txt && txt.length < 400) serie.push(txt);
  }
}
// Extras: <p>GRUPO</p><dl><dt>[cod]</dt><dd><span>nombre</span><span>precio</span></dd></dl>
const extra = [];
const iEx = cuerpo.indexOf('class="ex-content"');
if (iEx >= 0) {
  const trozo = cuerpo.slice(iEx, iEx + 40000);
  let grupo = '';
  for (const m of trozo.matchAll(/<p>([^<]{2,60})<\\/p>|<dd[^>]*>([\\s\\S]*?)<\\/dd>/g)) {
    if (m[1] !== undefined) { grupo = limpia(m[1]); continue; }
    const spans = [...m[2].matchAll(/<span[^>]*>([\\s\\S]*?)<\\/span>/g)].map(x => limpia(x[1])).filter(Boolean);
    if (!spans.length) continue;
    const it = { grupo: grupo, nombre: spans[0] };
    if (spans[1] && /€/.test(spans[1])) it.precio = spans[1];
    extra.push(it);
  }
}
const equipo = (serie.length || extra.length) ? JSON.stringify({ serie: serie, extra: extra }) : '';

// ── el UPDATE ──────────────────────────────────────────────────────────────
// COALESCE con NULLIF, no COALESCE a secas: en esta tabla hay columnas que
// llegan a CERO o a cadena vacia en vez de a NULL, y un COALESCE normal no
// entra nunca sobre un 0. Le paso al enriquecedor de Gamboa con
// warranty_months, que tiene DEFAULT 0: una ejecucion entera sin guardar una
// sola garantia y sin dar ningun error.
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
pon('color', color);
pon('version', version);
pon('provincia', provincia);
pon('location', provincia);
// El equipamiento se pisa: el listado no puede darlo, asi que lo de aqui es
// siempre mejor que lo que hubiera.
if (equipo) pisa('equipment', equipo);
// El PVP de nuevo tampoco cambia nunca, pero si algun dia el portal corrige la
// cifra queremos la buena.
if (pvp) { pisa('price_new', pvp); if (pvpAnio) pisa('price_new_year', pvpAnio); }

// La ficha esta delante: verla es prueba de que el coche sigue publicado. Pero
// solo se sella si de verdad ha salido algo, para no certificar como vivo lo
// que no hemos sabido leer.
const hayDato = sets.length > 1;
if (hayDato) sets.push('last_seen_at = NOW()', 'last_checked_at = NOW()', 'updated_at = NOW()');

console.log('[vian-enrich] ' + id + ': carroceria=' + (carroc || '-')
  + ' puertas=' + (puertas || '-') + ' plazas=' + (plazas || '-')
  + ' cc=' + (cilin || '-') + ' prov=' + (provincia || '-')
  + ' pvp=' + (pvp || '-') + ' equipamiento=' + serie.length + '+' + extra.length);

return [{ json: {
  sql: 'UPDATE moveadvisor_marketplace_vo_offers SET ' + sets.join(', ') + ' WHERE id = ' + esc(id),
  veredicto: hayDato ? 'enriquecida' : 'sin datos',
  serie: serie.length, extra: extra.length, pvp: pvp,
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
  { parameters: {}, id: "ve-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-380, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 45 2,8,14,20 * * *" }] } },
    id: "ve-cron", name: "4 veces/día (cada 6 h)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-380, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "ve-cola", name: "PG: Cola a enriquecer",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-140, 300], credentials: PG_CRED },
  { parameters: { options: {} }, id: "ve-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [80, 300] },
  // Una cola vacia llega como UN ITEM VACIO, no como "nada". Sin este IF, ese
  // item recorre el bucle y revienta el nodo HTTP con "URL parameter must be a
  // string, got undefined", que es como cayeron los dos workflows de Gamboa la
  // madrugada del 2026-09-07 -y era el caso normal: no habia nada que hacer-.
  { parameters: condicionNoVacia("ve-c-url", "source_url"), id: "ve-if-url",
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
    }, id: "ve-http", name: "HTTP: Ficha de VIAN",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [520, 420] },
  { parameters: { jsCode: CODE }, id: "ve-code", name: "Code: Extraer de la ficha",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [740, 420] },
  { parameters: condicionNoVacia("ve-c-sql", "sql"), id: "ve-if-sql", name: "IF: ¿hay algo que guardar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [960, 420] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "ve-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1180, 340], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "ve-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1400, 420],
    webhookId: "f6c4d3a2-vian-enrich" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Cola a enriquecer")]] },
  "4 veces/día (cada 6 h)":     { main: [[L("PG: Cola a enriquecer")]] },
  "PG: Cola a enriquecer":      { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta":    { main: [[], [L("IF: ¿hay ficha que pedir?")]] },
  "IF: ¿hay ficha que pedir?":  { main: [[L("HTTP: Ficha de VIAN")], [L("Loop: oferta por oferta")]] },
  "HTTP: Ficha de VIAN":        { main: [[L("Code: Extraer de la ficha")]] },
  "Code: Extraer de la ficha":  { main: [[L("IF: ¿hay algo que guardar?")]] },
  "IF: ¿hay algo que guardar?": { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":      { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
};

const wf = {
  name: "VIAN – Enriquecer (carrocería, plazas, cilindrada, equipamiento, PVP nuevo)",
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

const destino = path.join(RAIZ, "n8n-workflows", "vian-enrich-offers.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, " + LOTE + " por pasada, espera de " + ESPERA_SEGUNDOS + "s");
