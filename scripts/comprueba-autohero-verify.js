/**
 * Comprueba el verificador de Autohero.
 *
 *   npm run test:autohero-verify
 *
 * Barre su API de verdad y le da las respuestas a los nodos Code tal como
 * están en el JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE LA PRIMERA PASADA PUEDA HACER SU TRABAJO. Va a dar 2.340 bajas, el
 *     61 % de lo que damos por vivo. Es mucho, y es correcto: son cuatro meses
 *     sin que nadie diera una sola baja. Si alguien baja el techo de mortandad
 *     al 40 % «por prudencia», la limpieza no se hará nunca y nadie lo notará.
 *
 *   - LOS CUATRO FRENOS, cada uno con su caso: una llamada que falla, una
 *     vuelta que viene corta, las dos fuentes que no concuerdan, y una
 *     mortandad imposible. Y que en los cuatro el parte lo diga.
 *
 *   - QUE LA MEMORIA SE LIMPIE entre pasadas.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autohero-verificar-activas.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const nodoApi = nodo("HTTP: Cien coches de su API");
const API = nodoApi.parameters.url;
const H = {};
((nodoApi.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });
const SITEMAP = nodo("HTTP: Su sitemap (segunda opinión)").parameters.url;

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$ || (() => uno({})), ctx.$input, () => ctx.estatico, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const varios = (js) => ({ first: () => ({ json: js[0] }), all: () => js.map((j) => ({ json: j })),
  item: { json: js[0] } });
const pide = async (cuerpo) => {
  const r = await fetch(API, { method: "POST", headers: H, body: cuerpo, signal: AbortSignal.timeout(90000) });
  return { statusCode: r.status, body: await r.json() };
};

/** Una pasada entera: sitemap, medida, vuelta y cruce. */
function pasada(estatico, resSitemap, resContar, respuestas, nuestras, run) {
  const a = ejecuta(codigo("Code: Contar el sitemap"), { estatico, run, $input: uno(resSitemap) });
  const b = ejecuta(codigo("Code: Generar llamadas"), { estatico, run, $input: uno(resContar) });
  const llamadas = b.items.map((x) => x.json).filter((x) => x.hay);
  for (const l of llamadas) {
    ejecuta(codigo("Code: Apuntar los uuid"), {
      estatico, run,
      $: () => uno({ offset: l.offset }),
      $input: uno(respuestas(l.offset)),
    });
  }
  const c = ejecuta(codigo("Code: Cruzar por uuid"), {
    estatico, run,
    $: (n) => (n === "PG: Las que damos por vivas" ? varios(nuestras) : uno({})),
    $input: uno({}),
  });
  const r = ejecuta(codigo("Code: Resumen"), { estatico, run, $input: uno({}) });
  return { llamadas, cruce: c, resumen: r.items[0].json, log: a.log.concat(b.log, c.log, r.log) };
}

(async () => {
  console.log("\n── Autohero · verificador ──────────────────────────────────\n");

  // ── 0. El workflow ───────────────────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("todos los Postgres llevan la credencial que existe",
    pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"), pgs.length + " nodos");
  for (const [buc, quien] of [["Loop: cien en cien", "HTTP: Cien coches de su API"],
                              ["Loop: trozo a trozo", "PG: Dar de baja"]]) {
    const s = wf.connections[buc].main;
    comprueba("la salida 1 de «" + buc + "» es la que trabaja",
      s[1] && s[1][0] && s[1][0].node === quien);
  }
  const cruzar = codigo("Code: Cruzar por uuid");
  const techo = Number((cruzar.match(/pct > ([0-9.]+)/) || [])[1]);
  comprueba("el techo de mortandad deja pasar la limpieza de hoy (61 %)",
    techo > 0.61, "está en el " + Math.round(techo * 100) + " %");

  // ── 1. La vuelta de verdad ───────────────────────────────────────────────
  console.log("\n  la vuelta de verdad");
  const rs = await fetch(SITEMAP, { headers: { "User-Agent": H["user-agent"] }, signal: AbortSignal.timeout(90000) });
  const resSitemap = { statusCode: rs.status, data: await rs.text() };
  const est = {};
  const a = ejecuta(codigo("Code: Contar el sitemap"), { estatico: est, $input: uno(resSitemap) });
  comprueba("cuenta los coches del sitemap", est.av_sitemap > 1000, est.av_sitemap + " coches");

  const resContar = await pide(a.items[0].json.cuerpo);
  const b = ejecuta(codigo("Code: Generar llamadas"), { estatico: est, $input: uno(resContar) });
  const llamadas = b.items.map((x) => x.json).filter((x) => x.hay);
  comprueba("la API y el sitemap concuerdan", !est.av_motivo,
    "API " + est.av_total + "  ·  sitemap " + est.av_sitemap);
  comprueba("genera las llamadas", llamadas.length >= 20, llamadas.length + " llamadas");

  const respuestas = {};
  for (const l of llamadas) {
    respuestas[l.offset] = await pide(l.cuerpo);
    ejecuta(codigo("Code: Apuntar los uuid"), {
      estatico: est, $: () => uno({ offset: l.offset }), $input: uno(respuestas[l.offset]),
    });
  }
  comprueba("ninguna llamada falló", est.av_fallos === 0, est.av_fallos + " fallos");
  comprueba("recoge el catálogo entero", est.av_ids.length >= est.av_total * 0.97,
    est.av_ids.length + " de " + est.av_total);
  comprueba("no hay uuid repetidos", new Set(est.av_ids).size === est.av_ids.length);
  comprueba("los ids llevan el prefijo ah_", est.av_ids.every((x) => x.indexOf("ah_") === 0));

  // ── 2. El cruce contra la base ───────────────────────────────────────────
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const vivas = (await c.query(
    "SELECT id FROM moveadvisor_market_offers WHERE portal='autohero' AND is_active")).rows;
  const cruce = ejecuta(codigo("Code: Cruzar por uuid"), {
    estatico: est,
    $: (n) => (n === "PG: Las que damos por vivas" ? varios(vivas) : uno({})),
    $input: uno({}),
  });
  const trozos = cruce.items.map((x) => x.json).filter((x) => x.seguir);
  console.log("\n  el cruce con la base");
  comprueba("da bajas", trozos.length > 0, est.av_muertas + " de " + est.av_nuestras
    + " (" + Math.round(100 * est.av_muertas / est.av_nuestras) + "%)");
  comprueba("no frenó con la limpieza de cuatro meses", !est.av_motivo, est.av_motivo || "sin motivo");
  comprueba("vivas + muertas = las que teníamos", est.av_vivas + est.av_muertas === est.av_nuestras);

  // ── 3. El SQL, y deshecho ────────────────────────────────────────────────
  console.log("\n  el SQL de las bajas");
  await c.query("BEGIN");
  try {
    let tocadas = 0;
    for (const t of trozos) tocadas += (await c.query(t.sql)).rowCount;
    comprueba("el UPDATE toca exactamente las que dice", tocadas === est.av_muertas, tocadas + " filas");
    const quedan = (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='autohero' AND is_active")).rows[0].n;
    comprueba("después quedan vivas las que dice el cruce", quedan === est.av_vivas, quedan + " vivas");
    const resumen = ejecuta(codigo("Code: Resumen"), { estatico: est, $input: uno({}) });
    await c.query(resumen.items[0].json.sql);
    comprueba("el parte se apunta en verify_runs", true, resumen.items[0].json.bajas + " bajas anotadas");
    comprueba("la memoria queda limpia",
      !Object.keys(est).some((k) => k.indexOf("av_") === 0));
  } finally {
    await c.query("ROLLBACK");
  }
  await c.end();

  // ── 4. Los cuatro frenos ─────────────────────────────────────────────────
  console.log("\n  los frenos");
  const nuestras = vivas.slice(0, 300);
  const todas = (off) => respuestas[off] || { statusCode: 200, body: { data: { searchAdV9AdsV2: { total: est.av_total, data: [] } } } };

  // Freno 1: una llamada que falla.
  const e1 = {};
  const p1 = pasada(e1, resSitemap, resContar,
    (off) => (off === 300 ? { statusCode: 502, body: {} } : todas(off)), nuestras, "r1");
  comprueba("una llamada que falla -> ni una baja",
    p1.cruce.items.every((x) => !x.json.seguir), p1.resumen.motivo);
  comprueba("y el parte lo dice", p1.resumen.bajas === 0 && /no se pudieron leer/.test(p1.resumen.motivo));

  // Freno 2: la vuelta viene corta.
  const e2 = {};
  const p2 = pasada(e2, resSitemap, resContar,
    (off) => (off < 500 ? todas(off) : { statusCode: 200,
      body: { data: { searchAdV9AdsV2: { total: est.av_total, data: [{ id: "x" + off }] } } } }),
    nuestras, "r2");
  comprueba("una vuelta corta -> ni una baja",
    p2.cruce.items.every((x) => !x.json.seguir), p2.resumen.motivo);
  comprueba("y el motivo dice cuántos faltaban", /vino corta/.test(p2.resumen.motivo));

  // Freno 3: las dos fuentes no concuerdan.
  const e3 = {};
  const contarPoco = JSON.parse(JSON.stringify(resContar));
  contarPoco.body.data.searchAdV9AdsV2.total = 200;
  const p3 = pasada(e3, resSitemap, contarPoco, todas, nuestras, "r3");
  comprueba("si la API y el sitemap no concuerdan -> ni una baja",
    p3.resumen.bajas === 0 && /no concuerdan/.test(p3.resumen.motivo), p3.resumen.motivo);

  // Y que sin sitemap se siga trabajando: perder la segunda opinión no puede
  // dejar el portal sin verificar para siempre.
  const e4 = {};
  const p4 = pasada(e4, { statusCode: 503, data: "" }, resContar, todas, nuestras, "r4");
  comprueba("sin sitemap se sigue igual: los otros frenos bastan",
    p4.resumen.bajas > 0, p4.resumen.bajas + " bajas");

  // Freno 4: mortandad imposible, con la vuelta buena y ofertas que no existen.
  const e5 = {};
  const inventadas = [];
  for (let i = 0; i < 300; i++) inventadas.push({ id: "ah_00000000-0000-0000-0000-" + String(100000000000 + i) });
  const p5 = pasada(e5, resSitemap, resContar, todas, inventadas, "r5");
  comprueba("mortandad imposible -> ni una baja",
    p5.resumen.bajas === 0 && /no es de fiar/.test(p5.resumen.motivo), p5.resumen.motivo);

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
