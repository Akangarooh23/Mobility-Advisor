"use strict";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Find offers visible in the screenshot
  const targets = [
    { brand: "opel", model: "corsa", price: 7905, year: 2022, mileage: 44857 },
    { brand: "fiat", model: "doblo", price: 8147, year: 2021, mileage: 99671 },
    { brand: "fiat", model: "500", price: 8873, year: 2021, mileage: 47368 },
    { brand: "fiat", model: "doblo", price: 9478, year: 2022, mileage: 61019 },
    { brand: "fiat", model: "500", price: 11172, year: 2023, mileage: 31482 },
  ];

  for (const t of targets) {
    const r = await pool.query(`
      SELECT id, brand, model, price, year, mileage, image_url, image_urls, location
      FROM moveadvisor_marketplace_vo_offers
      WHERE is_active = true
        AND lower(brand) = $1
        AND lower(model) LIKE $2
        AND price BETWEEN $3 AND $4
        AND year = $5
      LIMIT 3
    `, [t.brand, `%${t.model}%`, t.price - 50, t.price + 50, t.year]);

    if (!r.rows.length) {
      console.log(`NOT FOUND: ${t.brand} ${t.model} ${t.price}€`);
      continue;
    }

    for (const row of r.rows) {
      let urls = [];
      try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}
      console.log(`FOUND: ${row.brand} ${row.model} | ${row.price}€ | ${row.year} | ${row.mileage}km | ${row.location}`);
      console.log(`  ID: ${row.id}`);
      console.log(`  image_urls count: ${urls.length}`);
      console.log(`  image_urls[0]: ${urls[0] || "NONE"}`);
      console.log(`  image_urls[1]: ${urls[1] || "NONE"}`);
      console.log(`  image_urls[2]: ${urls[2] || "NONE"}`);
      console.log();
    }
  }

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
