/**
 * Dejar de mentir con la fecha de publicacion de Wallapop.
 *
 * `listed_at` deberia decir cuando se publico el anuncio. En las 4.722 ofertas
 * de Wallapop decia otra cosa: era identica a `first_seen_at` en TODAS, o sea la
 * fecha en que la vimos nosotros por primera vez. Un coche publicado en mayo y
 * rascado en julio figuraba como publicado en julio.
 *
 * No era un dato ausente, que se nota, sino un dato equivocado, que no se nota:
 * cualquier calculo de "cuanto lleva en venta" salia corto y nadie lo iba a ver
 * mirando la ficha.
 *
 * Lo suyo habria sido corregirlas con la fecha buena, pero no se puede: el
 * `created_at` solo lo da el buscador, y el buscador solo deja llegar a las
 * paginas mas recientes. La ficha (/api/v3/items/{id}) no lo trae, y la pagina
 * web tampoco lo lleva dentro. Se comprobaron los tres caminos.
 *
 * Asi que se vacia. No se pierde nada, y esa es la clave: al ser identica a
 * `first_seen_at`, esa columna no guardaba ni un dato que no siguiera estando en
 * la otra. Lo unico que aportaba era la apariencia de saber algo que no sabiamos.
 *
 * A partir de aqui el reparto queda limpio:
 *   listed_at IS NULL      -> no sabemos cuando se publico
 *   listed_at IS NOT NULL  -> fecha real, la que manda la API al scrapearla
 *   first_seen_at          -> desde cuando la conocemos nosotros (intacta)
 *
 * El scraper ya guarda la buena en las que entren de ahora en adelante.
 *
 *   node scripts/rellena-listed-at-wallapop.js            (en seco, no escribe)
 *   ESCRIBIR=1 node scripts/rellena-listed-at-wallapop.js (de verdad)
 */
"use strict";

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const ESCRIBIR = process.env.ESCRIBIR === "1";

/**
 * La firma del dato malo: `listed_at` clavada a `first_seen_at`.
 *
 * Se filtra por eso y no por "todas las de wallapop" para no tocar las que ya
 * tengan la fecha buena del scraper nuevo. Una que coincidiera por casualidad
 * -publicada el mismo segundo en que la vimos- se vaciaria tambien, pero eso
 * pide que el azar acierte al segundo y el coste de equivocarse es perder un
 * dato que igualmente sigue en `first_seen_at`.
 */
const CONDICION = `
  portal = 'wallapop'
  AND listed_at IS NOT NULL
  AND listed_at = first_seen_at`;

(async () => {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();

  const antes = (await c.query(`
    SELECT count(*) malas,
      count(*) FILTER (WHERE COALESCE(is_active, TRUE)) activas
    FROM moveadvisor_market_offers WHERE ${CONDICION}`)).rows[0];

  const buenas = (await c.query(`
    SELECT count(*) n FROM moveadvisor_market_offers
    WHERE portal = 'wallapop' AND listed_at IS NOT NULL AND listed_at <> first_seen_at`)).rows[0];

  console.log(`${ESCRIBIR ? "" : "[EN SECO] "}Wallapop:`);
  console.log(`  con fecha de publicacion falsa (= first_seen_at): ${antes.malas}  (${antes.activas} activas)`);
  console.log(`  con fecha de publicacion real                   : ${buenas.n}`);

  if (Number(antes.malas) === 0) {
    console.log("\nNo hay nada que limpiar.");
    await c.end();
    return;
  }

  if (!ESCRIBIR) {
    console.log(`\n[EN SECO] se pondrian a NULL ${antes.malas} fechas. No se ha tocado la base.`);
    console.log("Para hacerlo de verdad: ESCRIBIR=1 node scripts/rellena-listed-at-wallapop.js");
    await c.end();
    return;
  }

  // updated_at no se toca: esto no es un cambio del anuncio, es una correccion
  // nuestra, y mover esa fecha haria parecer que la oferta cambio hoy.
  const r = await c.query(`
    UPDATE moveadvisor_market_offers SET listed_at = NULL WHERE ${CONDICION}`);
  console.log(`\nVaciadas ${r.rowCount} fechas de publicacion falsas.`);

  const despues = (await c.query(`
    SELECT count(*) FILTER (WHERE listed_at IS NULL) sin_fecha,
           count(*) FILTER (WHERE listed_at IS NOT NULL) con_fecha,
           count(*) FILTER (WHERE first_seen_at IS NOT NULL) con_primera_vez
    FROM moveadvisor_market_offers WHERE portal = 'wallapop'`)).rows[0];
  console.log(`  ahora: ${despues.sin_fecha} sin fecha de publicacion, ${despues.con_fecha} con fecha real.`);
  console.log(`  first_seen_at sigue intacta en ${despues.con_primera_vez}.`);

  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
