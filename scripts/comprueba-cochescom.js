/**
 * Comprueba el scraper de coches.com (orquestador + segmento).
 *
 *   npm run test:cochescom
 *
 * Pide páginas de verdad y se las da a los nodos Code tal como están en el JSON.
 * El UPSERT se lanza contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que el cursor viva en Postgres. El scraper anterior repartía las marcas
 *     por día de la semana -i % 7 === día-, así que una noche que fallara se
 *     saltaba trece marcas hasta la semana siguiente.
 *   - Que una pasada encadene marcas hasta gastar sus 20 ventanas. Plantarse al
 *     acabar la marca convierte 5 días de vuelta en 30.
 *   - Que el UPSERT resucite lo que ve en el listado. Sin eso, una oferta que el
 *     verificador dé de baja por error se queda muerta para siempre.
 *   - Que las cabeceras vayan en headerParameters: en options.headers,
 *     typeVersion 4 las ignora y se pide sin User-Agent.
 *   - Que el lector siga sacando ofertas del __NEXT_DATA__.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", f), "utf8"));
const orq = lee("cochescom-scraper-offers.json");
const seg = lee("cochescom-segmento.json");
const nodo = (w, n) => w.nodes.find((x) => x.name === n);
const codigo = (w, n) => nodo(w, n).parameters.jsCode;
const http = seg.nodes.filter((n) => String(n.type).endsWith("httpRequest"));
const H = {};
((http[0].parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "$execution", "console", js);
  const r = f(ctx.$, ctx.$input, () => ctx.estatico || {}, { id: "r1" },
    { log: (m) => log.push(String(m)) });
  return { items: r || [], log };
}
const uno = (j) => ({ item: { json: j }, first: () => ({ json: j }), all: () => [{ json: j }] });
const todas = (arr) => ({ all: () => arr.map((j) => ({ json: j })), first: () => ({ json: arr[0] }) });

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const pide = async (url) => {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(40000) });
  return { statusCode: r.status, data: await r.text() };
};

(async () => {
  console.log("EL ORQUESTADOR");
  const sub = orq.nodes.find((n) => String(n.type).endsWith("executeWorkflow"));
  comprueba("llama al segmento con el id como texto, no como objeto",
    typeof sub.parameters.workflowId === "string");
  comprueba("y el id está enlazado de verdad",
    sub.parameters.workflowId !== "PENDIENTE_DE_ENLAZAR", String(sub.parameters.workflowId));
  comprueba("espera a cada segmento antes de lanzar el siguiente",
    (sub.parameters.options || {}).waitForSubWorkflow === true);

  const cron = orq.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto", Number(p[1]) !== 0, "minuto " + p[1]);
  // Ocupado: Autocasión 8:20 y 19:20, alemán 8:15 y 20:15, AS24 ES 13:30 y 16:30.
  comprueba("no arranca encima de otro scraper",
    horas.every((h) => ![8, 13, 16, 19, 20].includes(h)), "horas " + p[2]);
  comprueba("avisa por correo si falla",
    orq.settings.errorWorkflow === "9BwKOPMIzjj3owho" && seg.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  comprueba("los Postgres reintentan",
    [...orq.nodes, ...seg.nodes].filter((n) => String(n.type).endsWith(".postgres"))
      .every((n) => n.retryOnFail === true));
  comprueba("no queda ningún nodo Wait",
    ![...orq.nodes, ...seg.nodes].some((n) => String(n.type).endsWith("n8n-nodes-base.wait")));

  for (const w of [orq, seg]) {
    const nombres = new Set(w.nodes.map((n) => n.name));
    let rotas = 0;
    for (const [de, x] of Object.entries(w.connections)) {
      if (!nombres.has(de)) rotas++;
      for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
    }
    comprueba("las conexiones de «" + w.name.slice(0, 26) + "» son correctas", rotas === 0);
  }
  for (const [w, bucle] of [[orq, "Loop: segmento por segmento"], [seg, "Loop: página por página"]]) {
    const m = w.connections[bucle].main;
    comprueba("el bucle «" + bucle.slice(0, 22) + "» usa la salida 1 para iterar",
      (m[0] || []).length === 0 && (m[1] || []).length > 0);
  }

  // ══ el cursor ════════════════════════════════════════════════════════════
  console.log("\nEL CURSOR");
  const cursorSql = nodo(orq, "PG: Por dónde íbamos").parameters.query;
  comprueba("vive en Postgres, no en el día de la semana",
    /moveadvisor_cursores/.test(cursorSql)
    && !/getDay\(\)/.test(codigo(orq, "Code: Generar segmentos (marca x páginas)")));
  comprueba("y el filtro no usa LIKE, que trata el guion bajo como comodín",
    /clave ~ '\^cochescom_pag_/.test(cursorSql));

  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  const aMapa = (filas) => Object.fromEntries(filas.map((r) => [r.clave, Number(r.valor)]));
  const mapa = aMapa((await c.query(cursorSql)).rows);
  const fila = { marca: mapa.cochescom_marca ?? 0, pagina: mapa.cochescom_pagina ?? 1 };
  comprueba("la consulta funciona aunque no existan sus filas",
    Number.isFinite(fila.marca) && Number.isFinite(fila.pagina), fila.marca + ":" + fila.pagina);

  const turno = ejecuta(codigo(orq, "Code: Qué marca toca"),
    { $: () => todas([]), $input: todas((await c.query(cursorSql)).rows.length
      ? (await c.query(cursorSql)).rows : [{ clave: "cochescom_marca", valor: 0 }]) }).items[0].json;
  comprueba("sabe qué marca le toca", !!turno.marcaDeTurno, turno.marcaDeTurno);

  const conteo = await pide("https://www.coches.com/coches-segunda-mano/" + turno.marcaDeTurno + ".htm");
  const gen = ejecuta(codigo(orq, "Code: Generar segmentos (marca x páginas)"), {
    $: (n) => (n === "HTTP: Contar la marca de turno" ? uno(conteo) : uno(turno)),
    $input: uno(turno),
  });
  const segs = gen.items.map((x) => x.json);
  comprueba("reparte ventanas", segs.length > 0, segs.length + " ventanas");
  comprueba("gasta el presupuesto entero de la pasada", segs.length === 20, segs.length + " de 20");
  comprueba("encadenando marcas si hace falta",
    new Set(segs.map((s) => s.brand)).size >= 1,
    [...new Set(segs.map((s) => s.brand))].slice(0, 4).join(", "));
  comprueba("apunta el cursor antes de scrapear, y crea las filas si faltan",
    /INSERT INTO moveadvisor_cursores/.test(segs[0].sqlCursor)
    && /ON CONFLICT \(clave\) DO UPDATE/.test(segs[0].sqlCursor));
  comprueba("y guarda cuántas páginas tiene la marca medida",
    /cochescom_pag_/.test(segs[0].sqlCursor));

  // ══ el segmento ══════════════════════════════════════════════════════════
  console.log("\nEL SEGMENTO");
  comprueba("las cabeceras van donde n8n las lee",
    http.every((n) => n.parameters.sendHeaders === true && !(n.parameters.options || {}).headers));
  comprueba("un corte de red no tumba la ventana",
    http.every((n) => n.onError === "continueRegularOutput"));
  const sinMarca = ejecuta(codigo(seg, "Params"), { $input: uno({ brand: "", desde: 0, hasta: 0 }) });
  comprueba("un segmento sin marca no se inventa ninguna", sinMarca.items.length === 0);

  const paginas = ejecuta(codigo(seg, "Code: Generar páginas"),
    { $: () => uno({ brand: turno.marcaDeTurno, desde: 1, hasta: 25 }), $input: uno(conteo) });
  comprueba("saca las páginas de la ventana", paginas.items.length > 0,
    paginas.items.length + " páginas");
  comprueba("y la URL apunta al portal",
    /^https:\/\/www\.coches\.com\/coches-segunda-mano\//.test(paginas.items[0].json.url),
    String(paginas.items[0].json.url).slice(0, 60));
  const fuera = ejecuta(codigo(seg, "Code: Generar páginas"),
    { $: () => uno({ brand: turno.marcaDeTurno, desde: 9000, hasta: 9025 }), $input: uno(conteo) });
  comprueba("una ventana más allá del final no pide nada", fuera.items.length === 0);

  // ══ páginas de verdad ════════════════════════════════════════════════════
  console.log("\nTRES PÁGINAS REALES");
  let total = 0;
  let ultimoSql = null;
  for (const pag of paginas.items.slice(0, 3)) {
    await dormir(1200);
    const res = await pide(pag.json.url);
    const t = ejecuta(codigo(seg, "Code: Transformar ofertas"), { $input: uno(res) });
    const j = t.items[0].json;
    total += Number(j.count || 0);
    console.log("      página " + pag.json.page + "   HTTP " + res.statusCode + "   "
      + (j.count || 0) + " ofertas");
    if (j.sql) ultimoSql = j.sql;
  }
  comprueba("el lector sigue sacando ofertas del JSON", total >= 40, total + " de 60");
  comprueba("y el UPSERT resucita lo que ve en el listado",
    /is_active = TRUE/.test(String(ultimoSql || "")));

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  if (!ultimoSql) {
    comprueba("había SQL que probar", false);
  } else {
    await c.query("BEGIN");
    try {
      const r = await c.query(ultimoSql);
      comprueba("el UPSERT entra sin quejarse", r.rowCount > 0, r.rowCount + " filas");
      const v = (await c.query(`SELECT count(*)::int n,
          count(*) FILTER (WHERE price > 0)::int con_precio,
          count(*) FILTER (WHERE is_active)::int activas
        FROM moveadvisor_market_offers
        WHERE portal='cochescom' AND scraped_at > NOW() - INTERVAL '1 minute'`)).rows[0];
      comprueba("quedan con precio y activas",
        Number(v.con_precio) > 0 && Number(v.activas) === Number(v.n),
        v.con_precio + " con precio de " + v.n);
    } finally { await c.query("ROLLBACK"); }
  }

  console.log("\nEL PORTAL");
  const e = (await c.query(`SELECT count(*) FILTER (WHERE is_active)::int activas,
      (NOW()::date - max(scraped_at)::date) dias
    FROM moveadvisor_market_offers WHERE portal='cochescom'`)).rows[0];
  console.log("      " + Number(e.activas).toLocaleString("es") + " activas nuestras, "
    + "85.252 declara el portal, " + e.dias + " días desde el último scrape");
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
