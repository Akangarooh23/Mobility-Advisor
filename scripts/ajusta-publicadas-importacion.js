/**
 * Aplica la regla de publicación del escaparate de importación, por tramos.
 *
 *   node scripts/ajusta-publicadas-importacion.js            (solo mira)
 *   ESCRIBIR=1 node scripts/ajusta-publicadas-importacion.js (aplica)
 *
 * ── La regla ───────────────────────────────────────────────────────────────
 *
 * Cuanto más caro el coche, más ahorro hay que exigirle. Un 20% sobre 15.000 €
 * son 3.000 €, que compensan el viaje; un 20% sobre 90.000 € son 18.000 €, y
 * ahí el cliente espera más para meterse en una importación.
 *
 *      4.000 -  25.000 €   ->  al menos 20% de ahorro
 *     25.000 -  45.000 €   ->  al menos 25%
 *     45.000 - 100.000 €   ->  al menos 30%
 *
 * Fuera de 4.000-100.000 no se publica nada.
 *
 * ── Lo que no cambia ───────────────────────────────────────────────────────
 *
 * El mínimo de 15 comparables y el techo del 50% de ahorro. Esos dos no son
 * criterios de negocio sino protecciones: con menos de 15 comparables la
 * mediana española la decide cualquier anuncio suelto, y un ahorro por encima
 * del 50% casi siempre significa que esa mediana está mal, no que el coche sea
 * un chollo. Es lo que impidió que un BMW 320 de 1985 se publicara con «5
 * millones de precio español».
 *
 * Y `import_locked`: si alguien fija una oferta a mano, esa decisión manda.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");
const ESCRIBIR = process.env.ESCRIBIR === "1";

// [desde, hasta, ahorro mínimo en tanto por uno]
const TRAMOS = [
  [4000, 25000, 0.20],
  [25000, 45000, 0.25],
  [45000, 100000, 0.30],
];
// Un suelo de ahorro EN EUROS, no solo en tanto por ciento. Al cliente le da
// igual el porcentaje: le importa cuanto se ahorra. Un 28% sobre un coche de
// 12.000 son 3.400 EUR, y por eso nadie se mete en una importacion.
const AHORRO_MINIMO = Number(process.env.AHORRO || 6000);
const COMPS_MINIMO = 15;
const AHORRO_MAXIMO = 0.5;

/**
 * La condición SQL de «esta oferta merece publicarse».
 *
 * Tiene que decir lo MISMO que la regla del workflow
 * (n8n-workflows/importacion-scoring.json). Si las dos se separan, este script
 * y la pasada de las 8:05 se pisan y gana la última que corra.
 */
const MERECE = "(" + TRAMOS.map(([a, b, m]) =>
  `(price >= ${a} AND price < ${b} AND import_margin_pct >= ${m})`).join("\n     OR ") + ")"
  + `\n    AND import_margin >= ${AHORRO_MINIMO}`
  + `\n    AND import_comps >= ${COMPS_MINIMO}`
  + `\n    AND import_margin_pct <= ${AHORRO_MAXIMO}`
  + "\n    AND COALESCE(is_active, TRUE)"
  + "\n    AND import_margin_pct IS NOT NULL"
  // Ni dañado, ni sin comprobar, ni con precio neto sin IVA. NULL en is_damaged
  // significa «no lo hemos mirado», y publicar sin mirar es lo que puso un Range
  // Rover con el frontal destrozado delante de un cliente el 2026-09-10.
  + "\n    AND is_damaged IS NOT NULL"
  + "\n    AND is_damaged = FALSE"
  + "\n    AND COALESCE(price_is_net, FALSE) = FALSE";

const DE = "country = 'DE'";
const eur = (n) => (n === null || n === undefined ? "-" : Number(n).toLocaleString("es") + " €");

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();

  console.log("  LA REGLA");
  for (const [a, b, m] of TRAMOS) {
    console.log("      " + String(eur(a)).padStart(10) + " - " + String(eur(b)).padEnd(11)
      + "  al menos " + Math.round(m * 100) + "% de ahorro");
  }
  console.log("      (siempre con " + COMPS_MINIMO + " comparables o más, y hasta un "
    + Math.round(AHORRO_MAXIMO * 100) + "% de ahorro)\n");

  const hoy = (await c.query(
    `SELECT count(*)::int n FROM moveadvisor_market_offers WHERE ${DE} AND import_published`)).rows[0].n;

  const cambio = (await c.query(`SELECT
      count(*) FILTER (WHERE import_published AND NOT (${MERECE}))::int se_van,
      count(*) FILTER (WHERE NOT import_published AND (${MERECE}))::int entran,
      count(*) FILTER (WHERE ${MERECE})::int quedarian,
      count(*) FILTER (WHERE import_published AND NOT (${MERECE}) AND import_locked)::int fijadas_se_van,
      count(*) FILTER (WHERE NOT import_published AND (${MERECE}) AND import_locked)::int fijadas_entran
    FROM moveadvisor_market_offers WHERE ${DE}`)).rows[0];

  console.log("  publicadas ahora : " + hoy.toLocaleString("es"));
  console.log("      se retirarían: " + cambio.se_van.toLocaleString("es")
    + (cambio.fijadas_se_van ? "   (" + cambio.fijadas_se_van + " fijadas a mano, no se tocan)" : ""));
  console.log("      entrarían     : " + cambio.entran.toLocaleString("es")
    + (cambio.fijadas_entran ? "   (" + cambio.fijadas_entran + " fijadas a mano, no se tocan)" : ""));
  console.log("      quedarían     : " + cambio.quedarian.toLocaleString("es"));

  console.log("\n  POR TRAMO");
  for (const [a, b, m] of TRAMOS) {
    const t = (await c.query(`SELECT
        count(*) FILTER (WHERE import_published)::int ahora,
        count(*) FILTER (WHERE ${MERECE})::int despues
      FROM moveadvisor_market_offers
      WHERE ${DE} AND price >= ${a} AND price < ${b}`)).rows[0];
    console.log("      " + String(eur(a)).padStart(10) + " - " + String(eur(b)).padEnd(11)
      + "  (" + Math.round(m * 100) + "%)   ahora " + String(t.ahora).padStart(4)
      + "  ->  " + String(t.despues).padStart(4));
  }

  // Lo que entra por debajo de 12.000 es nuevo: la regla anterior tenía ahí su
  // suelo, así que esas ofertas no se habían ofrecido nunca.
  const nuevas = (await c.query(`SELECT count(*)::int n, min(price)::int mn, max(price)::int mx
    FROM moveadvisor_market_offers
    WHERE ${DE} AND NOT import_published AND price < 12000 AND (${MERECE})`)).rows[0];
  if (nuevas.n) {
    console.log("\n  DE ESAS, POR DEBAJO DE 12.000 € SON NUEVAS: " + nuevas.n);
    console.log("      de " + eur(nuevas.mn) + " a " + eur(nuevas.mx));
    console.log("      (la regla anterior tenía el suelo en 12.000, así que nunca se han ofrecido)");
    const m = await c.query(`SELECT brand, model, year, price::int,
        import_margin::int ahorro, round(import_margin_pct*100)::int pct, import_comps k
      FROM moveadvisor_market_offers
      WHERE ${DE} AND NOT import_published AND price < 12000 AND (${MERECE})
      ORDER BY import_margin_pct DESC LIMIT 8`);
    for (const x of m.rows) {
      console.log("          " + String((x.brand || "") + " " + (x.model || "")).slice(0, 24).padEnd(26)
        + String(x.year || "-").padStart(5) + "   " + String(eur(x.price)).padStart(10)
        + "   ahorro " + String(eur(x.ahorro)).padStart(10) + " (" + x.pct + "%)   " + x.k + " comps");
    }
  }

  if (!ESCRIBIR) {
    console.log("\n  Nada escrito. Para aplicarlo:  ESCRIBIR=1 npm run ajusta-importacion");
    await c.end();
    return;
  }

  await c.query("BEGIN");
  try {
    const fuera = await c.query(`UPDATE moveadvisor_market_offers SET
        import_published = FALSE, market_price_es = NULL, import_margin = NULL,
        import_margin_pct = NULL, import_score = NULL, import_cost = NULL,
        import_scored_at = NOW()
      WHERE ${DE} AND import_published AND NOT (${MERECE})
        AND NOT COALESCE(import_locked, FALSE)`);
    const dentro = await c.query(`UPDATE moveadvisor_market_offers SET
        import_published = TRUE, import_scored_at = NOW()
      WHERE ${DE} AND NOT import_published AND (${MERECE})
        AND NOT COALESCE(import_locked, FALSE)`);
    await c.query("COMMIT");
    console.log("\n      retiradas: " + fuera.rowCount + "   publicadas: " + dentro.rowCount);
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("  ERROR, nada escrito: " + e.message);
    await c.end();
    process.exit(1);
  }

  const fin = (await c.query(`SELECT count(*)::int n, min(price)::int mn, max(price)::int mx,
      round(avg(price))::int medio, round(avg(import_margin_pct)*100)::int pct
    FROM moveadvisor_market_offers WHERE ${DE} AND import_published`)).rows[0];
  console.log("\n  QUEDAN PUBLICADAS: " + fin.n.toLocaleString("es"));
  console.log("      de " + eur(fin.mn) + " a " + eur(fin.mx) + "   (medio " + eur(fin.medio)
    + ", ahorro medio " + fin.pct + "%)");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
