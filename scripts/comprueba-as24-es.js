/**
 * Comprueba el scraper de AutoScout24 España (orquestador + segmento).
 *
 *   npm run test:as24-es
 *
 * Pide páginas de verdad a autoscout24.es y se las da a los nodos Code tal como
 * están en el JSON. Luego lanza el UPSERT contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que las cabeceras vayan donde n8n las lee. En typeVersion 4,
 *     options.headers se IGNORA en silencio: el scraper llevaba desde agosto
 *     pidiéndole a AutoScout24 sin User-Agent.
 *   - Que el orquestador llame al segmento con el id COMO TEXTO. La forma de
 *     objeto con typeVersion 1 da «Workflow does not exist».
 *   - Que las barras de los regex hayan sobrevivido a vivir dentro de una
 *     cadena: "\d" en una cadena es "d", y el fichero alemán tiene ese fallo.
 *   - Que NULLIF del color compare contra vacío y no contra «''».
 *   - Que el cursor avance y no repita marca, que es lo que costó dos horas de
 *     releer Audi en Alemania.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const lee = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, "n8n-workflows", f), "utf8"));
const orq = lee("autoscout24-scraper-offers.json");
const seg = lee("autoscout24-segmento.json");
const nodo = (w, n) => w.nodes.find((x) => x.name === n);
const codigo = (w, n) => nodo(w, n).parameters.jsCode;

function ejecuta(js, ctx) {
  const log = [];
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  const r = f(ctx.$ || (() => ({ item: { json: {} }, first: () => ({ json: {} }) })),
    ctx.$input, () => ctx.estatico || {}, { log: (m) => log.push(String(m)) });
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
    sub.parameters.workflowId !== "PENDIENTE_DE_ENLAZAR" && /^[A-Za-z0-9]{8,}$/.test(sub.parameters.workflowId),
    sub.parameters.workflowId);
  comprueba("la forma del id casa con la typeVersion",
    (sub.typeVersion >= 1.1) === (typeof sub.parameters.workflowId === "object"),
    "tv" + sub.typeVersion);

  const cron = orq.nodes.find((n) => String(n.type).endsWith("scheduleTrigger"));
  const expr = cron.parameters.rule.interval[0].expression;
  const p = String(expr).split(" ");
  const horas = String(p[2]).split(",").map(Number);
  comprueba("corre entre las 8:00 y las 00:00", horas.every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(p[1]) !== 0, "minuto " + p[1]);
  // El scraper ALEMÁN ocupa 8:15-11:00 y 20:15-23:00 pegándole al mismo portal.
  // Una pasada española dura unas 2h45.
  comprueba("no se solapa con el scraper alemán",
    horas.every((h) => h >= 11 && h + 3 <= 20), "empieza a las " + horas.join(" y "));
  comprueba("avisa por correo si falla", orq.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  comprueba("los Postgres reintentan",
    orq.nodes.filter((n) => String(n.type).endsWith(".postgres")).every((n) => n.retryOnFail === true));

  // El cursor: dos pasadas seguidas NO pueden repetir marca.
  console.log("\nEL CURSOR DE MARCAS");
  const genSeg = codigo(orq, "Code: Generar segmentos (marca x precio)");
  const pasada = (cursor) => ejecuta(genSeg, {
    $: (n) => (n === "PG: Por dónde íbamos" ? { first: () => ({ json: { cursor } }) } : uno({})),
    $input: uno({}),
  }).items.map((x) => x.json);
  const a = pasada(0);
  const b = pasada(3);
  comprueba("una pasada da marcas x tramos", a.length === 42, a.length + " segmentos");
  const marcasA = [...new Set(a.map((x) => x.mk))];
  const marcasB = [...new Set(b.map((x) => x.mk))];
  comprueba("la segunda pasada NO repite marca de la primera",
    !marcasA.some((m) => marcasB.includes(m)), marcasA.join(",") + "  vs  " + marcasB.join(","));
  comprueba("y deja apuntado por dónde seguir",
    /UPDATE moveadvisor_cursores SET valor = 3/.test(a[0].sqlCursor), a[0].sqlCursor.slice(0, 58));
  const vuelta = pasada(44);
  comprueba("al llegar al final vuelve a empezar",
    vuelta.length === 42 && /valor = 2/.test(vuelta[0].sqlCursor));
  comprueba("un cursor corrupto no revienta la pasada", pasada(999).length === 42);

  // ══ el segmento ══════════════════════════════════════════════════════════
  console.log("\nEL SEGMENTO");
  for (const n of seg.nodes.filter((x) => String(x.type).endsWith("httpRequest"))) {
    const hp = ((n.parameters.headerParameters || {}).parameters || []).map((x) => x.name);
    comprueba("manda User-Agent donde n8n lo lee   [" + n.name + "]",
      n.parameters.sendHeaders === true && hp.includes("User-Agent")
      && !(n.parameters.options || {}).headers, hp.join(", "));
    comprueba("un corte de red no tumba la pasada   [" + n.name + "]",
      n.onError === "continueRegularOutput");
  }
  comprueba("el upsert reintenta si se corta Postgres",
    nodo(seg, "PG: Upsert ofertas").retryOnFail === true);
  comprueba("avisa por correo si falla", seg.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  const js = codigo(seg, "Code: Transformar ofertas");
  comprueba("el regex de dígitos conserva su barra",
    js.indexOf("[^\\d]") >= 0 && js.indexOf("[^d]") < 0);
  const lineaColor = js.split("\n").find((l) => l.indexOf("NULLIF(moveadvisor_market_offers.color") >= 0) || "";
  comprueba("NULLIF del color compara contra vacío, no contra «''»",
    lineaColor.indexOf("color,'')") >= 0 && lineaColor.indexOf("''''") < 0);
  comprueba("marca el país", /'ES', NOW\(\)/.test(js) && /country = EXCLUDED\.country/.test(js));
  comprueba("volver a ver una oferta la devuelve a la vida", /is_active = TRUE/.test(js));

  // ══ páginas de verdad ════════════════════════════════════════════════════
  console.log("\nUNA MARCA REAL, DE PRINCIPIO A FIN");
  const http = nodo(seg, "HTTP: Contar (pág 1)");
  const H = {};
  (http.parameters.headerParameters.parameters).forEach((c) => { H[c.name] = c.value; });
  const monta = (mk, pf, pt, page) => String(http.parameters.url)
    .replace("=https://", "https://")
    .replace("{{ $json.mk }}", mk).replace("{{ $json.pf }}", pf)
    .replace("{{ $json.pt }}", pt).replace(/page=.*$/, "page=" + page);

  const url1 = monta(9, 4000, 8000, 1);
  const r1 = await fetch(url1, { headers: H, signal: AbortSignal.timeout(30000) });
  const html1 = await r1.text();
  comprueba("AutoScout24 nos responde", r1.status === 200, "HTTP " + r1.status
    + "   " + (html1.length / 1024).toFixed(0) + " KB");

  const pags = ejecuta(codigo(seg, "Code: Generar páginas"), {
    $: (n) => (n === "Params" ? uno({ mk: 9, pf: 4000, pt: 8000 }) : uno({})),
    $input: uno({ data: html1 }),
  }).items;
  comprueba("sabe cuántas páginas hay", pags.length > 0 && pags.length <= 200,
    pags.length + " páginas");
  comprueba("y las numera desde la 1",
    pags.length > 0 && pags[0].json.page === 1 && pags[0].json.mk === 9);

  await dormir(1500);
  const r2 = await fetch(monta(9, 4000, 8000, 1), { headers: H, signal: AbortSignal.timeout(30000) });
  const html2 = await r2.text();
  const t = ejecuta(js, { $input: uno({ data: html2 }) }).items[0].json;
  comprueba("saca ofertas de la página", t.count > 0, t.count + " ofertas");
  comprueba("y arma un INSERT", /^INSERT INTO moveadvisor_market_offers/.test(t.sql || ""));
  comprueba("todas con URL española",
    (t.sql.match(/https:\/\/www\.autoscout24\.es\/anuncios/g) || []).length === t.count);
  comprueba("NO marca país alemán", !/'DE'/.test(t.sql));

  // ══ contra la base ═══════════════════════════════════════════════════════
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();
  await c.query("BEGIN");
  try {
    const res = await c.query(t.sql);
    comprueba("el UPSERT entra sin quejarse", res.rowCount === t.count,
      res.rowCount + " de " + t.count + " filas");
    const ids = (t.sql.match(/\('(as_[0-9a-f-]+)'/g) || []).map((x) => x.slice(2, -1));
    const q = await c.query(`SELECT country, portal, price, is_active,
        COALESCE(color,'') color, COALESCE(title,'') title
      FROM moveadvisor_market_offers WHERE id = ANY($1)`, [ids]);
    comprueba("quedan guardadas como españolas",
      q.rows.length > 0 && q.rows.every((x) => x.country === "ES"), q.rows.length + " filas");
    comprueba("y activas", q.rows.every((x) => x.is_active === true));
    comprueba("con precio", q.rows.filter((x) => x.price > 0).length >= q.rows.length * 0.9,
      q.rows.filter((x) => x.price > 0).length + " de " + q.rows.length);
    const conColor = q.rows.filter((x) => x.color).length;
    console.log("      color sacado del slug: " + conColor + " de " + q.rows.length);
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
