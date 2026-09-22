/**
 * Comprueba el enriquecedor de CanalCar.
 *
 *   npm run test:canalcar-enrich
 *
 * Pide fichas de verdad y se las da a los nodos Code tal como están en el JSON
 * del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK, que
 * se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE COMPRUEBE QUE LA FICHA ES DE ESTE COCHE. La url de CanalCar no lleva
 *     número y la reescriben. Sin mirar el data-coche-id se le escribiría el
 *     color de otro coche a esta fila, que es lo que pasó en Clicars: 10 de
 *     cada 30 fichas eran de otro.
 *
 *   - QUE LA POTENCIA SE GUARDE TAL CUAL. El JSON-LD la etiqueta 'BHP' y es
 *     CV. Convertirla metería un 1,4 % de error en todo el portal.
 *
 *   - QUE MARQUE EL INTENTO SIEMPRE. Una ficha rota que no marca
 *     enrich_tried_at vuelve a la cola tres veces al día para siempre.
 *
 *   - QUE NO RESUCITE NADA. Que una ficha conteste 200 no prueba que el coche
 *     esté a la venta: los de 2020 siguen contestando.
 *
 *   - Y QUE NO PROMETA LO QUE NO PUEDE DAR. La ficha de CanalCar no trae
 *     cilindrada ni CO₂; si alguien añade esas columnas al UPDATE, será
 *     escribiendo algo que no ha leído.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "canalcar-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const EXTRAER = "Code: Extraer color, carrocería, potencia y sitio";
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
  const r = f(ctx.$ || (() => uno({})), ctx.$input, () => ctx.estatico, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Una oferta pasa por «¿toca pedirla?» y por el Code que extrae. */
function pasa(oferta, respuesta, estatico, run) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"), { estatico, run, $input: uno(oferta) });
  const item = t.items[0].json;
  if (!item.pedir) return { saltada: true, json: {}, log: t.log };
  const e = ejecuta(codigo(EXTRAER), {
    estatico, run,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (e.items[0] || { json: {} }).json, log: e.log };
}
/** Una ficha inventada, con el número y los datos que se quieran. */
const ficha = (numero, datos) => ({
  statusCode: 200,
  data: '<div data-coche-id="' + numero + '"></div>'
    + '<script type="application/ld+json">' + JSON.stringify(Object.assign({
      "@context": "https://schema.org", "@type": ["Product", "Car"], name: "Un coche",
      color: "Gris", bodyType: "Hatchback", numberOfDoors: 5, seatingCapacity: 5,
      vehicleEngine: { "@type": "EngineSpecification", enginePower: { value: 110, unitCode: "BHP" } },
      offers: { "@type": "Offer", price: 20990, seller: { "@type": "Organization",
        name: "Canalcar", address: { "@type": "PostalAddress", addressLocality: "Las Rozas" } } },
    }, datos)) + "</script>",
});

(async () => {
  console.log("\n── CanalCar · enriquecedor ─────────────────────────────────\n");

  // ── 0. El workflow, por dentro ───────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("los Postgres llevan la credencial que existe",
    pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"), pgs.length + " nodos");
  comprueba("NO lleva la credencial fantasma del JSON viejo",
    JSON.stringify(wf).indexOf("zoxD0jV8hxZqH0uY") === -1);
  const s = wf.connections["Loop: coche por coche"].main;
  comprueba("la salida 1 del bucle es la que trabaja",
    s[1] && s[1][0] && s[1][0].node === "Code: ¿toca pedirla?");
  comprueba("la salida 0 del bucle va al resumen",
    s[0] && s[0][0] && s[0][0].node === "Code: Resumen");
  comprueba("hay un IF entre el Code y el HTTP",
    wf.connections["Code: ¿toca pedirla?"].main[0][0].node.indexOf("IF") === 0);
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const horas = cron.parameters.rule.interval[0].expression.split(" ")[2].split(",").map(Number);
  comprueba("las pasadas caen entre las 8:00 y las 00:00",
    horas.every((h) => h >= 8 && h < 24), horas.join("h, ") + "h");

  console.log("\n  la cola");
  const cola = nodo("PG: Cola a enriquecer").parameters.query;
  // Quitar los comentarios antes de mirar: si no, se comprueba la prosa.
  const sinComentarios = cola.split("\n").filter((l) => l.trim().indexOf("--") !== 0).join("\n");
  comprueba("solo pide lo que damos por vivo", /is_active/.test(sinComentarios));
  comprueba("respeta enrich_tried_at para no repetir la misma cola",
    /enrich_tried_at IS NULL/.test(sinComentarios));
  comprueba("no pide coches sin url", /COALESCE\(url, ''\) <> ''/.test(sinComentarios));
  comprueba("no busca cilindrada ni CO₂: la ficha no los trae",
    !/displacement/.test(sinComentarios) && !/co2/.test(sinComentarios));

  /*
   * ── 1. Contra fichas de verdad ──────────────────────────────────────────
   *
   * Los coches se sacan DEL LISTADO, no de la base, y esto es a propósito.
   *
   * Pedí 40 urls guardadas al azar: las 26 que siguen en su listado devuelven
   * su ficha, y las 14 que ya no están devuelven la ficha de OTRO COCHE. Ni un
   * 404. Así que una muestra sacada de la base mezcla las dos cosas y el
   * resultado depende de cuánto tiempo lleve el verificador sin pasar.
   *
   * Sacándolos del listado, lo que se prueba es lo que debe cumplirse siempre:
   * un coche a la venta se lee entero.
   */
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();

  const lista = await (await fetch("https://www.canalcar.es/coches-ocasion",
    { headers: H, signal: AbortSignal.timeout(60000) })).text();
  const ofertas = [];
  let ix = 0;
  while (ofertas.length < 3) {
    const a = lista.indexOf('data-coche-id="', ix);
    if (a === -1) break;
    const b = lista.indexOf('"', a + 15);
    const numero = lista.slice(a + 15, b);
    const u = lista.indexOf('data-url="', b);
    const u2 = lista.indexOf('"', u + 10);
    ix = b;
    if (u === -1) continue;
    ofertas.push({ id: "cnc_" + numero, url: "https://www.canalcar.es" + lista.slice(u + 10, u2) });
  }

  console.log("\n  contra " + ofertas.length + " coches que están a la venta hoy");
  const est = {};
  const sqls = [];
  for (const o of ofertas) {
    await dormir(1100);
    const r = await fetch(o.url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(40000) });
    const res = { statusCode: r.status, data: await r.text() };
    const p = pasa(o, res, est, "run-real");
    sqls.push(p.json.sql);
    console.log("      " + o.id.padEnd(12) + "HTTP " + r.status
      + "   campos: " + (p.json.campos || 0));
  }
  comprueba("un coche a la venta se lee entero", est.cn_leidas === ofertas.length,
    est.cn_leidas + " de " + ofertas.length);
  comprueba("ninguno era de otro coche", (est.cn_otro || 0) === 0);
  comprueba("todos producen SQL", sqls.every((x) => !!x));
  comprueba("todas marcan el intento", sqls.every((x) => /enrich_tried_at = NOW\(\)/.test(x)));
  comprueba("ninguna toca is_active", sqls.every((x) => x.indexOf("is_active") === -1));
  comprueba("ninguna toca last_seen_at", sqls.every((x) => x.indexOf("last_seen_at") === -1));
  comprueba("ninguna escribe cilindrada ni CO₂",
    sqls.every((x) => x.indexOf("displacement") === -1 && x.indexOf("co2") === -1));
  comprueba("el color no se pisa si ya lo hay",
    sqls.filter((x) => /color/.test(x)).every((x) => /COALESCE\(NULLIF\(color/.test(x)));
  comprueba("llena el concesionario y la ciudad, que estaban al 0 %",
    sqls.some((x) => /dealer_name/.test(x)) && sqls.some((x) => /city/.test(x)));

  /*
   * ── 1b. La propiedad que de verdad importa ──────────────────────────────
   *
   * Cogiendo ofertas de la base tal como están -mezcla de vivas y de vendidas
   * que nadie ha dado de baja todavía-, lo que NO puede pasar nunca es que a
   * una fila se le escriban los datos de otro coche. O escribe los suyos, o no
   * escribe nada más que el intento.
   */
  const mezcla = (await c.query(`SELECT id, url FROM moveadvisor_market_offers
     WHERE portal='canalcar' AND is_active AND COALESCE(url,'')<>''
     ORDER BY random() LIMIT 4`)).rows;
  console.log("\n  con 4 ofertas de la base, como están");
  const est1b = {};
  let equivocadas = 0;
  for (const o of mezcla) {
    await dormir(1100);
    const r = await fetch(o.url, { headers: H, redirect: "follow", signal: AbortSignal.timeout(40000) });
    const res = { statusCode: r.status, data: await r.text() };
    const p = pasa(o, res, est1b, "run-mezcla");
    // Si la ficha no era suya, lo único que puede llevar el SQL es el intento.
    const escribeDatos = (p.json.campos || 0) > 0;
    const suya = String(res.data).indexOf('data-coche-id="' + o.id.split("_")[1] + '"') !== -1;
    if (escribeDatos && !suya) equivocadas++;
    console.log("      " + o.id.padEnd(12) + (suya ? "su ficha " : "de otro  ")
      + "   campos: " + (p.json.campos || 0));
  }
  comprueba("a ninguna fila se le escriben los datos de otro coche", equivocadas === 0,
    est1b.cn_otro
      ? est1b.cn_otro + " de " + mezcla.length + " urls devolvían otro coche, y se pararon"
      : "las " + mezcla.length + " devolvían la suya");

  // ── 2. Los casos que engañan ─────────────────────────────────────────────
  console.log("\n  los casos que engañan");

  // La ficha de OTRO coche.
  const e1 = {};
  const otro = pasa({ id: "cnc_11111", url: "https://x" }, ficha("22222", {}), e1, "r-otro");
  comprueba("una ficha de otro coche NO se escribe",
    otro.json.campos === 0 && /enrich_tried_at = NOW\(\)/.test(otro.json.sql),
    "solo marca el intento");
  comprueba("y queda contada como «era otro coche»", e1.cn_otro === 1);

  // La misma, pero con el número correcto.
  const e2 = {};
  const bien = pasa({ id: "cnc_22222", url: "https://x" }, ficha("22222", {}), e2, "r-bien");
  comprueba("la ficha correcta sí se escribe", bien.json.campos >= 6, bien.json.campos + " campos");
  comprueba("la potencia se guarda tal cual, sin convertir de BHP",
    /power_cv = 110/.test(bien.json.sql), "110 CV");
  comprueba("y el kW se deriva de los CV", /power_kw = 81/.test(bien.json.sql),
    "110 x 0,7355 = 81 kW");

  // Una potencia imposible no se guarda.
  const e3 = {};
  const rara = pasa({ id: "cnc_3", url: "https://x" },
    ficha("3", { vehicleEngine: { enginePower: { value: 4, unitCode: "BHP" } } }), e3, "r-rara");
  comprueba("una potencia de 4 CV no se guarda", rara.json.sql.indexOf("power_cv") === -1);

  // Una ficha sin JSON-LD.
  const e4 = {};
  const vacia = pasa({ id: "cnc_4", url: "https://x" },
    { statusCode: 200, data: '<div data-coche-id="4"></div><html>nada</html>' }, e4, "r-vacia");
  comprueba("una ficha sin JSON-LD solo marca el intento", vacia.json.campos === 0);

  // Un 404.
  const e5 = {};
  const muerta = pasa({ id: "cnc_5", url: "https://x" }, { statusCode: 404, data: "" }, e5, "r-404");
  comprueba("un 404 solo marca el intento", muerta.json.campos === 0);
  comprueba("y no da el coche por muerto", muerta.json.sql.indexOf("is_active") === -1);

  // El item vacío de una consulta sin filas.
  const e6 = {};
  const nada = pasa({}, { statusCode: 200, data: "" }, e6, "r-nada");
  comprueba("el item vacío de una cola sin filas no dispara el HTTP", nada.saltada);

  // El cortacircuitos.
  const e7 = {};
  for (let i = 0; i < 20; i++) {
    pasa({ id: "cnc_" + i, url: "https://x" }, { statusCode: 503, data: "" }, e7, "r-corta");
  }
  comprueba("quince fichas seguidas sin leer paran la pasada", e7.cn_parado === true, e7.cn_motivo);
  const despues = pasa({ id: "cnc_99", url: "https://x" }, ficha("99", {}), e7, "r-corta");
  comprueba("y después ya no se pide ninguna más", despues.saltada);

  /*
   * ── 3. El SQL, contra la base y deshecho ────────────────────────────────
   *
   * Se usan las ofertas de la base -no las del listado-, porque 98 de los
   * coches que tienen hoy no están todavía en nuestra tabla y un UPDATE sobre
   * una fila que no existe no toca nada y no prueba nada.
   */
  console.log("\n  el SQL, contra la base (y deshecho)");
  const dela = (await c.query(`SELECT id FROM moveadvisor_market_offers
     WHERE portal='canalcar' AND is_active ORDER BY random() LIMIT 4`)).rows;
  const estSql = {};
  const sqlsBase = dela.map((o) =>
    pasa(o.id ? { id: o.id, url: "https://x" } : {}, ficha(String(o.id).split("_")[1], {}),
      estSql, "run-sql").json.sql);
  await c.query("BEGIN");
  try {
    let tocadas = 0;
    for (const sql of sqlsBase) tocadas += (await c.query(sql)).rowCount;
    comprueba("cada UPDATE toca una fila y solo una", tocadas === sqlsBase.length, tocadas + " filas");
    const q = (await c.query(`SELECT count(enrich_tried_at)::int marcadas
      FROM moveadvisor_market_offers WHERE id = ANY($1)`,
      [dela.map((o) => o.id)])).rows[0];
    comprueba("las cuatro quedan marcadas", q.marcadas === dela.length);
    const resumen = ejecuta(codigo("Code: Resumen"), { estatico: est, $input: uno({}) });
    await c.query(resumen.items[0].json.sql);
    comprueba("el parte se apunta en verify_runs", true,
      resumen.items[0].json.leidas + " fichas leídas");
    comprueba("la memoria queda limpia",
      !Object.keys(est).some((k) => k.indexOf("cn_") === 0));
  } finally {
    await c.query("ROLLBACK");
  }
  await c.end();

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
