const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL         || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET               = 'vehicle-files';

let _client = null;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  if (!_client) _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return _client;
}

/**
 * Upload a Base64-encoded file to Supabase Storage.
 * Returns the public URL on success, or null if Supabase is not configured.
 */
async function uploadBase64ToSupabase(base64Content, mimeType, storagePath) {
  const client = getClient();
  if (!client) return null;

  try {
    let rawBase64 = String(base64Content || '').trim();
    if (rawBase64.startsWith('data:')) {
      const comma = rawBase64.indexOf(',');
      rawBase64 = comma >= 0 ? rawBase64.slice(comma + 1) : rawBase64;
    }
    if (!rawBase64) return null;

    const buffer = Buffer.from(rawBase64, 'base64');
    const { error } = await client.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.warn('[supabaseStorage] upload error:', error.message);
      return null;
    }

    return getPublicUrl(storagePath);
  } catch (err) {
    console.warn('[supabaseStorage] upload exception:', err?.message);
    return null;
  }
}

/**
 * Upload a raw Buffer to Supabase Storage.
 */
async function uploadBufferToSupabase(buffer, mimeType, storagePath) {
  const client = getClient();
  if (!client) return null;

  try {
    const { error } = await client.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.warn('[supabaseStorage] upload error:', error.message);
      return null;
    }

    return getPublicUrl(storagePath);
  } catch (err) {
    console.warn('[supabaseStorage] upload exception:', err?.message);
    return null;
  }
}

/**
 * Build a public URL for a file already in the bucket.
 */
function getPublicUrl(storagePath) {
  const client = getClient();
  if (!client) return '';
  const { data } = client.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || '';
}

/**
 * Sanitize a string to be safe as a file name component.
 */
function safeName(name = '') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

module.exports = { uploadBase64ToSupabase, uploadBufferToSupabase, getPublicUrl, safeName };
