/**
 * El origen de n8n-workflows/vian-verificar-activas.json.
 *
 *   node scripts/genera-verificador-vian.js
 *   npm run test:vian-verificar
 *
 * ── Por qué este va por listado y no ficha por ficha ───────────────────────
 *
 * Van tres concesionarios y tres formas distintas de decir «vendido». Esto no
 * se puede dar por hecho: hay que medirlo en cada uno antes de escribir nada.
 *
 *   Gamboa   la ficha redirige con un 301 al listado de su categoría
 *   Modrive  desaparece del sitemap
 *   VIAN     la ficha SIGUE DEVOLVIENDO 200
 *
 * Comprobado el 2026-09-07 sobre una oferta que constaba de baja: 200. O sea que
 * aquí preguntar oferta por oferta no distingue absolutamente nada, y un
 * verificador copiado del de Gamboa daría por vivo el catálogo entero para
 * siempre sin fallar nunca.
 *
 * Lo que sí es concluyente es el listado: 54 páginas de 12 coches. Lo que no
 * está ahí, está vendido. Sale además baratísimo —unas 55 peticiones al día
 * frente a las 622 de preguntar una a una— y por eso este verificador se parece
 * más al de Modrive, que enumera el sitemap, que al de Gamboa.
 *
 * ── La regla que no se puede aflojar ───────────────────────────────────────
 *
 * Solo se da de baja si el barrido llegó ENTERO hasta el final. Con medio
 * listado leído, una oferta que no aparece puede estar viva en la página que no
 * llegamos a pedir. Si una página falla, o si se acaba el tope de páginas antes
 * de llegar al final natural, no se da de baja a nadie: se refresca lo visto y
 * se deja constancia en el parte.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

const BASE = "https://www.comprayconduce.es/coches-ocasion/";
const POR_PAGINA = 12;
const TOPE_PAGINAS = 80;      // solo un tope de seguridad: se para solo antes
const ESPERA_SEGUNDOS = 2;

// El cortacircuitos. Esto retira coches del escaparate, así que si de golpe casi
// todo sale de baja es que ha cambiado el listado, no que hayan liquidado el
// concesionario.
const TOPE_MORTANDAD = 0.5;

const CODE_PLAN = `// De la página 1 salen los primeros coches y el tamaño del catálogo.
const res = $input.first().json;
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);

const s = $getWorkflowStaticData('global');
s.vian_inicio = new Date().toISOString();
s.vian_fallo = false;
s.vian_completo = false;
s.vian_vistos = 0;
s.vian_paginas = 0;
s.vian_ids = {};

if (codigo !== 200 || !cuerpo) {
  console.log('[vian-verificar] la página 1 devolvió HTTP ' + codigo + '. No se toca nada.');
  s.vian_fallo = true;
  return [];
}

const m = cuerpo.match(/([\\d.]{2,7})\\s*(?:veh[ií]culos|coches|resultados)/i);
const total = m ? Number(String(m[1]).replace(/\\./g, '')) : 0;
// Dos páginas de margen sobre lo que dice el listado. El tope de ${TOPE_PAGINAS} es solo
// una red: el barrido se para solo cuando una página no aporta coches nuevos.
const paginas = Math.min(${TOPE_PAGINAS}, total > 0 ? Math.ceil(total / ${POR_PAGINA}) + 2 : ${TOPE_PAGINAS});
s.vian_total = total;

console.log('[vian-verificar] el listado publica ' + (total || '?') + ' coches -> hasta ' + paginas + ' páginas');

const out = [];
for (let p = 1; p <= paginas; p++) {
  out.push({ json: { pagina: p, url: '${BASE}' + (p > 1 ? '?pagina=' + p : ''), planificadas: paginas } });
}
return out;`;

const CODE_PAGINA = `// Cada página sella como publicado lo que trae. La base hace de acumulador:
// no hay que arrastrar listas entre vueltas del bucle.
const item = $('Loop: página por página').item.json;
const res = $input.first().json;
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);

const s = $getWorkflowStaticData('global');

// Ya se acabó el listado: no se pide más. Fuera de rango VIAN NO devuelve una
// página vacía, repite la última, así que la señal de final es que una página no
// aporte ningún coche NUEVO. Esperando páginas vacías se pedían 80 en vez de 54.
if (s.vian_completo || s.vian_fallo) return [{ json: { sql: null } }];

// Un fallo de red llega aquí con código 0 gracias a onError. Deja el barrido
// incompleto: a partir de aquí no se puede deducir nada de una ausencia.
if (codigo !== 200 || !cuerpo) {
  console.log('[vian-verificar] la página ' + item.pagina + ' devolvió HTTP ' + codigo
    + '. Barrido incompleto: no se dará de baja a nadie.');
  s.vian_fallo = true;
  return [{ json: { sql: null } }];
}

const ids = [...new Set(
  [...cuerpo.matchAll(/\\/ficha-vehiculo-ocasion\\/[^"'\\s]*?\\/(\\d{6,})/g)].map(x => x[1])
)];

s.vian_ids = s.vian_ids || {};
const nuevos = ids.filter(i => !s.vian_ids[i]);
ids.forEach(i => { s.vian_ids[i] = 1; });
s.vian_paginas = (s.vian_paginas || 0) + 1;
s.vian_vistos = Object.keys(s.vian_ids).length;

if (!nuevos.length) {
  // Se llegó al final del listado por las buenas: eso es lo que autoriza a dar
  // de baja lo que no ha aparecido.
  s.vian_completo = true;
  console.log('[vian-verificar] final del listado en la página ' + item.pagina
    + ': ' + s.vian_vistos + ' coches distintos.');
  return [{ json: { sql: null } }];
}

// Se casa por la clave primaria, no por la URL: nuestro id es literalmente
// 'vian_' + el numero que trae el listado. Una expresion regular sobre
// source_url fallaria justo el dia que el concesionario cambie la ruta de sus
// fichas, que es lo que han hecho Gamboa y Modrive esta misma semana.
const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
// updated_at no se toca: volver a ver un anuncio no es un cambio del anuncio.
// Y no se reactiva nada aquí: de resucitar se encarga el veredicto, que es quien
// sabe si el barrido fue completo.
const sql = 'UPDATE moveadvisor_marketplace_vo_offers'
  + ' SET last_seen_at = NOW(), last_checked_at = NOW()'
  + ' WHERE id IN (' + nuevos.map(function (x) { return esc('vian_' + x); }).join(', ') + ')';

console.log('[vian-verificar] página ' + item.pagina + ': ' + ids.length + ' coches ('
  + nuevos.length + ' nuevos, ' + s.vian_vistos + ' acumulados)');
return [{ json: { sql: sql, pagina: item.pagina, nuevos: nuevos.length } }];`;

const CODE_VEREDICTO = `// Fin del barrido. Aquí pasan dos cosas, y la primera pasa siempre:
//
//   1. Se apunta el parte, aunque no se haya podido verificar nada.
//   2. Si el listado se leyó ENTERO y ninguna página falló, se da de baja lo
//      que no apareció y se resucita lo que reapareció.
//
// No hace falta la lista de ausentes: las ofertas vistas llevan last_checked_at
// sellado durante este barrido y las que no conservan el valor viejo. La propia
// fecha las separa.
const s = $getWorkflowStaticData('global');
const inicio = String(s.vian_inicio || '');
if (!inicio) return [];

const vistos = s.vian_vistos || 0;
const paginas = s.vian_paginas || 0;
const completo = !!s.vian_completo && !s.vian_fallo;

const n = v => String(Number(v) || 0);
const apunte = (bajas, vivas) =>
  'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " SELECT 'vian', NOW(), " + n(vistos) + ', ' + vivas + ', ' + bajas
  + ', 0, 0, ' + (s.vian_fallo ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS}';

if (!completo) {
  const motivo = s.vian_fallo ? 'una página falló' : 'no se llegó al final del listado';
  console.log('[vian-verificar] ' + vistos + ' coches vistos en ' + paginas + ' páginas, pero '
    + motivo + '. No se da de baja a nadie.');
  return [{ json: { sql: apunte('0', '0'), bajas: false } }];
}

// El UPDATE va dentro de un CTE de la MISMA sentencia que el apunte: así el
// número de bajas que queda escrito es el de verdad, y si algo falla no queda ni
// el apunte ni las bajas a medias.
const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const sql = 'WITH bajas AS ('
  + ' UPDATE moveadvisor_marketplace_vo_offers'
  + ' SET is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()'
  + " WHERE portal = 'vian' AND is_active"
  + ' AND (last_checked_at IS NULL OR last_checked_at < ' + esc(inicio) + ')'
  + ' RETURNING 1'
  + '), vivas AS ('
  + ' UPDATE moveadvisor_marketplace_vo_offers'
  + ' SET is_active = TRUE, updated_at = NOW()'
  + " WHERE portal = 'vian' AND is_active IS FALSE"
  + ' AND last_checked_at >= ' + esc(inicio)
  + ' RETURNING 1'
  + ') ' + apunte('(SELECT count(*) FROM bajas)', n(vistos));

console.log('[vian-verificar] barrido completo: ' + paginas + ' páginas, ' + vistos
  + ' coches. Se dan de baja las activas que no han aparecido.');
return [{ json: { sql: sql, bajas: true } }];`;

const CODE_FRENO = `// El cortacircuitos, antes de aplicar nada.
//
// Este workflow retira coches del escaparate. Si el barrido dice que ha
// desaparecido más de la mitad del catálogo, eso no es que el concesionario haya
// vendido 300 coches en un día: es que el listado ha cambiado de forma y ya no
// lo sabemos leer. Mejor quedarse corto y que lo miremos.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;
const vistos = s.vian_vistos || 0;
const total = Number(s.vian_total || 0);

if (item.bajas && total > 0 && vistos < total * ${1 - TOPE_MORTANDAD}) {
  console.log('[vian-verificar] PARADO: el listado dice tener ' + total + ' coches y solo se han'
    + ' visto ' + vistos + '. Eso no es una liquidación, es que el listado ha cambiado.');
  return [{ json: { sql: null, parado: true } }];
}
return [{ json: item }];`;

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

const HTTP = (url) => ({
  url: url,
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
    { name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    { name: "Accept-Language", value: "es-ES,es;q=0.9" },
  ]},
  options: {
    response: { response: { fullResponse: true, neverError: true, responseFormat: "text" } },
    timeout: 30000,
    redirect: { redirect: { followRedirects: true } },
  },
});

const nodos = [
  { parameters: {}, id: "vv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-400, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 20 4,16 * * *" }] } },
    id: "vv-cron", name: "2 veces/día (4:20 y 16:20)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-400, 400] },
  { parameters: HTTP(BASE), id: "vv-http1", name: "HTTP: Contar el catálogo",
    // Un fallo de red no puede tumbar el run: llega como código 0 y se trata.
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [-160, 300] },
  { parameters: { jsCode: CODE_PLAN }, id: "vv-plan", name: "Code: Planificar barrido",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [60, 300] },
  { parameters: { options: {} }, id: "vv-loop", name: "Loop: página por página",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [280, 300] },

  { parameters: { jsCode: CODE_VEREDICTO }, id: "vv-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [520, 160] },
  { parameters: { jsCode: CODE_FRENO }, id: "vv-freno", name: "Code: Cortacircuitos",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [740, 160] },
  { parameters: condicionSql("vv-c-baja"), id: "vv-if-baja", name: "IF: ¿hay algo que aplicar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [960, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "vv-pg-fin", name: "PG: Apuntar y dar de baja",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1180, 160], credentials: PG_CRED },

  { parameters: HTTP("={{ $json.url }}"), id: "vv-httpn", name: "HTTP: Página del listado",
    onError: "continueRegularOutput",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [520, 440] },
  { parameters: { jsCode: CODE_PAGINA }, id: "vv-pagina", name: "Code: Sellar los vistos",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [740, 440] },
  { parameters: condicionSql("vv-c-sellar"), id: "vv-if-sellar", name: "IF: ¿hay que sellar?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [960, 440] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "vv-pg-sellar", name: "PG: Sellar página",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1180, 360], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "vv-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1400, 440],
    webhookId: "a1d7e4c9-vian-verificar" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":        { main: [[L("HTTP: Contar el catálogo")]] },
  "2 veces/día (4:20 y 16:20)":  { main: [[L("HTTP: Contar el catálogo")]] },
  "HTTP: Contar el catálogo":    { main: [[L("Code: Planificar barrido")]] },
  "Code: Planificar barrido":    { main: [[L("Loop: página por página")]] },
  // salida 0 del bucle = terminado, salida 1 = siguiente página
  "Loop: página por página":     { main: [[L("Code: Veredicto")], [L("HTTP: Página del listado")]] },
  "Code: Veredicto":             { main: [[L("Code: Cortacircuitos")]] },
  "Code: Cortacircuitos":        { main: [[L("IF: ¿hay algo que aplicar?")]] },
  "IF: ¿hay algo que aplicar?":  { main: [[L("PG: Apuntar y dar de baja")], []] },
  "HTTP: Página del listado":    { main: [[L("Code: Sellar los vistos")]] },
  "Code: Sellar los vistos":     { main: [[L("IF: ¿hay que sellar?")]] },
  "IF: ¿hay que sellar?":        { main: [[L("PG: Sellar página")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Sellar página":           { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: página por página")]] },
};

const wf = {
  name: "VIAN – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "vian-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, barrido del listado, ~55 peticiones por pasada");
