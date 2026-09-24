/**
 * CanalCar – Verificar ofertas activas (por su listado, cruzando por id)
 *
 * El origen de n8n-workflows/canalcar-verificar-activas.json.
 *
 *   node scripts/genera-verificador-canalcar.js
 *   npm run test:canalcar-verify
 *
 * ── Por qué hace falta, y cuánto ───────────────────────────────────────────
 *
 * CanalCar no tiene ni ha tenido nunca un verificador: en n8n no hay un solo
 * flujo de este portal. Nadie ha dado de baja un coche suyo jamás. Medido hoy:
 * de las 459 que damos por vivas, 103 ya no están en su catálogo -el 22 %-.
 *
 * ── Por el listado, no por el sitemap ──────────────────────────────────────
 *
 * Tienen un sitemap.vehicles.xml y sería una sola petición. No se usa, y esto
 * es lo importante de este fichero:
 *
 *     cruzando por URL (el sitemap)  ->  305 vivas, 154 muertas
 *     cruzando por ID  (el listado)  ->  356 vivas, 103 muertas
 *
 * 51 coches de diferencia, todos vivos, todos los habría matado el sitemap. La
 * razón es que en CanalCar la url no identifica al coche: es
 * /coches-ocasion/marca/modelo/texto-de-la-version, sin número, y la reescriben.
 * 11 de las 454 tarjetas de hoy enlazan a una ruta cuyo último tramo es de otra
 * versión. El id solo vive en el atributo data-coche-id de la tarjeta.
 *
 * Siete páginas de 71 son siete peticiones para verificar 459 ofertas. Sigue
 * siendo barato, y es la respuesta correcta en vez de la barata.
 *
 * ── Lo que puede salir mal, y los tres frenos ──────────────────────────────
 *
 * El riesgo de fiarse de una lista es que la lista venga a medias. Entonces
 * «no está en la lista» dejaría de significar «se ha vendido».
 *
 *   1. NINGUNA PÁGINA PUEDE FALLAR. Si la cuarta de siete devuelve un error,
 *      faltan 71 coches de la lista y los 71 parecerían vendidos. Basta un
 *      fallo para no dar ni una baja.
 *
 *   2. HAY QUE HABER RECOGIDO EL CATÁLOGO ENTERO. Su campo oculto
 *      resultado-total-coches dice cuántos tienen; si al terminar la vuelta
 *      hemos visto menos, se para. Se admite un 3 % de merma porque vender un
 *      coche a mitad de la vuelta corre las tarjetas de sitio y puede saltarse
 *      una.
 *
 *   3. TECHO DE MORTANDAD. Si las que faltan pasan del 40 % de las nuestras,
 *      se para. Hoy son el 22 %, y eso son tres semanas sin mirar. Un 90 % no
 *      sería un mes de ventas histórico: sería la lista rota.
 *
 * Con los tres puestos, el peor caso es una pasada que no hace nada y lo dice
 * en su parte.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const BASE = "https://www.canalcar.es/coches-ocasion";
const POR_PAGINA = 71;
const TOPE_PAGINAS = 40;
const TOPE_MORTANDAD = 0.4;
const MERMA_ADMITIDA = 0.03;
const POR_TROZO = 1500;

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
  timeout: 30000,
  redirect: { redirect: { followRedirects: true } },
};

const ACTIVAS = `-- Lo que damos por vivo de CanalCar, para cruzarlo con su listado.
--
-- Solo el id: el cruce va por id y traer lo demás sería memoria tirada. n8n
-- guarda en memoria la salida de cada nodo, iteración a iteración.
SELECT id FROM moveadvisor_market_offers
WHERE portal = 'canalcar' AND is_active`;

const CODE_PAGINAS = `// Cuántas páginas hay hoy, y a la vez el arranque de la pasada.
const s = $getWorkflowStaticData('global');
// La memoria es del workflow, no de la pasada: sin limpiarla aquí, los ids de
// ayer contarían como vivos hoy y no se daría ni una baja.
for (const k of Object.keys(s)) { if (k.indexOf('cc_') === 0) delete s[k]; }
s.cc_run = $execution.id;
s.cc_ids = [];
s.cc_fallos = 0;
s.cc_paginas_ok = 0;
s.cc_motivo = '';

const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no en
// 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const html = String(res.data || res.body || '');
const codigo = Number(res.statusCode || 0);

if (codigo !== 200 || !html) {
  s.cc_motivo = 'el listado no contestó (HTTP ' + codigo + ')';
  console.log('[canalcar-verify] NO SE DAN BAJAS: ' + s.cc_motivo);
  return [{ json: { hay: '', url: '' } }];
}

// El total declarado, del campo oculto <input id="resultado-total-coches">.
let total = 0;
{
  const i = html.indexOf('resultado-total-coches');
  if (i !== -1) {
    let j = html.indexOf('value="', i);
    if (j === -1 || j - i > 60) j = html.lastIndexOf('value="', i);
    if (j !== -1 && Math.abs(j - i) < 120) {
      let n = '';
      for (let k = j + 7; k < j + 20; k++) {
        const ch = html.charAt(k);
        if (ch >= '0' && ch <= '9') n += ch;
        else if (ch === '.') continue;
        else break;
      }
      total = Number(n) || 0;
    }
  }
}
s.cc_total = total;

// Y las páginas que enlaza, que es la otra medida.
let porEnlaces = 0;
{
  let i = 0;
  for (;;) {
    const j = html.indexOf('page=', i);
    if (j === -1) break;
    let n = '';
    for (let k = j + 5; k < j + 11; k++) {
      const ch = html.charAt(k);
      if (ch >= '0' && ch <= '9') n += ch; else break;
    }
    if (n && Number(n) > porEnlaces) porEnlaces = Number(n);
    i = j + 1;
  }
}

let paginas = Math.max(porEnlaces, total > 0 ? Math.ceil(total / ${POR_PAGINA}) : 0);
if (paginas > ${TOPE_PAGINAS}) paginas = ${TOPE_PAGINAS};
if (!(paginas > 0)) {
  s.cc_motivo = 'el listado no dice cuántas páginas tiene';
  console.log('[canalcar-verify] NO SE DAN BAJAS: ' + s.cc_motivo);
  return [{ json: { hay: '', url: '' } }];
}

const out = [];
for (let p = 1; p <= paginas; p++) {
  out.push({ json: { hay: 'si', page: p, url: p === 1 ? '${BASE}' : '${BASE}?page=' + p } });
}
console.log('[canalcar-verify] su catálogo declara ' + total + ' coches en ' + paginas + ' páginas');
return out;`;

const CODE_APUNTAR = `// Los ids de esta página, al montón.
const s = $getWorkflowStaticData('global');
const res = $input.first().json;
const html = String(res.data || res.body || '');
const codigo = Number(res.statusCode || 0);
const pagina = $('Loop: página por página').first().json.page;

if (codigo !== 200 || !html) {
  // FRENO 1: una página que falla son 71 coches que parecerían vendidos.
  s.cc_fallos = (s.cc_fallos || 0) + 1;
  console.log('[canalcar-verify] la página ' + pagina + ' falló (HTTP ' + codigo + ')');
  return [{ json: { pagina: pagina, ids: 0, fallo: true } }];
}

/*
 * El id vive en data-coche-id, y en ningún otro sitio.
 *
 * Sin expresiones regulares: este código viaja dentro de una cadena y dentro
 * de un JSON, y por el camino las barras se pierden.
 */
const marca = 'data-coche-id="';
let n = 0;
let i = 0;
for (;;) {
  const j = html.indexOf(marca, i);
  if (j === -1) break;
  const desde = j + marca.length;
  const fin = html.indexOf('"', desde);
  i = desde;
  if (fin === -1) continue;
  const id = html.slice(desde, fin);
  if (id) { s.cc_ids.push('cnc_' + id); n++; }
}

if (!n) {
  // Una página sin una sola tarjeta también es una página que no sirve: la 8
  // devuelve un 520 y ese caso ya lo coge el HTTP, pero una página 200 y vacía
  // engañaría igual.
  s.cc_fallos = (s.cc_fallos || 0) + 1;
  console.log('[canalcar-verify] la página ' + pagina + ' vino sin tarjetas');
  return [{ json: { pagina: pagina, ids: 0, fallo: true } }];
}
s.cc_paginas_ok = (s.cc_paginas_ok || 0) + 1;
return [{ json: { pagina: pagina, ids: n, fallo: false } }];`;

const CODE_CRUZAR = `// Cruzar lo nuestro con lo suyo, por id.
const s = $getWorkflowStaticData('global');
const nuestras = $('PG: Las que damos por vivas').all().map(x => x.json);
s.cc_nuestras = nuestras.length;

const suyos = new Set(s.cc_ids || []);
s.cc_suyos = suyos.size;

// Si la medida ya falló, el motivo está puesto y aquí no hay nada que decidir.
if (!s.cc_motivo) {
  // FRENO 1: ninguna página puede haber fallado.
  if (s.cc_fallos > 0) {
    s.cc_motivo = s.cc_fallos + ' página(s) no se pudieron leer: faltan coches de la lista';
  // FRENO 2: hay que haber recogido el catálogo entero.
  //
  // Se admite un 3 % de merma: vender un coche a mitad de la vuelta corre las
  // tarjetas de sitio y puede dejar una sin ver.
  } else if (s.cc_total > 0 && suyos.size < Math.floor(s.cc_total * ${1 - MERMA_ADMITIDA})) {
    s.cc_motivo = 'recogimos ' + suyos.size + ' de los ' + s.cc_total + ' que declaran: la vuelta vino corta';
  }
}

if (s.cc_motivo) {
  console.log('[canalcar-verify] NO SE DAN BAJAS: ' + s.cc_motivo);
  return [{ json: { seguir: '', sql: null } }];
}

console.log('[canalcar-verify] su listado trae ' + suyos.size
  + ' coches; nosotros damos por vivas ' + nuestras.length);

const muertas = [];
for (const o of nuestras) {
  if (!suyos.has(String(o.id))) muertas.push(String(o.id));
}
s.cc_muertas = muertas.length;
s.cc_vivas = nuestras.length - muertas.length;

// FRENO 3: una mortandad imposible es la lista rota, no un buen mes de ventas.
const pct = nuestras.length ? (muertas.length / nuestras.length) : 0;
if (pct > ${TOPE_MORTANDAD}) {
  s.cc_motivo = 'faltan el ' + Math.round(pct * 100) + '% de las nuestras: la lista no es de fiar';
  console.log('[canalcar-verify] NO SE DAN BAJAS: ' + s.cc_motivo);
  return [{ json: { seguir: '', sql: null } }];
}
if (!muertas.length) {
  s.cc_nada = true;
  console.log('[canalcar-verify] nada que dar de baja: todas siguen en su listado.');
  return [{ json: { seguir: '', sql: null } }];
}

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const out = [];
for (let i = 0; i < muertas.length; i += ${POR_TROZO}) {
  const trozo = muertas.slice(i, i + ${POR_TROZO});
  out.push({ json: {
    seguir: 'si',
    sql: 'UPDATE moveadvisor_market_offers SET is_active = FALSE, last_checked_at = NOW()'
      + ' WHERE id IN (' + trozo.map(esc).join(', ') + ')',
    cuantas: trozo.length,
  } });
}
console.log('[canalcar-verify] ' + muertas.length + ' bajas en ' + out.length + ' trozos');
return out;`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');

console.log('[canalcar-verify] ── resumen ──');
console.log('  dábamos por vivas : ' + (s.cc_nuestras || 0));
console.log('  su listado trae   : ' + (s.cc_suyos || 0) + ' de ' + (s.cc_total || 0) + ' declarados');
console.log('  páginas leídas    : ' + (s.cc_paginas_ok || 0) + '   fallidas: ' + (s.cc_fallos || 0));
console.log('  BAJAS             : ' + (s.cc_muertas || 0));
console.log('  siguen vivas      : ' + (s.cc_vivas || 0));
if (s.cc_nada) console.log('  nada que dar de baja: todas siguen en su listado.');
if (s.cc_motivo) console.log('  NO SE DIERON BAJAS: ' + s.cc_motivo);

// Si un freno paró la pasada, no se ha dado ni una baja: el recuento de
// muertas es lo que HABRÍA hecho, no lo que hizo.
const frenada = !!s.cc_motivo;
const bajas = frenada ? 0 : (s.cc_muertas || 0);
const vivas = frenada ? 0 : (s.cc_vivas || 0);

const n = v => String(Number(v) || 0);
// La tabla de los verificadores, con portal='canalcar':
//     checked  las que dábamos por vivas   alive  las que siguen
//     deactivated  las bajas               unclassified  las que no se dieron
//     transient  las páginas que fallaron  blocked  TRUE si frenó
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('canalcar', NOW(), " + n(s.cc_nuestras) + ', ' + n(vivas) + ', '
  + n(bajas) + ', ' + n(frenada ? (s.cc_muertas || 0) : 0) + ', ' + n(s.cc_fallos) + ', '
  + (frenada ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, nuestras: s.cc_nuestras || 0, suyos: s.cc_suyos || 0,
  bajas: bajas, vivas: vivas, motivo: s.cc_motivo || '' };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('cc_') === 0) delete s[k]; }
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
// Cuatro veces al día, en huecos libres. Siete peticiones cada una.
// No pisa a Autocasión (9:50), coches.com (9:55), AutoScout24 (13:30),
// Modrive (17:50) ni Clicars (21:35).
const CRON = "4 veces/día (9:45, 13:45, 17:45 y 21:45)";
const nodos = [
  { parameters: {}, id: "cv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-860, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 45 9,13,17,21 * * *" }] } },
    id: "cv-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-860, 400] },
  { parameters: { operation: "executeQuery", query: ACTIVAS, options: {} },
    id: "cv-activas", name: "PG: Las que damos por vivas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-660, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { url: BASE, ...CABECERAS, options: OPCIONES_HTTP },
    id: "cv-contar", name: "HTTP: Contar el catálogo",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-460, 300] },
  { parameters: { jsCode: CODE_PAGINAS }, id: "cv-paginas", name: "Code: Generar páginas",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-260, 300] },
  // Si no se pudo medir el catálogo, no se entra al bucle: se va derecho al
  // cruce, que ve el motivo puesto, no da ninguna baja y lo apunta en el parte.
  { parameters: condicion("cv-c-hay", "hay"), id: "cv-if-hay", name: "IF: ¿se pudo medir?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [-60, 300] },
  { parameters: { options: {} }, id: "cv-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [160, 300] },
  { parameters: { url: "={{ $json.url }}", ...CABECERAS, options: OPCIONES_HTTP },
    id: "cv-http", name: "HTTP: Página del listado",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [380, 440] },
  { parameters: { jsCode: CODE_APUNTAR }, id: "cv-apuntar", name: "Code: Apuntar los ids",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [600, 440] },
  { parameters: { jsCode: CODE_CRUZAR }, id: "cv-cruzar", name: "Code: Cruzar por id",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [380, 160] },
  { parameters: condicion("cv-c-seguir", "seguir"), id: "cv-if", name: "IF: ¿se dan las bajas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [600, 160] },
  { parameters: { options: {} }, id: "cv-loop2", name: "Loop: trozo a trozo",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [820, 80] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cv-pg-bajas", name: "PG: Dar de baja",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1020, 200],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "cv-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [1020, -40] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "cv-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1220, -40],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Las que damos por vivas")]] },
  [CRON]:                       { main: [[L("PG: Las que damos por vivas")]] },
  "PG: Las que damos por vivas": { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo":   { main: [[L("Code: Generar páginas")]] },
  "Code: Generar páginas":      { main: [[L("IF: ¿se pudo medir?")]] },
  "IF: ¿se pudo medir?":        { main: [[L("Loop: página por página")], [L("Code: Cruzar por id")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada página. Tenerlas al revés
  // dispara el HTTP al acabar la pasada: le pasaba al enriquecedor de Autocasión.
  "Loop: página por página":    { main: [[L("Code: Cruzar por id")], [L("HTTP: Página del listado")]] },
  "HTTP: Página del listado":   { main: [[L("Code: Apuntar los ids")]] },
  "Code: Apuntar los ids":      { main: [[L("Loop: página por página")]] },
  "Code: Cruzar por id":        { main: [[L("IF: ¿se dan las bajas?")]] },
  // Sin bajas que dar -porque frenó o porque no había- se va directo al parte:
  // una pasada que no hace nada también se apunta, y con el motivo.
  "IF: ¿se dan las bajas?":     { main: [[L("Loop: trozo a trozo")], [L("Code: Resumen")]] },
  "Loop: trozo a trozo":        { main: [[L("Code: Resumen")], [L("PG: Dar de baja")]] },
  "PG: Dar de baja":            { main: [[L("Loop: trozo a trozo")]] },
  "Code: Resumen":              { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  // El id que n8n le dio la primera vez. Sin el, importar no actualiza:
  // crea una copia con su propio cron y n8n lo da por bueno. Y NO vale
  // inventarse uno: tiene que ser este, o la copia se crea igual.
  id: "6CwPwT7pT7wNZmPO",
  name: "CanalCar – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "canalcar-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  7 peticiones por pasada para verificar 459 ofertas, cruzando por id");
console.log("  (por url, su sitemap daba por muertos 51 coches que siguen a la venta)");
