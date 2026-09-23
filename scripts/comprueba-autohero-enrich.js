/**
 * Comprueba el enriquecedor de Autohero.
 *
 *   npm run test:autohero-enrich
 *
 * Pide fichas de verdad y se las da a los nodos Code tal como están en el JSON
 * del workflow. Luego lanza el SQL contra la base dentro de BEGIN/ROLLBACK,
 * que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE LEA LA FECHA, NO LA ETIQUETA. La ficha lleva un diccionario de
 *     traducciones donde "carDetails.features.list.inspectionExpiryDate" vale
 *     "ITV válida hasta". Buscar el nombre del campo a secas encuentra esa
 *     línea primero y no trae ninguna fecha. En OcasionPlus me creí dos veces
 *     que una ficha «no tenía datos» por leer justo eso.
 *
 *   - QUE NO ESCRIBA UNA FECHA QUE NO ES. La página tiene muchas fechas
 *     (última revisión, primera matriculación). Solo vale la que va pegada a
 *     inspectionExpiryDate.
 *
 *   - QUE SE PUEDA LLEGAR A LA FICHA AUNQUE LA URL GUARDADA SEA UNA BÚSQUEDA.
 *     1.063 filas la tienen así.
 *
 *   - QUE MARQUE EL INTENTO SIEMPRE, y que no resucite a nadie.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autohero-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const EXTRAER = "Code: Extraer la ITV y la garantía";
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
  if (!item.pedir) return { saltada: true, json: {}, url: "" };
  const e = ejecuta(codigo(EXTRAER), {
    estatico, run,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (e.items[0] || { json: {} }).json, url: item.url };
}

(async () => {
  console.log("\n── Autohero · enriquecedor ─────────────────────────────────\n");

  // ── 0. El workflow ───────────────────────────────────────────────────────
  console.log("  el workflow");
  const pgs = wf.nodes.filter((n) => n.type.endsWith("postgres"));
  comprueba("los Postgres llevan la credencial que existe",
    pgs.every((n) => n.credentials.postgres.id === "uG6rcC7AqSKyEJOW"), pgs.length + " nodos");
  comprueba("NO lleva la credencial fantasma del JSON viejo",
    JSON.stringify(wf).indexOf("zoxD0jV8hxZqH0uY") === -1);
  const s = wf.connections["Loop: coche por coche"].main;
  comprueba("la salida 1 del bucle es la que trabaja",
    s[1] && s[1][0] && s[1][0].node === "Code: ¿toca pedirla?");
  comprueba("la salida 0 va al resumen", s[0] && s[0][0] && s[0][0].node === "Code: Resumen");
  // La unidad del Wait: sin ella, n8n aplica HORAS y la pasada hace una ficha.
  for (const w of wf.nodes.filter((n) => n.type.endsWith(".wait"))) {
    comprueba("«" + w.name + "» dice su unidad y espera segundos",
      w.parameters.unit === "seconds" && Number(w.parameters.amount) <= 5,
      JSON.stringify(w.parameters));
  }
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const horas = cron.parameters.rule.interval[0].expression.split(" ")[2].split(",").map(Number);
  comprueba("las pasadas caen entre las 8:00 y las 00:00",
    horas.every((h) => h >= 8 && h < 24), horas.join("h, ") + "h");

  console.log("\n  la cola");
  const cola = nodo("PG: Cola a enriquecer").parameters.query;
  const sinComentarios = cola.split("\n").filter((l) => l.trim().indexOf("--") !== 0).join("\n");
  comprueba("solo pide lo que damos por vivo", /is_active/.test(sinComentarios));
  comprueba("la cola la manda la ITV", /next_itv, ''\) = ''/.test(sinComentarios));
  /*
   * Y NO la garantía. De 2.698 fichas leídas, las 2.698 dicen 12 meses: no es
   * un dato por coche, es una constante de la casa. Metiéndola en la condición
   * había 672 coches que ya tenían la ITV y entraban solo por ella: 672
   * páginas de 690 KB para volver a leer el mismo número.
   */
  comprueba("y la garantía no mete a nadie en la cola",
    !/warranty_months/.test(sinComentarios));
  comprueba("pero sí se escribe cuando se lee una ficha",
    /warranty_months = /.test(codigo(EXTRAER)));
  comprueba("respeta enrich_tried_at", /enrich_tried_at IS NULL/.test(sinComentarios));
  const lim = Number((cola.match(/LIMIT (\d+)/) || [])[1]);
  // Cada ficha son 724 KB y n8n retiene la salida de cada vuelta del bucle.
  comprueba("la cola es pequeña: sus fichas pesan 724 KB", lim <= 200,
    lim + " x 724 KB = " + Math.round(lim * 724 / 1024) + " MB retenidos");

  // ── 1. Fichas de verdad ──────────────────────────────────────────────────
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  /*
   * Los coches salen de SU API, no de nuestra base, y esto es a propósito.
   *
   * De las 3.849 filas que damos por vivas, 2.340 están vendidas: el
   * verificador de este portal es nuevo y todavía no ha pasado ni una vez. Una
   * muestra sacada de la base trae dos de cada tres coches muertos -Autohero
   * devuelve 404 para unos y la página de otro coche para otros- y entonces la
   * prueba mide cuánto hace que no se verifica, no si esto funciona. Me pasó
   * al escribirla: 1 de 3.
   *
   * Sacándolos de su API se prueba lo que debe cumplirse siempre: un coche a
   * la venta se lee entero.
   */
  const API = "https://www.autohero.com/v1/retail-customer-gateway/graphql/searchAdV9AdsV2";
  const cuerpoApi = JSON.stringify({
    operationName: "searchAdV9AdsV2",
    variables: { search: { offset: 0, limit: 3, sort: "most_popular",
      filter: { field: "countryCode", op: "eq", value: "ES" }, aggs: [], postFilter: null,
      fields: ["registration"], properties: { abTestViewParams: null, firstPublishedDays: -30,
        shuffleCategoryBResults: false, resultsCombiner: "abbabbc", filterByEligibleDate: true,
        includeProspective: true } }, tradeInId: null },
    query: "query searchAdV9AdsV2($search: EsSearchRequestProjectionInput!, $tradeInId: UUID) { searchAdV9AdsV2(search: $search, tradeInId: $tradeInId) }",
  });
  const jApi = await (await fetch(API, { method: "POST", body: cuerpoApi,
    headers: { "content-type": "application/json", "accept": "*/*",
      "origin": "https://www.autohero.com", "referer": "https://www.autohero.com/es/search/",
      "user-agent": H["User-Agent"] }, signal: AbortSignal.timeout(90000) })).json();
  const ofertas = (jApi.data.searchAdV9AdsV2.data || []).map((x) => ({
    id: "ah_" + x.id,
    url: "https://www.autohero.com/es/" + x.carUrlTitle + "/id/" + x.id + "/",
  }));

  console.log("\n  contra " + ofertas.length + " coches que están a la venta hoy");
  const est = {};
  const sqls = [];
  for (const o of ofertas) {
    await dormir(900);
    const p0 = ejecuta(codigo("Code: ¿toca pedirla?"), { estatico: est, run: "real", $input: uno(o) });
    const u = p0.items[0].json.url;
    const r = await fetch(u, { headers: H, redirect: "follow", signal: AbortSignal.timeout(50000) });
    const res = { statusCode: r.status, data: await r.text() };
    const e = ejecuta(codigo(EXTRAER), {
      estatico: est, run: "real",
      $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: p0.items[0].json } } : uno({})),
      $input: uno(res),
    });
    const j = e.items[0].json;
    sqls.push(j.sql);
    console.log("      " + o.id.slice(0, 14) + "…  HTTP " + r.status + "   "
      + Math.round(res.data.length / 1024) + " KB   ITV: " + (j.itv || "(no trae)"));
  }
  comprueba("lee las fichas", est.ae_leidas === ofertas.length, est.ae_leidas + " de " + ofertas.length);
  comprueba("ninguna era de otro coche", (est.ae_otro || 0) === 0);
  comprueba("saca la fecha de la ITV", (est.ae_con_itv || 0) > 0,
    est.ae_con_itv + " de " + ofertas.length);
  comprueba("todas marcan el intento", sqls.every((x) => /enrich_tried_at = NOW\(\)/.test(x)));
  comprueba("ninguna toca is_active", sqls.every((x) => x.indexOf("is_active") === -1));
  comprueba("ninguna toca last_seen_at", sqls.every((x) => x.indexOf("last_seen_at") === -1));
  comprueba("no escribe nada más que la ITV y la garantía",
    sqls.every((x) => x.indexOf("color") === -1 && x.indexOf("body_type") === -1
      && x.indexOf("price") === -1));

  /*
   * LA FECHA TIENE QUE SER LA DE LA ITV.
   *
   * Se comprueba contra la página: la fecha que escribimos tiene que aparecer
   * ahí en formato 28.10.2026, y pegada a la etiqueta «ITV válida hasta».
   */
  await dormir(900);
  const o0 = ofertas[0];
  const r0 = await fetch("https://www.autohero.com/es/coche/id/" + o0.id.slice(3) + "/",
    { headers: H, redirect: "follow", signal: AbortSignal.timeout(50000) });
  const html0 = await r0.text();
  const p0 = pasa(o0, { statusCode: r0.status, data: html0 }, {}, "slug");
  comprueba("se llega a la ficha con un nombre inventado en la url",
    r0.status === 200 && !p0.saltada && html0.indexOf(o0.id.slice(3)) !== -1,
    p0.url.slice(28, 70));
  if (p0.json.itv) {
    /*
     * La fecha se enseña en DOS formatos y en tres sitios distintos:
     *
     *     «ITV válida hasta: 18/6/27»   en la tira de titulares
     *     «ITV válida hasta» 18.06.2027 en la ficha técnica
     *
     * y una tercera vez dentro del diccionario de traducciones, sin fecha
     * ninguna. Mirar solo la PRIMERA aparición y esperar el formato con
     * puntos hacía fallar esta comprobación con una extracción correcta.
     */
    const d = p0.json.itv.split("-");
    const conPuntos = d[2] + "." + d[1] + "." + d[0];
    const conBarras = Number(d[2]) + "/" + Number(d[1]) + "/" + d[0].slice(2);
    comprueba("la fecha que escribe es la que la página enseña",
      html0.indexOf(conPuntos) !== -1 || html0.indexOf(conBarras) !== -1,
      p0.json.itv + " se ve como " + conPuntos + " y como " + conBarras);
  }
  if (p0.json.garantia !== null && p0.json.garantia !== undefined) {
    comprueba("y la garantía sale de «Garantía Autohero: N Meses»",
      html0.indexOf("Garantía Autohero") !== -1, p0.json.garantia + " meses");
  }

  // ── 2. Los casos que engañan ─────────────────────────────────────────────
  console.log("\n  los casos que engañan");
  const UUID = "2417ceb4-5ba4-498e-981c-ee6e4eb2f7c3";

  // Solo el diccionario de traducción, sin dato: no puede inventarse nada.
  const soloEtiqueta = { statusCode: 200, data: '<div>' + UUID + '</div>'
    + '{"carDetails.features.list.inspectionExpiryDate":"ITV válida hasta",'
    + '"carDetails.carHistory.lastServiceOn":"La última revisión"}' };
  const e1 = {};
  const t1 = pasa({ id: "ah_" + UUID, url: "" }, soloEtiqueta, e1, "r1");
  comprueba("una ficha con solo la etiqueta no escribe fecha", !t1.json.itv,
    "solo marca el intento");

  // Con etiqueta Y dato: tiene que coger el dato.
  const conDato = { statusCode: 200, data: soloEtiqueta.data
    + '{"lastServiceOn":"2026-02-17","inspectionExpiryDate":"2026-10-28"}' };
  const e2 = {};
  const t2 = pasa({ id: "ah_" + UUID, url: "" }, conDato, e2, "r2");
  comprueba("con etiqueta y dato, coge el dato", t2.json.itv === "2026-10-28", t2.json.itv);
  comprueba("y no coge la fecha de la última revisión", t2.json.itv !== "2026-02-17");

  /*
   * LA GARANTÍA NO PUEDE SALIR DEL MENÚ.
   *
   * En las 2.400 fichas, la PRIMERA aparición de «Garantía Autohero» es un
   * enlace de la cabecera y no lleva número:
   *
   *     Garantía Autohero</a><a class="linkItem___OIuu_" ...
   *
   * Quedarse con la primera hizo que una pasada entera sacara la ITV de 42
   * fichas de 43 y la garantía de NINGUNA. Aquí se pone el menú delante y el
   * dato detrás, que es el orden real de la página.
   */
  const conMenu = { statusCode: 200, data: '<div>' + UUID + '</div>'
    + '<a href="/es/garantia">Garantía Autohero</a><a class="linkItem___OIuu_">Comparar</a>'
    + '{"topHighlights":["Garantía Autohero: 12 Meses","Única propietaria"],'
    + '"inspectionExpiryDate":"2027-05-27"}' };
  const e2b = {};
  const t2b = pasa({ id: "ah_" + UUID, url: "" }, conMenu, e2b, "r2b");
  comprueba("la garantía sale del dato, no del enlace del menú", t2b.json.garantia === 12,
    t2b.json.garantia + " meses");
  comprueba("y la ITV de la misma ficha también", t2b.json.itv === "2027-05-27", t2b.json.itv);

  // Un número junto a «Garantía» que no son meses no se guarda.
  const e2c = {};
  const t2c = pasa({ id: "ah_" + UUID, url: "" },
    { statusCode: 200, data: '<div>' + UUID + '</div>Garantía Autohero por 2.500 euros' }, e2c, "r2c");
  comprueba("un «Garantía Autohero por 2.500 euros» no entra como meses",
    t2c.json.garantia === null || t2c.json.garantia === undefined);

  // Una fecha imposible.
  const e3 = {};
  const t3 = pasa({ id: "ah_" + UUID, url: "" },
    { statusCode: 200, data: '<div>' + UUID + '</div>{"inspectionExpiryDate":"1899-10-28"}' }, e3, "r3");
  comprueba("una ITV del año 1899 no se guarda", !t3.json.itv);

  // La ficha de otro coche.
  const e4 = {};
  const t4 = pasa({ id: "ah_11111111-1111-1111-1111-111111111111", url: "" }, conDato, e4, "r4");
  comprueba("una ficha de otro coche no se escribe", !t4.json.itv && e4.ae_otro === 1);

  // Un 404.
  const e5 = {};
  const t5 = pasa({ id: "ah_" + UUID, url: "" }, { statusCode: 404, data: "" }, e5, "r5");
  comprueba("un 404 solo marca el intento", !t5.json.itv && /enrich_tried_at/.test(t5.json.sql));
  comprueba("y no da el coche por muerto", t5.json.sql.indexOf("is_active") === -1);

  // El item vacío de una consulta sin filas.
  const e6 = {};
  comprueba("el item vacío de una cola sin filas no dispara el HTTP",
    pasa({}, { statusCode: 200, data: "" }, e6, "r6").saltada);

  // El cortacircuitos.
  const e7 = {};
  for (let i = 0; i < 20; i++) {
    pasa({ id: "ah_00000000-0000-0000-0000-00000000000" + (i % 10), url: "" },
      { statusCode: 503, data: "" }, e7, "r7");
  }
  comprueba("quince fichas seguidas sin leer paran la pasada", e7.ae_parado === true, e7.ae_motivo);
  comprueba("y después ya no se pide ninguna más",
    pasa({ id: "ah_" + UUID, url: "" }, conDato, e7, "r7").saltada);

  // ── 3. El SQL, y deshecho ────────────────────────────────────────────────
  console.log("\n  el SQL, contra la base (y deshecho)");
  await c.query("BEGIN");
  try {
    /*
     * Los coches vienen de SU API, y 898 de los suyos no están todavía en
     * nuestra base. Así que un UPDATE puede tocar 1 fila o 0, y las dos cosas
     * son correctas. Lo que NO puede pasar nunca es que toque más de una:
     * eso significaría un WHERE mal puesto.
     */
    const tocadas = [];
    for (const sql of sqls) tocadas.push((await c.query(sql)).rowCount);
    comprueba("ningún UPDATE toca más de una fila", tocadas.every((n) => n <= 1),
      tocadas.join(", ") + " filas");
    const enBase = ofertas.filter((o, i) => tocadas[i] === 1).map((o) => o.id);
    comprueba("alguno de ellos ya lo teníamos", enBase.length > 0,
      enBase.length + " de " + ofertas.length + " ya estaban");
    if (enBase.length) {
      const q = (await c.query(`SELECT count(*) FILTER (WHERE COALESCE(next_itv,'')<>'')::int con_itv,
          count(enrich_tried_at)::int marcadas
        FROM moveadvisor_market_offers WHERE id = ANY($1)`, [enBase])).rows[0];
      comprueba("a esos les queda la ITV puesta", q.con_itv === enBase.length, q.con_itv + " con ITV");
      comprueba("y todos marcados", q.marcadas === enBase.length);
    }
    const resumen = ejecuta(codigo("Code: Resumen"), { estatico: est, $input: uno({}) });
    await c.query(resumen.items[0].json.sql);
    comprueba("el parte se apunta en verify_runs", true,
      resumen.items[0].json.conItv + " fechas");
    comprueba("la memoria queda limpia",
      !Object.keys(est).some((k) => k.indexOf("ae_") === 0));
  } finally {
    await c.query("ROLLBACK");
  }
  await c.end();

  console.log("\n" + (fallos ? "  " + fallos + " COMPROBACIONES FALLAN" : "  todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
