/**
 * Saca la cuota mensual de la columna del precio financiado, en Flexicar.
 *
 *   npm run arregla-cuota-flexicar            (solo mira, no escribe)
 *   npm run arregla-cuota-flexicar -- --aplica
 *
 * POR QUÉ
 *
 * El scraper viejo de Flexicar escribía la CUOTA en finance_price y dejaba
 * monthly_price vacío. Así están 16.635 filas:
 *
 *     Opel Crossland 2021   precio 10.690 €   finance_price   166 €   cuota (vacía)
 *     Ford Kuga      2024   precio 27.300 €   finance_price   424 €   cuota (vacía)
 *
 * El scraper nuevo ya lo hace bien -la cuota a monthly_price y el precio
 * financiado a finance_price-, así que esto solo toca lo que quedó atrás:
 * las 16.635 son TODAS filas dadas de baja, ninguna viva.
 *
 * EL CRITERIO, Y POR QUÉ ESTE
 *
 * La razón finance_price/price parte los datos en dos montones separados por
 * un hueco vacío:
 *
 *     0,015 a 0,087   16.635 filas   <- cuotas mensuales (92 €, 166 €, 424 €)
 *     (nada entre 0,087 y 0,535)
 *     0,535 a 1,000   23.398 filas   <- precios financiados de verdad
 *
 * El corte va en 0,5, en mitad del hueco. No es un número elegido a ojo: un
 * descuento por financiar deja el precio entre el 70 % y el 100 % del de
 * contado -los cuatro que hay justo por encima del corte son 13.790 de 25.790,
 * 8.990 de 12.990, 7.990 de 11.490 y 6.990 de 9.990-, y una cuota mensual
 * anda por el 2 % del precio.
 *
 * LO QUE NO SE MUEVE
 *
 * Una «cuota» fuera de 30-3.000 € no es una cuota. Hay un SEAT León dado de
 * baja con precio 247.990 € y finance 21.490 €: las dos columnas están mal, y
 * mover ese 21.490 a monthly_price sería cambiar una mentira de sitio. A esos
 * se les limpia finance_price y se les deja la cuota vacía.
 *
 * Tampoco se toca updated_at, que ordena el escaparate: esto no es que el
 * anuncio haya cambiado, es que nosotros lo teníamos mal.
 */
"use strict";
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");
const RAIZ = path.join(__dirname, "..");
const env = fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8");
const DB_URL = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "");

const APLICA = process.argv.includes("--aplica");

// Debajo de esta razón, lo que hay en finance_price no es un precio.
const CORTE = 0.5;
// Y para que además se pueda guardar como cuota, tiene que parecer una cuota.
const CUOTA_MIN = 30;
const CUOTA_MAX = 3000;

const SOSPECHOSAS = `portal = 'flexicar' AND finance_price IS NOT NULL AND price > 0
      AND finance_price / price < ${CORTE}`;

(async () => {
  const c = new Client({ connectionString: DB_URL, statement_timeout: 300000 });
  await c.connect();

  const antes = (await c.query(`SELECT count(*)::int n,
      count(*) FILTER (WHERE is_active)::int vivas,
      count(*) FILTER (WHERE finance_price BETWEEN ${CUOTA_MIN} AND ${CUOTA_MAX}
                         AND monthly_price IS NULL)::int se_mueven,
      count(*) FILTER (WHERE NOT (finance_price BETWEEN ${CUOTA_MIN} AND ${CUOTA_MAX})
                         OR monthly_price IS NOT NULL)::int solo_se_limpian,
      min(finance_price)::int fin_min, max(finance_price)::int fin_max
    FROM moveadvisor_market_offers WHERE ${SOSPECHOSAS}`)).rows[0];

  console.log("\n  FLEXICAR: filas con una «cuota» en la columna del precio financiado");
  console.log("      son                        : " + antes.n.toLocaleString("es"));
  console.log("      de ellas, vivas            : " + antes.vivas
    + (antes.vivas === 0 ? "   (ninguna: el scraper nuevo ya lo hace bien)" : "   <- OJO"));
  console.log("      su finance_price va de " + antes.fin_min + " a " + antes.fin_max + " €");
  console.log("\n      la cuota se mueve a su sitio : " + antes.se_mueven.toLocaleString("es"));
  console.log("      solo se limpia el financiado : " + antes.solo_se_limpian
    + "   (no parece una cuota, o ya hay una)");

  // El montón de al lado, para ver que no se toca
  const buenas = (await c.query(`SELECT count(*)::int n, min(round(finance_price/price,3))::numeric razon_min
    FROM moveadvisor_market_offers
    WHERE portal = 'flexicar' AND finance_price IS NOT NULL AND price > 0
      AND finance_price / price >= ${CORTE}`)).rows[0];
  console.log("      precios financiados de verdad, intactos: " + buenas.n.toLocaleString("es")
    + "   (razón mínima " + buenas.razon_min + ")");

  if (!antes.n) { console.log("\n  No hay nada que arreglar.\n"); await c.end(); return; }

  if (!APLICA) {
    console.log("\n  NO SE HA ESCRITO NADA. Para aplicarlo:");
    console.log("      npm run arregla-cuota-flexicar -- --aplica\n");
    await c.end();
    return;
  }

  /*
   * Por bloques, para no tener 16.000 filas bloqueadas de una vez mientras el
   * scraper y el verificador escriben en la misma tabla: el 13-sep una pasada
   * del scoring y el scraper alemán se trabaron con «deadlock detected».
   */
  console.log("\n  APLICANDO, en bloques de 4.000");
  let total = 0;
  for (;;) {
    const r = await c.query(`UPDATE moveadvisor_market_offers SET
        monthly_price = CASE
          WHEN monthly_price IS NULL
           AND finance_price BETWEEN ${CUOTA_MIN} AND ${CUOTA_MAX} THEN finance_price
          ELSE monthly_price END,
        finance_price = NULL
      WHERE id IN (
        SELECT id FROM moveadvisor_market_offers WHERE ${SOSPECHOSAS} LIMIT 4000)`);
    if (!r.rowCount) break;
    total += r.rowCount;
    console.log("      " + total.toLocaleString("es") + " filas");
  }

  const desp = (await c.query(`SELECT
      count(*) FILTER (WHERE finance_price IS NOT NULL AND price > 0
                         AND finance_price / price < ${CORTE})::int quedan,
      count(*) FILTER (WHERE finance_price IS NOT NULL)::int con_financiado,
      count(*) FILTER (WHERE monthly_price IS NOT NULL)::int con_cuota
    FROM moveadvisor_market_offers WHERE portal = 'flexicar'`)).rows[0];
  console.log("\n  DESPUÉS");
  console.log("      «cuotas» en la columna del financiado : " + desp.quedan);
  console.log("      con precio financiado                 : " + desp.con_financiado.toLocaleString("es"));
  console.log("      con cuota mensual                     : " + desp.con_cuota.toLocaleString("es"));
  console.log("");
  await c.end();
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
