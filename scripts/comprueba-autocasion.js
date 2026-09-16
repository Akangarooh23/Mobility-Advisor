/**
 * Comprueba el scraper de Autocasión (orquestador + segmento).
 *
 *   npm run test:autocasion
 *
 * Pide páginas de verdad y se las da a los nodos Code tal como están en el JSON.
 * El UPSERT se lanza contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que el orquestador llame al segmento con el id COMO TEXTO y enlazado de
 *     verdad. La forma de objeto con typeVersion 1 da «Workflow does not exist»
 *     y el literal REEMPLAZA_... no llama a nadie.
 *   - Que las cabeceras vayan en headerParameters. En options.headers,
 *     typeVersion 4 las ignora en silencio y se pide sin User-Agent.
 *   - Que el cursor viva en Postgres. En $getWorkflowStaticData se reinicia al
 *     reimportar, y eso costó tres re-scrapeos de Audi en Alemania.
 *   - Que una ventana de páginas no se pase de la última página de la marca:
 *     Lamborghini tiene 7 y el orquestador reparte hasta la 625.
 *   - Que el lector siga sacando ofertas del JSON-LD. Es de julio y el portal
 *     ha podido cambiar.
 *   - Que la URL guardada sea la de la FICHA -acaba en refNNNNNN- y no la de un
 *     listado de provincia: 35.518 filas de julio y agosto tienen esa basura y
 *     no hay forma de verificarlas.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", f), "utf8"));
const orq = lee("autocasion-scraper-brands.json");
const seg = lee("autocasion-segmento.json");
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

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ══ el orquestador ═══════════════════════════════════════════════════════
  console.log("EL ORQUESTADOR");
  const sub = orq.nodes.find((n) => String(n.type).endsWith("executeWorkflow"));
  comprueba("llama al segmento con el id como texto, no como objeto",
    typeof sub.parameters.workflowId === "string", typeof sub.parameters.workflowId);
  comprueba("y el id está enlazado de verdad",
    sub.parameters.workflowId !== "PENDIENTE_DE_ENLAZAR"
    && !/REEMPLAZA/.test(String(sub.parameters.workflowId)),
    String(sub.parameters.workflowId));
  // Que ESPERE a cada segmento. Sin esto dispara las 20 ventanas de golpe y
  // deja veinte ejecuciones en paralelo: el 16-sep hundio el verificador de
  // Autocasion a 17 ofertas/min con el mismo diseno que en AutoScout24 hace 130.
  comprueba("espera a cada segmento antes de lanzar el siguiente",
    (sub.parameters.options || {}).waitForSubWorkflow === true);

  comprueba("la forma del id casa con la typeVersion",
    sub.typeVersion === 1 ? typeof sub.parameters.workflowId === "string" : true,
    "tv" + sub.typeVersion);

  const cron = orq.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(p[1]) !== 0, "minuto " + p[1]);
  // El scraper alemán de importación ocupa 20:15-23:00 y 8:15-11:00.
  comprueba("no arranca dentro del scraper alemán",
    horas.every((h) => h !== 20 && h !== 22), "horas " + p[2]);
  comprueba("avisa por correo si falla", orq.settings.errorWorkflow === "9BwKOPMIzjj3owho"
    && seg.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  comprueba("los Postgres reintentan",
    [...orq.nodes, ...seg.nodes].filter((n) => String(n.type).endsWith(".postgres"))
      .every((n) => n.retryOnFail === true));

  // ══ el cursor ════════════════════════════════════════════════════════════
  console.log("\nEL CURSOR");
  const cursorSql = nodo(orq, "PG: Por dónde íbamos").parameters.query;
  comprueba("vive en Postgres, no en la memoria del workflow",
    /moveadvisor_cursores/.test(cursorSql)
    && !/getWorkflowStaticData/.test(codigo(orq, "Code: Generar segmentos (marca x páginas)")));

  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  // La consulta devuelve filas clave/valor: el cursor y las páginas de cada
  // marca. Aquí se aplanan igual que hace el nodo «Qué marca toca».
  const aMapa = (filas) => Object.fromEntries(filas.map((r) => [r.clave, Number(r.valor)]));
  const cursorFilas = (await c.query(cursorSql)).rows;
  const mapa = aMapa(cursorFilas);
  const fila = { marca: mapa.autocasion_marca ?? 0, pagina: mapa.autocasion_pagina ?? 1 };
  comprueba("la consulta del cursor funciona aunque no existan sus filas",
    Number.isFinite(fila.marca) && Number.isFinite(fila.pagina),
    fila.marca + ":" + fila.pagina);
  const sabidas = Object.keys(mapa).filter((k) => /^autocasion_pag_[0-9]+$/.test(k)).length;
  comprueba("y trae las páginas conocidas de cada marca, que es lo que encadena",
    sabidas > 0, sabidas + " marcas medidas de 61");

  // El reparto necesita saber cuántas páginas tiene la marca de turno, y eso
  // sale de una petición real: por eso se le da la página 1 de verdad.
  const marcaTurno = ejecuta(codigo(orq, "Code: Qué marca toca"),
    { $: () => uno(fila), $input: uno(fila) }).items[0].json;
  comprueba("sabe qué marca le toca", !!marcaTurno.marcaDeTurno, marcaTurno.marcaDeTurno);
  const H1 = {};
  ((orq.nodes.find((n) => n.name === "HTTP: Contar la marca de turno")
    .parameters.headerParameters || {}).parameters || []).forEach((c) => { H1[c.name] = c.value; });
  const conteo = await fetch(
    "https://www.autocasion.com/coches-segunda-mano/" + marcaTurno.marcaDeTurno + "-ocasion",
    { headers: H1, signal: AbortSignal.timeout(40000) });
  const htmlConteo = { statusCode: conteo.status, data: await conteo.text() };

  // Se fuerza el cursor al principio de la marca. Con el cursor real esto podía
  // pasar EN VACÍO: si va por la página 501 y la marca tiene 338, el reparto
  // devuelve cero ventanas y todas las comprobaciones se cumplen sin probar
  // nada. Pasó en la primera versión de este test.
  const desdeElPrincipio = { marca: Number(fila.marca) || 0, pagina: 1 };
  const gen = ejecuta(codigo(orq, "Code: Generar segmentos (marca x páginas)"),
    { $: (n) => (n === "HTTP: Contar la marca de turno" ? uno(htmlConteo) : uno(desdeElPrincipio)),
      $input: uno(desdeElPrincipio) });
  const segs = gen.items.map((x) => x.json);
  comprueba("con el cursor al principio reparte varias ventanas de verdad",
    segs.length > 1 && segs[0].desde === 1, segs.length + " ventanas desde la página " + segs[0].desde);
  comprueba("una pasada reparte segmentos", segs.length > 0, segs.length + " segmentos");
  comprueba("cada uno es una ventana de páginas, no una marca entera",
    segs.every((s) => s.hasta - s.desde <= 24), "hasta " + (segs[0].hasta - segs[0].desde + 1) + " páginas");
  // Lo que costó media hora colgado: repartir ventanas más allá del final.
  const maxReal = Math.max(...[...htmlConteo.data.matchAll(/[?&]page=([0-9]+)/g)].map((m) => Number(m[1])));
  comprueba("NINGUNA ventana se pasa de la última página de la marca",
    segs.every((s) => s.desde <= maxReal),
    marcaTurno.marcaDeTurno + " tiene " + maxReal + ", la última ventana empieza en "
      + segs[segs.length - 1].desde);
  // ENCADENAR MARCAS es lo que separa 5 dias de vuelta completa de 30. La
  // version que se plantaba al acabar la marca dejaba 6 de las 20 ventanas sin
  // usar en BMW, y gastaba una pasada entera en Lamborghini, que tiene 7
  // paginas. Se prueba con una marca pequena y paginas conocidas.
  const conPaginas = [
    { clave: "autocasion_marca", valor: 45 }, { clave: "autocasion_pagina", valor: 1 },
    { clave: "autocasion_pag_45", valor: 7 }, { clave: "autocasion_pag_46", valor: 12 },
    { clave: "autocasion_pag_47", valor: 30 },
  ];
  const todas = (arr) => ({ all: () => arr.map((j) => ({ json: j })), first: () => ({ json: arr[0] }) });
  const turno2 = ejecuta(codigo(orq, "Code: Qué marca toca"),
    { $: () => todas(conPaginas), $input: todas(conPaginas) }).items[0].json;
  const chico = ejecuta(codigo(orq, "Code: Generar segmentos (marca x páginas)"), {
    $: (n) => (n === "Code: Qué marca toca" ? uno(turno2) : uno({ data: '<a href="?page=7">7</a>' })),
    $input: uno(turno2),
  }).items.map((x) => x.json);
  comprueba("una marca pequeña no desperdicia la pasada: encadena con la siguiente",
    new Set(chico.map((s) => s.brand)).size > 1,
    chico.length + " ventanas en " + new Set(chico.map((s) => s.brand)).size + " marcas");
  comprueba("y respeta el tamaño real de cada una",
    chico[0].hasta === 7 && chico[1].brand !== chico[0].brand,
    chico[0].brand + " p" + chico[0].desde + "-" + chico[0].hasta
      + ", luego " + chico[1].brand);
  comprueba("gasta el presupuesto entero de la pasada", chico.length === 20,
    chico.length + " de 20");
  // Un segmento sin marca NO puede inventarse una. Habia un ": 'peugeot'" de
  // valor por defecto y el 15-sep scrapeo 360 ofertas de Peugeot saltandose el
  // cursor, porque el orquestador le mando un segmento vacio.
  const sinMarca = ejecuta(codigo(seg, "Params"), { $input: uno({ brand: "", desde: 0, hasta: 0 }) });
  comprueba("un segmento sin marca no se inventa ninguna", sinMarca.items.length === 0,
    JSON.stringify(sinMarca.items));
  comprueba("y el orquestador no lo llama siquiera",
    orq.nodes.some((n) => n.name === "IF: ¿hay marca que scrapear?"));

  comprueba("no queda ningún nodo Wait, que es lo que colgó la primera pasada",
    ![...orq.nodes, ...seg.nodes].some((n) => String(n.type).endsWith("wait")));
  comprueba("apunta el cursor ANTES de scrapear, y crea las filas si faltan",
    /INSERT INTO moveadvisor_cursores/.test(segs[0].sqlCursor)
    && /ON CONFLICT \(clave\) DO UPDATE/.test(segs[0].sqlCursor));
  const nodoGuarda = nodo(orq, "PG: Apuntar dónde nos quedamos");
  comprueba("y lo escribe UNA vez, no una por segmento", nodoGuarda.executeOnce === true);

  // El cursor tiene que avanzar de verdad entre pasadas.
  await c.query("BEGIN");
  try {
    await c.query(segs[0].sqlCursor);
    const m2 = aMapa((await c.query(cursorSql)).rows);
    const antes = fila.marca + ":" + fila.pagina;
    const ahora = (m2.autocasion_marca ?? 0) + ":" + (m2.autocasion_pagina ?? 1);
    comprueba("tras una pasada el cursor ha avanzado", ahora !== antes, antes + "  ->  " + ahora);
  } finally { await c.query("ROLLBACK"); }

  // ══ el segmento ══════════════════════════════════════════════════════════
  console.log("\nEL SEGMENTO");
  comprueba("las cabeceras van donde n8n las lee, no en options.headers",
    http.every((n) => n.parameters.sendHeaders === true && !(n.parameters.options || {}).headers));
  comprueba("manda User-Agent", !!H["User-Agent"]);
  comprueba("un corte de red no tumba la ventana",
    http.every((n) => n.onError === "continueRegularOutput"));
  comprueba("hay un IF antes del UPSERT para las páginas vacías",
    seg.nodes.some((n) => n.name === "IF: ¿hay ofertas?"));

  for (const w of [orq, seg]) {
    const nombres = new Set(w.nodes.map((n) => n.name));
    let rotas = 0;
    for (const [de, x] of Object.entries(w.connections)) {
      if (!nombres.has(de)) rotas++;
      for (const r of x.main) for (const l of r) if (!nombres.has(l.node)) rotas++;
    }
    comprueba("las conexiones de «" + w.name.slice(0, 30) + "» apuntan a nodos que existen",
      rotas === 0);
  }
  // En splitInBatches la salida 0 es TERMINADO y la 1 es cada item. Tenerlas al
  // revés hace que el nodo de después se dispare al acabar el bucle.
  for (const [w, bucle] of [[orq, "Loop: segmento por segmento"], [seg, "Loop: página por página"]]) {
    const m = w.connections[bucle].main;
    comprueba("el bucle «" + bucle + "» usa la salida 1 para iterar",
      (m[0] || []).length === 0 && (m[1] || []).length > 0);
  }

  // ══ páginas de verdad ════════════════════════════════════════════════════
  console.log("\nUNA MARCA PEQUEÑA, DE VERDAD  (lamborghini: 7 páginas)");
  const pide = async (url) => {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(40000) });
    return { statusCode: r.status, data: await r.text() };
  };
  const pag1 = await pide("https://www.autocasion.com/coches-segunda-mano/lamborghini-ocasion");
  const dentro = ejecuta(codigo(seg, "Code: Generar páginas"),
    { $: () => uno({ brand: "lamborghini", desde: 1, hasta: 25 }), $input: uno(pag1) });
  comprueba("no pide más páginas de las que tiene la marca",
    dentro.items.length > 0 && dentro.items.length < 25,
    dentro.items.length + " páginas");

  const fuera = ejecuta(codigo(seg, "Code: Generar páginas"),
    { $: () => uno({ brand: "lamborghini", desde: 101, hasta: 125 }), $input: uno(pag1) });
  comprueba("una ventana más allá del final no pide nada", fuera.items.length === 0);

  await dormir(1300);
  console.log("\nTRES PÁGINAS REALES");
  let totalOfertas = 0;
  let conRef = 0;
  let ultimoSql = null;
  for (const pagina of [1, 2, 3]) {
    const res = await pide("https://www.autocasion.com/coches-segunda-mano/kia-ocasion?page=" + pagina);
    const t = ejecuta(codigo(seg, "Code: Transformar ofertas"), { $input: uno(res) });
    const j = t.items[0].json;
    const urls = [...String(j.sql || "").matchAll(/'(https:\/\/www\.autocasion\.com[^']+)'/g)].map((m) => m[1]);
    const buenas = urls.filter((u) => /ref\d{6,}$/.test(u)).length;
    totalOfertas += Number(j.count || 0);
    conRef += buenas;
    console.log("      página " + pagina + "   HTTP " + res.statusCode + "   "
      + (j.count || 0) + " ofertas   " + buenas + " con refNNNNNN");
    if (j.sql) ultimoSql = j.sql;
    await dormir(1300);
  }
  comprueba("el lector sigue sacando ofertas del JSON-LD", totalOfertas >= 60,
    totalOfertas + " de 75");
  comprueba("y guarda la URL de la FICHA, no la de un listado de provincia",
    conRef >= totalOfertas * 0.9, conRef + " de " + totalOfertas);

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
          count(*) FILTER (WHERE url ~ 'ref[0-9]{6,}$')::int con_ref
        FROM moveadvisor_market_offers
        WHERE portal='autocasion' AND scraped_at > NOW() - INTERVAL '1 minute'`)).rows[0];
      comprueba("quedan guardadas con precio", Number(v.con_precio) > 0,
        v.con_precio + " de " + v.n);
      comprueba("y con URL de ficha", Number(v.con_ref) === Number(v.n),
        v.con_ref + " de " + v.n);
    } finally { await c.query("ROLLBACK"); }
  }

  // ══ el estado del portal ═════════════════════════════════════════════════
  console.log("\nCOMO ESTA AUTOCASION AHORA MISMO");
  const e = (await c.query(`SELECT count(*) FILTER (WHERE is_active)::int activas,
      count(*) FILTER (WHERE is_active AND url ~ 'ref[0-9]{6,}$')::int verificables,
      (NOW()::date - max(scraped_at)::date) dias
    FROM moveadvisor_market_offers WHERE portal='autocasion'`)).rows[0];
  console.log("      " + Number(e.activas).toLocaleString("es") + " activas, "
    + Number(e.verificables).toLocaleString("es") + " con URL de ficha, "
    + e.dias + " días desde el último scrape");
  await c.end();

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
