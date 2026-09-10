/**
 * Comprueba el scoring de importación.
 *
 *   npm run test:importacion-scoring
 *
 * Ejecuta el SQL de verdad contra la base dentro de BEGIN/ROLLBACK y mira lo que
 * habría escrito. Tarda unos 9 minutos: es el tiempo que tarda el workflow.
 *
 * Este workflow decide qué coches alemanes se le ofrecen a un cliente para
 * importar. Si se equivoca, alguien se plantea traer un coche que no compensa.
 *
 * Lo que vigila, y por qué:
 *
 *   - Que la mediana española no se envenene. Un BMW 320 de 1985 publicado en
 *     España a 9.999.999 € hacía que su «precio español» saliera 5.003.450 €,
 *     porque solo tenía dos comparables de su año y la mediana de dos números es
 *     su media. Hay 761 ofertas españolas por encima de 300.000 €.
 *   - Que no se guarde una valoración que no se sostiene. Con menos de 15
 *     comparables la mediana la decide cualquier anuncio suelto; antes se
 *     guardaba igual y en el ERP se veía un Audi A3 del 98 «valorado» en
 *     999.999 €. Un dato que no se sostiene es peor que no tener dato.
 *   - Que las protecciones de la publicación sigan en pie: 15 comparables,
 *     12.000 € de precio mínimo y un ahorro de entre el 15% y el 50%.
 *   - Que el ahorro que se le enseña al cliente sea creíble.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const wf = JSON.parse(fs.readFileSync(
  path.join(RAIZ, "n8n-workflows", "importacion-scoring.json"), "utf8"));
const nodo = wf.nodes.find((n) => (n.parameters || {}).query);
const SQL = nodo.parameters.query;

let fallos = 0;
const comprueba = (nombre, cond, detalle) => {
  if (!cond) fallos++;
  console.log("  " + (cond ? "  ok  " : " FALLA") + "  " + nombre + (detalle ? "   " + detalle : ""));
};

(async () => {
  // ══ configuración ════════════════════════════════════════════════════════
  console.log("CONFIGURACIÓN");
  const cron = wf.nodes.find((n) => n.type.endsWith("scheduleTrigger"));
  const expr = ((((cron.parameters || {}).rule || {}).interval || [])[0] || {}).expression;
  const p = String(expr).split(" ");
  comprueba("corre entre las 8:00 y las 00:00",
    String(p[2]).split(",").map(Number).every((h) => h >= 8 && h <= 23), expr);
  comprueba("y no en punto, para no pisar a los demás", Number(p[1]) !== 0, "minuto " + p[1]);
  comprueba("avisa por correo si falla", wf.settings.errorWorkflow === "9BwKOPMIzjj3owho");
  comprueba("el nodo de Postgres reintenta si se corta la conexión", nodo.retryOnFail === true);

  console.log("\nEL SQL");
  comprueba("descarta los comparables disparatados", /es\.price <= de\.de_price \* 5/.test(SQL));
  comprueba("y solo guarda la valoración con 15 comparables o más",
    /market_price_es\s*=\s*CASE WHEN comp\.comps >= 15/.test(SQL)
    && /import_margin\s*=\s*CASE WHEN comp\.comps >= 15/.test(SQL));
  comprueba("import_comps se guarda siempre, para saber por qué falta lo demás",
    /import_comps\s*=\s*comp\.comps,/.test(SQL));
  comprueba("la publicación exige 15 comparables", /comp\.comps>=15/.test(SQL));
  comprueba("y un precio mínimo de 12.000 €", /comp\.de_price >= 12000/.test(SQL));
  comprueba("y un ahorro de entre el 15% y el 50%",
    />= 0\.15/.test(SQL) && /<= 0\.5/.test(SQL));

  // ══ la pasada de verdad ══════════════════════════════════════════════════
  console.log("\nLA PASADA (contra la base, con ROLLBACK)");
  const c = new Client({ connectionString: DB_URL, statement_timeout: 1200000 });
  await c.connect();
  await c.query("BEGIN");
  try {
    const t0 = Date.now();
    await c.query(SQL);
    const seg = Math.round((Date.now() - t0) / 1000);
    console.log("      tardó " + seg + " s");
    comprueba("cabe de sobra antes de que arranque nada más", seg < 1800, seg + " s");

    const r = (await c.query(`SELECT
        count(*) FILTER (WHERE import_published)::int publicadas,
        count(*) FILTER (WHERE market_price_es IS NOT NULL)::int con_valoracion,
        count(*) FILTER (WHERE import_comps IS NOT NULL)::int con_comps,
        round(avg(import_margin) FILTER (WHERE import_published))::int ahorro_medio,
        round(avg(import_comps) FILTER (WHERE import_published))::int comps_medio
      FROM moveadvisor_market_offers WHERE country='DE'`)).rows[0];
    console.log("      publicadas: " + r.publicadas + "   con valoración: "
      + r.con_valoracion.toLocaleString("es") + "   con recuento de comparables: "
      + r.con_comps.toLocaleString("es"));

    // ── lo que ya no puede pasar ─────────────────────────────────────────
    const mal = (await c.query(`SELECT
        count(*) FILTER (WHERE market_price_es IS NOT NULL AND import_comps < 15)::int valoradas_sin_base,
        count(*) FILTER (WHERE import_margin IS NOT NULL AND import_comps < 15)::int margen_sin_base,
        count(*) FILTER (WHERE market_price_es > price * 5)::int valoracion_absurda
      FROM moveadvisor_market_offers WHERE country='DE'`)).rows[0];
    comprueba("ninguna valoración apoyada en menos de 15 comparables",
      mal.valoradas_sin_base === 0, "(" + mal.valoradas_sin_base + ")");
    comprueba("ningún margen apoyado en menos de 15 comparables",
      mal.margen_sin_base === 0, "(" + mal.margen_sin_base + ")");
    comprueba("ninguna valoración española de más de 5 veces el precio alemán",
      mal.valoracion_absurda === 0, "(" + mal.valoracion_absurda + ")");

    // El caso que lo destapó todo.
    const bmw = (await c.query(`SELECT market_price_es::int v, import_comps c
      FROM moveadvisor_market_offers
      WHERE country='DE' AND brand='BMW' AND model='320' AND year=1985 LIMIT 1`)).rows[0];
    if (bmw) {
      console.log("      el BMW 320 de 1985: valoración " + (bmw.v === null ? "NULL" : bmw.v)
        + ", " + bmw.c + " comparables");
      comprueba("el BMW de 1985 ya no sale valorado en 5 millones", bmw.v === null || bmw.v < 100000);
    }

    // ── lo que se publica sigue teniendo sentido ─────────────────────────
    const pub = (await c.query(`SELECT
        count(*) FILTER (WHERE import_comps < 15)::int pocos,
        count(*) FILTER (WHERE price < 12000)::int baratas,
        count(*) FILTER (WHERE import_margin_pct < 0.15 OR import_margin_pct > 0.5)::int fuera,
        min(import_margin)::int peor
      FROM moveadvisor_market_offers WHERE country='DE' AND import_published`)).rows[0];
    comprueba("ninguna publicada con menos de 15 comparables", pub.pocos === 0);
    comprueba("ninguna publicada por debajo de 12.000 €", pub.baratas === 0);
    comprueba("ninguna publicada fuera de la horquilla de ahorro", pub.fuera === 0);
    comprueba("el peor ahorro publicado sigue siendo un ahorro", pub.peor > 0, pub.peor + " €");
    console.log("      ahorro medio de las publicadas: " + r.ahorro_medio
      + " €   con " + r.comps_medio + " comparables de media");

    comprueba("se publica un número razonable de ofertas",
      r.publicadas > 100 && r.publicadas < 5000, r.publicadas + " de 190.374 activas");
  } finally {
    await c.query("ROLLBACK");
    console.log("      (deshecho: no se ha escrito nada)");
    await c.end();
  }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
