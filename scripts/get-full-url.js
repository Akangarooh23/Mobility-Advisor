"use strict";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function main() {
  const r = await pool.query(
    "SELECT id, image_url, image_urls FROM moveadvisor_marketplace_vo_offers WHERE id = $1",
    ["leasys-vxkuphnekn4329001"]
  );
  const row = r.rows[0];
  let urls = [];
  try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}
  console.log("image_url:", row.image_url);
  console.log("image_urls[0]:", urls[0]);
  console.log("image_urls[1]:", urls[1]);
  console.log("Total photos:", urls.length);
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
