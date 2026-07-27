"use strict";
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const ids = [
    "leasys-vxkuphnekn4329001", // OPEL Corsa 6
    "leasys-zfa3120000je69840",  // FIAT 500 2 S
    "leasys-vxfvbyhrmn7063390",  // FIAT Scudo 3 Business
  ];

  for (const id of ids) {
    const r = await pool.query(
      "SELECT id, brand, model, image_url, image_urls FROM moveadvisor_marketplace_vo_offers WHERE id = $1",
      [id]
    );
    if (!r.rows.length) { console.log(id + ": NOT FOUND\n"); continue; }
    const row = r.rows[0];
    let urls = [];
    try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}
    const first = urls[0] || "";
    const imgUrlFile = String(row.image_url || "").split("/").pop();
    const firstFile = first.split("/").pop();
    const inSync = row.image_url === first;

    console.log(`${row.brand} ${row.model} (${id})`);
    console.log(`  image_url    : ...${imgUrlFile}`);
    console.log(`  image_urls[0]: ...${firstFile}`);
    console.log(`  In sync: ${inSync ? "YES ✓" : "NO - needs fix"}`);

    if (!inSync && first) {
      const upd = await pool.query(
        "UPDATE moveadvisor_marketplace_vo_offers SET image_url = $1, updated_at = NOW() WHERE id = $2",
        [first, id]
      );
      console.log(`  → Fixed image_url to image_urls[0] (${upd.rowCount} row)`);
    }
    console.log();
  }

  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
