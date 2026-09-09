/**
 * El origen de n8n-workflows/gamboa-verificar-activas.json.
 *
 *   node scripts/genera-verificador-gamboa.js
 *   npm run test:gamboa-verificar
 *
 * ── Por que hace falta ─────────────────────────────────────────────────────
 *
 * `moveadvisor_marketplace_vo_offers` no es dato de mercado: es el escaparate,
 * lo que ve el cliente y sobre lo que pide cita. Y hasta hoy nadie comprobaba
 * nunca si esos coches seguian existiendo. La cifra que lo resume: 4.449
 * marcados como disponibles para comprar y CERO marcados como vendidos en toda
 * la historia de la tabla.
 *
 * En Gamboa se nota: el concesionario publica 683 coches y nosotros teniamos
 * 960 como activos. Sobran ~277. De las seis ofertas mas caras que se probaron,
 * cuatro ya no existian.
 *
 * ── Como se sabe que un coche ya no esta ───────────────────────────────────
 *
 * Gamboa NO devuelve 404 cuando vende un coche: **redirige** la ficha al
 * listado de su categoria. Medido el 2026-09-06, sin seguir redirects:
 *
 *   viva    ->  HTTP 200, sin redirect
 *   vendida ->  HTTP 301  Location: /toyota-c-hr-ocasion-madrid
 *
 * Por eso el nodo HTTP va con followRedirects DESACTIVADO. Es la diferencia
 * entre una señal positiva y una corazonada.
 *
 * ── La version anterior de esto estaba mal, y en silencio ──────────────────
 *
 * El primer intento miraba el CONTENIDO: si la pagina no traia la tabla tecnica
 * -`class="resultado"`- se daba por muerta. Parecia razonable hasta que se
 * comprobo contra el sitio de verdad: la pagina de listado a la que redirige
 * contiene `class="resultado"` 48 veces, y la ficha caida 6.
 *
 * O sea que habria clasificado como VIVAS todas las muertas. Habria corrido
 * cada noche informando de cero bajas, y las 277 ofertas fantasma seguirian en
 * el escaparate para siempre sin que nada fallara nunca.
 *
 * Ese es el motivo de que aqui la regla sea el codigo de estado y no el HTML:
 * el maquetado de un concesionario cambia; un 301 significa lo mismo siempre.
 *
 * ── El cortacircuitos, y por que la cola va al azar ────────────────────────
 *
 * Este workflow retira coches del ESCAPARATE. Si algo se tuerce -una migracion
 * del sitio que redirija medio catalogo, un balanceador mal configurado- el run
 * se para solo en cuanto la mortandad se dispara. Mejor quedarse corto y que lo
 * miremos, que vaciar la tienda de madrugada.
 *
 * Eso obliga a que la cola vaya en orden ALEATORIO, que es lo unico que aqui
 * parece un capricho y no lo es. Ordenada por antiguedad, las primeras son las
 * que el scraper dejo de ver en el listado, o sea justo las vendidas: el frente
 * de la cola es 100% mortandad por construccion y el cortacircuitos salta
 * siempre. Paso de verdad el 2026-09-06 -25 miradas, 25 bajas, 308 sin mirar- y
 * a ese ritmo el catalogo no se terminaba de verificar nunca.
 *
 * Al azar, la mortandad de cualquier tramo se parece a la del catalogo entero,
 * que es justo lo que el cortacircuitos necesita medir.
 */
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");

const PG_CRED = { postgres: { id: "zoxD0jV8hxZqH0uY", name: "Postgres account" } };

// TODO el catalogo en una sola pasada, y cabe porque se pide con HEAD.
//
// Con GET no cabia: n8n guarda en memoria la salida de cada vuelta del bucle, y
// una ficha de Gamboa pesa 200 KB. Las 961 juntas son ~190 MB, y el verificador
// de Wallapop ya se colgo asi a la vuelta 1.551 con cuerpos de 13 KB.
//
// Con HEAD el cuerpo pesa 0 y el problema desaparece. Comprobado contra Gamboa
// el 2026-09-06 sobre ocho ofertas, cuatro vivas y cuatro vendidas: HEAD y GET
// devuelven el MISMO codigo en las ocho. Esa comprobacion no es opcional -en
// Wallapop, HEAD devuelve 404 sobre ofertas VIVAS, y fiarse de el alli habria
// dado de baja el catalogo entero-.
const LOTE = 1200;
const ESPERA_SEGUNDOS = 1;

// El cortacircuitos: a partir de estas comprobaciones, si el porcentaje de
// bajas pasa del limite, se para.
//
// Cuenta SOLO muertes nuevas -ofertas que constaban activas y ya no estan-
// sobre el numero de ACTIVAS miradas. Reconfirmar un coche que ya sabiamos
// vendido no es mortandad: es la comprobacion semanal haciendo su trabajo.
//
// Contarlas rompio el verificador tres dias seguidos. Ver el comentario de la
// consulta de la cola.
//
// Y solo tiene sentido con la cola en orden aleatorio dentro de cada grupo. Con
// la cola ordenada por antiguedad medía el frente -las vendidas- en vez del
// catalogo, y saltaba siempre. La mortandad real medida en una pasada completa
// fue del 63%; el 85% solo se alcanza si ha pasado algo de verdad, como que el
// concesionario rehaga su web y empiece a redirigirlo todo.
const MINIMO_PARA_JUZGAR = 50;
const TOPE_MORTANDAD = 0.85;

const COLA = `-- Las ofertas de Gamboa que toca comprobar hoy.
--
-- Las ACTIVAS van cada dia: son las que estan en el escaparate y las que un
-- cliente puede intentar comprar. Las que YA CONSTAN DE BAJA van una vez por
-- semana, solo para que una que se diera por muerta por error pueda resucitar.
--
-- Antes entraban las dos con el mismo filtro de 20 horas, y eso rompio el
-- verificador entero durante tres dias. Las 548 activas se habian comprobado a
-- mano el 2026-09-08 a las 17:09, asi que el filtro de 20 horas las dejaba
-- fuera; la cola quedaba con las 444 bajas y NADA MAS. Cada reconfirmacion de
-- una muerta contaba como baja para el cortacircuitos, que saltaba a las 50
-- fichas con "mortandad del 100%" y cortaba la pasada antes de llegar a
-- ninguna viva. Las cuatro pasadas del dia se gastaban en eso:
--
--     09/09 04:01   activas 0   ya de baja 50   BLOQUEADA
--     08/09 16:01   activas 0   ya de baja 42   BLOQUEADA
--
-- Ademas, reconfirmar 444 muertas cada dia son 444 peticiones para enterarse de
-- algo que ya sabemos. Una vez por semana sobra.
SELECT id, source_url, is_active
FROM moveadvisor_marketplace_vo_offers
WHERE portal = 'gamboa'
  AND COALESCE(source_url, '') <> ''
  AND (
    (is_active AND (last_checked_at IS NULL
                    OR last_checked_at < NOW() - INTERVAL '20 hours'))
    OR
    (NOT is_active AND (last_checked_at IS NULL
                        OR last_checked_at < NOW() - INTERVAL '7 days'))
  )
-- Las activas primero, y dentro de cada grupo al azar.
--
-- Primero las activas porque son las que importan: si una pasada se queda a
-- medias -por un corte de red o por el propio cortacircuitos-, lo que tiene que
-- haberse comprobado ya es el escaparate, no el cementerio.
--
-- Y al azar dentro del grupo porque el orden por antiguedad ponia delante justo
-- las que el scraper habia dejado de ver, o sea las vendidas: el frente de la
-- cola era 100% mortandad POR CONSTRUCCION. Paso el 2026-09-06: 25 miradas, 25
-- bajas, 308 sin mirar.
ORDER BY is_active DESC, random()
LIMIT ${LOTE}`;

const CODE_TOCA = `// Arranque de ejecucion, cortacircuitos y guarda de cola vacia.
const s = $getWorkflowStaticData('global');
const item = $input.first().json;

if (!s.gam_run || s.gam_run !== $execution.id) {
  s.gam_run = $execution.id;
  s.gam_parado = false;
  s.gam_vistas = 0;
  s.gam_vivas = 0;
  s.gam_bajas = 0;
  s.gam_raras = 0;
  s.gam_fallos = 0;
  s.gam_motivo = '';
  // Las dos que miden de verdad la mortandad: activas miradas y muertes
  // nuevas. Las reconfirmaciones de bajas ya sabidas no entran en ninguna.
  s.gam_activas_vistas = 0;
  s.gam_bajas_nuevas = 0;
}

// Una cola vacia no llega como "nada". Cuando la consulta no devuelve filas,
// n8n manda UN ITEM VACIO: recorre el bucle igual que una oferta, llega al nodo
// HTTP sin url y lo revienta con "URL parameter must be a string, got
// undefined". Asi cayeron las cuatro ejecuciones programadas de la madrugada del
// 2026-09-07, y era el caso normal: el dia anterior se habia verificado todo el
// catalogo y con el filtro de 20 horas no habia nada elegible hasta la tarde.
//
// Un item sin oferta se trata como si nos hubieran parado: no se pide nada, no
// cuenta para el parte y el run termina limpio.
if (!item || !item.id || !String(item.source_url || '').trim()) {
  console.log('[gamboa-verificar] no hay nada que verificar ahora mismo.');
  return [{ json: Object.assign({}, item || {}, { saltar: true }) }];
}

return [{ json: Object.assign({}, item, { saltar: !!s.gam_parado }) }];`;

const CODE_VEREDICTO = `// El veredicto sobre UNA ficha de Gamboa.
//
// El nodo HTTP va SIN seguir redirects a proposito, porque ahi esta la señal:
//
//   viva    ->  HTTP 200
//   vendida ->  HTTP 301  Location: /la-categoria-de-ese-coche
//
// Mirar el HTML en vez del codigo de estado seria un error: la pagina a la que
// redirige contiene la marca class="resultado" 48 veces, o sea los mismos
// marcadores que una ficha viva. Un verificador que se fiara del contenido
// daria por vivas todas las muertas y no lo diria nunca.
const oferta = $('Code: ¿toca pedirla?').item.json;
const res = $input.first().json;
const cuerpo = String(res.body || res.data || '');
const codigo = Number(res.statusCode || 0);
const cabeceras = res.headers || {};
const destino = String(cabeceras.location || cabeceras.Location || '');

const s = $getWorkflowStaticData('global');
const id = String(oferta.id || '');
const eraActiva = oferta.is_active !== false;
if (!id) return [{ json: { sql: null } }];

const esc = v => "'" + String(v).replace(/'/g, "''") + "'";
const soloFecha = (veredicto) => [{ json: {
  sql: 'UPDATE moveadvisor_marketplace_vo_offers SET last_checked_at = NOW() WHERE id = ' + esc(id),
  veredicto: veredicto,
} }];

// ── fallo pasajero ─────────────────────────────────────────────────────────
// Un 500 o un timeout no dicen nada del coche. Se rota la fecha para que la
// cola siga girando, y no se toca is_active ni last_seen_at: no lo hemos visto.
if (codigo === 0 || codigo >= 500) {
  s.gam_fallos = (s.gam_fallos || 0) + 1;
  return soloFecha('pasajero');
}

s.gam_vistas = (s.gam_vistas || 0) + 1;
if (eraActiva) s.gam_activas_vistas = (s.gam_activas_vistas || 0) + 1;

// ── sigue publicado ────────────────────────────────────────────────────────
// Se pide con HEAD, asi que no hay cuerpo que mirar: la señal es el codigo.
// Sin redirects de por medio, un 200 en la URL de la ficha significa que la
// ficha sigue ahi.
//
// Como cordura se mira el content-type: si algun dia deja de contestar HTML,
// mejor enterarse por una cola de 'raras' que darlo todo por bueno.
const tipo = String(cabeceras['content-type'] || cabeceras['Content-Type'] || '');
const tieneFicha = codigo === 200 && (!tipo || /html/i.test(tipo));

if (tieneFicha) {
  s.gam_vivas = (s.gam_vivas || 0) + 1;
  // Si constaba inactiva y ha reaparecido, se resucita: asi una baja por error
  // se corrige sola sin que nadie tenga que mirarlo.
  const sets = eraActiva
    ? 'last_checked_at = NOW(), last_seen_at = NOW()'
    : 'is_active = TRUE, last_checked_at = NOW(), last_seen_at = NOW(), updated_at = NOW()';
  return [{ json: { sql: 'UPDATE moveadvisor_marketplace_vo_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: eraActiva ? 'viva' : 'resucitada' } }];
}

// ── ya no esta ─────────────────────────────────────────────────────────────
// Un redirect a otra pagina: el coche se ha vendido y Gamboa manda al visitante
// a su categoria.
//
// Con una salvedad. Si el destino sigue llevando el numero de la oferta, no es
// una venta, es el sitio normalizando su propia URL -de mayusculas a
// minusculas, o cambiando el slug del modelo-. Eso no da de baja a nadie.
const esRedirect = codigo === 301 || codigo === 302 || codigo === 307 || codigo === 308;
const numeroOferta = (String(oferta.source_url || '').match(/(\\d{4,})\\s*$/) || [])[1] || '';
const seLoLleva = esRedirect && !(numeroOferta && destino.indexOf(numeroOferta) >= 0);
const esBaja = codigo === 404 || codigo === 410 || seLoLleva;

if (esRedirect && !seLoLleva) {
  // El destino lleva el numero de la oferta, asi que no es una venta: Gamboa ha
  // cambiado el slug. Se guarda la URL NUEVA.
  //
  // Antes solo se rotaba la fecha, y eso dejaba muertas para siempre a las que
  // ya constaban de baja: su URL vieja no volveria a dar 200 nunca. Medido el
  // 2026-09-09 sobre 25 bajas al azar, CUATRO estaban vivas en su URL nueva
  // -16%-. Sobre las 444 bajas de Gamboa son unos 70 coches fuera del
  // escaparate que se pueden vender.
  //
  // No se resucita aqui: eso seria adivinar que el destino esta vivo, y
  // comprobarlo costaria una segunda peticion por ficha. Con la URL corregida,
  // la proxima pasada la pide directamente y, si contesta 200, la resucita ella
  // sola por el camino normal.
  //
  // updated_at no se toca: cambiar de URL no es que el anuncio haya cambiado.
  const base = (String(oferta.source_url || '').match(/^https?:\\/\\/[^/]+/) || [''])[0];
  const abs = /^https?:\\/\\//.test(destino) ? destino : (base + destino);
  console.log('[gamboa-verificar] ' + id + ': slug nuevo -> ' + abs);
  if (!base || !destino) return soloFecha('redirect propio');
  return [{ json: {
    sql: 'UPDATE moveadvisor_marketplace_vo_offers SET source_url = ' + esc(abs)
      + ', last_checked_at = NOW() WHERE id = ' + esc(id),
    veredicto: 'slug nuevo',
  } }];
}

if (esBaja) {
  s.gam_bajas = (s.gam_bajas || 0) + 1;
  // Solo es una MUERTE NUEVA si constaba activa. Reconfirmar una baja ya sabida
  // no dice nada de la salud del catalogo.
  if (eraActiva) s.gam_bajas_nuevas = (s.gam_bajas_nuevas || 0) + 1;

  // Cortacircuitos. Si de golpe casi todo lo que estaba vivo sale muerto es que
  // ha cambiado la web del concesionario, no que haya vendido el concesionario
  // entero.
  //
  // Se mide sobre las ACTIVAS miradas, no sobre todo lo mirado. Con el total,
  // una cola llena de bajas ya sabidas daba 100% de mortandad y cortaba la
  // pasada antes de comprobar una sola oferta viva. Paso tres dias seguidos,
  // del 2026-09-07 al 09.
  const activas = s.gam_activas_vistas || 0;
  const nuevas = s.gam_bajas_nuevas || 0;
  if (activas >= ${MINIMO_PARA_JUZGAR} && (nuevas / activas) > ${TOPE_MORTANDAD}) {
    s.gam_parado = true;
    s.gam_motivo = 'mortandad del ' + Math.round(100 * nuevas / activas) + '% en ' + activas + ' activas';
    console.log('[gamboa-verificar] PARADO: ' + s.gam_motivo
      + '. Eso no es que Gamboa haya vendido el concesionario: es que ha cambiado la web.');
    return soloFecha('parado');
  }

  // Si ya constaba inactiva no se toca updated_at: reescribirlo cada dia borra
  // el unico rastro que queda de cuando se cayo el anuncio.
  const sets = eraActiva
    ? 'is_active = FALSE, last_checked_at = NOW(), updated_at = NOW()'
    : 'last_checked_at = NOW()';
  console.log('[gamboa-verificar] BAJA ' + id + (eraActiva ? '' : ' (ya constaba)'));
  return [{ json: { sql: 'UPDATE moveadvisor_marketplace_vo_offers SET ' + sets
    + ' WHERE id = ' + esc(id), veredicto: 'baja' } }];
}

// ── ni una cosa ni la otra ─────────────────────────────────────────────────
// Un 200 que no trae la ficha pero tampoco parece un listado. No se toca
// is_active: se apunta y se mira el registro. Equivocarse por no dar de baja se
// arregla manana; vaciar el escaparate por una corazonada, no.
s.gam_raras = (s.gam_raras || 0) + 1;
console.log('[gamboa-verificar] RARA ' + id + ' (HTTP ' + codigo + ', ' + cuerpo.length
  + ' bytes) ' + oferta.source_url);
return soloFecha('rara');`;

const CODE_RESUMEN = `// El parte de la ejecucion, a moveadvisor_verify_runs.
const s = $getWorkflowStaticData('global');
const vistas = s.gam_vistas || 0;

console.log('[gamboa-verificar] ── resumen ──');
console.log('  fichas miradas   : ' + vistas + ' (' + (s.gam_activas_vistas || 0) + ' estaban activas)');
console.log('  siguen publicadas: ' + (s.gam_vivas || 0));
console.log('  BAJAS NUEVAS     : ' + (s.gam_bajas_nuevas || 0));
console.log('  bajas ya sabidas : ' + ((s.gam_bajas || 0) - (s.gam_bajas_nuevas || 0)));
console.log('  sin clasificar   : ' + (s.gam_raras || 0));
console.log('  fallos pasajeros : ' + (s.gam_fallos || 0));
if (s.gam_parado) console.log('  PARADO POR EL CORTACIRCUITOS: ' + s.gam_motivo);
if ((s.gam_raras || 0) > vistas * 0.1) {
  console.log('  OJO: mas del 10% sin clasificar. Mirar esas URLs: o Gamboa ha');
  console.log('  cambiado el maquetado, o hay un tercer estado que no conocemos.');
}
// Si una pasada no llega a mirar ninguna activa, el escaparate se ha quedado
// sin verificar ese dia aunque el parte salga limpio. Es exactamente lo que
// pasaba del 2026-09-07 al 09 y no lo dijo nadie.
if (!s.gam_parado && (s.gam_activas_vistas || 0) === 0 && vistas > 0) {
  console.log('  OJO: no se ha mirado NI UNA oferta activa. Solo bajas ya sabidas.');
}

const n = v => String(Number(v) || 0);
// 'deactivated' son las bajas NUEVAS. Contar ahi las reconfirmaciones hacia que
// el parte dijera "50 bajas" los dias en que no se habia dado de baja a nadie.
const sql = 'INSERT INTO moveadvisor_verify_runs'
  + ' (portal, run_at, checked, alive, deactivated, unclassified, transient, blocked, wait_seconds)'
  + " VALUES ('gamboa', NOW(), " + n(vistas) + ', ' + n(s.gam_vivas) + ', '
  + n(s.gam_bajas_nuevas) + ', ' + n(s.gam_raras) + ', ' + n(s.gam_fallos) + ', '
  + (s.gam_parado ? 'TRUE' : 'FALSE') + ', ${ESPERA_SEGUNDOS})';

return [{ json: { sql: sql, vistas: vistas, vivas: s.gam_vivas || 0,
  bajas: s.gam_bajas_nuevas || 0, reconfirmadas: (s.gam_bajas || 0) - (s.gam_bajas_nuevas || 0),
  activas_vistas: s.gam_activas_vistas || 0,
  raras: s.gam_raras || 0, fallos: s.gam_fallos || 0, parado: !!s.gam_parado } }];`;

const condicionBooleana = (id, campo) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id, leftValue: "={{ $json." + campo + " }}", rightValue: "",
      operator: { type: "boolean", operation: "true", singleValue: true } }],
    combinator: "and",
  },
  looseTypeValidation: true, options: {},
});
const condicionSql = (id) => ({
  conditions: {
    options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
    conditions: [{ id: id, leftValue: "={{ $json.sql }}", rightValue: "",
      operator: { type: "string", operation: "notEmpty", singleValue: true } }],
    combinator: "and",
  },
  looseTypeValidation: true, options: {},
});

const nodos = [
  { parameters: {}, id: "gv-manual", name: "Ejecutar manualmente",
    type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-400, 200] },
  { parameters: { rule: { interval: [{ field: "cronExpression", expression: "0 0 */6 * * *" }] } },
    id: "gv-cron", name: "4 veces/día (cada 6 h)",
    type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1, position: [-400, 400] },
  { parameters: { operation: "executeQuery", query: COLA, options: {} },
    id: "gv-cola", name: "PG: Cola a verificar",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [-160, 300], credentials: PG_CRED },
  { parameters: { options: {} }, id: "gv-loop", name: "Loop: oferta por oferta",
    type: "n8n-nodes-base.splitInBatches", typeVersion: 3, position: [60, 300] },

  { parameters: { jsCode: CODE_RESUMEN }, id: "gv-resumen", name: "Code: Resumen",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [300, 160] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "gv-pg-parte", name: "PG: Apuntar el parte",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [520, 160], credentials: PG_CRED },

  { parameters: { jsCode: CODE_TOCA }, id: "gv-toca", name: "Code: ¿toca pedirla?",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [300, 440] },
  { parameters: condicionBooleana("gv-c-saltar", "saltar"), id: "gv-if-toca",
    name: "IF: ¿nos hemos parado?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [520, 440] },
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
        // SIN seguir redirects: el 301 ES la señal de que el coche se ha
        // vendido. Siguiendolo se llega al listado, que trae los mismos
        // marcadores que una ficha viva y confunde por completo el veredicto.
        redirect: { redirect: { followRedirects: false } },
      },
      method: "HEAD",
    }, id: "gv-http", name: "HTTP: ¿sigue la ficha?",
    type: "n8n-nodes-base.httpRequest", typeVersion: 4, position: [740, 540] },
  { parameters: { jsCode: CODE_VEREDICTO }, id: "gv-veredicto", name: "Code: Veredicto",
    type: "n8n-nodes-base.code", typeVersion: 2, position: [960, 540] },
  { parameters: condicionSql("gv-c-sql"), id: "gv-if-sql", name: "IF: ¿hay veredicto?",
    type: "n8n-nodes-base.if", typeVersion: 2, position: [1180, 540] },
  { parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} },
    id: "gv-pg", name: "PG: Actualizar oferta",
    type: "n8n-nodes-base.postgres", typeVersion: 2, position: [1400, 460], credentials: PG_CRED },
  { parameters: { amount: ESPERA_SEGUNDOS, unit: "seconds" }, id: "gv-wait",
    name: "Esperar " + ESPERA_SEGUNDOS + "s",
    type: "n8n-nodes-base.wait", typeVersion: 1, position: [1620, 540],
    webhookId: "e5b3c281-gamboa-verificar" },
];

const L = (n) => ({ node: n, type: "main", index: 0 });
const conexiones = {
  "Ejecutar manualmente":    { main: [[L("PG: Cola a verificar")]] },
  "4 veces/día (cada 6 h)":  { main: [[L("PG: Cola a verificar")]] },
  "PG: Cola a verificar":    { main: [[L("Loop: oferta por oferta")]] },
  "Loop: oferta por oferta": { main: [[L("Code: Resumen")], [L("Code: ¿toca pedirla?")]] },
  "Code: Resumen":           { main: [[L("PG: Apuntar el parte")]] },
  "Code: ¿toca pedirla?":    { main: [[L("IF: ¿nos hemos parado?")]] },
  // true = parados: vuelve al bucle sin pedir. false = pedirla.
  "IF: ¿nos hemos parado?":  { main: [[L("Loop: oferta por oferta")], [L("HTTP: ¿sigue la ficha?")]] },
  "HTTP: ¿sigue la ficha?":  { main: [[L("Code: Veredicto")]] },
  "Code: Veredicto":         { main: [[L("IF: ¿hay veredicto?")]] },
  "IF: ¿hay veredicto?":     { main: [[L("PG: Actualizar oferta")], [L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  "PG: Actualizar oferta":   { main: [[L("Esperar " + ESPERA_SEGUNDOS + "s")]] },
  ["Esperar " + ESPERA_SEGUNDOS + "s"]: { main: [[L("Loop: oferta por oferta")]] },
};

const wf = {
  name: "Gamboa – Verificar ofertas activas",
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

const destino = path.join(RAIZ, "n8n-workflows", "gamboa-verificar-activas.json");
fs.writeFileSync(destino, JSON.stringify(wf, null, 2) + "\n");
console.log("escrito  " + destino);
console.log("  " + nodos.length + " nodos, HEAD, " + LOTE + " por pasada (todo el catalogo de una vez)");
console.log("  cada pasada dura ~" + Math.round(LOTE * ESPERA_SEGUNDOS / 60) + " min");
console.log("  cortacircuitos: para si mas del " + Math.round(TOPE_MORTANDAD * 100)
  + "% sale de baja tras " + MINIMO_PARA_JUZGAR + " fichas");
