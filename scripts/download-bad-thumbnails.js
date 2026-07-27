"use strict";
const { Pool } = require("pg");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const OUT_DIR = "C:/Users/Anapi/AppData/Local/Temp/leasys_audit";
fs.mkdirSync(OUT_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, res => {
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(fs.statSync(dest).size); });
    }).on("error", e => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function main() {
  // Get all Leasys offers sorted by price (first 30, those are the cheapest = most likely to have bad photos)
  const r = await pool.query(`
    SELECT id, brand, model, price, year, mileage, image_url, image_urls
    FROM moveadvisor_marketplace_vo_offers
    WHERE is_active = true AND seller = 'Leasys'
    ORDER BY price ASC
    LIMIT 30
  `);

  console.log(`Checking ${r.rows.length} Leasys offers...\n`);
  const results = [];

  for (const row of r.rows) {
    let urls = [];
    try { urls = typeof row.image_urls === "string" ? JSON.parse(row.image_urls) : (row.image_urls || []); } catch {}
    const first = urls[0] || "";
    if (!first) { console.log(`  SKIP (no photo): ${row.brand} ${row.model}`); continue; }

    // Extract safe filename from offer ID
    const offerKey = row.id.replace("leasys-", "").substring(0, 20);
    const destPath = path.join(OUT_DIR, `${offerKey}_img0.jpg`);
    let size = 0;
    try {
      size = await download(first, destPath);
    } catch (e) {
      console.log(`  ERROR: ${row.brand} ${row.model} - ${e.message}`);
      continue;
    }

    results.push({ id: row.id, brand: row.brand, model: row.model, price: row.price, size, file: destPath, urls });
    console.log(`OK ${row.brand} ${row.model} (${row.price}€) - img0 size: ${Math.round(size/1024)}KB → ${offerKey}_img0.jpg`);
  }

  console.log(`\nDownloaded ${results.length} thumbnails to ${OUT_DIR}`);
  // Write a manifest
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(results.map(x => ({
    id: x.id, brand: x.brand, model: x.model, price: x.price, size: x.size,
    file: path.basename(x.file), totalPhotos: x.urls.length
  })), null, 2));

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
