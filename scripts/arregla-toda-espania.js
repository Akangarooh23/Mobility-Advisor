/**
 * Quita «Toda España» de la provincia, la ciudad y la ubicación de Autohero.
 *
 *   npm run arregla-toda-espania            (solo mira, no escribe)
 *   npm run arregla-toda-espania -- --aplica
 *
 * POR QUÉ
 *
 * El scraper viejo de Autohero no leía la sede y escribía «Toda España» en
 * province, city y location. Medido el 23-sep-2026:
 *
 *     province = 'Toda España'   3.720 filas  (2.051 de ellas activas)
 *     city     = 'Toda España'   3.565
 *     location = 'Toda España'   3.720
 *
 * Y no está en ningún otro portal: es solo de aquí.
 *
 * «Toda España» no es una provincia. En esa columna el resto de la tabla tiene
 * Madrid, Barcelona, Sevilla... así que un filtro por provincia no encuentra
 * estos coches, y una lista de provincias los saca como si fueran una más.
 *
 * POR QUÉ NO LO ARREGLA SOLO EL SCRAPER
 *
 * Porque el scraper nuevo sí lee la sede -provincia del código postal, ciudad
 * de su campo city- y ya ha corregido los 2.400 coches que siguen a la venta.
 * Pero:
 *
 *   - A los vendidos no los va a volver a tocar nunca, y se quedan con el
 *     cartel puesto.
 *   - A los 52 que están «Im Transport» su API no les da ni código postal ni
 *     ciudad, así que el scraper no escribe nada y el UPSERT conserva lo
 *     viejo. Son los que quedaban con «Toda España» después de la pasada.
 *
 * LO QUE HACE, Y LO QUE NO
 *
 * Deja los tres campos vacíos. Vacío quiere decir «no lo sabemos», que es la
 * verdad; «Toda España» dice algo que no es cierto de ningún coche en
 * concreto.
 *
 * No toca updated_at, que ordena el escaparate: esto no es que el anuncio haya
 * cambiado, es que nosotros lo teníamos mal.
 *
 * No toca ningún otro portal ni ningún otro valor. Si mañana aparece otro
 * cartel parecido, se añade aquí y se vuelve a mirar antes de escribir.
 */
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");
const CARTEL = "Toda España";

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();

  const antes = (await c.query(`SELECT
      count(*) FILTER (WHERE province = $1)::int prov,
      count(*) FILTER (WHERE city = $1)::int ciudad,
      count(*) FILTER (WHERE location = $1)::int loc,
      count(*) FILTER (WHERE is_active AND province = $1)::int prov_activas,
      count(*)::int total
    FROM moveadvisor_market_offers WHERE portal = 'autohero'`, [CARTEL])).rows[0];

  console.log("\n  AUTOHERO: " + antes.total.toLocaleString("es") + " filas");
  console.log("      province = «" + CARTEL + "» : " + antes.prov.toLocaleString("es")
    + "   (activas: " + antes.prov_activas.toLocaleString("es") + ")");
  console.log("      city     = «" + CARTEL + "» : " + antes.ciudad.toLocaleString("es"));
  console.log("      location = «" + CARTEL + "» : " + antes.loc.toLocaleString("es"));

  /*
   * Antes de tocar nada: ¿está el cartel en algún otro portal?
   *
   * Si apareciera, sería que otro scraper hace lo mismo y este script se
   * quedaría corto. Mejor verlo que suponerlo.
   */
  const otros = await c.query(`SELECT portal, count(*)::int n FROM moveadvisor_market_offers
    WHERE portal <> 'autohero' AND (province = $1 OR city = $1 OR location = $1)
    GROUP BY 1 ORDER BY 2 DESC`, [CARTEL]);
  console.log("\n  el mismo cartel en otros portales: "
    + (otros.rows.length ? otros.rows.map((x) => x.portal + ":" + x.n).join("  ") : "en ninguno"));

  // Y lo que queda de verdad en esa columna, para ver contra qué se compara.
  const buenas = await c.query(`SELECT province v, count(*)::int n
    FROM moveadvisor_market_offers WHERE portal = 'autohero' AND COALESCE(province,'') <> ''
      AND province <> $1 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`, [CARTEL]);
  console.log("  provincias de verdad que ya tiene: "
    + buenas.rows.map((x) => x.v + ":" + x.n).join("  "));

  if (!antes.prov && !antes.ciudad && !antes.loc) {
    console.log("\n  No hay nada que arreglar.\n");
    await c.end();
    return;
  }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run arregla-toda-espania -- --aplica\n");
    await c.end();
    return;
  }

  /*
   * Por bloques, para no tener miles de filas bloqueadas de una vez mientras
   * el scraper y el verificador escriben en la misma tabla: el 13-sep una
   * pasada del scoring y el scraper alemán se trabaron con «deadlock detected».
   */
  console.log("\n  APLICANDO, en bloques de 2.000");
  let total = 0;
  for (;;) {
    const r = await c.query(`UPDATE moveadvisor_market_offers SET
        province = CASE WHEN province = $1 THEN '' ELSE province END,
        city     = CASE WHEN city     = $1 THEN '' ELSE city     END,
        location = CASE WHEN location = $1 THEN '' ELSE location END
      WHERE id IN (
        SELECT id FROM moveadvisor_market_offers
        WHERE portal = 'autohero' AND (province = $1 OR city = $1 OR location = $1)
        LIMIT 2000)`, [CARTEL]);
    if (!r.rowCount) break;
    total += r.rowCount;
    console.log("      " + total.toLocaleString("es") + " filas limpias");
  }

  const desp = (await c.query(`SELECT
      count(*) FILTER (WHERE province = $1)::int prov,
      count(*) FILTER (WHERE COALESCE(province,'') <> '')::int con_provincia,
      count(*) FILTER (WHERE is_active AND COALESCE(province,'') <> '')::int activas_con
    FROM moveadvisor_market_offers WHERE portal = 'autohero'`, [CARTEL])).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      con «" + CARTEL + "»        : " + desp.prov);
  console.log("      con una provincia de verdad : " + desp.con_provincia.toLocaleString("es")
    + "   (activas: " + desp.activas_con.toLocaleString("es") + ")");
  console.log("");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
