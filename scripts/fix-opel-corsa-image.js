"use strict";
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Find the OPEL Corsa 6 (or any offer where image_url != image_urls[0])
  const find = await pool.query(`
    SELECT id, brand, model, year, price, image_url, image_urls
    FROM moveadvisor_marketplace_vo_offers
    WHERE lower(brand) = 'opel' AND lower(model) LIKE '%corsa%' AND year = 2022
    ORDER BY price ASC
    LIMIT 5
  `);

  console.log(`Found ${find.rows.length} offer(s):\n`);

  for (const row of find.rows) {
    let urls = [];
    try { urls = JSON.parse(row.image_urls || "[]"); } catch {}
    const first = Array.isArray(urls) ? urls[0] : null;

    console.log(`ID: ${row.id}`);
    console.log(`  image_url  : ${row.image_url}`);
    console.log(`  image_urls[0]: ${first}`);
    console.log(`  In sync: ${row.image_url === first ? "✓ YES" : "✗ NO"}`);

    if (first && row.image_url !== first) {
      const res = await pool.query(
        `UPDATE moveadvisor_marketplace_vo_offers SET image_url = $1, updated_at = NOW() WHERE id = $2`,
        [first, row.id]
      );
      console.log(`  → Fixed: image_url updated to image_urls[0] (${res.rowCount} row updated)`);
    }
    console.log();
  }

  // Also fix ALL offers where image_url is not a supabase URL but image_urls[0] is
  console.log("--- Checking all offers with desync (non-supabase image_url but supabase in image_urls) ---\n");
  const all = await pool.query(`
    SELECT id, brand, model, image_url, image_urls
    FROM moveadvisor_marketplace_vo_offers
    WHERE image_urls IS NOT NULL AND image_urls != '' AND image_urls != '[]'
      AND (image_url IS NULL OR image_url NOT LIKE '%supabase%')
    LIMIT 50
  `);
  console.log(`Found ${all.rows.length} offer(s) with potential desync\n`);

  let fixed = 0;
  for (const row of all.rows) {
    let urls = [];
    try { urls = JSON.parse(row.image_urls || "[]"); } catch {}
    const first = Array.isArray(urls) ? urls[0] : null;
    if (first && first.includes("supabase") && row.image_url !== first) {
      await pool.query(
        `UPDATE moveadvisor_marketplace_vo_offers SET image_url = $1, updated_at = NOW() WHERE id = $2`,
        [first, row.id]
      );
      console.log(`Fixed: ${row.brand} ${row.model} (${row.id}) → ${first.substring(0, 80)}...`);
      fixed++;
    }
  }
  console.log(`\n✓ Fixed ${fixed} offers`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
