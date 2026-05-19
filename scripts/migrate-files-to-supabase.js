/**
 * One-time migration: uploads Base64 files from DB to Supabase Storage
 * and updates the file_url column.
 *
 * Run with:
 *   node scripts/migrate-files-to-supabase.js
 *
 * Env vars needed: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY
 * (already in .env.local — the script loads it automatically)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const { Pool } = require('pg');
const { uploadBase64ToSupabase, safeName } = require('../lib/supabaseStorage');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateTable(tableName, typeColumn, vehicleIdColumn = 'vehicle_id') {
  console.log(`\n── ${tableName} ──────────────────────────────`);

  const { rows } = await pool.query(
    `SELECT id, ${vehicleIdColumn} AS vehicle_id, ${typeColumn} AS file_type,
            file_name, file_mime_type, file_content_base64
     FROM ${tableName}
     WHERE (file_url IS NULL OR file_url = '')
       AND file_content_base64 IS NOT NULL
       AND file_content_base64 != ''`
  );

  console.log(`  Found ${rows.length} file(s) without Supabase URL`);
  if (rows.length === 0) return;

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const mimeType    = row.file_mime_type || guessMime(row.file_name);
    const ext         = extFromMime(mimeType, row.file_name);
    const folder      = folderForType(row.file_type);
    const storagePath = `vehicles/${row.vehicle_id}/${folder}/${Date.now()}_${safeName(row.file_name || `file${ext}`)}`;

    process.stdout.write(`  [${row.id}] ${row.file_name || '?'} → `);

    const url = await uploadBase64ToSupabase(row.file_content_base64, mimeType, storagePath);

    if (url) {
      await pool.query(
        `UPDATE ${tableName} SET file_url = $1, file_content_base64 = '' WHERE id = $2`,
        [url, row.id]
      );
      console.log(`OK  ${url}`);
      ok++;
    } else {
      console.log('FAIL (upload returned null — check SUPABASE_URL / SUPABASE_SERVICE_KEY)');
      fail++;
    }

    // Small delay to avoid hitting Supabase rate limits
    await sleep(80);
  }

  console.log(`  Done: ${ok} uploaded, ${fail} failed`);
}

function folderForType(type = '') {
  const t = String(type).toLowerCase();
  if (t === 'photo')              return 'photos';
  if (t === 'document')           return 'documents';
  if (t === 'technical_sheet')    return 'technical-sheet';
  if (t === 'circulation_permit') return 'circulation-permit';
  if (t === 'itv')                return 'itv';
  return 'other';
}

function guessMime(fileName = '') {
  const n = String(fileName).toLowerCase();
  if (n.endsWith('.pdf'))  return 'application/pdf';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png'))  return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif'))  return 'image/gif';
  return 'application/octet-stream';
}

function extFromMime(mime = '', fileName = '') {
  const fn = String(fileName).toLowerCase();
  if (fn.includes('.')) return '';
  const m = String(mime).toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
  if (m.includes('png'))  return '.png';
  if (m.includes('pdf'))  return '.pdf';
  if (m.includes('webp')) return '.webp';
  return '';
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('=== Supabase Storage Migration ===');
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL || '(not set)'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? '(set)' : '(not set)'}`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('\nERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('\nERROR: DATABASE_URL must be set in .env.local');
    process.exit(1);
  }

  try {
    // Ensure the file_url columns exist before migrating
    await pool.query(`ALTER TABLE IF EXISTS moveadvisor_user_vehicle_files ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE IF EXISTS moveadvisor_user_vehicle_documents ADD COLUMN IF NOT EXISTS file_url TEXT NOT NULL DEFAULT ''`);

    await migrateTable('moveadvisor_user_vehicle_files',     'file_type');
    await migrateTable('moveadvisor_user_vehicle_documents', 'document_type');

    console.log('\n✅ Migration complete');
  } catch (err) {
    console.error('\nFATAL:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
