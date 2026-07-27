/**
 * Diagnóstico: muestra ubicaciones no estándar y registros sin potencia CV.
 * node scripts/tmp_check_locations_power.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { Pool } = require("pg");

const TABLE = "moveadvisor_marketplace_vo_offers";
const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

async function main() {
  const { rows: cols } = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = $1 ORDER BY ordinal_position
  `, [TABLE]);
  console.log("COLUMNAS:", cols.map(c => c.column_name).join(", "));

  const { rows: locs } = await pool.query(`
    SELECT DISTINCT location, internal_location, COUNT(*) as n
    FROM ${TABLE}
    WHERE is_active = TRUE
    GROUP BY location, internal_location
    ORDER BY location
  `);
  console.log("\n=== LOCATIONS ===");
  locs.forEach(r => console.log(`  location="${r.location}" internal="${r.internal_location}" (${r.n})`));

  const { rows: noPower } = await pool.query(`
    SELECT id, brand, model, year, seller, location, power
    FROM ${TABLE}
    WHERE is_active = TRUE AND (power IS NULL OR power = '')
    ORDER BY brand, model
  `);
  console.log(`\n=== SIN POTENCIA: ${noPower.length} registros ===`);
  noPower.forEach(r => console.log(`  [${r.seller}] ${r.brand} ${r.model} ${r.year || ""} (${r.location})`));
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => pool.end());
