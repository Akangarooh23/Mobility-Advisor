"use strict";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r = await pool.query(`
    SELECT id, brand, model, image_url, image_urls
    FROM moveadvisor_marketplace_vo_offers
    WHERE is_active = true
    ORDER BY brand, model
  `);

  let totalActive = r.rows.length;
  let withSupabase = 0;
  let withExternalOnly = 0;
  let withEmpty = 0;
  const externalUrls = [];
  const badFirst = [];

  for (const row of r.rows) {
    let urls = [];
    try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}
    const supaUrls = urls.filter(u => u && u.includes("supabase"));
    const first = urls[0] || "";
    const imageUrl = row.image_url || "";

    if (supaUrls.length > 0) {
      withSupabase++;
      if (!first.includes("supabase")) {
        badFirst.push({ id: row.id, brand: row.brand, model: row.model, first: first.substring(0,80) });
      }
    } else if (imageUrl && !imageUrl.includes("supabase")) {
      withExternalOnly++;
      externalUrls.push({ id: row.id, brand: row.brand, model: row.model, url: imageUrl.substring(0,80) });
    } else {
      withEmpty++;
    }
  }

  console.log(`\n=== MARKETPLACE PHOTO AUDIT ===`);
  console.log(`Total active offers: ${totalActive}`);
  console.log(`With Supabase photos: ${withSupabase}`);
  console.log(`With external URL only (no Supabase): ${withExternalOnly}`);
  console.log(`With no photos: ${withEmpty}`);

  if (badFirst.length > 0) {
    console.log(`\n--- Offers with Supabase photos but non-Supabase as image_urls[0] (${badFirst.length}) ---`);
    for (const b of badFirst) console.log(`  ${b.brand} ${b.model} (${b.id}): ${b.first}`);
  }

  if (externalUrls.length > 0) {
    console.log(`\n--- Offers with ONLY external image_url, no Supabase (${externalUrls.length}) ---`);
    for (const e of externalUrls) console.log(`  ${e.brand} ${e.model} (${e.id}): ${e.url}`);
  }

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
