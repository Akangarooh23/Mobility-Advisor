/**
 * Comprueba el verificador de CanalCar.
 *
 *   npm run test:canalcar-verify
 *
 * Baja las páginas de verdad y se las da a los nodos Code tal como están en el
 * JSON del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK,
 * que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE CRUCE POR ID Y NO POR URL. En CanalCar la url no identifica al coche
 *     -es /marca/modelo/texto-de-la-version, sin número, y la reescriben-. Por
 *     url, su sitemap daba por muertos 154 de los nuestros; por id son 103.
 *     Los 51 de diferencia están vivos.
 *
 *   - LOS TRES FRENOS, cada uno con su caso:
 *       1. una página que falla  -> ni una baja
 *       2. una vuelta que viene corta -> ni una baja
 *       3. una mortandad imposible -> ni una baja
 *     Y que en los tres casos el parte lo diga, en vez de terminar en verde.
 *
 *   - QUE LA MEMORIA SE LIMPIE. Es del workflow, no de la pasada: si los ids
 *     de una pasada sobreviven a la siguiente, la siguiente no da ninguna baja
 *     y nadie se entera.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "canalcar-verificar-activas.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$ || (() => uno({})), ctx.$input, () => ctx.estatico, { id: "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const varios = (js) => ({ first: () => ({ json: js[0] }), all: () => js.map((j) => ({ json: j })),
  item: { json: js[0] } });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Una pasada entera: mide, recorre las páginas y cruza. */
function pasada(estatico, paginaUno, respuestas, nuestras) {
  const m = ejecuta(codigo("Code: Generar páginas"), { estatico, $input: uno(paginaUno) });
  const paginas = m.items.map((x) => x.json).filter((x) => x.hay);
  for (const p of paginas) {
    const res = respuestas(p.page);
    ejecuta(codigo("Code: Apuntar los ids"), {
      estatico,
      $: () => uno({ page: p.page }),
      $input: uno(res),
    });
  }
  const c = ejecuta(codigo("Code: Cruzar por id"), {
    estatico,
    $: (n) => (n === "PG: Las que damos por vivas" ? varios(nuestras) : uno({})),
    $input: uno({}),
  });
  const r = ejecuta(codigo("Code: Resumen"), { estatico, $input: uno({}) });
  return { medida: m, paginas: paginas, cruce: c, resumen: r.items[0].json, log: r.log };
}

(async () => {
  console.log("\n── CanalCar · verificador ──────────────────────────────────\n");

  // ── 0. El workflow, por dentro ───────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("todos los Postgres llevan la credencial que existe",
    pgs.length > 0 && pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"),
    pgs.length + " nodos");
  comprueba("la consulta de activas filtra por portal y por is_active",
    /portal = 'canalcar'/.test(nodo("PG: Las que damos por vivas").parameters.query)
    && /is_active/.test(nodo("PG: Las que damos por vivas").parameters.query));
  for (const [buc, quien] of [["Loop: página por página", "HTTP: Página del listado"],
                              ["Loop: trozo a trozo", "PG: Dar de baja"]]) {
    const s = wf.connections[buc].main;
    comprueba("la salida 1 de «" + buc + "» es la que trabaja",
      s[1] && s[1][0] && s[1][0].node === quien, s[1] && s[1][0] ? s[1][0].node : "(vacía)");
  }
  comprueba("no se usa el sitemap en ninguna parte",
    JSON.stringify(wf).indexOf("sitemap") === -1);

  // ── 1. La medida, contra la página de verdad ─────────────────────────────
  console.log("\n  midiendo el catálogo de verdad");
  const r1 = await fetch("https://www.canalcar.es/coches-ocasion",
    { headers: H, signal: AbortSignal.timeout(60000) });
  const html1 = await r1.text();
  const est = {};
  const med = ejecuta(codigo("Code: Generar páginas"), { estatico: est, $input: uno({ data: html1, statusCode: r1.status }) });
  const paginas = med.items.map((x) => x.json).filter((x) => x.hay);
  comprueba("mide el catálogo y genera todas sus páginas", paginas.length >= 6,
    paginas.length + " páginas, " + est.cc_total + " coches declarados");
  comprueba("la primera página no lleva ?page=", paginas[0].url.indexOf("page=") === -1);
  comprueba("la última sí", paginas[paginas.length - 1].url.indexOf("page=" + paginas.length) !== -1);

  // ── 2. La vuelta entera, de verdad ───────────────────────────────────────
  console.log("\n  la vuelta entera (" + paginas.length + " peticiones)");
  const htmls = {};
  for (const p of paginas) {
    await dormir(1100);
    const r = await fetch(p.url, { headers: H, signal: AbortSignal.timeout(60000) });
    htmls[p.page] = { data: await r.text(), statusCode: r.status };
    ejecuta(codigo("Code: Apuntar los ids"), {
      estatico: est, $: () => uno({ page: p.page }), $input: uno(htmls[p.page]),
    });
  }
  comprueba("ninguna página falló", est.cc_fallos === 0, est.cc_fallos + " fallos");
  comprueba("recoge el catálogo entero", est.cc_ids.length >= est.cc_total * 0.97,
    est.cc_ids.length + " de " + est.cc_total);
  comprueba("los ids llevan el prefijo cnc_", est.cc_ids.every((x) => x.indexOf("cnc_") === 0),
    "p.ej. " + est.cc_ids[0]);
  comprueba("no hay ids repetidos", new Set(est.cc_ids).size === est.cc_ids.length);

  // ── 3. El cruce contra la base de verdad ─────────────────────────────────
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const vivas = (await c.query(
    "SELECT id FROM moveadvisor_market_offers WHERE portal='canalcar' AND is_active")).rows;
  const cruce = ejecuta(codigo("Code: Cruzar por id"), {
    estatico: est,
    $: (n) => (n === "PG: Las que damos por vivas" ? varios(vivas) : uno({})),
    $input: uno({}),
  });
  const trozos = cruce.items.map((x) => x.json).filter((x) => x.seguir);
  console.log("\n  el cruce con la base");
  /*
   * Que no haya bajas NO es un fallo: significa que su listado y el nuestro
   * coinciden, y con el verificador corriendo a diario ese es el caso normal.
   * Lo que sí sería un fallo es que no las haya SIN explicación -ni bajas, ni
   * `cc_nada`, ni motivo de freno-, porque eso es el cruce sin ejecutarse.
   *
   * Esto pedía `bajas > 0` y por eso llevaba meses en rojo: solo pasaba los
   * días en que el portal iba por delante de nosotros. Los casos con bajas de
   * verdad se cubren más abajo, con listas inventadas, que es donde se pueden
   * provocar a voluntad.
   */
  comprueba("el cruce llega hasta el final", trozos.length > 0 || est.cc_nada === true,
    (est.cc_muertas || 0) + " de " + est.cc_nuestras + " bajas");
  comprueba("no frenó", !est.cc_motivo, est.cc_motivo || "sin motivo");
  comprueba("vivas + muertas = las que teníamos", est.cc_vivas + est.cc_muertas === est.cc_nuestras);

  /*
   * Y lo que de verdad importa de una baja, que antes solo se contaba: que el
   * coche sea nuestro y que no esté en su listado. Un cruce que diera de baja
   * ids de otro portal, o ids que sí están en la página, pasaba las tres
   * comprobaciones de arriba sin despeinarse.
   */
  const nuestrasIds = new Set(vivas.map((x) => String(x.id)));
  const suyos = new Set(est.cc_ids || []);
  const bajasIds = trozos.flatMap((t) => (t.sql.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1)));
  comprueba("cada baja es una de las nuestras", bajasIds.every((id) => nuestrasIds.has(id)),
    bajasIds.length + " ids");
  comprueba("y ninguna sigue en su listado", bajasIds.every((id) => !suyos.has(id)));

  /*
   * LA COMPROBACIÓN QUE JUSTIFICA ESTE FICHERO.
   *
   * La alternativa barata es su sitemap.vehicles.xml: UNA petición en vez de
   * siete. Se descartó porque cruza por url, y en CanalCar la url no
   * identifica al coche. Aquí se mide contra el sitemap de verdad, para que si
   * alguien «optimiza» esto a una sola petición, la prueba le diga a cuántos
   * coches vivos le costaría.
   */
  await dormir(1100);
  const rs = await fetch("https://www.canalcar.es/sitemap.vehicles.xml",
    { headers: H, signal: AbortSignal.timeout(60000) });
  const xml = await rs.text();
  const sinBarra = (u) => {
    const t = String(u || "").trim();
    return t.charAt(t.length - 1) === "/" ? t.slice(0, -1) : t;
  };
  const delSitemap = new Set();
  for (const trozo of xml.split("<loc>").slice(1)) {
    const fin = trozo.indexOf("</loc>");
    if (fin !== -1) delSitemap.add(sinBarra(trozo.slice(0, fin)));
  }
  const conUrl = (await c.query(
    "SELECT id, url FROM moveadvisor_market_offers WHERE portal='canalcar' AND is_active")).rows;
  const muertasPorUrl = conUrl.filter((o) => !delSitemap.has(sinBarra(o.url))).length;
  comprueba("cruzar por id mata MENOS coches que cruzar por el sitemap",
    est.cc_muertas < muertasPorUrl,
    "por id " + est.cc_muertas + "  ·  por sitemap " + muertasPorUrl
    + "  ·  " + (muertasPorUrl - est.cc_muertas) + " coches vivos que el sitemap mataría");

  // ── 4. El SQL, contra la base y deshecho ─────────────────────────────────
  console.log("\n  el SQL de las bajas");
  await c.query("BEGIN");
  try {
    let tocadas = 0;
    for (const t of trozos) tocadas += (await c.query(t.sql)).rowCount;
    comprueba("el UPDATE toca exactamente las que dice", tocadas === est.cc_muertas,
      tocadas + " filas");
    const quedan = (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='canalcar' AND is_active")).rows[0].n;
    comprueba("después quedan vivas las que dice el cruce", quedan === est.cc_vivas,
      quedan + " vivas");
    const resumen = ejecuta(codigo("Code: Resumen"), { estatico: est, $input: uno({}) });
    const parte = resumen.items[0].json;
    await c.query(parte.sql);
    comprueba("el parte se apunta en verify_runs", true, parte.bajas + " bajas anotadas");
    comprueba("la memoria queda limpia",
      !Object.keys(est).some((k) => k.indexOf("cc_") === 0), Object.keys(est).length + " claves");
  } finally {
    await c.query("ROLLBACK");
  }
  await c.end();

  // ── 5. Los tres frenos ───────────────────────────────────────────────────
  console.log("\n  los frenos");
  const nuestras = vivas.slice(0, 200);
  const todasSuyas = (p) => htmls[p] || { data: "", statusCode: 200 };

  // Freno 1: una página que falla.
  const e1 = {};
  const p1 = pasada(e1, { data: html1, statusCode: 200 },
    (p) => (p === 3 ? { data: "", statusCode: 502 } : todasSuyas(p)), nuestras);
  comprueba("una página que falla -> ni una baja",
    p1.cruce.items.every((x) => !x.json.seguir), p1.resumen.motivo);
  comprueba("y el parte lo dice, no termina en verde",
    p1.resumen.bajas === 0 && /no se pudieron leer/.test(p1.resumen.motivo));

  // Freno 2: la vuelta viene corta (páginas que responden 200 pero con menos).
  const e2 = {};
  const p2 = pasada(e2, { data: html1, statusCode: 200 },
    (p) => (p <= 2 ? todasSuyas(p) : { data: '<article data-coche-id="1">x</article>', statusCode: 200 }),
    nuestras);
  comprueba("una vuelta corta -> ni una baja",
    p2.cruce.items.every((x) => !x.json.seguir), p2.resumen.motivo);
  comprueba("y el motivo dice cuántos faltaban", /vino corta/.test(p2.resumen.motivo));

  /*
   * Freno 3: mortandad imposible.
   *
   * Hay que llegar hasta él, y para eso los frenos 1 y 2 tienen que estar
   * satisfechos: se le dan las páginas BUENAS -catálogo entero, ninguna
   * fallida- y unas ofertas nuestras que no están en él. Así lo único raro es
   * la mortandad, que sale del 100 %.
   *
   * (Al escribir esto puse páginas falsas y lo que saltaba era el freno 2, no
   * el 3. La prueba decía «ok» sin haber probado nada.)
   */
  const e3 = {};
  const inventadas = [];
  for (let i = 0; i < 200; i++) inventadas.push({ id: "cnc_9" + (900000 + i) });
  const p3 = pasada(e3, { data: html1, statusCode: 200 }, todasSuyas, inventadas);
  comprueba("mortandad imposible -> ni una baja",
    p3.cruce.items.every((x) => !x.json.seguir), p3.resumen.motivo);
  comprueba("y el motivo es la mortandad, no otro freno",
    /no es de fiar/.test(p3.resumen.motivo), p3.resumen.motivo);

  // Y el caso bueno: nada que dar de baja.
  const e4 = {};
  const p4 = pasada(e4, { data: html1, statusCode: 200 }, todasSuyas,
    est.cc_ids ? [] : []);
  comprueba("sin ofertas nuestras -> no da bajas y lo dice",
    p4.resumen.bajas === 0, p4.resumen.motivo || "nada que dar de baja");

  // Y que no se pueda medir.
  const e5 = {};
  const p5 = pasada(e5, { data: "", statusCode: 520 }, todasSuyas, nuestras);
  comprueba("si el listado no contesta -> ni una baja",
    p5.resumen.bajas === 0 && /no contestó/.test(p5.resumen.motivo), p5.resumen.motivo);

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
