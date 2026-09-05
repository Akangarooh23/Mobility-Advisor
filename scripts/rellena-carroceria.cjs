/**
 * La carrocería de los coches alemanes, sacada de los españoles.
 *
 * El scraper alemán no la trae: `body_type` está vacío en las 25.498 ofertas.
 * Y hace falta, porque de ella depende la banda del impuesto —un SUV de dos
 * toneladas emite bastante más que una berlina con el mismo motor— y el
 * impuesto entra en el precio que se publica.
 *
 * Lo que se descubrió midiendo: al Kia Sorento de 2021 le estimamos 151 g/km y
 * son 177. Es un SUV, pero en su anuncio pone «1.Hand LED Keyless Ahk Navi
 * Finanzierung» y ni cilindrada: por el título no hay manera de saber que es
 * grande. Ochocientos diez euros de impuesto por debajo, que habrían salido del
 * margen como salieron los mil setenta del primer coche.
 *
 * No hace falta tocar el scraper para arreglarlo. **Ya tenemos el dato**: hay
 * 422.069 ofertas españolas con carrocería, y el 94 % de los coches alemanes
 * tienen su marca y modelo también en el lado español. Un Kia Sorento es un SUV
 * lo venda quien lo venda.
 *
 *   node scripts/rellena-carroceria.cjs          → en seco, no escribe nada
 *   node scripts/rellena-carroceria.cjs --aplica → escribe
 *
 * Solo rellena lo que está vacío: si algún día el scraper trae la carrocería de
 * verdad, esa manda y esto no la pisa.
 */
require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const APLICA = process.argv.includes("--aplica");

/**
 * La carrocería más repetida de cada marca y modelo en el mercado español.
 *
 * La más repetida y no cualquiera: un «BMW Serie 3» aparece como berlina y como
 * familiar, y para lo que se usa esto —cuánto pesa y cuánto traga— manda la
 * mayoritaria. Se piden al menos tres anuncios para no copiar la carrocería mal
 * puesta de un anuncio suelto.
 */
const DICCIONARIO = `
  SELECT m, mo, body_type FROM (
    SELECT lower(trim(brand)) m, lower(trim(model)) mo, body_type, count(*) n,
           row_number() OVER (
             PARTITION BY lower(trim(brand)), lower(trim(model))
             ORDER BY count(*) DESC
           ) puesto
      FROM moveadvisor_market_offers
     WHERE COALESCE(country, 'ES') <> 'DE'
       AND NULLIF(trim(COALESCE(body_type, '')), '') IS NOT NULL
       AND NULLIF(trim(COALESCE(brand, '')), '') IS NOT NULL
       AND NULLIF(trim(COALESCE(model, '')), '') IS NOT NULL
     GROUP BY 1, 2, 3
  ) t
   WHERE puesto = 1 AND n >= 3
`;

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows: previa } = await pool.query(
    `WITH es AS (${DICCIONARIO})
     SELECT COALESCE(es.body_type, '(sin cruce)') AS carroceria, count(*)::int AS n
       FROM moveadvisor_market_offers de
       LEFT JOIN es ON es.m = lower(trim(de.brand)) AND es.mo = lower(trim(de.model))
      WHERE de.country = 'DE'
        AND NULLIF(trim(COALESCE(de.body_type, '')), '') IS NULL
      GROUP BY 1
      ORDER BY 2 DESC`
  );

  const total = previa.reduce((s, f) => s + f.n, 0);
  const sinCruce = previa.find((f) => f.carroceria === "(sin cruce)")?.n || 0;

  console.log(`coches alemanes sin carrocería: ${total}`);
  console.log(`se les puede poner            : ${total - sinCruce}`);
  console.log(`se quedan sin                 : ${sinCruce}\n`);
  for (const f of previa) {
    console.log(`  ${String(f.n).padStart(6)}  ${f.carroceria}`);
  }

  if (!APLICA) {
    console.log("\nen seco: no se ha escrito nada. Con --aplica se escribe.");
    await pool.end();
    return;
  }

  const r = await pool.query(
    `WITH es AS (${DICCIONARIO})
     UPDATE moveadvisor_market_offers de
        SET body_type = es.body_type
       FROM es
      WHERE de.country = 'DE'
        AND NULLIF(trim(COALESCE(de.body_type, '')), '') IS NULL
        AND es.m = lower(trim(de.brand))
        AND es.mo = lower(trim(de.model))`
  );

  console.log(`\nactualizadas ${r.rowCount} filas`);
  await pool.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
