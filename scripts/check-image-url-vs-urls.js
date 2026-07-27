"use strict";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Find the specific offers from the screenshot + check how many have image_url != image_urls[0]
  const r = await pool.query(`
    SELECT id, brand, model, price, year, mileage, image_url, image_urls
    FROM moveadvisor_marketplace_vo_offers
    WHERE is_active = true
    ORDER BY price ASC
    LIMIT 200
  `);

  let desynced = 0;
  let externalImageUrl = 0;

  console.log("--- Offers where image_url differs from image_urls[0] ---\n");
  for (const row of r.rows) {
    let urls = [];
    try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}
    const first = urls[0] || "";
    const imageUrl = row.image_url || "";
    const isSupabaseFirst = first.includes("supabase");
    const isSupabaseImageUrl = imageUrl.includes("supabase");
    const inSync = imageUrl === first;

    if (!inSync) {
      desynced++;
      const tag = !isSupabaseImageUrl ? "🔴 EXTERNAL image_url" : (isSupabaseFirst ? "🟡 both Supabase but differ" : "⚪ other");
      console.log(`${tag} | ${row.brand} ${row.model} | ${row.price}€ | ${row.year} | ${row.mileage}km`);
      console.log(`  image_url    : ${imageUrl.split("/").pop()}`);
      console.log(`  image_urls[0]: ${first.split("/").pop()}`);
    }

    if (!isSupabaseImageUrl && imageUrl) externalImageUrl++;
  }

  console.log(`\nTotal active: ${r.rows.length}`);
  console.log(`With desynced image_url vs image_urls[0]: ${desynced}`);
  console.log(`With non-Supabase image_url: ${externalImageUrl}`);

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
