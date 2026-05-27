/**
 * Elimina todas las ofertas importadas de Leasys (id LIKE 'leasys-%').
 * Uso: node scripts/delete-leasys-offers.js
 */

require("dotenv").config({ path: ".env.local" });

const { Pool } = require("pg");

async function main() {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) {
    console.error("No se encontró POSTGRES_URL ni DATABASE_URL en .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

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
