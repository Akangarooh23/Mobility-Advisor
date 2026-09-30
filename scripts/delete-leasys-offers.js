/**
 * Elimina las ofertas importadas de Leasys (id LIKE 'leasys-%').
 *
 * ## Qué hace y por qué sigue aquí
 *
 * Leasys ya no se rasca: **no queda ni una línea de código que lo mencione** en
 * `lib/`, `api/` ni `src/`. Pero sus 87 ofertas siguen en la tabla del
 * marketplace, sirviéndose a los usuarios sin que nadie las verifique. Este
 * guion es la limpieza de eso, y no se había ejecutado nunca.
 *
 * Decidir si se borran o se marcan como inactivas es cosa de producto. Este
 * guion hace lo primero.
 *
 * ## Por qué ahora pide permiso
 *
 * Antes se ejecutaba con `node scripts/delete-leasys-offers.js` y borraba. Lee
 * `DATABASE_URL`, que en la máquina de trabajo apunta a **producción**, así que
 * un autocompletado desafortunado era un borrado.
 *
 * Tres de los ocho guiones destructivos del repositorio no pedían nada. Dos se
 * borraron —no tenían propósito— y este se quedó con freno, porque el suyo sigue
 * en pie.
 *
 * Uso:
 *
 *   node scripts/delete-leasys-offers.js            → dice cuántas hay y se para
 *   node scripts/delete-leasys-offers.js --borra     → las borra
 */

require("dotenv").config({ path: ".env.local" });

const { Pool } = require("pg");
const { SSL_POSTGRES } = require("../lib/postgres-ssl");

/** Sin esto solo cuenta. Escribirlo a mano es el permiso. */
const BORRA_DE_VERDAD = process.argv.includes("--borra");

async function main() {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) {
    console.error("No se encontró POSTGRES_URL ni DATABASE_URL en .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connString, ssl: SSL_POSTGRES });

  try {
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM moveadvisor_marketplace_vo_offers WHERE id LIKE 'leasys-%'`
    );
    const total = Number(countRes.rows[0].count);
    console.log(`Ofertas Leasys encontradas: ${total}`);

    if (total === 0) {
      console.log("Nada que borrar.");
      return;
    }

    if (!BORRA_DE_VERDAD) {
      /*
       * Se dice a qué base se está apuntando, porque es lo que de verdad importa
       * antes de borrar. Sin la contraseña: solo el servidor y la base.
       */
      let aDonde = "(no se pudo leer)";
      try {
        const u = new URL(connString);
        aDonde = `${u.hostname}${u.pathname}`;
      } catch {}

      console.log("");
      console.log(`Se borrarían ${total} ofertas de  ${aDonde}`);
      console.log("");
      console.log("No se ha borrado nada. Para hacerlo de verdad:");
      console.log("");
      console.log("    node scripts/delete-leasys-offers.js --borra");
      console.log("");
      return;
    }

    const del = await pool.query(
      `DELETE FROM moveadvisor_marketplace_vo_offers WHERE id LIKE 'leasys-%'`
    );
    console.log(`✓ Eliminadas: ${del.rowCount} ofertas`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
