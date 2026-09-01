/**
 * Rellenar la cilindrada de las ofertas alemanas, sacándola de su titular.
 *
 * La columna `displacement` está vacía en las 1.568 ofertas publicadas, y el
 * dato está delante: lo dice el propio anuncio en 916 de ellas, dentro del
 * texto que el anunciante alemán usa como versión —«1.6 TDICR 110PS STYLE».
 *
 * Sirve para dos cosas. La primera, que la ficha deje de tener un hueco y el
 * filtro de cilindrada del marketplace funcione. La segunda y la que importa:
 * es el desempate cuando se le pregunte a Eurotax por un modelo, año y kW que
 * en su catálogo tiene más de una versión.
 *
 *   node scripts/rellena-cilindrada.cjs          → en seco, no escribe nada
 *   node scripts/rellena-cilindrada.cjs --aplica → escribe
 *
 * Solo rellena lo que está vacío. Nunca pisa un valor que ya esté puesto: si
 * algún día el scraper lo trae bien, el suyo manda sobre este.
 */
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const { cilindradaDelTitular, cilindradaCreible } = require("../lib/cruce-eurotax.js");

const APLICA = process.argv.includes("--aplica");

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows } = await pool.query(
    `SELECT id, brand, model, version, title, displacement
      , power_kw
       FROM moveadvisor_market_offers
      WHERE country = 'DE'
        AND COALESCE(NULLIF(trim(displacement), ''), '') = ''`
  );

  const conDato = [];
  for (const fila of rows) {
    const titular = [fila.version, fila.title].filter(Boolean).join(" ");
    const litros = cilindradaDelTitular(titular);
    if (litros == null) continue;
    // El consumo se cuela disfrazado de motor: «4.5l Euro 4» en un Polo.
    if (!cilindradaCreible(litros, fila.power_kw)) continue;
    // En centímetros cúbicos, que es como lo enseña la ficha y como lo espera
    // el filtro. 1,6 L son 1.600 cc.
    conDato.push({ id: fila.id, cc: Math.round(litros * 1000), litros, titular });
  }

  console.log(`ofertas alemanas sin cilindrada: ${rows.length}`);
  console.log(`se les puede sacar del titular : ${conDato.length}`);
  console.log(`se quedan sin ella             : ${rows.length - conDato.length}`);

  const fuera = conDato.filter((x) => x.litros < 0.8 || x.litros > 3.5);
  if (fuera.length) {
    console.log(`\nfuera de lo corriente, míralos antes de aplicar (${fuera.length}):`);
    fuera.forEach((x) => console.log(`  ${x.litros} L · ${x.titular.slice(0, 70)}`));
  }

  if (!APLICA) {
    console.log("\nen seco: no se ha escrito nada. Con --aplica se escribe.");
    await pool.end();
    return;
  }

  let escritas = 0;
  for (const x of conDato) {
    // La condición de vacío va también en el UPDATE, no solo en el SELECT:
    // entre leer y escribir cabe una pasada del scraper.
    const r = await pool.query(
      `UPDATE moveadvisor_market_offers
          SET displacement = $2
        WHERE id = $1
          AND COALESCE(NULLIF(trim(displacement), ''), '') = ''`,
      [x.id, String(x.cc)]
    );
    escritas += r.rowCount;
  }
  console.log(`\nescritas ${escritas} de ${conDato.length}`);
  await pool.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
