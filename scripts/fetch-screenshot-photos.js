"use strict";
const { Pool } = require("pg");
const https = require("https");
const fs = require("fs");
const path = require("path");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const OUT_DIR = "C:/Users/Anapi/AppData/Local/Temp/screenshot_check";
fs.mkdirSync(OUT_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(fs.statSync(dest).size); });
    }).on("error", e => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function main() {
  // Specific offer IDs from the screenshot (matched by mileage/year)
  const ids = [
    "leasys-vxkuphnekn4329001",  // OPEL Corsa 6 (engine in screenshot)
    "leasys-zfa26300006t07175",   // FIAT Doblò Cargo 3 SX (orange van)
    "leasys-zfa3120000je69840",   // FIAT 500 2 S (steering wheel)
    "leasys-zfa26300006w34715",   // FIAT Doblò Cargo 3 Base (AmicoBlu)
    "leasys-zfacf1cj4njh11721",   // FIAT 500 2 Dolcevita (red car)
  ];

  for (const id of ids) {
    const r = await pool.query(
      "SELECT id, brand, model, price, image_url, image_urls FROM moveadvisor_marketplace_vo_offers WHERE id = $1",
      [id]
    );
    if (!r.rows.length) { console.log(`NOT FOUND: ${id}`); continue; }
    const row = r.rows[0];
    let urls = [];
    try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}

    const first = urls[0] || row.image_url || "";
    if (!first) { console.log(`NO PHOTO: ${row.brand} ${row.model}`); continue; }

    const key = id.replace("leasys-", "").substring(0, 16);
    const dest = path.join(OUT_DIR, `${key}_img0.jpg`);
    try {
      const size = await download(first, dest);
      console.log(`✓ ${row.brand} ${row.model} (${row.price}€) - ${Math.round(size/1024)}KB - URL: ...${first.split("/").slice(-2).join("/")}`);
    } catch (e) {
      console.log(`✗ ${row.brand} ${row.model}: ${e.message}`);
    }
  }

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
