/**
 * Comprueba el confirmador de wallapop por vendedor.
 *
 *   npm run test:wallapop-confirmar
 *
 * Baja un catálogo de verdad de la API y se lo da a los nodos Code tal como
 * están en el JSON del workflow. El SQL se lanza contra la base dentro de
 * BEGIN/ROLLBACK, que se deshace siempre.
 *
 * ── Lo que vigila, y por qué cada cosa ────────────────────────────────────
 *
 *   - QUE NO DÉ NI UNA BAJA. Es la razón de ser de este fichero. La idea
 *     evidente -dar por vendido lo que no aparece en el catálogo del
 *     vendedor- se probó y es FALSA: de 12 ofertas ausentes, 2 seguían vivas.
 *     Si alguien «mejora» esto para que también dé bajas, esta prueba se lo
 *     dice con los coches buenos que mataría.
 *
 *   - QUE LA PAGINACIÓN USE `since`. Con `next_page`, `next` o `cursor` la
 *     API devuelve OTRA VEZ la primera página, con HTTP 200 y sin queja. Un
 *     bucle con el nombre equivocado da vueltas sobre los mismos 40 anuncios
 *     para siempre y parece que funciona.
 *
 *   - QUE LA CABECERA X-DeviceOS ESTÉ. Sin ella la API responde 403.
 *
 *   - QUE LA MEMORIA SE LIMPIE. Es del workflow, no de la pasada: si los
 *     contadores sobreviven, el parte de mañana lleva los números de hoy.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "wallapop-confirmar-por-vendedor.json"), "utf8"));
const nodo = (n) => wf.nodes.find((x) => x.name === n);
const codigo = (n) => nodo(n).parameters.jsCode;

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
function ejecuta(js, ctx) {
  const f = new Function("$", "$input", "$getWorkflowStaticData", "console", js);
  const r = f(ctx.$ || (() => uno({})), ctx.$input, () => ctx.estatico,
    { log: (m) => (ctx.log || []).push(String(m)) });
  return r || [];
}
const uno = (j) => ({ first: () => ({ json: j }), all: () => [{ json: j }], item: { json: j } });
const varios = (js) => ({ first: () => ({ json: js[0] }), all: () => js.map((j) => ({ json: j })),
  item: { json: js[0] } });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("\n  el workflow");
  /*
   * El id tiene que ser el que n8n ya tiene, no uno inventado de 16
   * caracteres. Con uno inventado, la importacion crea una COPIA y quedan
   * dos workflows con dos crones pidiendo lo mismo a wallapop.
   */
  comprueba("el id es el que n8n asigno", wf.id === "ddnBIkp12vd6YhAQ",
    wf.id + " (" + String(wf.id).length + " caracteres)");
  comprueba("nace apagado", wf.active === false);

  const http = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
  const H = {};
  ((http.parameters.headerParameters || {}).parameters || []).forEach((c) => { H[c.name] = c.value; });
  comprueba("manda X-DeviceOS: sin ella la API da 403", H["X-DeviceOS"] === "0", H["X-DeviceOS"]);

  const pag = (((http.parameters.options || {}).pagination || {}).pagination) || {};
  const qs = (((pag.parameters || {}).parameters) || [])[0] || {};
  comprueba("pagina con `since`, que es el unico que avanza", qs.name === "since",
    "usa " + qs.name);
  comprueba("y toma el cursor de meta.next",
    /meta\.next/.test(String(qs.value)), String(qs.value));
  comprueba("tiene tope de paginas", pag.limitPagesFetched === true && pag.maxRequests > 0,
    pag.maxRequests + " paginas");

  /*
   * LA COMPROBACIÓN QUE JUSTIFICA ESTE FICHERO.
   *
   * Ni el SQL ni el codigo pueden contener nada que de una baja. Se mira el
   * workflow ENTERO, no solo el nodo que se espera.
   */
  console.log("\n  que no pueda dar ni una baja");
  const todo = JSON.stringify(wf);
  comprueba("no pone is_active a FALSE en ninguna parte",
    !/is_active\s*=\s*FALSE/i.test(todo));
  comprueba("ni borra ofertas", !/DELETE\s+FROM\s+moveadvisor_market_offers/i.test(todo));
  const sqlConfirmar = nodo("Code: Confirmar vivas").parameters.jsCode;
  comprueba("lo unico que escribe es last_checked_at",
    /SET last_checked_at = NOW\(\)/.test(sqlConfirmar)
    && !/SET[^']*is_active/i.test(sqlConfirmar));

  console.log("\n  un catalogo de verdad");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 120000 });
  await c.connect();
  const v = (await c.query(`
    SELECT d.dealer_id, o.dealer_name, count(*)::int AS ofertas
      FROM moveadvisor_market_offers o
      JOIN LATERAL (SELECT dealer_id FROM moveadvisor_market_dealers
                     WHERE portal='wallapop' AND company_name = o.dealer_name LIMIT 1) d ON true
     WHERE o.portal='wallapop' AND o.is_active AND COALESCE(o.dealer_name,'') <> ''
     GROUP BY 1,2 HAVING count(*) BETWEEN 15 AND 60
     ORDER BY count(*) DESC LIMIT 1`)).rows[0];
  comprueba("hay un vendedor de prueba", Boolean(v), v ? v.dealer_name + ", " + v.ofertas + " ofertas" : "");
  if (!v) { await c.end(); process.exit(1); }

  const paginas = [];
  let url = "https://api.wallapop.com/api/v3/users/" + v.dealer_id + "/items";
  for (let p = 0; p < 5 && url; p++) {
    const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(20000) });
    if (r.status !== 200) { comprueba("la API responde 200", false, "HTTP " + r.status); break; }
    const j = await r.json();
    paginas.push(j);
    const sig = j.meta && j.meta.next;
    url = sig ? "https://api.wallapop.com/api/v3/users/" + v.dealer_id
      + "/items?since=" + encodeURIComponent(sig) : null;
    if (url) await dormir(1200);
  }
  const anuncios = paginas.reduce((n, j) => n + ((j.data || []).length), 0);
  comprueba("trae anuncios", anuncios > 0, anuncios + " en " + paginas.length + " paginas");
  comprueba("cada pagina trae los suyos, no repite la primera",
    paginas.length < 2 || new Set(paginas.flatMap((j) => (j.data || []).map((x) => x.id))).size === anuncios,
    "ids distintos frente a " + anuncios + " anuncios");

  console.log("\n  el nodo que decide");
  const est = {};
  const salida = ejecuta(codigo("Code: Confirmar vivas"), {
    estatico: est,
    $: () => uno(v),
    $input: varios(paginas),
  });
  const r0 = salida[0].json;
  comprueba("dice que hay que confirmar", r0.seguir === "si");
  comprueba("y cuenta los que ha visto", r0.vistos === anuncios, r0.vistos + " de " + anuncios);
  comprueba("el SQL solo toca wallapop", /portal = 'wallapop'/.test(r0.sql || ""));
  comprueba("y solo las que ya damos por vivas", /AND is_active/.test(r0.sql || ""));

  console.log("\n  un vendedor sin catalogo no rompe nada");
  const vacio = ejecuta(codigo("Code: Confirmar vivas"), {
    estatico: {}, $: () => uno(v), $input: varios([{ data: [] }]),
  });
  comprueba("no confirma nada", vacio[0].json.seguir === "");
  comprueba("y no deja SQL que lanzar", vacio[0].json.sql === null);

  console.log("\n  el SQL, contra la base y deshecho");
  await c.query("BEGIN");
  try {
    const antes = (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='wallapop' AND is_active"
    )).rows[0].n;
    const tocadas = (await c.query(r0.sql)).rowCount;
    comprueba("confirma alguna de las nuestras", tocadas > 0, tocadas + " filas");
    comprueba("y no cambia cuantas estan vivas", (await c.query(
      "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE portal='wallapop' AND is_active"
    )).rows[0].n === antes, "siguen " + antes);
  } finally {
    await c.query("ROLLBACK");
  }
  await c.end();

  console.log("\n  la memoria");
  const resumen = ejecuta(codigo("Code: Resumen"), { estatico: est, $input: uno({}) });
  comprueba("el parte cuenta los vendedores", resumen[0].json.vendedores >= 1,
    JSON.stringify(resumen[0].json));
  comprueba("y la memoria queda limpia",
    !Object.keys(est).some((k) => k.indexOf("wp_") === 0), Object.keys(est).join(", "));

  console.log("\n  " + (fallos ? fallos + " FALLOS" : "todo en orden") + "\n");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error("\nERROR:", e.message); process.exit(1); });
