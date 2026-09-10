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
 *     un ahorro que sube por tramos -20%, 25% y 30%- y un techo del 50%.
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
  comprueba("el techo del ahorro sigue en el 50%", /<= 0\.5/.test(SQL));

  // ── los tramos ────────────────────────────────────────────────────────────
  //
  // Cuanto más caro el coche, más ahorro se le exige: un 20% sobre 15.000 € son
  // 3.000, que compensan el viaje; un 20% sobre 90.000 son 18.000, y ahí el
  // cliente espera más para meterse en una importación.
  console.log("\nLOS TRAMOS");
  comprueba("4.000-25.000 exige 20%",
    /de_price >= 4000\s+AND comp\.de_price < 25000[\s\S]{0,140}>= 0\.20/.test(SQL));
  comprueba("25.000-45.000 exige 25%",
    /de_price >= 25000 AND comp\.de_price < 45000[\s\S]{0,140}>= 0\.25/.test(SQL));
  comprueba("45.000-100.000 exige 30%",
    /de_price >= 45000 AND comp\.de_price < 100000[\s\S]{0,140}>= 0\.30/.test(SQL));

  // ── el suelo de ahorro en euros ───────────────────────────────────────────
  //
  // Al cliente le da igual el porcentaje: le importa cuánto se ahorra. Un 28%
  // sobre un coche de 12.000 € son 3.400 €, y por eso nadie se mete en una
  // importación.
  //
  // Y este suelo conserva la gama alta, que es lo que subir los porcentajes se
  // cargaba. Medido el 2026-09-10:
  //
  //   20/25/30            1.001 ofertas   5.625 €   12 por encima de 25.000
  //   30/35/40              296           7.903      1 por encima de 25.000
  //   20/25/30 + 6.000      336           8.853     12 por encima de 25.000
  comprueba("y al menos 6.000 € de ahorro en euros", /comp\.margin >= 6000/.test(SQL));

  // ── lo que nunca se publica ───────────────────────────────────────────────
  //
  // De 1.954 fichas alemanas miradas el 2026-09-10, 339 estaban dañadas -el
  // 17%- y 130 de ellas decían «No apto para circular». Una llegó a estar
  // publicada en la web con el frontal destrozado y un 38% de ahorro.
  console.log("\nLO QUE NUNCA SE PUBLICA");
  comprueba("nada dañado", /m\.is_damaged = FALSE/.test(SQL));
  // NULL es «no lo hemos mirado», y publicar sin mirar es lo que puso ese coche
  // delante de un cliente.
  comprueba("ni nada sin comprobar", /m\.is_damaged IS NOT NULL/.test(SQL));
  // Un precio alemán sin IVA comparado contra precios españoles con IVA se
  // inventa un 19% de ahorro que no existe. Son las furgonetas comerciales.
  comprueba("ni ningún precio neto sin IVA",
    /COALESCE\(m\.price_is_net, FALSE\) = FALSE/.test(SQL));

  // ── la horquilla de precio del negocio ────────────────────────────────────
  //
  // Por debajo de 4.000 € no sale a cuenta: solo el fee y el impuesto base son
  // 3.630 €, casi el precio del coche, antes de contar el transporte. Por
  // encima de 100.000 € es otro negocio — en el ensayo salían Ferrari
  // Purosangue de 432.850 €, con números buenos y 37 comparables, pero no es el
  // coche que importamos.
  console.log("\nLA HORQUILLA DE PRECIO");
  comprueba("solo puntúa coches de 4.000 a 100.000 €",
    /AND price BETWEEN 4000 AND 100000/.test(SQL));
  comprueba("y limpia lo que se queda fuera",
    /price < 4000 OR price > 100000/.test(SQL)
    && /import_published = CASE WHEN import_locked THEN import_published ELSE FALSE END/.test(SQL));
  // Si no se limpiara, un coche publicado ayer que hoy queda fuera de la
  // horquilla no entraría en el cálculo y conservaría su import_published de
  // ayer: seguiría ofreciéndose para siempre sin que nada volviera a mirarlo.
  comprueba("  (si no, lo publicado ayer se quedaría publicado para siempre)", true);
  // Los comparables españoles NO se capan: hacerlo dejaría a un coche alemán de
  // 140.000 € sin sus comparables caros y le bajaría la mediana artificialmente.
  comprueba("pero NO capa los comparables españoles",
    !/es\.price BETWEEN 4000/.test(SQL) && !/es\.price > 150000/.test(SQL));

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
        count(*) FILTER (WHERE price < 4000)::int baratas,
        count(*) FILTER (WHERE import_margin_pct > 0.5)::int fuera,
        count(*) FILTER (WHERE is_damaged)::int danadas,
        count(*) FILTER (WHERE is_damaged IS NULL)::int sin_mirar,
        count(*) FILTER (WHERE price_is_net)::int netas,
        count(*) FILTER (WHERE price >= 4000 AND price < 25000 AND import_margin_pct < 0.20)::int t1,
        count(*) FILTER (WHERE price >= 25000 AND price < 45000 AND import_margin_pct < 0.25)::int t2,
        count(*) FILTER (WHERE price >= 45000 AND price < 100000 AND import_margin_pct < 0.30)::int t3,
        min(import_margin)::int peor
      FROM moveadvisor_market_offers WHERE country='DE' AND import_published`)).rows[0];
    comprueba("ninguna publicada con menos de 15 comparables", pub.pocos === 0);
    comprueba("ninguna publicada por debajo de 4.000 €", pub.baratas === 0);
    comprueba("ninguna publicada dañada", pub.danadas === 0, "(" + pub.danadas + ")");
    comprueba("ninguna publicada sin comprobar si está dañada", pub.sin_mirar === 0,
      "(" + pub.sin_mirar + ")");
    comprueba("ninguna publicada con precio neto sin IVA", pub.netas === 0);
    comprueba("ninguna publicada por debajo del ahorro de su tramo",
      pub.t1 === 0 && pub.t2 === 0 && pub.t3 === 0,
      pub.t1 + " / " + pub.t2 + " / " + pub.t3);
    comprueba("ninguna publicada con menos de 6.000 € de ahorro",
      pub.peor >= 6000, "el peor ahorro publicado: "
      + Number(pub.peor || 0).toLocaleString("es") + " €");
    // Y que el recorte no se haya llevado por delante la gama alta, que es lo
    // que pasaba subiendo los porcentajes.
    const gama = (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
      WHERE country='DE' AND import_published AND price >= 25000`)).rows[0].n;
    comprueba("sigue habiendo coches por encima de 25.000 €", gama > 0, "(" + gama + ")");
    comprueba("ninguna publicada fuera de la horquilla de ahorro", pub.fuera === 0);
    comprueba("el peor ahorro publicado sigue siendo un ahorro", pub.peor > 0, pub.peor + " €");
    console.log("      ahorro medio de las publicadas: " + r.ahorro_medio
      + " €   con " + r.comps_medio + " comparables de media");

    comprueba("se publica un número razonable de ofertas",
      r.publicadas > 100 && r.publicadas < 5000, r.publicadas + " de 190.374 activas");

    // Y que la horquilla se cumple de verdad en los datos, no solo en el texto
    // del SQL.
    const fuera = (await c.query(`SELECT
        count(*) FILTER (WHERE import_published AND price < 4000)::int baratas,
        count(*) FILTER (WHERE import_published AND price > 100000)::int caras,
        count(*) FILTER (WHERE market_price_es IS NOT NULL
                           AND (price < 4000 OR price > 100000))::int valoradas_fuera
      FROM moveadvisor_market_offers WHERE country='DE'`)).rows[0];
    comprueba("ninguna publicada por debajo de 4.000 €", fuera.baratas === 0);
    comprueba("ninguna publicada por encima de 100.000 €", fuera.caras === 0);
    comprueba("ninguna valorada fuera de la horquilla", fuera.valoradas_fuera === 0,
      "(" + fuera.valoradas_fuera + ")");
  } finally {
    await c.query("ROLLBACK");
    console.log("      (deshecho: no se ha escrito nada)");
    await c.end();
  }

  console.log(fallos === 0 ? "\nTodo correcto." : "\n" + fallos + " comprobaciones han fallado.");
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
