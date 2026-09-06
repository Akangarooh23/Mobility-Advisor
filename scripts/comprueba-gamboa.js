/**
 * Comprueba el scraper de Gamboa.
 *
 *   npm run test:gamboa
 *
 * Pide UNA pagina real del listado, se la da al nodo Code tal como esta en el
 * JSON del workflow, y lanza el SQL que genera contra la base de verdad dentro
 * de BEGIN/ROLLBACK. Una peticion, sin dejar rastro.
 *
 * Lo que vigila:
 *
 *   - Que las cabeceras se manden. Estaban en options.headers.values, que en
 *     typeVersion 4 n8n ignora en silencio: el scraper pedia las paginas sin
 *     User-Agent ninguno.
 *   - Que una respuesta que no sea 200 pare el run en vez de guardar cero
 *     ofertas calladamente. Con neverError puesto, ese es el riesgo.
 *   - Que el SQL entre de verdad en la tabla, con las columnas que dice.
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "gamboa-scraper-vo.json"), "utf8"));
const nodoHttp = wf.nodes.find((n) => n.type.endsWith("httpRequest"));
const JS = wf.nodes.find((n) => n.name === "Code: Transformar ofertas").parameters.jsCode;
const JS_URLS = wf.nodes.find((n) => n.name === "Code: Generar URLs").parameters.jsCode;

function generaUrls(respuesta) {
  const f = new Function("$input", "console", JS_URLS);
  const log = [];
  return { items: f({ first: () => ({ json: respuesta }) }, { log: (m) => log.push(String(m)) }), log };
}

function transforma(respuesta) {
  const f = new Function("$input", JS);
  return f({ item: { json: respuesta } })[0].json;
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  // ── las cabeceras, donde n8n las lee ──────────────────────────────────────
  console.log("CABECERAS");
  const cab = ((nodoHttp.parameters.headerParameters || {}).parameters || []);
  comprueba("sendHeaders esta puesto", nodoHttp.parameters.sendHeaders === true);
  comprueba("van en headerParameters, que es donde typeVersion 4 mira",
    cab.length > 0, "(" + cab.map((c) => c.name).join(", ") + ")");
  comprueba("no queda ninguna escondida en options.headers",
    !(nodoHttp.parameters.options || {}).headers);
  comprueba("manda User-Agent", cab.some((c) => c.name === "User-Agent"));

  // ── una respuesta que no es 200 tiene que parar el run ────────────────────
  console.log("\nRESPUESTA MALA");
  let paro = false;
  try { transforma({ statusCode: 503, body: "<html>error</html>" }); }
  catch (e) { paro = /HTTP 503/.test(e.message); }
  comprueba("un 503 detiene el run en vez de guardar cero ofertas", paro);
  paro = false;
  try { transforma({ statusCode: 404, body: "" }); } catch (e) { paro = true; }
  comprueba("un 404 tambien", paro);

  // ── una pagina real ───────────────────────────────────────────────────────
  console.log("\nUNA PAGINA REAL DEL LISTADO");
  const headers = {};
  cab.forEach((c) => { headers[c.name] = c.value; });
  const url = "https://www.gamboaocasion.com/coches-ocasion-madrid";
  const r = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(25000) });
  const body = await r.text();
  console.log("      " + url + "  ->  HTTP " + r.status + "   " + body.length + " bytes");
  comprueba("el listado responde 200", r.status === 200);

  // ── cuantas paginas planifica ─────────────────────────────────────────────
  // El numero de paginas ya no es fijo: se lee del propio listado. El anterior
  // decia "~463 coches = ~20 paginas" y el concesionario publica hoy 683, o sea
  // que el scraper veia poco mas de la mitad sin que nada lo dijera.
  console.log("\nPLANIFICACION");
  const plan = generaUrls({ statusCode: 200, body: body });
  plan.log.forEach((l) => console.log("      " + l));
  const paginas = plan.items.length;
  comprueba("cuenta el catalogo y planifica en consecuencia", paginas >= 25 && paginas <= 60,
    "(" + paginas + " paginas)");
  comprueba("la pagina 1 va sin ?pagina=", !/pagina=/.test(plan.items[0].json.url));
  comprueba("la ultima lleva su numero",
    plan.items[paginas - 1].json.url.endsWith("?pagina=" + paginas));

  let paro2 = false;
  try { generaUrls({ statusCode: 500, body: "" }); } catch (e) { paro2 = true; }
  comprueba("si no puede contar el catalogo, para el run", paro2);

  const out = transforma({ statusCode: r.status, body: body });
  console.log("      ofertas encontradas en la pagina: " + out.count);
  comprueba("saca ofertas de la pagina", out.count > 0);
  comprueba("genera SQL", !!out.sql && /INSERT INTO moveadvisor_marketplace_vo_offers/.test(out.sql));
  comprueba("sella last_seen_at al reencontrarlas", /last_seen_at = NOW\(\)/.test(out.sql));

  // updated_at NO puede moverse en cada pasada. El escaparate ordena por
  // portal_score y, como todos los concesionarios valen 80, el desempate real
  // es updated_at DESC: ponerlo a NOW() sin motivo metia las 609 filas de
  // Gamboa por delante de VIAN y de Modrive, hasta el punto de que el filtro de
  // vendedor del ERP ya solo ofrecia Gamboa.
  comprueba("updated_at solo se mueve si el anuncio ha cambiado",
    /updated_at = CASE WHEN/.test(out.sql) && !/updated_at = NOW\(\)/.test(out.sql));
  comprueba("y lo decide comparando precio, titulo y kilometros",
    /price IS DISTINCT FROM EXCLUDED\.price/.test(out.sql)
    && /title IS DISTINCT FROM EXCLUDED\.title/.test(out.sql)
    && /mileage IS DISTINCT FROM EXCLUDED\.mileage/.test(out.sql));

  // ── contra la base, y deshecho ────────────────────────────────────────────
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  await c.query("BEGIN");
  try {
    const antes = Number((await c.query(`SELECT count(*) n FROM moveadvisor_marketplace_vo_offers
      WHERE portal='gamboa'`)).rows[0].n);
    const q = await c.query(out.sql);
    const despues = Number((await c.query(`SELECT count(*) n FROM moveadvisor_marketplace_vo_offers
      WHERE portal='gamboa'`)).rows[0].n);
    comprueba("el SQL se ejecuta sin error", true, "(" + q.rowCount + " filas tocadas)");
    console.log("      ofertas de gamboa: " + antes + " -> " + despues + "  (nuevas: " + (despues - antes) + ")");

    const m = (await c.query(`SELECT count(*) n FROM moveadvisor_marketplace_vo_offers
      WHERE portal='gamboa' AND last_seen_at > NOW() - INTERVAL '1 minute'`)).rows[0].n;
    comprueba("deja last_seen_at fresco en las que ha visto", Number(m) > 0, "(" + m + ")");
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
