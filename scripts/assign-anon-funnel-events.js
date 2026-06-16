/**
 * Asigna user_email a todos los eventos de funnel anónimos (sin user_email).
 * Uso:
 *   node scripts/assign-anon-funnel-events.js             → preview (no modifica)
 *   node scripts/assign-anon-funnel-events.js --apply     → aplica la actualización
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const { Pool } = require("pg");

const TARGET_EMAIL = "anapicazoh@gmail.com";
const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) {
    console.error("No se encontró POSTGRES_URL ni DATABASE_URL en .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

  try {
    const preview = await pool.query(
      `SELECT anon_id, COUNT(*)::int AS events,
              MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
       FROM moveadvisor_funnel_events
       WHERE user_email IS NULL OR user_email = ''
       GROUP BY anon_id
       ORDER BY last_seen DESC`
    );

    if (preview.rows.length === 0) {
      console.log("✅ No hay eventos anónimos sin user_email.");
      return;
    }

    console.log(`\n📋 Sesiones anónimas sin email (${preview.rows.length}):\n`);
    for (const row of preview.rows) {
      const from = new Date(row.first_seen).toLocaleString("es-ES");
      const to   = new Date(row.last_seen).toLocaleString("es-ES");
      console.log(`  ${row.anon_id}  →  ${row.events} eventos  [${from} → ${to}]`);
    }

    const totalEvents = preview.rows.reduce((sum, r) => sum + r.events, 0);
    console.log(`\n  Total: ${totalEvents} eventos en ${preview.rows.length} sesiones`);
    console.log(`  Se asignarán a: ${TARGET_EMAIL}\n`);

    if (DRY_RUN) {
      console.log("ℹ️  Modo preview — ejecuta con --apply para aplicar los cambios.\n");
      return;
    }

    const result = await pool.query(
      `UPDATE moveadvisor_funnel_events
       SET user_email = $1
       WHERE user_email IS NULL OR user_email = ''`,
      [TARGET_EMAIL]
    );

    console.log(`✅ Actualizados ${result.rowCount} eventos → ${TARGET_EMAIL}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
