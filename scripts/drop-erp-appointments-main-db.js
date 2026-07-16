/**
 * One-time cleanup: drops erp_appointments from the MAIN app database.
 * The table was accidentally created there instead of in the ERP database.
 * Run once: node scripts/drop-erp-appointments-main-db.js
 */
require("dotenv").config();
const { Pool } = require("pg");

async function main() {
  const cs = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!cs) throw new Error("No POSTGRES_URL / DATABASE_URL set");

  const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });

  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'erp_appointments'
     ) AS exists`
  );

  if (!rows[0].exists) {
    console.log("erp_appointments does not exist in main DB — nothing to do.");
    await pool.end();
    return;
  }

  await pool.query("DROP TABLE erp_appointments");
  console.log("Dropped erp_appointments from main DB.");
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
