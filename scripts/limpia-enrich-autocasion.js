/**
 * Borra lo que el enriquecedor viejo de Autocasión escribió de otro coche.
 *
 *   npm run limpia-autocasion            (solo mira, no escribe)
 *   npm run limpia-autocasion -- --aplica
 *
 * POR QUE
 *
 * La versión anterior no comprobaba si la URL guardada era una ficha. 35.518
 * ofertas de julio y agosto tienen como URL un listado de provincia, y al
 * pedirla el lector cogía el PRIMER coche de esa lista y le escribía sus datos
 * a la oferta. Probado el 15-sep-2026 contra
 * /coches-segunda-mano/peugeot-2008-ocasion/madrid:
 *
 *     color = 'Naranja', doors = 6, power_cv = 100, body_type = 'SUV'
 *
 * Seis puertas. El rastro en la base: de las 34 ofertas de Autocasión con
 * puertas guardadas, 32 tenían más de cinco.
 *
 * QUE SE BORRA, Y QUE NO
 *
 * No se puede saber campo a campo qué vino del listado y qué del scraper, así
 * que se es conservador y se borra SOLO lo que es imposible de por sí:
 *
 *   - puertas fuera de 2..5
 *   - plazas fuera de 2..9
 *
 * A las 542 ofertas de URL rota que ya pasaron por el enriquecedor se les
 * quita además enrich_tried_at, para que si algún día recuperan su URL buena
 * vuelvan a la cola. Su color y su carrocería se dejan: pueden venir del
 * scraper, y borrar datos buenos por si acaso es peor que dejar alguno dudoso.
 *
 * No se toca updated_at: esto no es que el anuncio haya cambiado.
 */
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 600000 });
  await c.connect();

  const antes = (await c.query(`SELECT
      count(*) FILTER (WHERE doors IS NOT NULL AND (doors > 5 OR doors < 2))::int puertas_malas,
      count(*) FILTER (WHERE seats IS NOT NULL AND (seats > 9 OR seats < 2))::int plazas_malas,
      count(*) FILTER (WHERE url !~ 'ref[0-9]{6,}$' AND enrich_tried_at IS NOT NULL)::int rotas_tocadas
    FROM moveadvisor_market_offers WHERE portal='autocasion'`)).rows[0];
  console.log("  LO QUE HAY");
  console.log("      puertas imposibles : " + antes.puertas_malas);
  console.log("      plazas imposibles  : " + antes.plazas_malas);
  console.log("      de URL rota y ya tocadas por el enriquecedor: "
    + Number(antes.rotas_tocadas).toLocaleString("es"));

  const muestra = await c.query(`SELECT brand, model, doors, seats, color, body_type
    FROM moveadvisor_market_offers
    WHERE portal='autocasion' AND doors IS NOT NULL AND (doors > 5 OR doors < 2)
    LIMIT 8`);
  if (muestra.rows.length) {
    console.log("\n  UNA MUESTRA");
    for (const x of muestra.rows) {
      console.log("      " + String((x.brand || "") + " " + (x.model || "")).slice(0, 28).padEnd(30)
        + x.doors + " puertas   " + (x.seats || "-") + " plazas   "
        + (x.color || "-") + "   " + (x.body_type || "-"));
    }
  }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run limpia-autocasion -- --aplica");
    await c.end();
    return;
  }

  const r1 = await c.query(`UPDATE moveadvisor_market_offers
       SET doors = NULL
     WHERE portal='autocasion' AND doors IS NOT NULL AND (doors > 5 OR doors < 2)`);
  const r2 = await c.query(`UPDATE moveadvisor_market_offers
       SET seats = NULL
     WHERE portal='autocasion' AND seats IS NOT NULL AND (seats > 9 OR seats < 2)`);
  const r3 = await c.query(`UPDATE moveadvisor_market_offers
       SET enrich_tried_at = NULL
     WHERE portal='autocasion' AND url !~ 'ref[0-9]{6,}$' AND enrich_tried_at IS NOT NULL`);
  console.log("\n  APLICADO");
  console.log("      puertas borradas : " + r1.rowCount);
  console.log("      plazas borradas  : " + r2.rowCount);
  console.log("      devueltas a la cola por URL rota: " + r3.rowCount);
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
