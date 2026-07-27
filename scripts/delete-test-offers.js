/**
 * Elimina todas las ofertas que no son de Leasys ni Astara (ofertas de prueba).
 * Muestra visitas y leads asociados antes de borrar.
 * Uso:
 *   node scripts/delete-test-offers.js          → preview (no borra)
 *   node scripts/delete-test-offers.js --delete  → borra definitivamente
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const { Pool } = require("pg");

const DRY_RUN = !process.argv.includes("--delete");

async function main() {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) {
    console.error("No se encontró POSTGRES_URL ni DATABASE_URL en .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });

  try {
    // Listar las ofertas de prueba
    const preview = await pool.query(
      `SELECT o.id, o.title, o.seller, o.portal, o.year, o.price, o.is_active,
              COALESCE(o.view_count, 0) AS views
       FROM moveadvisor_marketplace_vo_offers o
       WHERE seller NOT IN ('Leasys', 'Astara')
       ORDER BY o.created_at DESC`
    );

    if (preview.rows.length === 0) {
      console.log("✓ No hay ofertas de prueba. Nada que borrar.");
      return;
    }

    const ids = preview.rows.map((r) => r.id);

    // Buscar leads asociados a estas ofertas
    let leadsMap = {};
    try {
      const leadsRes = await pool.query(
        `SELECT vehicle_id, email, created_at
         FROM moveadvisor_market_leads
         WHERE vehicle_id = ANY($1::text[])
         ORDER BY created_at DESC`,
        [ids]
      );
      for (const l of leadsRes.rows) {
        if (!leadsMap[l.vehicle_id]) leadsMap[l.vehicle_id] = [];
        leadsMap[l.vehicle_id].push(l.email);
      }
    } catch {
      // tabla leads puede no existir con esa estructura
    }

    console.log(`\nOfertas que se ${DRY_RUN ? "borrarían" : "van a borrar"} (${preview.rows.length}):\n`);

    let hasActivity = false;
    for (const r of preview.rows) {
      const leads = leadsMap[r.id] || [];
      const active = r.is_active ? "publicado" : "despublicado";
      const activity = [];
      if (r.views > 0) activity.push(`${r.views} visita(s)`);
      if (leads.length > 0) activity.push(`leads: ${leads.join(", ")}`);

      const actStr = activity.length ? `  ⚠️  ${activity.join(" | ")}` : "";
      if (activity.length) hasActivity = true;

      console.log(`  [${r.id}]  ${r.title}  |  ${active}  |  seller: "${r.seller || "—"}"${actStr}`);
    }

    if (hasActivity) {
      console.log(`\n⚠️  Algunas ofertas tienen actividad. Revísalas antes de borrar.`);
    } else {
      console.log(`\n✓ Ninguna oferta tiene leads ni visitas registradas.`);
    }

    if (DRY_RUN) {
      console.log(`\nEjecuta con --delete para confirmar el borrado.`);
      return;
    }

    // Borrar (CASCADE elimina units y leads asociados si la FK lo permite)
    const del = await pool.query(
      `DELETE FROM moveadvisor_marketplace_vo_offers WHERE seller NOT IN ('Leasys', 'Astara')`
    );
    console.log(`\n✓ Eliminadas: ${del.rowCount} ofertas de prueba`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
