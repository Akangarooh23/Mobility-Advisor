const { Pool } = require("pg");
const authHandler = require("../../api/auth");

function nt(v) { return typeof v === "string" ? v.trim() : String(v ?? "").trim(); }

/**
 * Lo que se deja subir, por extensión.
 *
 * La interfaz solo ofrece `.pdf,image/*`, pero eso es una sugerencia del
 * navegador: quien llame a mano puede mandar lo que quiera. Y el depósito sirve
 * los ficheros en abierto, así que un `.html` o un `.svg` subidos aquí serían
 * una página alojada en nuestro dominio de almacenamiento, lista para un engaño.
 *
 * Se filtra por extensión y no por el tipo declarado porque el tipo lo pone el
 * cliente y muchos navegadores mandan `application/octet-stream` cuando no
 * saben: fiarse de él dejaría fuera fotos legítimas y dentro cualquier cosa.
 */
const EXTENSIONES = new Set([
  "pdf",
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "avif", "bmp", "tif", "tiff",
]);

function extensionDe(nombre) {
  const punto = String(nombre).lastIndexOf(".");
  return punto < 0 ? "" : String(nombre).slice(punto + 1).toLowerCase();
}

function getPool() {
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return cadena ? new Pool({ connectionString: cadena }) : null;
}

/**
 * ¿Ese vehículo es de quien lo pide?
 *
 * Antes no se preguntaba: se cogía el `vehicleId` tal como venía y se armaba la
 * ruta con él, así que cualquiera con cuenta podía escribir dentro de la carpeta
 * de otro. Hace falta conocer el identificador —un UUID, no se adivina—, pero
 * eso es un obstáculo, no un permiso.
 *
 * Es la misma comprobación que hace el descargador del informe antes de servir
 * un PDF.
 */
async function esSuyo(vehicleId, email) {
  const pool = getPool();
  if (!pool) return false;
  try {
    const { rowCount } = await pool.query(
      `SELECT 1
         FROM moveadvisor_user_vehicles v
         LEFT JOIN moveadvisor_users u ON lower(u.email) = $1
        WHERE v.id = $2 AND (lower(v.user_email) = $1 OR v.user_id = u.id)
        LIMIT 1`,
      [email, vehicleId]
    );
    return rowCount > 0;
  } catch {
    return false;
  } finally {
    pool.end().catch(() => {});
  }
}

module.exports = async function storagePresignHandler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const email = nt(sessionPayload?.user?.email).toLowerCase();
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const { fileName, vehicleId, fileType } = req.body || {};
  if (!nt(fileName)) return res.status(400).json({ error: "fileName required" });

  if (!EXTENSIONES.has(extensionDe(nt(fileName)))) {
    return res.status(415).json({ error: "tipo_de_fichero_no_admitido" });
  }

  if (nt(vehicleId) && !(await esSuyo(nt(vehicleId), email))) {
    return res.status(403).json({ error: "vehiculo_no_encontrado" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: "storage_not_configured" });
  }

  const BUCKET = "vehicle-files";
  const safeName = (name) => String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const safeVehicleId = nt(vehicleId) ? safeName(nt(vehicleId)) : email.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeFileType = nt(fileType) ? safeName(nt(fileType)) : "documents";
  const path = `vehicles/${safeVehicleId}/${safeFileType}/${Date.now()}_${safeName(nt(fileName))}`;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return res.status(500).json({ error: "presign_failed", detail });
    }

    const data = await response.json();
    const signedUrl = `${SUPABASE_URL}${data.url}`;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    return res.json({ signedUrl, publicUrl });
  } catch (err) {
    return res.status(500).json({ error: "presign_error", detail: err?.message });
  }
};
