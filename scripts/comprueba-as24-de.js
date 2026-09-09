/**
 * Comprueba el scraper de Alemania (AutoScout24 DE).
 *
 *   npm run test:as24-de
 *
 * Son DOS workflows: un orquestador que reparte marcas y tramos de precio, y un
 * sub-workflow «Segmento DE» que es quien pide las páginas y guarda.
 *
 * ── Por qué existe este fichero ────────────────────────────────────────────
 *
 * Porque los dos llevaban desde el 2026-07-16 sin ejecutarse y nadie se enteró.
 * No fallaban: no hacían nada, que es peor. Tres defectos encadenados, todos
 * invisibles:
 *
 *   1. La conexión del disparador programado apuntaba a «Cada día a las 21:00»
 *      y el nodo se llamaba «Cada día a las 03:00». n8n no se queja: el cron
 *      simplemente no dispara nada.
 *   2. El orquestador llamaba al sub-workflow por el id 2h0kGQXmyLto6YzO, que no
 *      existe en n8n. Aunque el cron hubiera funcionado, la pasada moría ahí.
 *   3. Los nodos HTTP llevaban las cabeceras en options.headers, que
 *      typeVersion 4 ignora en silencio: pedían sin User-Agent.
 *
 * Ninguno de los tres da error. Por eso hay que comprobarlos a mano.
 */
"use strict";

const { Client } = require("pg");
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const N8N_DB = path.join(process.env.USERPROFILE || process.env.HOME, ".n8n", "database.sqlite");

const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", f), "utf8"));
const orq = leer("autoscout24-scraper-offers-de.json");
const seg = leer("autoscout24-segmento-de.json");
const codigo = (wf, n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

function corre(js, entrada, contexto) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  // $('Nombre') tiene que ofrecer .item y .first(), como en n8n: los nodos usan
  // una u otra segun si trabajan por item o sobre la primera fila.
  const nodo = (n) => {
    const j = (contexto || {})[n] || {};
    return { item: { json: j }, first: () => ({ json: j }), all: () => [{ json: j }] };
  };
  const r = f(nodo,
    { item: { json: entrada }, first: () => ({ json: entrada }), all: () => [{ json: entrada }] },
    () => ((contexto || {}).estatico || {}),
    { log: (m) => log.push(String(m)) });
  return { salida: r, log };
}

(async () => {
  // ══ las conexiones ═══════════════════════════════════════════════════════
  console.log("LAS CONEXIONES");
  for (const [etiqueta, wf] of [["orquestador", orq], ["segmento", seg]]) {
    const nombres = new Set(wf.nodes.map((n) => n.name));
    const rotas = [];
    for (const [de, c] of Object.entries(wf.connections)) {
      if (!nombres.has(de)) rotas.push("sale de un nodo que no existe: " + de);
      for (const rama of c.main || []) for (const l of rama) {
        if (!nombres.has(l.node)) rotas.push(de + " -> " + l.node);
      }
    }
    comprueba(etiqueta + ": ninguna apunta a un nodo inexistente", rotas.length === 0,
      rotas.slice(0, 2).join(" | "));
  }

  // El disparador programado tiene que estar CONECTADO. Es el defecto que dejó
  // Alemania dos meses parada.
  const cron = orq.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  comprueba("el orquestador tiene disparador programado", !!cron);
  comprueba("y está conectado a algo",
    !!cron && !!orq.connections[cron.name] && (orq.connections[cron.name].main || []).flat().length > 0);

  // Y dentro de la ventana que pidió Ana: de 8:00 a 00:00, nada de madrugada.
  const expr = cron && ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const horas = String(expr || "").split(" ")[2] || "";
  const listaHoras = horas.split(",").map(Number).filter((h) => !Number.isNaN(h));
  comprueba("corre entre las 8:00 y las 00:00",
    listaHoras.length > 0 && listaHoras.every((h) => h >= 8 && h <= 23),
    expr + "   (horas: " + listaHoras.join(", ") + ")");

  // ══ el cursor de marcas ══════════════════════════════════════════════════
  //
  // Vivía en $getWorkflowStaticData, que se reinicia al reimportar el workflow.
  // El 2026-09-09 se reimportó tres veces en una tarde y las tres pasadas
  // empezaron por la misma marca: dos horas releyendo Audi, que ya estaba
  // entero -6 ofertas nuevas cada cinco minutos en vez de mil-.
  console.log("\nEL CURSOR DE MARCAS");
  const gen = codigo(orq, "Code: Generar segmentos (marca x precio)");
  comprueba("no vive en la memoria del workflow",
    !/getWorkflowStaticData/.test(gen));
  comprueba("lo lee de Postgres", /\$\('PG: Por dónde íbamos'\)/.test(gen));
  comprueba("y hay un nodo que lo apunta una sola vez",
    orq.nodes.some((n) => n.name === "PG: Apuntar dónde nos quedamos" && n.executeOnce === true));

  // Se ejecuta el generador como lo haría n8n, con el cursor que le daría la
  // base, y se comprueba que reparte y avanza bien.
  const gen42 = corre(gen, {}, { "PG: Por dónde íbamos": { cursor: 3 } });
  const marcas = [...new Set(gen42.salida.map((x) => x.json.mk))];
  comprueba("con el cursor en 3 saca 3 marcas × 14 tramos",
    gen42.salida.length === 42 && marcas.length === 3, "(" + gen42.salida.length + " segmentos)");
  comprueba("y no repite las que ya están hechas",
    !marcas.includes(9) && !marcas.includes(13) && !marcas.includes(47),
    "marcas " + marcas.join(", "));
  comprueba("deja apuntado por dónde sigue la próxima",
    /UPDATE moveadvisor_cursores SET valor = 6\b/.test(gen42.salida[0].json.sqlCursor || ""));
  gen42.log.forEach((l) => console.log("      " + l));

  // Y que da la vuelta al llegar al final de la lista.
  const genFin = corre(gen, {}, { "PG: Por dónde íbamos": { cursor: 44 } });
  comprueba("al llegar al final vuelve a empezar",
    /valor = 2\b/.test(genFin.salida[0].json.sqlCursor || ""),
    "cursor 44 de 45 -> la próxima empieza en la 2");
  const sinCursor = corre(gen, {}, { "PG: Por dónde íbamos": {} });
  comprueba("y si la base no le da cursor, empieza por el principio",
    sinCursor.salida.length === 42 && sinCursor.salida[0].json.mk === 9);

  // ══ la llamada al sub-workflow ═══════════════════════════════════════════
  console.log("\nLA LLAMADA AL SUB-WORKFLOW");
  const llamada = orq.nodes.find((n) => n.type.endsWith("executeWorkflow"));
  const wid = (llamada.parameters || {}).workflowId;

  // La forma del parámetro depende de la versión del nodo, y equivocarse no da
  // un error claro: n8n pinta «[object Object]» en el campo y responde
  // «Workflow does not exist».
  //
  //     @version 1        workflowId: type 'string'            -> cadena pelada
  //     @version >= 1.1   workflowId: type 'workflowSelector'  -> { __rl, value }
  //
  // Este nodo estaba en la versión 1 con el objeto de la 1.1, o sea mal desde
  // que se escribió. Y encima con un id que tampoco existía.
  const v = Number(llamada.typeVersion || 1);
  const esObjeto = wid !== null && typeof wid === "object";
  comprueba("el id del sub-workflow tiene la forma que pide la versión del nodo",
    v >= 1.1 ? esObjeto : !esObjeto,
    "typeVersion " + v + ", " + (esObjeto ? "objeto" : "cadena"));

  const id = esObjeto ? wid.value : wid;
  comprueba("el orquestador llama a un sub-workflow por id", !!id, String(id));
  if (fs.existsSync(N8N_DB)) {
    const db = new DatabaseSync(N8N_DB, { readOnly: true });
    const dest = db.prepare("SELECT name FROM workflow_entity WHERE id = ?").get(String(id));
    const suyo = db.prepare("SELECT id FROM workflow_entity WHERE name = ?").get(seg.name);
    db.close();
    comprueba("ese id existe en n8n", !!dest, dest ? dest.name : "NO EXISTE");
    comprueba("y es el workflow de segmento, no otro",
      !!dest && dest.name === seg.name,
      suyo ? "el de segmento tiene el id " + suyo.id : "");
  } else {
    console.log("      (no encuentro la base de n8n, me salto esa comprobación)");
  }

  // ══ los nodos HTTP ═══════════════════════════════════════════════════════
  console.log("\nLOS NODOS HTTP");
  const https = seg.nodes.filter((n) => n.type.endsWith("httpRequest"));
  comprueba("los " + https.length + " mandan cabeceras",
    https.every((n) => n.parameters.sendHeaders === true
      && ((n.parameters.headerParameters || {}).parameters || []).some((c) => c.name === "User-Agent")));
  comprueba("ninguna escondida en options.headers, que typeVersion 4 ignora",
    https.every((n) => !(n.parameters.options || {}).headers));
  comprueba("un corte de red no tumba la pasada",
    https.every((n) => n.onError === "continueRegularOutput"));
  // Un segmento que falle no puede llevarse por delante los otros 41. Paso el
  // 2026-09-09: Neon corto la conexion en el segmento 13 de 42 y se perdio el
  // resto de la pasada.
  const ew = orq.nodes.filter((n) => n.type.endsWith("executeWorkflow"));
  comprueba("un segmento fallido no tumba la pasada entera",
    ew.every((n) => n.onError === "continueRegularOutput"));
  const pgSeg = seg.nodes.filter((n) => n.type.endsWith(".postgres"));
  comprueba("el nodo de Postgres reintenta si la conexión se cae",
    pgSeg.every((n) => n.retryOnFail === true && n.maxTries >= 2));

  comprueba("piden coches de Alemania (cy=D)",
    https.every((n) => /[?&]cy=D\b/.test(String(n.parameters.url))));

  // ══ contra AutoScout24 de verdad ═════════════════════════════════════════
  console.log("\nCONTRA AUTOSCOUT24 DE VERDAD");
  const H = {};
  ((https[0].parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });
  // Un segmento cualquiera: SEAT (74), de 0 a 3.000 €.
  const url = String(https[0].parameters.url)
    .replace(/^=/, "")
    .replace("{{ $json.mk }}", "74").replace("{{ $json.pf }}", "0").replace("{{ $json.pt }}", "3000");
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
  const cuerpo = await r.text();
  console.log("      HTTP " + r.status + "   " + cuerpo.length + " bytes");
  comprueba("el listado responde", r.status === 200);
  comprueba("y no es una pantalla de bloqueo",
    !/_Incapsula_|incident_id|cf-browser-verification/i.test(cuerpo));

  const pag = corre(codigo(seg, "Code: Generar páginas"), { body: cuerpo },
    { Params: { mk: 74, pf: 0, pt: 3000 } });
  comprueba("saca cuántas páginas tiene el segmento", pag.salida.length > 0,
    "(" + pag.salida.length + " páginas, tope 30)");
  comprueba("y no se pasa del tope", pag.salida.length <= 30);

  const tr = corre(codigo(seg, "Code: Transformar ofertas"), { body: cuerpo });
  const sql = tr.salida[0].json.sql;
  const n = tr.salida[0].json.count;
  comprueba("saca ofertas de la página", n > 0, "(" + n + " ofertas)");
  comprueba("genera SQL", !!sql && /INSERT INTO moveadvisor_market_offers/.test(sql));
  comprueba("las marca como alemanas", /'DE'/.test(sql || ""));

  // Una página que no viene no puede tumbar la pasada.
  const mala = corre(codigo(seg, "Code: Transformar ofertas"), { body: "" });
  comprueba("una página vacía se salta sin romper nada", mala.salida[0].json.sql === null);

  // ══ el UPSERT ════════════════════════════════════════════════════════════
  //
  // Aquí había una errata de dos caracteres con consecuencias: la línea del
  // color llevaba CUATRO comillas donde las demás llevan dos.
  //
  //     images = COALESCE(NULLIF(...images,''),  EXCLUDED.images)
  //     color  = COALESCE(NULLIF(...color,''''), EXCLUDED.color)
  //
  // En SQL '''' no es la cadena vacía: es una cadena que contiene una comilla.
  // Así que NULLIF nunca devolvía NULL sobre un color vacío, COALESCE se
  // quedaba con el vacío, y un color que faltara no se rellenaba jamás.
  console.log("\nEL UPSERT");
  comprueba("el color se rellena si estaba vacío",
    /color = COALESCE\(NULLIF\(moveadvisor_market_offers\.color, ?''\), ?EXCLUDED\.color\)/.test(sql || ""));
  comprueba("y las demás columnas con COALESCE también",
    !/NULLIF\([^)]*, ?''''\)/.test(sql || ""));
  comprueba("sella last_seen_at al reencontrarlas", /last_seen_at = NOW\(\)/.test(sql || ""));

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  await c.query("BEGIN");
  try {
    const res = await c.query(sql);
    comprueba("el SQL se ejecuta sin error", true, "(" + res.rowCount + " filas)");
    const q = (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='autoscout24' AND country='DE'"
    )).rows[0].n;
    console.log("      ofertas DE en la base: " + q);
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
