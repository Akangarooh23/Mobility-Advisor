"use strict";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const r = await pool.query(`
    SELECT id, brand, model, price, year, mileage, location
    FROM moveadvisor_marketplace_vo_offers
    WHERE is_active = true AND (lower(brand) LIKE '%opel%' OR lower(brand) LIKE '%fiat%')
    ORDER BY price ASC
    LIMIT 40
  `);
  for (const x of r.rows) {
    console.log(`${x.brand} ${x.model} | ${x.price}€ | ${x.year} | ${x.mileage}km | ${x.location} | ${x.id}`);
  }
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
