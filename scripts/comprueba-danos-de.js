/**
 * Comprueba el comprobador de daños de Alemania.
 *
 *   npm run test:danos-de
 *
 * Pide fichas alemanas de verdad y se las da a los nodos Code tal como están en
 * el JSON del workflow. Luego lanza el SQL contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que una ficha que no da el dato se marque IGUAL con damage_checked_at.
 *     Sin eso vuelve en cada pasada y la cola no avanza: es exactamente el
 *     agujero de las 312 candidatas que ya habían pasado por el enriquecedor.
 *   - Que NULL, FALSE y TRUE sigan siendo tres cosas distintas. NULL es «no lo
 *     sé» y es lo único que impide publicar; confundirlo con FALSE publicaría
 *     coches sin comprobar.
 *   - Que un coche dañado YA PUBLICADO se retire en el acto, pero respetando
 *     import_locked, que es lo que respeta el scoring.
 *   - Que NO toque updated_at: es lo que ordena el escaparate, y moverlo subiría
 *     a los primeros puestos justo los coches que acabamos de mirar.
 *   - Que el cortacircuitos pare si AutoScout24 deja de dar el dato, en vez de
 *     quemar las 500 de la pasada y retrasarlas tres días.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "importacion-danos-de.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
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

/** Una oferta pasa por «¿toca pedirla?» y por «¿está dañado?». */
function pasa(oferta, respuesta, estatico) {
  const t = ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (item.saltar) return { saltada: true, json: {} };
  const v = ejecuta(codigo("Code: ¿está dañado?"), {
    estatico,
    $: (n) => (n === "Code: ¿toca pedirla?" ? { item: { json: item } } : uno({})),
    $input: uno(respuesta),
  });
  return { saltada: false, json: (v.items[0] || { json: {} }).json, log: v.log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const p = String(expr).split(" ");
  comprueba("corre entre las 8:00 y las 00:00",
    String(p[2]).split(",").map(Number).every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(p[1]) !== 0, "minuto " + p[1]);
  // El scoring corre a las 13:10. Si la pasada de la mañana fuera después, lo
  // comprobado hoy no se publicaría hasta mañana.
  comprueba("hay una pasada antes del scoring de las 13:10",
    String(p[2]).split(",").map(Number).some((h) => h < 13),
    "horas " + p[2]);

  comprueba("el nodo HTTP manda User-Agent",
    http.parameters.sendHeaders === true && !!H["User-Agent"]);
  comprueba("ninguna cabecera en options.headers, que typeVersion 4 ignora",
    !(http.parameters.options || {}).headers);
  comprueba("un corte de red no tumba la pasada",
    http.onError === "continueRegularOutput");
  comprueba("el Code mira también la propiedad data, no solo body",
    /res\.body \|\| res\.data/.test(codigo("Code: ¿está dañado?")));
  comprueba("los nodos de Postgres reintentan",
    wf.nodes.filter((n) => n.type.endsWith(".postgres")).every((n) => n.retryOnFail === true));
  comprueba("el que escribe oferta a oferta aguanta cortes largos",
    nodo("PG: Guardar el veredicto").maxTries >= 5
    && nodo("PG: Guardar el veredicto").waitBetweenTries >= 15000);
  comprueba("hay un IF antes del HTTP para la cola vacía",
    wf.nodes.some((n) => n.name === "IF: ¿hay ficha que pedir?"));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ la cola ══════════════════════════════════════════════════════════════
  console.log("\nLA COLA");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Cola a comprobar").parameters.query;
  comprueba("no toca ofertas que no sean alemanas",
    /country\s*=\s*'DE'/.test(COLA) && /portal\s*=\s*'autoscout24'/.test(COLA));
  comprueba("reintenta las que no dieron el dato, pero no cada pasada",
    /damage_checked_at IS NULL OR damage_checked_at </.test(COLA));

  const q = await c.query(COLA);
  comprueba("la cola devuelve candidatas", q.rows.length > 0, q.rows.length + " ofertas");
  const publicadas = q.rows.filter((r) => r.import_published).length;
  console.log("      " + publicadas + " de ellas ya están publicadas (van primero)");
  comprueba("las publicadas van al principio",
    q.rows.slice(0, publicadas).every((r) => r.import_published), "(" + publicadas + ")");
  comprueba("todas traen URL", q.rows.every((r) => r.url && String(r.url).startsWith("http")));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nCINCO FICHAS REALES");
  const est = {};
  let ultimo = null;
  let leidas = 0;
  for (const fila of q.rows.slice(0, 5)) {
    const r = await fetch(fila.url, { headers: H, signal: AbortSignal.timeout(30000) });
    const cuerpo = await r.text();
    const out = pasa(fila, { statusCode: r.status, body: cuerpo }, est);
    const j = out.json;
    console.log("      HTTP " + r.status + "  "
      + String(j.veredicto || "-").padEnd(18)
      + (j.notaDano ? "«" + j.notaDano + "»  " : "")
      + (j.precioNeto ? "PRECIO-NETO  " : "")
      + (j.retirada ? "RETIRADA  " : ""));
    comprueba("  siempre deja la marca de comprobado",
      /damage_checked_at = NOW\(\)/.test(j.sql || ""));
    comprueba("  NO toca updated_at", !/updated_at/.test(j.sql || ""));
    if (j.danado !== null && j.danado !== undefined) {
      leidas++;
      ultimo = { fila, j };
    }
    await dormir(1200);
  }
  comprueba("la mayoría de las fichas da el dato de daño", leidas >= 3,
    leidas + " de 5");

  // ══ una ficha que no se sabe leer ════════════════════════════════════════
  console.log("\nUNA FICHA QUE NO SE SABE LEER");
  for (const caso of [
    ["HTTP 410 (ya vendida)", { statusCode: 410, body: "" }],
    ["200 sin __NEXT_DATA__", { statusCode: 200, body: "<html><body>nada</body></html>" }],
  ]) {
    const mala = pasa({ id: "as24_x", url: "u" }, caso[1], {});
    comprueba(caso[0] + ": marca y no inventa nada",
      /damage_checked_at = NOW\(\)/.test(mala.json.sql || "")
      && !/is_damaged|price_is_net|had_accident/.test(mala.json.sql || ""),
      mala.json.veredicto);
  }

  // ══ los tres estados ═════════════════════════════════════════════════════
  console.log("\nNULL, FALSE Y TRUE SON TRES COSAS DISTINTAS");
  const ficha = (vehiculo, precios) => ({
    statusCode: 200,
    body: '<script id="__NEXT_DATA__" type="application/json">'
      + JSON.stringify({ props: { pageProps: { listingDetails: {
        vehicle: vehiculo, prices: precios || { public: { isFinalPrice: true } } } } } })
      + "</script>",
  });
  const sano = pasa({ id: "a1", url: "u" }, ficha({ damageConditions: [] }), {});
  comprueba("sin daños declarados -> is_damaged = FALSE",
    /is_damaged = FALSE/.test(sano.json.sql || ""), sano.json.veredicto);
  const roto = pasa({ id: "a2", url: "u" },
    ficha({ damageConditions: ["Dañado", "No apto para circular"] }), {});
  comprueba("con daños -> is_damaged = TRUE y la nota tal cual",
    /is_damaged = TRUE/.test(roto.json.sql || "")
    && /damage_note = 'Dañado, No apto para circular'/.test(roto.json.sql || ""));
  const mudo = pasa({ id: "a3", url: "u" }, ficha({ bodyType: "SUV" }), {});
  comprueba("sin la clave -> NO escribe is_damaged, se queda en NULL",
    !/is_damaged/.test(mudo.json.sql || ""), mudo.json.veredicto);

  // El IVA: un precio neto comparado contra precios españoles con IVA se
  // inventa un 19% de ahorro que no existe.
  const neto = pasa({ id: "a4", url: "u" },
    ficha({ damageConditions: [] }, { public: { isFinalPrice: false, netPriceRaw: 10000 } }), {});
  comprueba("precio sin IVA -> price_is_net = TRUE",
    /price_is_net = TRUE/.test(neto.json.sql || ""));

  // ══ retirar lo publicado ═════════════════════════════════════════════════
  console.log("\nUN COCHE DAÑADO QUE YA ESTABA PUBLICADO");
  const pub = pasa({ id: "a5", url: "u", import_published: true },
    ficha({ damageConditions: ["Dañado"] }), {});
  comprueba("se retira del escaparate en el acto",
    /import_published = CASE WHEN import_locked/.test(pub.json.sql || ""));
  comprueba("pero respeta lo que una persona haya fijado a mano",
    /THEN import_published ELSE FALSE END/.test(pub.json.sql || ""));
  const noPub = pasa({ id: "a6", url: "u", import_published: false },
    ficha({ damageConditions: ["Dañado"] }), {});
  comprueba("una que no estaba publicada no se toca de más",
    !/import_published/.test(noPub.json.sql || ""));
  const sanoPub = pasa({ id: "a7", url: "u", import_published: true },
    ficha({ damageConditions: [] }), {});
  comprueba("una publicada y sana sigue publicada",
    !/import_published/.test(sanoPub.json.sql || ""));

  // ══ el cortacircuitos ════════════════════════════════════════════════════
  console.log("\nEL CORTACIRCUITOS");
  const bloqueo = {};
  let pedidas = 0;
  let saltadas = 0;
  for (let i = 0; i < 60; i++) {
    const r = pasa({ id: "b" + i, url: "u" }, { statusCode: 403, body: "" }, bloqueo);
    if (r.saltada) saltadas++; else pedidas++;
  }
  comprueba("para cuando AutoScout24 deja de dar el dato", saltadas > 0,
    pedidas + " pedidas antes de parar, " + saltadas + " saltadas");
  comprueba("no se gasta la pasada entera", pedidas < 45, pedidas + " de 60");
  const sanas = {};
  let pedidasSanas = 0;
  for (let i = 0; i < 60; i++) {
    const r = pasa({ id: "c" + i, url: "u" }, ficha({ damageConditions: [] }), sanas);
    if (!r.saltada) pedidasSanas++;
  }
  comprueba("y NO para cuando todo va bien", pedidasSanas === 60, pedidasSanas + " de 60");

  // El parte tiene que limpiar la memoria: si no, el freno de hoy sigue puesto
  // mañana y el workflow no vuelve a mirar una ficha nunca más.
  const resumen = ejecuta(codigo("Code: Resumen"), { estatico: bloqueo, $: () => uno({}), $input: uno({}) });
  comprueba("el parte apunta la pasada",
    /INSERT INTO moveadvisor_verify_runs/.test(resumen.items[0].json.sql)
    && /'danos-de'/.test(resumen.items[0].json.sql));
  comprueba("y deja la memoria limpia para la siguiente",
    !Object.keys(bloqueo).some((k) => k.indexOf("dd_") === 0),
    "quedan: " + (Object.keys(bloqueo).join(", ") || "nada"));

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha leída con la que probar", false);
  } else {
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, is_damaged, damage_note, price_is_net, damage_checked_at"
        + " FROM moveadvisor_market_offers WHERE id = $1", [ultimo.fila.id])).rows[0];
      const antes = await lee();
      const res = await c.query(ultimo.j.sql);
      comprueba("el SQL casa con una oferta nuestra", res.rowCount === 1, "(" + res.rowCount + " filas)");
      const desp = await lee();
      comprueba("el veredicto entra",
        desp.is_damaged === ultimo.j.danado,
        "is_damaged = " + String(desp.is_damaged));
      comprueba("queda marcada como comprobada", !!desp.damage_checked_at);
      comprueba("y updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at), String(antes.updated_at).slice(0, 19));
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ lo que desatasca ═════════════════════════════════════════════════════
  console.log("\nEL AGUJERO QUE VIENE A TAPAR");
  const t = (await c.query(`SELECT
      count(*) FILTER (WHERE enrich_tried_at IS NOT NULL)::int ficha_vista_sin_dato,
      count(*)::int total
    FROM moveadvisor_market_offers
    WHERE country='DE' AND is_active AND is_damaged IS NULL
      AND price BETWEEN 4000 AND 100000 AND import_comps >= 15
      AND market_price_es IS NOT NULL AND market_price_es - price >= 6000`)).rows[0];
  console.log("      candidatas sin comprobar: " + t.total
    + "   (" + t.ficha_vista_sin_dato + " que el enriquecedor ya no volvería a mirar)");
  const pasadas = Math.ceil(t.total / q.rows.length || 1);
  comprueba("la cola se vacía en pocos días",
    pasadas <= 6, "unas " + pasadas + " pasadas, a 2 por día");

  await c.end();
  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
