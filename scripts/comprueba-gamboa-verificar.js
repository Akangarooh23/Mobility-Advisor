/**
 * Comprueba el verificador de Gamboa.
 *
 *   npm run test:gamboa-verificar
 *
 * Este workflow da de baja coches del ESCAPARATE, no de una tabla de datos de
 * mercado: una baja mal puesta retira del sitio un coche que se puede vender, y
 * una baja que no se pone deja a un cliente pidiendo cita por un coche que ya
 * no existe. Por eso la prueba es mas dura que las demas.
 *
 * Lo que vigila:
 *
 *   - Que reconozca la baja de Gamboa, que NO es un 404: es un 301 al listado
 *     de la categoria.
 *   - Que el nodo HTTP siga SIN seguir redirects y pidiendo con HEAD. Sin
 *     redirects porque el 301 ES la señal; con HEAD porque asi el cuerpo no
 *     ocupa memoria y las 961 ofertas caben en una sola pasada. Y ojo: que
 *     HEAD sirva aqui no es general -en Wallapop devuelve 404 sobre ofertas
 *     VIVAS, y fiarse de el alli habria dado de baja el catalogo entero-.
 *   - Que un 301 que conserva el numero del coche NO de de baja: eso es la web
 *     cambiando su slug, no una venta.
 *   - Que el cortacircuitos pare el run si la mortandad se dispara.
 *   - Que un 5xx no de de baja a nadie.
 *   - Que una oferta que reaparece viva se resucite sola.
 *   - Que updated_at no se reescriba en una que ya constaba inactiva: es el
 *     unico rastro de cuando se cayo.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "gamboa-verificar-activas.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const cabs = wf.nodes.find((n) => n.type.endsWith("httpRequest")).parameters.headerParameters.parameters;
const H = {}; cabs.forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico, { id: ctx.run || "run-1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }] });

function pasa(oferta, respuesta, estatico, run) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"), { estatico, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (item.saltar) return { saltada: true, log: [] };
  const v = ejecuta(codigo("Code: Veredicto"), {
    estatico, run,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, sql: v.items[0].json.sql, veredicto: v.items[0].json.veredicto, log: v.log };
}

// Las respuestas que puede dar Gamboa, medidas contra el sitio real el
// 2026-09-06 pidiendo SIN seguir redirects.
const FICHA = { statusCode: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: "" };
// Una vendida: 301 al listado de su categoria.
const VENDIDA = { statusCode: 301, headers: { location: "/toyota-c-hr-ocasion-madrid" }, body: "" };
// Un redirect que conserva el numero del coche: la web cambiando su slug, no
// una venta. No puede dar de baja a nadie.
const SLUG_NUEVO = { statusCode: 301, headers: { location: "/nissan-qashqai-ocasion-madrid/nissan-qashqai-tekna-37016" }, body: "" };
// Un 200 que no es HTML: algo raro, y mejor enterarse.
const NO_HTML = { statusCode: 200, headers: { "content-type": "application/json" }, body: "" };

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const act = (await c.query(`SELECT id, source_url, is_active FROM moveadvisor_marketplace_vo_offers
    WHERE portal='gamboa' AND is_active ORDER BY id LIMIT 3`)).rows;
  const inact = (await c.query(`SELECT id, source_url, is_active FROM moveadvisor_marketplace_vo_offers
    WHERE portal='gamboa' AND is_active IS FALSE ORDER BY id LIMIT 1`)).rows[0]
    || Object.assign({}, act[2], { is_active: false });

  // ══ la comprobacion que sostiene todo lo demas ═══════════════════════════
  console.log("EL NODO HTTP");
  const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
  const sigue = (((http.parameters.options || {}).redirect || {}).redirect || {}).followRedirects;
  comprueba("NO sigue redirects: el 301 ES la señal de venta", sigue === false);
  comprueba("y lee la respuesta entera, para ver el codigo y la cabecera Location",
    http.parameters.options.response.response.fullResponse === true
    && http.parameters.options.response.response.neverError === true);
  comprueba("pide con HEAD, para que el cuerpo no ocupe memoria",
    http.parameters.method === "HEAD");

  // ══ lo que mas daño puede hacer ══════════════════════════════════════════
  console.log("\nSI CAMBIA LA WEB DE GAMBOA");
  const e0 = {};
  const noHtml = pasa(act[0], NO_HTML, e0);
  comprueba("un 200 que no es HTML no se da por bueno", noHtml.veredicto === "rara");
  const slug = pasa({ id: "gamboa_37016", is_active: true,
    source_url: "https://www.gamboaocasion.com/nissan-qashqai-ocasion-madrid/nissan-qashqai-x-37016" },
    SLUG_NUEVO, e0);
  slug.log.forEach((l) => console.log("      " + l));
  comprueba("un redirect que conserva el numero guarda la URL nueva",
    /source_url = 'https:\/\/[^']*37016'/.test(slug.sql || ""), slug.veredicto);
  comprueba("  y no toca updated_at: cambiar de URL no es cambiar el anuncio",
    !/updated_at/.test(slug.sql || ""));
  comprueba("un redirect que conserva el numero NO da de baja", !/is_active/.test(slug.sql),
    "(" + slug.veredicto + ")");

  // ══ el cortacircuitos ════════════════════════════════════════════════════
  console.log("\nEL CORTACIRCUITOS");
  const e1 = {};
  let bajas = 0;
  for (let i = 0; i < 200; i++) {
    const r = pasa(act[0], VENDIDA, e1);
    if (r.saltada) break;
    if (/is_active = FALSE/.test(r.sql || "")) bajas++;
  }
  comprueba("para cuando casi todo lo VIVO sale de baja", e1.gam_parado === true);
  // Y con la cola AL AZAR, que es lo que hace que ese porcentaje signifique
  // algo. Ordenada por antiguedad medía el frente de la cola -las vendidas- en
  // vez del catalogo, y el cortacircuitos saltaba en todas las pasadas.
  const cola = wf.nodes.find((n) => n.name === "PG: Cola a verificar").parameters.query;
  comprueba("la cola va al azar dentro de cada grupo",
    /ORDER BY is_active DESC, random\(\)/.test(cola));
  comprueba("y el catalogo entero cabe en una pasada",
    Number((cola.match(/LIMIT (\d+)/) || [])[1]) >= 1000);
  comprueba("y lo hace pronto: el daño queda acotado", bajas <= 60, "(" + bajas + " bajas antes de parar)");
  console.log("      motivo: " + e1.gam_motivo);
  const tras = pasa(act[1], VENDIDA, e1);
  comprueba("despues de parar ya no pide nada mas", tras.saltada === true);

  // ══ una cola llena de bajas que YA sabíamos ══════════════════════════════
  //
  // Esto tumbó el verificador tres días seguidos sin que nadie se enterara.
  //
  // La cola metía las inactivas con el mismo filtro de 20 horas que las
  // activas. Las 548 vivas se habían comprobado a mano el 8-sep a las 17:09, o
  // sea que el filtro las dejaba fuera, y la cola quedaba con las 444 bajas y
  // nada más. Cada reconfirmación sumaba como «baja», el cortacircuitos leía
  // «mortandad del 100%» y cortaba la pasada antes de mirar UNA sola oferta
  // viva. Cuatro pasadas al día tirándose así:
  //
  //     09/09 04:01   activas 0   ya de baja 50   BLOQUEADA
  //     08/09 16:01   activas 0   ya de baja 42   BLOQUEADA
  //
  // Reconfirmar un coche que ya sabíamos vendido no es mortandad.
  console.log("\nUNA COLA LLENA DE BAJAS QUE YA SABÍAMOS");
  const e1b = {};
  const yaMuerta = Object.assign({}, act[0], { is_active: false });
  let reconfirmadas = 0;
  for (let i = 0; i < 200; i++) {
    const r = pasa(yaMuerta, VENDIDA, e1b);
    if (r.saltada) break;
    reconfirmadas++;
  }
  comprueba("NO salta el cortacircuitos", e1b.gam_parado !== true,
    e1b.gam_motivo ? "(dijo: " + e1b.gam_motivo + ")" : "");
  comprueba("las mira todas, no corta la pasada", reconfirmadas === 200,
    "(" + reconfirmadas + " de 200)");
  comprueba("no cuentan como bajas nuevas", (e1b.gam_bajas_nuevas || 0) === 0);
  comprueba("ni como activas miradas", (e1b.gam_activas_vistas || 0) === 0);
  comprueba("y no reescriben updated_at, que es la fecha real de la baja",
    !/updated_at/.test(pasa(yaMuerta, VENDIDA, {}).sql || ""));

  // Y la cola ya no las trae cada día: las vivas cada 20 horas, las muertas una
  // vez por semana. Reconfirmar 444 muertas a diario son 444 peticiones para
  // enterarse de algo que ya sabemos.
  comprueba("la cola pide las activas cada día",
    /is_active AND \(last_checked_at IS NULL[\s\S]{0,80}INTERVAL '20 hours'/.test(cola));
  comprueba("y las que ya constan de baja, una vez por semana",
    /NOT is_active AND \(last_checked_at IS NULL[\s\S]{0,90}INTERVAL '7 days'/.test(cola));

  // ══ los veredictos, contra la base ═══════════════════════════════════════
  console.log("\nVEREDICTOS (con ROLLBACK)");
  const e2 = {};
  await c.query("BEGIN");
  try {
    const viva = pasa(act[0], FICHA, e2);
    comprueba("una ficha con tabla tecnica = sigue publicada", viva.veredicto === "viva");
    comprueba("no mueve updated_at si no ha cambiado nada", !/updated_at/.test(viva.sql));
    await c.query(viva.sql);
    let f = (await c.query(`SELECT is_active, last_seen_at FROM moveadvisor_marketplace_vo_offers
      WHERE id=$1`, [act[0].id])).rows[0];
    comprueba("sigue activa y con last_seen_at fresco", f.is_active === true
      && Date.now() - new Date(f.last_seen_at).getTime() < 60000);

    const baja = pasa(act[1], VENDIDA, e2);
    baja.log.forEach((l) => console.log("      " + l));
    comprueba("un redirect al listado = baja", baja.veredicto === "baja");
    await c.query(baja.sql);
    f = (await c.query(`SELECT is_active FROM moveadvisor_marketplace_vo_offers WHERE id=$1`,
      [act[1].id])).rows[0];
    comprueba("y la retira del escaparate", f.is_active === false);

    const res = pasa(Object.assign({}, inact, { is_active: false }),
      FICHA, e2);
    comprueba("una inactiva que reaparece se resucita", res.veredicto === "resucitada"
      && /is_active = TRUE/.test(res.sql));

    const yaBaja = pasa(Object.assign({}, inact, { is_active: false }),
      VENDIDA, e2);
    comprueba("una baja ya sabida no reescribe updated_at", !/updated_at/.test(yaBaja.sql));
    comprueba("  (si lo hiciera, borraria la fecha real de la baja)", !/is_active/.test(yaBaja.sql));
  } finally { await c.query("ROLLBACK"); }

  // ══ fallos pasajeros ═════════════════════════════════════════════════════
  console.log("\nFALLOS PASAJEROS");
  const e3 = {};
  for (const st of [500, 502, 503, 0]) {
    const r = pasa(act[0], { statusCode: st, headers: {}, body: "" }, e3);
    comprueba("HTTP " + st + " no da de baja", !/is_active/.test(r.sql) && r.veredicto === "pasajero");
  }
  comprueba("y no cuentan como ficha mirada", (e3.gam_vistas || 0) === 0);

  // ══ una ficha real ═══════════════════════════════════════════════════════
  console.log("\nCONTRA GAMBOA DE VERDAD");
  const e4 = {};
  // redirect "manual" para pedir igual que el workflow: sin seguir el 301, que
  // es justo lo que distingue un coche vendido de uno que sigue en venta.
  const muestra = (await c.query(`SELECT id, source_url, is_active
    FROM moveadvisor_marketplace_vo_offers WHERE portal='gamboa' AND is_active
      AND COALESCE(source_url,'')<>'' ORDER BY random() LIMIT 5`)).rows;
  let vivas = 0, vendidas = 0, movidas = 0, raras = 0;
  for (const o of muestra) {
    const r = await fetch(o.source_url, { method: "HEAD", headers: H, redirect: "manual", signal: AbortSignal.timeout(25000) });
    const body = "";
    const cab = {}; r.headers.forEach((v, k) => { cab[k.toLowerCase()] = v; });
    const v = pasa(o, { statusCode: r.status, headers: cab, body }, e4);
    console.log("      " + o.id.padEnd(14) + "HTTP " + String(r.status).padEnd(4)
      + (cab.location ? "-> " + cab.location.slice(0, 34) : "").padEnd(38) + " ->  " + v.veredicto);
    if (v.veredicto === "viva") vivas++;
    else if (v.veredicto === "baja") vendidas++;
    // 'redirect propio' es un veredicto bueno: la web ha cambiado el slug del
    // coche pero el numero sigue siendo el mismo, asi que no es una venta.
    else if (v.veredicto === "redirect propio") movidas++;
    else raras++;
    await new Promise((s) => setTimeout(s, 2000));
  }
  comprueba("clasifica todas sin dejar ninguna sin clasificar", raras === 0,
    "(" + vivas + " vivas, " + vendidas + " vendidas, " + movidas + " con slug nuevo, " + raras + " raras)");

  // Y contra ofertas que YA sabemos vendidas -las que el propio verificador dio
  // de baja-, para que la comprobacion no dependa de que la muestra al azar
  // pille una muerta. Antes exigia eso y era frageil: en cuanto el verificador
  // limpio el catalogo, las muestras salian todas vivas y la prueba fallaba sin
  // que nada estuviera mal.
  const yaMuertas = (await c.query(`SELECT id, source_url, is_active
    FROM moveadvisor_marketplace_vo_offers WHERE portal='gamboa' AND is_active IS FALSE
      AND COALESCE(source_url,'')<>'' ORDER BY random() LIMIT 4`)).rows;
  let confirmadas = 0, conSlugNuevo = 0, resucitables = 0;
  for (const o of yaMuertas) {
    const r = await fetch(o.source_url, { method: "HEAD", headers: H, redirect: "manual", signal: AbortSignal.timeout(25000) });
    const cab = {}; r.headers.forEach((v, k) => { cab[k.toLowerCase()] = v; });
    const v = pasa(o, { statusCode: r.status, headers: cab, body: "" }, e4);
    if (v.veredicto === "baja") confirmadas++;
    if (v.veredicto === "slug nuevo") conSlugNuevo++;
    console.log("      " + o.id.padEnd(14) + "HTTP " + String(r.status).padEnd(4)
      + "(ya de baja)".padEnd(38) + " ->  " + v.veredicto);
    // Si le hemos guardado una URL nueva, esa URL tiene que existir de verdad:
    // es lo que va a resucitar la oferta en la pasada siguiente.
    if (v.veredicto === "slug nuevo") {
      const nueva = (v.sql.match(/source_url = '([^']+)'/) || [])[1];
      await new Promise((s) => setTimeout(s, 900));
      const r2 = await fetch(nueva, { method: "HEAD", headers: H, redirect: "manual", signal: AbortSignal.timeout(25000) });
      console.log("         la URL nueva da HTTP " + r2.status + "   " + nueva.slice(-46));
      if (r2.status === 200) resucitables++;
    }
    await new Promise((s) => setTimeout(s, 1500));
  }
  // Cada una de las que ya constaban de baja tiene que salir clasificada: o
  // vendida de verdad, o con slug nuevo. Lo que no puede quedar es ninguna sin
  // veredicto.
  comprueba("clasifica todas las que ya constaban de baja",
    yaMuertas.length === 0 || confirmadas + conSlugNuevo === yaMuertas.length,
    "(" + confirmadas + " vendidas, " + conSlugNuevo + " con slug nuevo, de " + yaMuertas.length + ")");
  comprueba("y las URLs nuevas que guarda existen de verdad",
    conSlugNuevo === resucitables,
    conSlugNuevo ? "(" + resucitables + " de " + conSlugNuevo + " dan 200)" : "(no ha salido ninguna)");

  // ══ el parte ═════════════════════════════════════════════════════════════
  console.log("\nEL PARTE");
  const resu = ejecuta(codigo("Code: Resumen"), { estatico: e2, $: () => uno({}), $input: uno({}) });
  resu.log.forEach((l) => console.log("      " + l));
  await c.query("BEGIN");
  try {
    await c.query(resu.items[0].json.sql);
    const p = (await c.query(`SELECT * FROM moveadvisor_verify_runs
      WHERE portal='gamboa' ORDER BY id DESC LIMIT 1`)).rows[0];
    comprueba("queda escrito en moveadvisor_verify_runs", !!p);
    comprueba("con el reparto de veredictos", p && p.checked > 0);

    // Y el parte de una pasada que solo ha reconfirmado muertas tiene que decir
    // CERO bajas. Antes decía «50 bajas» los días en que no se dio de baja a
    // nadie, y eso es lo que hacía que la avería pareciera una matanza.
    const soloRecon = ejecuta(codigo("Code: Resumen"),
      { estatico: e1b, $: () => uno({}), $input: uno({}) });
    await c.query(soloRecon.items[0].json.sql);
    const p2 = (await c.query(`SELECT * FROM moveadvisor_verify_runs
      WHERE portal='gamboa' ORDER BY id DESC LIMIT 1`)).rows[0];
    console.log("      pasada de solo reconfirmaciones -> revisadas " + p2.checked
      + ", bajas " + p2.deactivated + ", bloqueada " + p2.blocked);
    comprueba("una pasada de solo reconfirmaciones apunta 0 bajas", p2.deactivated === 0);
    comprueba("y no queda marcada como avería", p2.blocked === false);
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
