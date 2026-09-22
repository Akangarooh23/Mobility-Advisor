const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL         || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET               = 'vehicle-files';

/**
 * El cajón privado, para los papeles.
 *
 * `vehicle-files` es público y así tiene que ser: ahí van las fotos de los
 * anuncios, que se sirven por URL directa. Pero un mandato firmado lleva el
 * nombre, la matrícula y la firma de una persona, y en un bucket público es
 * alcanzable por quien tenga la dirección — saltándose la sesión que pide el
 * ERP para enseñarlo.
 */
const BUCKET_PRIVADO       = 'erp-documentos';

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
async function uploadBase64ToSupabase(base64Content, mimeType, storagePath, bucket = BUCKET) {
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
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.warn('[supabaseStorage] upload error:', error.message);
      return null;
    }

    /*
     * En el cajón privado no hay URL pública que devolver.
     *
     * Se devuelve el camino, que es lo que hace falta guardar: el ERP lo pega
     * detrás de su bucket y sirve el fichero con su clave. Devolver aquí una
     * URL pública de un bucket privado sería devolver un enlace roto.
     */
    return bucket === BUCKET ? getPublicUrl(storagePath) : storagePath;
  } catch (err) {
    console.warn('[supabaseStorage] upload exception:', err?.message);
    return null;
  }
}

/**
 * Upload a raw Buffer to Supabase Storage.
 */
async function uploadBufferToSupabase(buffer, mimeType, storagePath, bucket = BUCKET) {
  const client = getClient();
  if (!client) return null;

  try {
    const { error } = await client.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.warn('[supabaseStorage] upload error:', error.message);
      return null;
    }

    // Igual que en la de base64: en el cajón privado no hay dirección pública
    // que dar, y se devuelve la privada, que es la que se guarda.
    return bucket === BUCKET ? getPublicUrl(storagePath) : urlPrivada(storagePath, bucket);
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
 * La dirección de un fichero del cajón privado.
 *
 * No es pública: sin la clave de servicio no abre nada. Se guarda porque hace
 * falta saber dónde está el fichero, y quien lo quiera enseñar tiene que pasar
 * por una ruta con sesión que lo comprueba y firma la bajada.
 */
function urlPrivada(storagePath, bucket = BUCKET_PRIVADO) {
  const camino = String(storagePath || '').replace(/^\/+/, '');
  if (!SUPABASE_URL || !camino) return '';
  if (/^https?:\/\//i.test(camino)) return camino;
  return `${SUPABASE_URL}/storage/v1/object/${bucket}/${camino}`;
}

/**
 * El camino dentro del cajón privado que lleva una dirección guardada, o ''.
 *
 * Vale para las dos formas que hay en la base: la dirección entera y el camino
 * a secas, que es lo que devolvía `uploadBase64ToSupabase` para el cajón
 * privado antes de que se guardara la dirección completa.
 */
function caminoPrivado(url, bucket = BUCKET_PRIVADO) {
  const s = String(url || '').trim();
  if (!s) return '';
  const m = s.match(new RegExp(`/object/(?:authenticated/|sign/)?${bucket}/(.+)$`));
  if (m) return m[1].split('?')[0];
  // Sin dominio y sin `/object/`: es un camino suelto del cajón privado.
  return /^https?:\/\//i.test(s) ? '' : s.replace(/^\/+/, '');
}

/**
 * Sanitize a string to be safe as a file name component.
 */
function safeName(name = '') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

/**
 * Una URL que caduca, para dejar bajar un fichero del cajón privado.
 *
 * El cajón privado no tiene URL pública: esa es toda la gracia. Para que el
 * cliente se baje su informe hace falta una dirección firmada y con fecha de
 * caducidad, que se pide con la clave de servicio —desde el servidor, nunca
 * desde el navegador— y solo después de comprobar que el fichero es suyo.
 */
async function urlFirmada(camino, segundos = 300, bucket = BUCKET_PRIVADO) {
  const client = getClient();
  if (!client || !camino) return null;
  const { data, error } = await client.storage.from(bucket).createSignedUrl(String(camino), segundos);
  if (error) {
    console.error('[storage] no se pudo firmar la URL:', error.message);
    return null;
  }
  return (data && data.signedUrl) || null;
}

module.exports = {
  uploadBase64ToSupabase, uploadBufferToSupabase, getPublicUrl, safeName, urlFirmada,
  urlPrivada, caminoPrivado,
  BUCKET, BUCKET_PRIVADO,
};
