/**
 * Comprueba el verificador de Alemania.
 *
 *   npm run test:as24-de-verificar
 *
 * Este workflow decide qué ofertas alemanas cuentan para valorar. Una baja mal
 * puesta borra un comparable; una que no se pone deja una valoración apoyada en
 * un coche que ya se vendió.
 *
 * Lo que vigila, y por qué cada cosa:
 *
 *   - Que NO mire el HTML. Buscar «ya no está disponible» en el cuerpo es lo que
 *     dio de baja 24.746 ofertas el 2026-08-16, de las que el 45% seguía
 *     publicada: esa frase viaja en el diccionario de traducciones de TODAS las
 *     páginas de AutoScout24.
 *   - Que un 3xx que conserva el uuid del coche NO se cuente como venta. Es la
 *     web normalizando su URL. En Gamboa ese mismo caso dejó 90 coches vivos
 *     marcados como muertos para siempre.
 *   - Que el cortacircuitos mida sobre ACTIVAS miradas y muertes NUEVAS. Con el
 *     total, una cola llena de bajas ya sabidas da 100% de mortandad y corta la
 *     pasada antes de comprobar una sola oferta viva.
 *   - Que un 429 o un 503 no den de baja a nadie.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autoscout24-de-verificar-activas.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }] });

/** Una oferta pasa por «¿toca pedirla?» y por «Veredicto». */
function pasa(oferta, respuesta, estatico, run) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (item.saltar) return { saltada: true };
  const v = ejecuta(codigo("Code: Veredicto"), {
    estatico, run,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, sql: v.items[0].json.sql, veredicto: v.items[0].json.veredicto, log: v.log };
}

const UUID = "cb6048b4-efdf-4ffb-8c08-d13974040bf4";
const OFERTA = { id: "as24_x", is_active: true, url: "https://www.autoscout24.es/anuncios/seat-leon-cat_ma74mo123-" + UUID };
// Las respuestas que da AutoScout24, medidas el 2026-09-09 sobre 60 fichas.
const VIVA = { statusCode: 200, headers: {} };
const IDA_410 = { statusCode: 410, headers: {} };
const AL_LISTADO = { statusCode: 301, headers: { location: "/lst/seat/leon" } };
const URL_NUEVA = { statusCode: 308, headers: { location: "/anuncios/seat-leon-nuevo-slug-cat_ma74mo123-" + UUID } };

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  // ══ el nodo HTTP ═════════════════════════════════════════════════════════
  console.log("EL NODO HTTP");
  comprueba("pide con HEAD, para no descargar 344 KB por ficha",
    http.parameters.method === "HEAD");
  comprueba("NO sigue redirecciones: el 301 y el 410 SON la señal",
    ((http.parameters.options || {}).redirect || {}).redirect.followRedirects === false);
  comprueba("lee la respuesta entera, para ver el código y la cabecera Location",
    (((http.parameters.options || {}).response || {}).response || {}).fullResponse === true);
  comprueba("manda User-Agent", !!H["User-Agent"]);
  comprueba("un corte de red no tumba la pasada", http.onError === "continueRegularOutput");
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  // La base es Neon, un Postgres serverless: suspende el motor cuando esta
  // ocioso y despertarlo tarda. El 2026-09-09 eso tumbo tres verificadores con
  // "Connection timed out" y corto el scraper aleman en el segmento 13 de 42 con
  // "Connection terminated unexpectedly". Una consulta que tarda 41 s no es una
  // consulta lenta -medida, tarda 0,9 s- : es el arranque en frio.
  const pg = wf.nodes.filter((n) => n.type.endsWith(".postgres"));
  comprueba("los " + pg.length + " nodos de Postgres reintentan si la conexión se cae",
    pg.every((n) => n.retryOnFail === true && n.maxTries >= 2),
    pg.map((n) => n.maxTries).join(", ") + " intentos");

  // ══ lo que NO puede hacer ════════════════════════════════════════════════
  //
  // La comprobación más importante del fichero.
  console.log("\nLO QUE NO PUEDE HACER");
  // Sin los comentarios: son justamente los que explican el fallo, y nombran las
  // frases prohibidas para que nadie las vuelva a meter.
  const soloCodigo = wf.nodes.filter((n) => n.type.endsWith(".code"))
    .map((n) => n.parameters.jsCode).join("\n")
    .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  comprueba("no busca «ya no está disponible» ni sus traducciones",
    !/ya no est|no longer available|nicht mehr|offer-not-found/i.test(soloCodigo));
  comprueba("no lee el cuerpo de la respuesta en absoluto",
    !/res\.body|res\.data|\bcuerpo\b/.test(soloCodigo));
  comprueba("decide solo con el código y la cabecera Location",
    /res\.statusCode/.test(soloCodigo) && /cabeceras\.location/i.test(soloCodigo));

  // ══ el horario ═══════════════════════════════════════════════════════════
  console.log("\nEL HORARIO");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const p = String(expr).split(" ");
  const horas = String(p[2] || "").split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(p[1]) !== 0,
    "minuto " + p[1]);

  // ══ la cola ══════════════════════════════════════════════════════════════
  console.log("\nLA COLA");
  const cola = wf.nodes.find((n) => n.name === "PG: Cola a verificar").parameters.query;
  comprueba("solo ofertas alemanas de AutoScout24",
    /portal = 'autoscout24'/.test(cola) && /country = 'DE'/.test(cola));
  comprueba("las activas cada día", /is_active AND[\s\S]{0,90}INTERVAL '20 hours'/.test(cola));
  comprueba("y las que ya constan de baja, una vez por semana",
    /NOT is_active AND[\s\S]{0,100}INTERVAL '7 days'/.test(cola));
  comprueba("las activas primero, y al azar dentro del grupo",
    /ORDER BY is_active DESC, random\(\)/.test(cola));

  // ══ los cuatro casos medidos ═════════════════════════════════════════════
  console.log("\nLOS CUATRO CASOS QUE DA AUTOSCOUT24");
  const e = {};
  const viva = pasa(OFERTA, VIVA, e);
  comprueba("200 = sigue publicada", viva.veredicto === "viva");
  comprueba("  y se le refresca last_seen_at", /last_seen_at = NOW\(\)/.test(viva.sql));

  const ida = pasa(OFERTA, IDA_410, e);
  comprueba("410 = vendida", ida.veredicto === "baja" && /is_active = FALSE/.test(ida.sql));

  const listado = pasa(OFERTA, AL_LISTADO, e);
  comprueba("301 al listado del modelo = vendida",
    listado.veredicto === "baja" && /is_active = FALSE/.test(listado.sql));

  const nueva = pasa(OFERTA, URL_NUEVA, e);
  comprueba("308 a la misma ficha = URL normalizada, NO es una venta",
    nueva.veredicto === "url nueva" && !/is_active/.test(nueva.sql || ""));
  comprueba("  y se guarda la URL nueva, absoluta",
    /url = 'https:\/\/www\.autoscout24\.es\/[^']+'/.test(nueva.sql || ""),
    (nueva.sql || "").slice(0, 74));

  // ══ los fallos pasajeros ═════════════════════════════════════════════════
  console.log("\nFALLOS PASAJEROS");
  for (const st of [0, 403, 429, 500, 503]) {
    const r = pasa(OFERTA, { statusCode: st, headers: {} }, {});
    comprueba("HTTP " + st + " no da de baja a nadie",
      r.veredicto === "pasajero" && !/is_active/.test(r.sql || ""));
  }

  // ══ una baja ya sabida ═══════════════════════════════════════════════════
  console.log("\nUNA BAJA QUE YA SABÍAMOS");
  const muerta = Object.assign({}, OFERTA, { is_active: false });
  const re = pasa(muerta, IDA_410, {});
  comprueba("no reescribe updated_at", !/updated_at/.test(re.sql || ""));
  comprueba("  (si lo hiciera, borraría la fecha real de la baja)", !/is_active/.test(re.sql || ""));
  const resu = pasa(muerta, VIVA, {});
  comprueba("y si reaparece, se resucita sola",
    resu.veredicto === "resucitada" && /is_active = TRUE/.test(resu.sql));

  // ══ el cortacircuitos ════════════════════════════════════════════════════
  console.log("\nEL CORTACIRCUITOS");
  const e1 = {};
  let n1 = 0;
  for (let i = 0; i < 400; i++) {
    const r = pasa(OFERTA, AL_LISTADO, e1);
    if (r.saltada) break;
    n1++;
  }
  comprueba("para si casi todo lo VIVO sale de baja", e1.de_parado === true);
  comprueba("y pronto: el daño queda acotado", n1 <= 130, "(" + n1 + " miradas antes de parar)");
  console.log("      motivo: " + e1.de_motivo);

  // Y lo contrario: 400 reconfirmaciones de bajas ya sabidas no pueden pararlo.
  const e2 = {};
  let n2 = 0;
  for (let i = 0; i < 400; i++) {
    const r = pasa(muerta, IDA_410, e2);
    if (r.saltada) break;
    n2++;
  }
  comprueba("NO para reconfirmando bajas que ya sabíamos", e2.de_parado !== true);
  comprueba("  las mira todas", n2 === 400, "(" + n2 + " de 400)");
  comprueba("  y no cuentan como muertes nuevas", (e2.de_bajas_nuevas || 0) === 0);

  // ══ contra AutoScout24 de verdad ═════════════════════════════════════════
  console.log("\nCONTRA AUTOSCOUT24 DE VERDAD");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const filas = (await c.query(`SELECT id, url, is_active FROM moveadvisor_market_offers
    WHERE portal='autoscout24' AND country='DE' AND COALESCE(url,'')<>''
    ORDER BY random() LIMIT 6`)).rows;

  const e3 = {};
  const reparto = {};
  let ultimoSql = null;
  for (const o of filas) {
    let res;
    try {
      const r = await fetch(o.url, { method: "HEAD", headers: H, redirect: "manual",
        signal: AbortSignal.timeout(20000) });
      const cab = {};
      r.headers.forEach((v, k) => { cab[k.toLowerCase()] = v; });
      res = { statusCode: r.status, headers: cab };
    } catch (err) { res = { statusCode: 0, headers: {} }; }
    const v = pasa(o, res, e3);
    reparto[v.veredicto] = (reparto[v.veredicto] || 0) + 1;
    if (v.sql) ultimoSql = v.sql;
    console.log("      HTTP " + String(res.statusCode).padEnd(4) + " -> " + v.veredicto);
    await new Promise((s) => setTimeout(s, 1100));
  }
  comprueba("clasifica todas, sin dejar ninguna sin veredicto",
    !reparto.rara, JSON.stringify(reparto));
  comprueba("y encuentra ofertas vivas de verdad",
    (reparto.viva || 0) + (reparto.resucitada || 0) > 0,
    "(si aquí saliera 0, el verificador vaciaría el mercado alemán)");

  // ══ el parte ═════════════════════════════════════════════════════════════
  console.log("\nEL PARTE");
  const resumen = ejecuta(codigo("Code: Resumen"), { estatico: e3, $: () => uno({}), $input: uno({}) });
  resumen.log.forEach((l) => console.log("      " + l));

  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  await c.query("BEGIN");
  try {
    await c.query(ultimoSql);
    await c.query(resumen.items[0].json.sql);
    const p = (await c.query(`SELECT checked, alive, deactivated, blocked
      FROM moveadvisor_verify_runs WHERE portal='autoscout24-de' ORDER BY id DESC LIMIT 1`)).rows[0];
    comprueba("el veredicto y el parte entran en la base", !!p);
    comprueba("y el parte cuadra con lo mirado", p && p.checked === (e3.de_vistas || 0),
      JSON.stringify(p));
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
