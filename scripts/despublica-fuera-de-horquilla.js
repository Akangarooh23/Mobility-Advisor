/**
 * Despublica las ofertas de importación que quedan fuera de la horquilla de
 * precio del negocio.
 *
 *   node scripts/despublica-fuera-de-horquilla.js            (solo mira)
 *   ESCRIBIR=1 node scripts/despublica-fuera-de-horquilla.js (aplica)
 *
 * Y con otros límites, si hiciera falta:
 *
 *   MINIMO=6000 MAXIMO=120000 ESCRIBIR=1 node scripts/despublica-fuera-de-horquilla.js
 *
 * ── Para qué sirve, si el workflow ya lo hace ──────────────────────────────
 *
 * El scoring aplica la horquilla en cada pasada, pero tarda 11 minutos y corre
 * una vez al día. Esto la aplica al momento, y sirve para tres cosas:
 *
 *   - Cambiar los límites y ver el efecto antes de tocar el workflow.
 *   - Retirar algo del escaparate ya, sin esperar a mañana.
 *   - Comprobar que lo que hay publicado cuadra con la regla.
 *
 * ── Por qué esta horquilla ─────────────────────────────────────────────────
 *
 * Por debajo de 4.000 € no sale a cuenta: solo el fee y el impuesto base son
 * 3.630 €, casi el precio del coche, antes de contar el transporte.
 *
 * Por encima de 100.000 € es otro negocio. El tope estuvo un rato en 150.000 y
 * el 2026-09-10 se bajó a 100.000, en dos tandas:
 *
 *   con 150.000   se retiraron 3: dos Ferrari Purosangue de 432.850 y 439.900 €
 *                 y un Porsche 992 de 155.900
 *   con 100.000   se retiraron 38 más: Porsche 911 y 992, BMW M5 y un Panamera,
 *                 de 100.000 a 145.900 €
 *
 * Las 38 tenían ahorros de 30.000 a 60.000 € y entre 16 y 44 comparables, o sea
 * números buenos. No se retiran porque el cálculo falle, sino porque no es el
 * coche que importamos.
 *
 * ── Qué respeta ────────────────────────────────────────────────────────────
 *
 * `import_locked`. Si alguien ha fijado una oferta a mano, esa decisión manda
 * sobre la regla y no se toca.
 *
 * ── Qué borra además de despublicar ────────────────────────────────────────
 *
 * La valoración: market_price_es, import_margin, import_margin_pct, import_score
 * e import_cost. Si una oferta no se ofrece, dejar ahí su margen es dejar un
 * número que parece vigente y que nadie va a volver a mirar.
 *
 * import_comps NO se borra: es la prueba de cuántos comparables tenía, y sirve
 * para entender por qué las demás columnas están vacías.
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const MINIMO = Number(process.env.MINIMO || 4000);
const MAXIMO = Number(process.env.MAXIMO || 100000);
// El ahorro mínimo que tiene que quedarle al cliente, en tanto por ciento del
// precio español. Se guarda como fracción: 0,30 son 30 puntos.
const MARGEN = Number(process.env.MARGEN || 30) / 100;
const ESCRIBIR = process.env.ESCRIBIR === "1";

// La importación es de Alemania. Si algún día se importa de otro sitio, esto
// tendrá que dejar de estar clavado.
//
// Una oferta sin margen calculado tambien se retira: si no sabemos cuánto ahorra
// el cliente, no podemos estar ofreciéndosela.
const DONDE = `country = 'DE' AND import_published
  AND (price IS NULL OR price < ${MINIMO} OR price > ${MAXIMO}
       OR import_margin_pct IS NULL OR import_margin_pct < ${MARGEN})`;

const eur = (n) => (n === null || n === undefined ? "-" : Number(n).toLocaleString("es") + " €");

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();

  const publicadas = (await c.query(
    "SELECT count(*)::int n FROM moveadvisor_market_offers WHERE country='DE' AND import_published")).rows[0].n;
  console.log("  horquilla: de " + eur(MINIMO) + " a " + eur(MAXIMO)
    + ", con al menos " + Math.round(MARGEN * 100) + "% de margen"
    + (ESCRIBIR ? "   ESCRIBIENDO" : "   (solo mirando)"));
  console.log("  publicadas ahora mismo: " + publicadas.toLocaleString("es") + "\n");

  const t = (await c.query(`SELECT count(*)::int n,
      count(*) FILTER (WHERE import_locked)::int fijadas,
      count(*) FILTER (WHERE price < ${MINIMO})::int baratas,
      count(*) FILTER (WHERE price > ${MAXIMO})::int caras,
      count(*) FILTER (WHERE price IS NULL)::int sin_precio,
      count(*) FILTER (WHERE import_margin_pct IS NOT NULL
                         AND import_margin_pct < ${MARGEN}
                         AND price BETWEEN ${MINIMO} AND ${MAXIMO})::int poco_margen,
      count(*) FILTER (WHERE import_margin_pct IS NULL)::int sin_margen
    FROM moveadvisor_market_offers WHERE ${DONDE}`)).rows[0];

  console.log("  FUERA DE LA HORQUILLA: " + t.n);
  console.log("      por debajo de " + eur(MINIMO) + " : " + t.baratas);
  console.log("      por encima de " + eur(MAXIMO) + " : " + t.caras);
  console.log("      sin precio                : " + t.sin_precio);
  console.log("      con menos del " + Math.round(MARGEN * 100) + "% de margen : " + t.poco_margen);
  console.log("      sin margen calculado      : " + t.sin_margen);
  console.log("      fijadas a mano            : " + t.fijadas + "   <- no se tocan");

  if (t.n) {
    console.log("\n  CUÁLES SON");
    const l = await c.query(`SELECT brand, model, year, price::int, import_margin::int m,
        import_comps k, import_locked, round(import_margin_pct*100)::int pct
      FROM moveadvisor_market_offers WHERE ${DONDE} ORDER BY price DESC LIMIT 30`);
    for (const x of l.rows) {
      console.log("      " + String((x.brand || "") + " " + (x.model || "")).slice(0, 26).padEnd(28)
        + String(x.year || "-").padStart(5) + "   " + String(eur(x.price)).padStart(12)
        + "   ahorro " + String(x.m === null ? "-" : eur(x.m)).padStart(11)
        + " (" + String(x.pct === null ? "-" : x.pct + "%").padStart(4) + ")"
        + "   " + String(x.k === null ? "-" : x.k).padStart(4) + " comps"
        + (x.import_locked ? "   FIJADA A MANO" : ""));
    }
    if (t.n > 30) console.log("      ... y " + (t.n - 30) + " más");
  }

  const aTocar = t.n - t.fijadas;
  if (!aTocar) { console.log("\n  Nada que despublicar."); await c.end(); return; }
  if (!ESCRIBIR) {
    console.log("\n  Se despublicarían " + aTocar + ". Nada escrito.");
    console.log("  Para aplicarlo:  ESCRIBIR=1 node scripts/despublica-fuera-de-horquilla.js");
    await c.end();
    return;
  }

  await c.query("BEGIN");
  try {
    const r = await c.query(`UPDATE moveadvisor_market_offers SET
        import_published  = FALSE,
        market_price_es   = NULL,
        import_margin     = NULL,
        import_margin_pct = NULL,
        import_score      = NULL,
        import_cost       = NULL,
        import_scored_at  = NOW()
      WHERE ${DONDE} AND NOT COALESCE(import_locked, FALSE)`);
    await c.query("COMMIT");
    console.log("\n      despublicadas: " + r.rowCount);
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("  ERROR, nada escrito: " + e.message);
    await c.end();
    process.exit(1);
  }

  const fin = (await c.query(`SELECT count(*)::int n, min(price)::int mn, max(price)::int mx,
      round(avg(price))::int medio
    FROM moveadvisor_market_offers WHERE country='DE' AND import_published`)).rows[0];
  console.log("\n  QUEDAN PUBLICADAS: " + fin.n.toLocaleString("es"));
  console.log("      de " + eur(fin.mn) + " a " + eur(fin.mx) + "   (medio " + eur(fin.medio) + ")");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
