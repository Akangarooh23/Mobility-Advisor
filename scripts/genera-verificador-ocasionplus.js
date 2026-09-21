/**
 * OcasionPlus – Verificar ofertas activas (por su sitemap)
 *
 * El origen de n8n-workflows/ocasionplus-verificar-activas.json.
 *
 *   node scripts/genera-verificador-ocasionplus.js
 *   npm run test:ocasionplus-verify
 *
 * ── Por qué por sitemap, y no preguntando coche a coche ────────────────────
 *
 * Porque publican su catálogo entero y preguntar uno por uno sería trabajo
 * tirado: 10.209 peticiones para averiguar lo que una sola ya dice.
 *
 * (Aquí había escrito que su robots.txt nos pedía 60 segundos entre
 * peticiones. NO ES CIERTO: ese Crawl-delay está bajo «User-agent: dotbot,
 * AhrefsBot, SemrushBot», tres rastreadores de SEO. Al grupo «*» no le pide
 * ninguna espera. Lo leí sin mirar a qué grupo pertenecía. Preguntar coche a
 * coche sí sería posible —HEAD dice la verdad aquí, 14 de 14, y el 410 es la
 * señal de vendido—, pero sigue sin tener sentido cuando una petición hace el
 * trabajo de diez mil.)
 *
 * Su catálogo está en:
 *
 *     https://www.ocasionplus.com/sitemap.fichas-coches.xml
 *
 * Medido el 21-sep: 2,8 MB, 12.738 fichas, 1,9 segundos. UNA petición. Lo que
 * no está ahí, ya no se vende.
 *
 * Es la misma idea que el verificador de Modrive y el de Flexicar: cuando el
 * portal publica una lista de lo que tiene, preguntar uno por uno es trabajo
 * tirado.
 *
 * ── Lo que puede salir mal, y los dos frenos ───────────────────────────────
 *
 * El riesgo de fiarse de una lista es que la lista venga mal: media, truncada
 * o con otro formato. Entonces «no está en la lista» dejaría de significar «se
 * ha vendido» y esto daría de baja miles de coches vivos de un golpe.
 *
 *   1. EL FICHERO TIENE QUE ESTAR ENTERO. Se comprueba que el XML termine en
 *      </urlset>. Una descarga cortada a la mitad es un XML que parsea igual
 *      de bien y que dice que faltan seis mil coches.
 *
 *   2. TECHO DE MORTANDAD. Si las que faltan pasan del 40% de las nuestras, se
 *      para. Hoy son el 21% -2.173 de 10.209- y eso es un mes entero sin
 *      mirar. Un 90% no sería un buen mes de ventas: sería la lista rota.
 *
 * Con los dos frenos puestos, el peor caso es que una pasada no haga nada y lo
 * diga en su parte.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "uG6rcC7AqSKyEJOW", name: "Postgres account" } };
const REINTENTA = { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 };
const ERROR_WF = "9BwKOPMIzjj3owho";

const SITEMAP = "https://www.ocasionplus.com/sitemap.fichas-coches.xml";
const TOPE_MORTANDAD = 0.4;
// Las bajas van en trozos: 2.173 ids son 35 KB de SQL, pero el primer día de
// un portal parado meses pueden ser muchos más.
const POR_TROZO = 1500;

const ACTIVAS = `-- Lo que damos por vivo de OcasionPlus, para cruzarlo con su lista.
--
-- Solo id y url: son 10.209 filas y todo lo demás sería memoria tirada. n8n
-- guarda en memoria la salida de cada nodo.
SELECT id, url FROM moveadvisor_market_offers
WHERE portal = 'ocasionplus' AND is_active AND COALESCE(url, '') <> ''`;

const CODE_CRUZAR = `// Cruzar nuestra lista con la suya.
const s = $getWorkflowStaticData('global');
s.op_run = $execution.id;
s.op_motivo = '';

const res = $input.first().json;
// Con responseFormat 'text' + fullResponse, n8n deja el cuerpo en 'data', no
// en 'body'. Mirar solo 'body' dejó 4.484 ofertas sin clasificar en Wallapop.
const xml = String(res.data || res.body || '');
const codigo = Number(res.statusCode || 0);

const nuestras = $('PG: Las que damos por vivas').all().map(x => x.json);
s.op_nuestras = nuestras.length;

if (codigo !== 200 || !xml) {
  s.op_motivo = 'el sitemap no contestó (HTTP ' + codigo + ')';
  console.log('[op-verify] NO SE DAN BAJAS: ' + s.op_motivo);
  return [{ json: { seguir: '', sql: null } }];
}

// FRENO 1: el fichero entero.
//
// Una descarga cortada a la mitad parsea igual de bien y dice que faltan seis
// mil coches. El cierre del XML es la única prueba de que llegó completo.
if (xml.trim().slice(-9) !== '</urlset>') {
  s.op_motivo = 'el sitemap llegó cortado (' + Math.round(xml.length / 1024) + ' KB, sin cierre)';
  console.log('[op-verify] NO SE DAN BAJAS: ' + s.op_motivo);
  return [{ json: { seguir: '', sql: null } }];
}

// Las urls de su lista, sin la barra final, que unas la llevan y otras no.
//
// Sin expresión regular: este código viaja dentro de una cadena y dentro de un
// JSON, y por el camino las barras se pierden. Hoy ha pasado cuatro veces, una
// de ellas midiendo justo esto. Mirar el último carácter no se rompe nunca.
const sinBarra = (u) => {
  const t = String(u || '').trim();
  return t.charAt(t.length - 1) === '/' ? t.slice(0, -1) : t;
};
const suyas = new Set();
const trozos = xml.split('<loc>');
for (let i = 1; i < trozos.length; i++) {
  const fin = trozos[i].indexOf('</loc>');
  if (fin === -1) continue;
  suyas.add(sinBarra(trozos[i].slice(0, fin)));
}
s.op_suyas = suyas.size;
console.log('[op-verify] su sitemap trae ' + suyas.size + ' fichas; nosotros damos por vivas ' + nuestras.length);

const muertas = [];
for (const o of nuestras) {
  if (!suyas.has(sinBarra(o.url))) muertas.push(String(o.id));
}
s.op_muertas = muertas.length;
s.op_vivas = nuestras.length - muertas.length;

// FRENO 2: una mortandad imposible es la lista rota, no un buen mes de ventas.
const pct = nuestras.length ? (muertas.length / nuestras.length) : 0;
if (pct > ${TOPE_MORTANDAD}) {
  s.op_motivo = 'faltan el ' + Math.round(pct * 100) + '% de las nuestras: la lista no es de fiar';
  console.log('[op-verify] NO SE DAN BAJAS: ' + s.op_motivo);
  return [{ json: { seguir: '', sql: null } }];
}
if (!muertas.length) {
  s.op_nada = true;
  console.log('[op-verify] nada que dar de baja: todas siguen en su catálogo.');
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
console.log('[op-verify] ' + muertas.length + ' bajas en ' + out.length + ' trozos');
return out;`;

const CODE_RESUMEN = `// El parte de la pasada.
const s = $getWorkflowStaticData('global');

console.log('[op-verify] ── resumen ──');
console.log('  dábamos por vivas : ' + (s.op_nuestras || 0));
console.log('  su catálogo trae  : ' + (s.op_suyas || 0));
console.log('  BAJAS             : ' + (s.op_muertas || 0));
console.log('  siguen vivas      : ' + (s.op_vivas || 0));
if (s.op_nada) console.log('  nada que dar de baja: todas siguen en su catálogo.');
if (s.op_motivo) console.log('  NO SE DIERON BAJAS: ' + s.op_motivo);

// Si un freno paró la pasada, no se ha dado ni una baja: el recuento de
// muertas es lo que HABRÍA hecho, no lo que hizo.
const frenada = !!s.op_motivo;
const bajas = frenada ? 0 : (s.op_muertas || 0);
const vivas = frenada ? 0 : (s.op_vivas || 0);

const n = v => String(Number(v) || 0);
// La tabla de los verificadores, con portal='ocasionplus':
//     checked  las que dábamos por vivas   alive  las que siguen
//     deactivated  las bajas               unclassified  las que no se dieron
//     transient  0 (una sola petición)     blocked  TRUE si frenó
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('ocasionplus', NOW(), " + n(s.op_nuestras) + ', ' + n(vivas) + ', '
  + n(bajas) + ', ' + n(frenada ? (s.op_muertas || 0) : 0) + ', 0, '
  + (frenada ? 'TRUE' : 'FALSE') + ', 0)';

const parte = { sql: sql, nuestras: s.op_nuestras || 0, suyas: s.op_suyas || 0,
  bajas: bajas, vivas: vivas, motivo: s.op_motivo || '' };
// La memoria es del workflow, no de la pasada: sin limpiarla, el freno de hoy
// seguiría puesto mañana.
for (const k of Object.keys(s)) { if (k.indexOf('op_') === 0) delete s[k]; }
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
// Dos veces al día, en huecos que no pisan a nadie.
const CRON = "2 veces/día (10:20 y 22:20)";
const nodos = [
  { parameters: {}, id: "op-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-640, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 20 10,22 * * *" }] } },
    id: "op-cron", name: CRON,
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-640, 400] },
  { parameters: { operation: "executeQuery", query: ACTIVAS, options: {} },
    id: "op-activas", name: "PG: Las que damos por vivas",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-440, 300],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: {
      url: SITEMAP,
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        { name: "Accept", value: "application/xml,text/xml,*/*;q=0.8" },
        { name: "Accept-Language", value: "es-ES,es;q=0.9" },
      ] },
      options: {
        response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
        // 2,8 MB tardan dos segundos, pero un día lento no puede tumbar la pasada.
        timeout: 120000,
        redirect: { redirect: { followRedirects: true } },
      },
    }, id: "op-http", name: "HTTP: Su catálogo entero (una petición)",
    onError: "continueRegularOutput", executeOnce: true,
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-240, 300] },
  { parameters: { jsCode: CODE_CRUZAR }, id: "op-cruzar",
    name: "Code: Cruzar con su catálogo",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [-40, 300] },
  { parameters: condicion("op-c-seguir", "seguir"), id: "op-if",
    name: "IF: ¿se dan las bajas?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [160, 300] },
  { parameters: { options: {} }, id: "op-loop", name: "Loop: trozo a trozo",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [360, 220] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "op-pg-bajas", name: "PG: Dar de baja",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [560, 340],
    credentials: PG_CRED, ...REINTENTA },
  { parameters: { jsCode: CODE_RESUMEN }, id: "op-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [560, 120] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "op-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [760, 120],
    credentials: PG_CRED, ...REINTENTA },
];

const conexiones = {
  "Ejecutar manualmente":       { main: [[L("PG: Las que damos por vivas")]] },
  [CRON]:                       { main: [[L("PG: Las que damos por vivas")]] },
  "PG: Las que damos por vivas": { main: [[L("HTTP: Su catálogo entero (una petición)")]] },
  "HTTP: Su catálogo entero (una petición)": { main: [[L("Code: Cruzar con su catálogo")]] },
  "Code: Cruzar con su catálogo": { main: [[L("IF: ¿se dan las bajas?")]] },
  // Sin bajas que dar -porque frenó o porque no había- se va directo al parte:
  // una pasada que no hace nada también se apunta, y con el motivo.
  "IF: ¿se dan las bajas?":     { main: [[L("Loop: trozo a trozo")], [L("Code: Resumen")]] },
  // La salida 0 del bucle es TERMINADO y la 1 es cada trozo. Tenerlas al revés
  // dispara el nodo de escritura al acabar: le pasaba al enriquecedor de Autocasión.
  "Loop: trozo a trozo":        { main: [[L("Code: Resumen")], [L("PG: Dar de baja")]] },
  "PG: Dar de baja":            { main: [[L("Loop: trozo a trozo")]] },
  "Code: Resumen":              { main: [[L("PG: Apuntar el parte")]] },
};

const wf = {
  name: "OcasionPlus – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "ocasionplus-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
const PASADAS = String(nodos.find((n) => String(n.type).endsWith("scheduleTrigger"))
  .parameters.rule.interval[0].expression).split(" ")[2].split(",").length;
console.log("  " + nodos.length + " nodos, " + PASADAS + " pasadas/día");
console.log("  UNA petición por pasada para verificar 10.209 ofertas");
console.log("  (su Crawl-delay de 60 s es solo para dotbot, AhrefsBot y SemrushBot)");
