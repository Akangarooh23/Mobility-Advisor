/**
 * Retira del escaparate de importación lo que la propia base ya sabe que no
 * debería estar: los dañados y los que no sabemos si lo están.
 *
 * Es exactamente la regla del scoring, aplicada a mano porque el scoring no
 * vuelve a correr hasta mañana a las 13:10 y la copia que corrió el 12/09 era
 * dos horas más vieja que la regla.
 *
 * Respeta import_locked, igual que el scoring: si una persona ha fijado a mano
 * que una oferta va, no se la quitamos por la espalda.
 */
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const env = fs.readFileSync("C:/Users/Anapi/Projects/Mobility-Advisor/.env.local", "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();

  const antes = (await c.query(`SELECT count(*)::int n FROM moveadvisor_market_offers
    WHERE country='DE' AND import_published`)).rows[0].n;

  const r = await c.query(`UPDATE moveadvisor_market_offers
       SET import_published = FALSE
     WHERE country = 'DE'
       AND import_published
       AND NOT COALESCE(import_locked, FALSE)
       AND (is_damaged IS NULL OR is_damaged = TRUE)
     RETURNING brand, model, year, price, is_damaged, damage_note`);

  console.log("  RETIRADAS " + r.rowCount + " DE " + antes + " PUBLICADAS\n");
  for (const x of r.rows.slice(0, 40)) {
    console.log("      " + String(x.price).padStart(8) + " €  " + String(x.year || "-") + "  "
      + String((x.brand || "") + " " + (x.model || "")).slice(0, 32).padEnd(34)
      + (x.is_damaged === null ? "sin comprobar" : "«" + (x.damage_note || "dañado") + "»"));
  }

  const desp = (await c.query(`SELECT
      count(*) FILTER (WHERE import_published)::int publicadas,
      count(*) FILTER (WHERE import_published AND is_damaged)::int danadas,
      count(*) FILTER (WHERE import_published AND is_damaged IS NULL)::int sin_dato,
      round(avg(market_price_es - price) FILTER (WHERE import_published))::int ahorro
    FROM moveadvisor_market_offers WHERE country='DE'`)).rows[0];
  console.log("\n  COMO QUEDA EL ESCAPARATE");
  console.log("      publicadas    : " + desp.publicadas);
  console.log("      dañadas       : " + desp.danadas);
  console.log("      sin comprobar : " + desp.sin_dato);
  console.log("      ahorro medio  : " + Number(desp.ahorro).toLocaleString("es") + " €");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
