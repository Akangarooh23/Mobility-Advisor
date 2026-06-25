/**
 * Recovers photos from Supabase Storage back into moveadvisor_user_vehicle_files.
 * Run: node scripts/recover-vehicle-photos.js
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const pool = new Pool({ connectionString: DATABASE_URL });

const BUCKET = "vehicle-files";

async function recoverVehiclePhotos(vehicleId) {
  console.log(`\n🔍 Buscando fotos en Supabase para: ${vehicleId}`);

  // List files in all known photo folders for this vehicle
  const folders = [
    `${vehicleId}/photo`,
    `vehicles/${vehicleId}/photos`,
    `vehicles/${vehicleId}/photo`,
    `${vehicleId}/photos`,
  ];

  let files = [];
  for (const folder of folders) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder);
    if (!error && data && data.length > 0) {
      console.log(`  📁 Encontrado en ${folder}: ${data.length} archivo(s)`);
      for (const file of data) {
        const path = `${folder}/${file.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        files.push({
          name: file.name,
          path,
          publicUrl: urlData.publicUrl,
          size: file.metadata?.size || 0,
          mimeType: file.metadata?.mimetype || "image/webp",
        });
      }
    }
  }

  if (files.length === 0) {
    console.log(`  ⚠️  No se encontraron archivos para ${vehicleId}`);
    return;
  }

  // Check existing rows in DB
  const existing = await pool.query(
    `SELECT file_name, file_url FROM moveadvisor_user_vehicle_files WHERE vehicle_id = $1 AND file_type = 'photo'`,
    [vehicleId]
  );
  const existingUrls = new Set(existing.rows.map((r) => r.file_url));
  console.log(`  📊 Filas existentes en BD: ${existing.rows.length}`);

  let inserted = 0;
  for (const file of files) {
    if (existingUrls.has(file.publicUrl)) {
      console.log(`  ✅ Ya existe: ${file.name}`);
      continue;
    }
    await pool.query(
      `INSERT INTO moveadvisor_user_vehicle_files
         (vehicle_id, file_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
       VALUES ($1, 'photo', $2, $3, $4, '', $5, NOW())`,
      [vehicleId, file.name, file.size, file.mimeType, file.publicUrl]
    );
    console.log(`  ✅ Recuperada: ${file.name} → ${file.publicUrl}`);
    inserted++;
  }

  console.log(`  🎉 ${inserted} foto(s) recuperada(s) para ${vehicleId}`);
}

async function main() {
  // Vehicle IDs to recover — add or remove as needed
  const vehicleIds = [
    "v-cw-1782321054808-hwi4n",
    "veh-1778144236925",
  ];

  for (const vid of vehicleIds) {
    await recoverVehiclePhotos(vid);
  }

  await pool.end();
  console.log("\n✅ Script completado.");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
