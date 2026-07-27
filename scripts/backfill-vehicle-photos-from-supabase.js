// One-time script: reads files already in Supabase vehicle-files bucket and creates
// missing records in moveadvisor_user_vehicle_files (Neon DB) without re-uploading.
// Usage: node scripts/backfill-vehicle-photos-from-supabase.js [--dry-run]
// Reads SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URL from .env.local

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });

const { createClient } = require("@supabase/supabase-js");
const { Pool } = require("pg");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const CONN_STRING = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "vehicle-files";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: SUPABASE_URL o SUPABASE_SERVICE_KEY no encontrada en .env.local");
  process.exit(1);
}
if (!CONN_STRING) {
  console.error("ERROR: DATABASE_URL no encontrada en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const pool = new Pool({ connectionString: CONN_STRING, ssl: { rejectUnauthorized: false } });

async function listFolder(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Supabase list("${prefix}") error: ${error.message}`);
  return data || [];
}

function guessMime(fileName) {
  const ext = String(fileName).split(".").pop().toLowerCase();
  const map = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", pdf: "application/pdf" };
  return map[ext] || "application/octet-stream";
}

async function collectFiles() {
  // List top-level items inside vehicles/
  const topItems = await listFolder("vehicles");
  // Folders show up as items with no metadata (metadata=null or id=null)
  const vehicleFolders = topItems.filter((item) => !item.metadata);

  console.log(`Carpetas de vehículos encontradas: ${vehicleFolders.map((f) => f.name).join(", ") || "ninguna"}`);

  const files = [];

  for (const folder of vehicleFolders) {
    const vehicleId = folder.name;
    if (!vehicleId) continue;

    // List subfolders (photos, documents, etc.)
    const subItems = await listFolder(`vehicles/${vehicleId}`);
    const subFolders = subItems.filter((item) => !item.metadata);

    for (const sub of subFolders) {
      const subfolder = sub.name;
      const fileType = (subfolder === "photos" || subfolder === "photo") ? "photo"
                    : (subfolder === "documents" || subfolder === "document") ? "document"
                    : null;
      if (!fileType) continue;

      // List actual files inside
      const fileItems = await listFolder(`vehicles/${vehicleId}/${subfolder}`);
      const actualFiles = fileItems.filter((item) => item.metadata);

      for (const f of actualFiles) {
        const filePath = `vehicles/${vehicleId}/${subfolder}/${f.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        const publicUrl = urlData?.publicUrl || "";
        const mimeType = f.metadata?.mimetype || guessMime(f.name);
        const size = Number(f.metadata?.size || 0);

        files.push({ vehicleId, fileType, fileName: f.name, size, mimeType, publicUrl });
      }
    }
  }

  return files;
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (no escribe nada)" : "REAL"}`);
  console.log("Leyendo archivos de Supabase...\n");

  const files = await collectFiles();
  console.log(`\nArchivos encontrados en Supabase: ${files.length}`);

  if (!files.length) {
    console.log("Nada que hacer.");
    await pool.end();
    return;
  }

  // Get existing records from DB
  const vehicleIds = [...new Set(files.map((f) => f.vehicleId))];
  const existing = await pool.query(
    `SELECT vehicle_id, file_url FROM moveadvisor_user_vehicle_files WHERE vehicle_id = ANY($1::varchar[])`,
    [vehicleIds]
  );
  const existingUrls = new Set((existing.rows || []).map((r) => r.file_url).filter(Boolean));
  console.log(`Registros ya existentes en BD: ${existingUrls.size}`);

  const toInsert = files.filter((f) => !existingUrls.has(f.publicUrl));
  console.log(`Registros a insertar: ${toInsert.length}\n`);

  if (!toInsert.length) {
    console.log("Todos los archivos ya tienen registro en BD. Nada que hacer.");
    await pool.end();
    return;
  }

  for (const f of toInsert) {
    console.log(`  [${DRY_RUN ? "DRY" : "INSERT"}] vehicleId=${f.vehicleId} | tipo=${f.fileType} | archivo=${f.fileName}`);
    if (!DRY_RUN) {
      await pool.query(
        `INSERT INTO moveadvisor_user_vehicle_files
           (vehicle_id, file_type, file_name, file_size, file_mime_type, file_content_base64, file_url, created_at)
         VALUES ($1, $2, $3, $4, $5, '', $6, NOW())`,
        [f.vehicleId, f.fileType, f.fileName, f.size, f.mimeType, f.publicUrl]
      );
    }
  }

  console.log(`\n${DRY_RUN ? "[DRY-RUN] Se habrían insertado" : "Insertados"}: ${toInsert.length} registros.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  pool.end();
  process.exit(1);
});
