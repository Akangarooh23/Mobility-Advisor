/**
 * Comprueba el enriquecedor de Autocasión.
 *
 *   npm run test:autocasion-enrich
 *
 * Pide fichas de verdad y se las da a los nodos Code tal como están en el JSON.
 * El SQL se lanza contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - QUE NO ESCRIBA LOS DATOS DE OTRO COCHE. Es el fallo por el que se rehízo:
 *     con una URL de listado de provincia, el lector cogía el primer coche de
 *     la lista. Se prueba contra el listado real que lo destapó.
 *   - Que una ficha VENDIDA -que redirige al listado del modelo- no se lea.
 *   - Que un coche con 6 puertas o 12 plazas no entre: es imposible, y si sale
 *     es que hemos leído otra cosa.
 *   - Que las salidas del bucle no estén cambiadas. Estaban: la 0 -terminado-
 *     iba directa al HTTP, que es como se dispara una petición de más al
 *     acabar la pasada.
 *   - Que updated_at no se toque: enriquecer no es que el anuncio haya
 *     cambiado.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "autocasion-enrich-offers.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;
const http = wf.nodes.find((n) => String(n.type).endsWith("httpRequest"));
const H = {};
((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

async function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console",
    "return (async () => {" + js + "})();");
  const r = await f(ctx.$, ctx.$input, () => ctx.estatico || {}, { id: ctx.run || "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ item: { json: j }, first: () => ({ json: j }), all: () => [{ json: j }] });

const VACIA = { color: "", doors: 0, seats: 0, power_cv: 0, body_type: "", traction: "", co2: "" };

/** Una oferta pasa por «¿toca pedirla?», el lector y el contador. */
async function pasa(oferta, respuesta, estatico, run) {
  const est = estatico || {};
  const t = await ejecuta(codigo("Code: ¿toca pedirla?"),
    { estatico: est, run, $: () => uno({}), $input: uno(oferta) });
  const item = t.items[0].json;
  if (!String(item.url || "").trim()) return { saltada: true, json: {} };
  const v = await ejecuta(codigo("Code: Extraer campos y generar SQL"), {
    estatico: est, run,
    $: () => ({ item: { json: item } }),
    $input: uno(respuesta),
  });
  const j = (v.items[0] || { json: {} }).json;
  await ejecuta(codigo("Code: Contar y vigilar"),
    { estatico: est, run, $: () => uno({}), $input: uno(j) });
  return { saltada: false, json: j, log: v.log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const pide = async (url, seguir) => {
  const r = await fetch(url, { headers: H, redirect: seguir ? "follow" : "manual",
    signal: AbortSignal.timeout(40000) });
  return { statusCode: r.status, data: r.status === 200 ? await r.text() : "" };
};

(async () => {
  console.log("CONFIGURACIÓN");
  comprueba("el nodo HTTP manda User-Agent donde n8n lo lee",
    http.parameters.sendHeaders === true && !!H["User-Agent"]
    && !(http.parameters.options || {}).headers);
  comprueba("NO sigue redirecciones: una ficha vendida lleva al listado",
    ((http.parameters.options || {}).redirect || {}).redirect.followRedirects === false);
  comprueba("un corte de red no tumba la pasada",
    http.onError === "continueRegularOutput");
  comprueba("el lector mira también la propiedad data, no solo body",
    /\.data \|\| httpOut\.body/.test(codigo("Code: Extraer campos y generar SQL")));
  comprueba("el que escribe oferta a oferta aguanta cortes largos",
    nodo("PG: Actualizar oferta").maxTries >= 5
    && nodo("PG: Actualizar oferta").waitBetweenTries >= 15000);
  comprueba("avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const cron = wf.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto", Number(p[1]) !== 0, "minuto " + p[1]);

  const m = wf.connections["Loop: oferta por oferta"].main;
  comprueba("la salida 0 del bucle es la de TERMINADO, no el HTTP",
    (m[0][0] || {}).node === "Code: Resumen", (m[0][0] || {}).node);
  comprueba("y la 1 es la que itera", (m[1][0] || {}).node === "Code: ¿toca pedirla?");

  const nombres = new Set(wf.nodes.map((n) => n.name));
  let rotas = 0;
  for (const [de, x] of Object.entries(wf.connections)) {
    if (!nombres.has(de)) rotas++;
    for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
  }
  comprueba("ninguna conexión apunta a un nodo que no existe", rotas === 0);

  // ══ lo que destapó todo esto ═════════════════════════════════════════════
  console.log("\nUNA URL DE LISTADO DE PROVINCIA  (el fallo por el que se rehízo)");
  const listado = "https://www.autocasion.com/coches-segunda-mano/peugeot-2008-ocasion/madrid";
  const res = await pide(listado, true);
  const contaminada = await pasa({ id: "ac_x", url: listado, ...VACIA }, res);
  const sqlMalo = String(contaminada.json.updateSql || "");
  comprueba("NO escribe los datos del primer coche de la lista",
    !/color|doors|seats|power_cv|body_type/.test(sqlMalo), contaminada.json.veredicto);
  comprueba("pero sí gasta el intento, para no repetirla cada pasada",
    /enrich_tried_at = NOW\(\)/.test(sqlMalo));

  console.log("\nUNA FICHA VENDIDA  (redirige al listado del modelo)");
  const vendida = await pasa({ id: "ac_y", url: "https://www.autocasion.com/a/b-ref99999999", ...VACIA },
    { statusCode: 301, data: "" });
  comprueba("no lee nada de la página de destino",
    !/color|doors|body_type/.test(String(vendida.json.updateSql || "")),
    vendida.json.veredicto);

  console.log("\nEL FILTRO DE CORDURA");
  const jsonld = (v) => ({ statusCode: 200,
    data: '<script type="application/ld+json">' + JSON.stringify(v) + "</script>" });
  const imposible = await pasa({ id: "ac_z", url: "https://www.autocasion.com/a/b-ref12345678", ...VACIA },
    jsonld({ "@type": "Car", color: "Rojo", numberOfDoors: 6, vehicleSeatingCapacity: 12 }));
  comprueba("6 puertas y 12 plazas se descartan",
    !/doors/.test(String(imposible.json.updateSql || ""))
    && !/seats/.test(String(imposible.json.updateSql || "")));
  comprueba("pero el color, que sí es plausible, entra",
    /color = COALESCE/.test(String(imposible.json.updateSql || "")));
  const normal = await pasa({ id: "ac_w", url: "https://www.autocasion.com/a/b-ref12345678", ...VACIA },
    jsonld({ "@type": "Car", color: "Azul", numberOfDoors: 5, vehicleSeatingCapacity: 5 }));
  comprueba("5 puertas y 5 plazas entran con normalidad",
    /doors = COALESCE/.test(String(normal.json.updateSql || ""))
    && /seats = COALESCE/.test(String(normal.json.updateSql || "")));
  comprueba("y NO toca updated_at", !/updated_at/.test(String(normal.json.updateSql || "")));

  // ══ el cortacircuitos ════════════════════════════════════════════════════
  console.log("\nEL CORTACIRCUITOS");
  const puerta = {};
  let pedidas = 0;
  for (let i = 0; i < 200; i++) {
    const t = await pasa({ id: "b" + i, url: "https://www.autocasion.com/a/b-ref12345678", ...VACIA },
      { statusCode: 403, data: "" }, puerta, "run-403");
    if (!t.saltada) pedidas++;
  }
  comprueba("un muro de 403 para la pasada", pedidas < 100, pedidas + " intentos antes de parar");
  comprueba("la cola vacía se salta y no llega al HTTP",
    (await pasa({}, jsonld({}), {})).saltada === true);

  // ══ la cola ══════════════════════════════════════════════════════════════
  console.log("\nLA COLA");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const COLA = nodo("PG: Ofertas a enriquecer").parameters.query;
  comprueba("SOLO pide URLs de ficha", /url ~ 'ref\[0-9\]\{6,\}\$'/.test(COLA));
  comprueba("y solo ofertas activas", /AND is_active/.test(COLA));
  const q = await c.query(COLA.replace(/LIMIT \d+/, "LIMIT 8"));
  comprueba("la cola devuelve candidatas", q.rows.length > 0, q.rows.length + " ofertas");
  comprueba("ninguna con URL de listado",
    q.rows.every((r) => /ref[0-9]{6,}$/.test(String(r.url))));

  // ══ fichas de verdad ═════════════════════════════════════════════════════
  console.log("\nCINCO FICHAS REALES");
  let leidas = 0; let vendidas = 0; let ultimo = null;
  for (const fila of q.rows.slice(0, 5)) {
    await dormir(1300);
    const r = await pide(fila.url, false);
    const out = await pasa(fila, r);
    const j = out.json;
    const campos = (String(j.updateSql || "").match(/(color|doors|seats|power_cv|body_type|co2) =/g) || []).length;
    console.log("      HTTP " + String(r.statusCode).padEnd(4) + " "
      + String(j.veredicto || (j.hasUpdates ? "con datos" : "sin datos")).padEnd(16)
      + campos + " campos");
    if (r.statusCode === 200 && campos > 0) { leidas++; ultimo = { fila, j }; }
    if (j.veredicto === "redirige") vendidas++;
  }
  comprueba("saca datos de las fichas vivas", leidas > 0,
    leidas + " leídas, " + vendidas + " ya vendidas");

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimo) {
    comprueba("había alguna ficha con datos que probar", false);
  } else {
    await c.query("BEGIN");
    try {
      const lee = async () => (await c.query(
        "SELECT updated_at, color, doors, seats, power_cv, body_type, enrich_tried_at"
        + " FROM moveadvisor_market_offers WHERE id = $1", [ultimo.fila.id])).rows[0];
      const antes = await lee();
      const r = await c.query(ultimo.j.updateSql);
      comprueba("el SQL casa con una oferta nuestra", r.rowCount === 1, "(" + r.rowCount + " filas)");
      const desp = await lee();
      // Lo que hay que exigir NO es que cambie algo: una ficha puede no traer
      // lo que le falta a esa oferta, y entonces lo correcto es no tocar nada.
      // Lo que no puede pasar nunca es PISAR un dato que ya estaba: todos los
      // campos van con COALESCE(NULLIF(...)) justo para eso, y es lo que separa
      // «rellenar huecos» de «escribir encima los datos de otro coche».
      const pisados = ["color", "doors", "seats", "power_cv", "body_type"].filter((k) => {
        const a = antes[k]; const b = desp[k];
        if (a === null || a === undefined || a === "" || a === 0) return false;
        return String(a) !== String(b);
      });
      comprueba("no pisa ningún dato que ya estuviera", pisados.length === 0,
        pisados.length ? "pisados: " + pisados.join(", ") : "ninguno");
      const rellenos = ["color", "doors", "seats", "power_cv", "body_type"].filter((k) => {
        const a = antes[k]; const b = desp[k];
        const vacio = (a === null || a === undefined || a === "" || a === 0);
        const lleno = !(b === null || b === undefined || b === "" || b === 0);
        return vacio && lleno;
      });
      console.log("      huecos rellenados: " + (rellenos.join(", ") || "ninguno")
        + "   (color «" + (desp.color || "-") + "», " + (desp.doors || "-") + "p, "
        + (desp.body_type || "-") + ")");
      comprueba("las puertas que entran son posibles",
        !desp.doors || (desp.doors >= 2 && desp.doors <= 5), String(desp.doors));
      comprueba("updated_at se queda donde estaba",
        String(antes.updated_at) === String(desp.updated_at));
      comprueba("queda marcada como intentada", !!desp.enrich_tried_at);
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ el destrozo que hay que limpiar ══════════════════════════════════════
  console.log("\nLO QUE DEJÓ LA VERSIÓN ANTERIOR");
  const d = (await c.query(`SELECT
      count(*) FILTER (WHERE doors > 5)::int puertas_imposibles,
      count(*) FILTER (WHERE url !~ 'ref[0-9]{6,}$' AND enrich_tried_at IS NOT NULL)::int rotas_tocadas,
      count(*) FILTER (WHERE is_active AND url ~ 'ref[0-9]{6,}$' AND enrich_tried_at IS NULL)::int por_hacer
    FROM moveadvisor_market_offers WHERE portal='autocasion'`)).rows[0];
  console.log("      con puertas imposibles: " + d.puertas_imposibles);
  console.log("      de URL rota y ya tocadas: " + Number(d.rotas_tocadas).toLocaleString("es"));
  console.log("      pendientes de enriquecer: " + Number(d.por_hacer).toLocaleString("es"));
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
