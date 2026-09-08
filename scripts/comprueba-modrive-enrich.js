/**
 * Comprueba el enriquecedor de Modrive.
 *
 *   npm run test:modrive-enrich
 *
 * Pide DOS fichas reales -una normal y una de siete plazas- y se las da al nodo
 * Code tal como está en el JSON del workflow. Luego lanza el SQL que genera
 * contra la base dentro de BEGIN/ROLLBACK.
 *
 * Lo que vigila:
 *
 *   - Que las plazas no salgan de «Asientos traseros de tres plazas». Sin exigir
 *     el paréntesis de «Cinco plazas ( 2+3 )», esa frase gana la carrera y
 *     escribe 3 plazas en un coche de 5; en el X-Trail de 7 escribía 2.
 *   - Que la cilindrada respete el separador de miles: «( 1.598 cc )» son 1598.
 *   - Que updated_at NO se mueva si la pasada no cambia ningún campo. El repaso
 *     de los 30 días vuelve a pasar por las 1.988 fichas y lo normal es que no
 *     cambie nada: sellarlo pondría a Modrive por delante de VIAN y de Gamboa
 *     en el escaparate sin que ningún coche se haya tocado.
 *   - Que una ficha que no se sabe leer NO se selle como viva, pero sí gaste su
 *     enrich_tried_at, para que no atasque la cola para siempre.
 *   - Que no se invente color ni provincia, que Modrive no publica.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "modrive-enrich-offers.json"), "utf8"));
const codigo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
const nodosHttp = wf.nodes.filter((n) => n.type.endsWith("httpRequest"));
const H = {};
(nodosHttp[0].parameters.headerParameters.parameters || []).forEach((c) => { H[c.name] = c.value; });

function corre(js, res, oferta) {
  const log = [];
  const f = new Function("$", "$input", "console", js);
  const r = f(() => ({ item: { json: oferta } }),
    { first: () => ({ json: res }), all: () => [{ json: res }] },
    { log: (m) => log.push(String(m)) });
  return { json: (r && r[0] ? r[0].json : {}), log };
}

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ── configuración ─────────────────────────────────────────────────────────
  console.log("CONFIGURACIÓN");
  comprueba("los " + nodosHttp.length + " nodos HTTP mandan cabeceras",
    nodosHttp.every((n) => n.parameters.sendHeaders === true
      && (n.parameters.headerParameters || {}).parameters));
  comprueba("ninguna escondida en options.headers",
    nodosHttp.every((n) => !(n.parameters.options || {}).headers));
  comprueba("un fallo de red no tumba la pasada",
    nodosHttp.every((n) => n.onError === "continueRegularOutput"));
  comprueba("hay un IF antes del HTTP para la cola vacía",
    wf.nodes.some((n) => n.name === "IF: ¿hay ficha que pedir?"));
  comprueba("el workflow avisa si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");

  // ── de dónde salen las fichas de prueba ───────────────────────────────────
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  const cola = wf.nodes.find((n) => n.name === "PG: Cola a enriquecer").parameters.query;
  const q = await c.query(cola);
  console.log("\nLA COLA");
  comprueba("la consulta de la cola se ejecuta", true, "(" + q.rows.length + " ofertas pendientes)");
  comprueba("solo pide ofertas de Modrive activas",
    /portal = 'modrive'/.test(cola) && /AND is_active/.test(cola));
  comprueba("y no vuelve a por las ya enriquecidas antes de 30 días",
    /enrich_tried_at < NOW\(\) - INTERVAL '30 days'/.test(cola));

  // Una normal y la de siete plazas, que es la que descubrió el fallo.
  const siete = await c.query(`SELECT id, source_url FROM moveadvisor_marketplace_vo_offers
     WHERE portal='modrive' AND is_active AND title ILIKE '%X-Trail%7pl%' LIMIT 1`);
  const casos = [];
  if (q.rows.length) casos.push({ etiqueta: "una ficha cualquiera", fila: q.rows[0], plazas: null });
  if (siete.rows.length) casos.push({ etiqueta: "un X-Trail de 7 plazas", fila: siete.rows[0], plazas: 7 });

  let ultimoSql = null;
  for (const caso of casos) {
    console.log("\n" + caso.etiqueta.toUpperCase());
    const r = await fetch(caso.fila.source_url, { headers: H, signal: AbortSignal.timeout(30000) });
    const body = await r.text();
    console.log("      " + caso.fila.source_url.slice(-56) + "  ->  HTTP " + r.status);
    const out = corre(codigo("Code: Extraer de la ficha"),
      { statusCode: r.status, body: body }, caso.fila);
    out.log.forEach((l) => console.log("      " + l));
    const j = out.json;
    ultimoSql = j.sql;

    comprueba("genera el UPDATE", !!j.sql && /^UPDATE moveadvisor_marketplace_vo_offers/.test(j.sql));
    comprueba("saca el equipamiento", (j.equipamiento || 0) > 20, "(" + j.equipamiento + " líneas)");
    comprueba("saca la matrícula", /^\d{4}[A-Z]{3}$/.test(j.matricula || ""), j.matricula || "-");
    comprueba("saca la cilindrada con el separador de miles bien",
      j.cilindrada > 500 && j.cilindrada < 8000, (j.cilindrada || "-") + " cc");
    if (caso.plazas) {
      comprueba("las plazas son las del coche, no las del reposacabezas",
        j.plazas === caso.plazas, "(" + j.plazas + ", esperaba " + caso.plazas + ")");
    } else {
      comprueba("saca las plazas", j.plazas >= 2 && j.plazas <= 9, "(" + j.plazas + ")");
    }
    comprueba("guarda la descripción del concesionario",
      /description = '/.test(j.sql));

    // Lo que Modrive NO publica no se inventa.
    comprueba("no se inventa el color", !/\bcolor = /.test(j.sql));
    comprueba("no se inventa la provincia",
      !/provincia = /.test(j.sql) && !/\blocation = /.test(j.sql));
    comprueba("no se inventa la garantía", !/warranty_months = /.test(j.sql));

    await dormir(1500);
  }

  // ── lo que ordena el escaparate ───────────────────────────────────────────
  console.log("\nEL ORDEN DEL ESCAPARATE");
  comprueba("updated_at solo se mueve si algún campo cambia de verdad",
    /updated_at = CASE WHEN /.test(ultimoSql) && !/updated_at = NOW\(\)/.test(ultimoSql));
  comprueba("y lo decide mirando los campos que escribe",
    /NULLIF\(body_type, ''\) IS NULL/.test(ultimoSql)
    && /equipment IS DISTINCT FROM /.test(ultimoSql));
  comprueba("sella last_seen_at, que es lo que fecha la baja",
    /last_seen_at = NOW\(\)/.test(ultimoSql));

  // ── una ficha que no se sabe leer ─────────────────────────────────────────
  console.log("\nUNA FICHA QUE NO SE SABE LEER");
  const mala = corre(codigo("Code: Extraer de la ficha"),
    { statusCode: 500, body: "" }, { id: "modrive_999999" });
  mala.log.forEach((l) => console.log("      " + l));
  comprueba("no la sella como viva", !/last_seen_at/.test(mala.json.sql || ""));
  comprueba("pero gasta su intento, para no atascar la cola",
    /enrich_tried_at = NOW\(\)/.test(mala.json.sql || ""));

  const sinJsonLd = corre(codigo("Code: Extraer de la ficha"),
    { statusCode: 200, body: "<html><body>una pagina cualquiera</body></html>" },
    { id: "modrive_999998" });
  sinJsonLd.log.forEach((l) => console.log("      " + l));
  comprueba("una página sin JSON-LD tampoco se sella",
    !/last_seen_at/.test(sinJsonLd.json.sql || ""));

  // ── contra la base ────────────────────────────────────────────────────────
  console.log("\nCONTRA LA BASE (con ROLLBACK)");
  await c.query("BEGIN");
  try {
    const res = await c.query(ultimoSql);
    comprueba("el SQL se ejecuta y casa con una oferta nuestra", res.rowCount === 1,
      "(" + res.rowCount + " filas)");

    // Y ahora la prueba de verdad: repetirlo NO debe mover updated_at.
    const antes = await c.query(
      "SELECT updated_at FROM moveadvisor_marketplace_vo_offers WHERE id = $1",
      [casos[casos.length - 1].fila.id]);
    await c.query("SELECT pg_sleep(0.05)");
    await c.query(ultimoSql);
    const despues = await c.query(
      "SELECT updated_at FROM moveadvisor_marketplace_vo_offers WHERE id = $1",
      [casos[casos.length - 1].fila.id]);
    comprueba("repetir la misma pasada NO mueve updated_at",
      String(antes.rows[0].updated_at) === String(despues.rows[0].updated_at),
      String(antes.rows[0].updated_at).slice(0, 19));
  } finally { await c.query("ROLLBACK"); await c.end(); }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
