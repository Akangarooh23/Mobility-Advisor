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

  const safeName = (name) => String(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const safeVehicleId = nt(vehicleId) ? safeName(nt(vehicleId)) : email.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeFileType = nt(fileType) ? safeName(nt(fileType)) : "documents";
  const path = `vehicles/${safeVehicleId}/${safeFileType}/${Date.now()}_${safeName(nt(fileName))}`;

  /*
   * Las fotos a un cajón, los papeles al otro.
   *
   * `vehicle-files` es público y tiene que serlo: de ahí se sirven las fotos de
   * los anuncios, por URL directa y sin sesión. Pero por esta misma ruta subía
   * el permiso de circulación, la ficha técnica y la ITV, y acababan en el mismo
   * sitio: con la dirección —que viaja en el panel y en la app— cualquiera abría
   * el permiso de circulación de un coche ajeno, con su matrícula, su bastidor y
   * el nombre del titular. Sin sesión ninguna.
   *
   * `erp-documentos` es privado: para verlo hay que pasar por
   * `papel-del-coche-handler.js`, que comprueba que el coche es de quien lo pide
   * y firma una dirección que caduca en cinco minutos.
   */
  const SOLO_LAS_FOTOS = new Set(["photos", "photo", "fotos"]);
  const alCajonPublico = SOLO_LAS_FOTOS.has(safeFileType.toLowerCase());
  const BUCKET = alCajonPublico ? "vehicle-files" : "erp-documentos";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${path}`,
      {
        method: "POST",
        headers: {
          // Sin `apikey` la clave nueva de Supabase (sb_secret_…) no vale: no es
          // un JWT y Storage contesta «Invalid Compact JWS».
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        /*
         * El cuerpo vacío, pero cuerpo.
         *
         * Se declaraba `application/json` y no se mandaba nada, y Storage
         * contesta 400: «Body cannot be empty when content-type is set to
         * application/json». De ahí salía el 500 de esta ruta.
         *
         * Y no se notaba porque quien la llama se lo traga: `uploadFileDirect`
         * devuelve `null` ante cualquier fallo y el guardado sigue por el
         * camino de respaldo, mandando el fichero entero en base64 a través de
         * la API. Funciona —por eso los papeles acababan guardados— pero es el
         * camino lento, y el que se rompe con un fichero grande.
         */
        body: "{}",
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return res.status(500).json({ error: "presign_failed", detail });
    }

    const data = await response.json();
    /*
     * La direccion de subida, entera.
     *
     * Storage la devuelve **relativa a `/storage/v1`**:
     * `/object/upload/sign/<bucket>/<ruta>?token=…`. Pegandola al dominio a
     * secas sale `https://…supabase.co/object/upload/sign/…`, que no existe:
     * contesta 404 y —esto es lo que costaba de ver— **sin cabeceras de
     * CORS**, asi que el navegador no dice «404», dice «Failed to fetch». En la
     * app eso era un error en pantalla al subir una foto; en la web no se
     * notaba porque `uploadFileDirect` se traga el fallo y sigue por el camino
     * de respaldo, mandando el fichero entero en base64.
     *
     * Se contempla que un dia devuelva la direccion completa: si ya trae el
     * dominio o el prefijo, no se le pone otro encima.
     */
    const relativa = String(data?.url || "");
    const signedUrl = /^https?:\/\//i.test(relativa)
      ? relativa
      : `${SUPABASE_URL}${relativa.startsWith("/storage/v1") ? "" : "/storage/v1"}${relativa}`;
    /*
     * La dirección con la que se guarda el fichero.
     *
     * Para una foto es la pública de siempre. Para un papel es la **privada**
     * —`/object/<cubo>/…`, sin `public`—, que sola no abre nada: quien la lea
     * en la base o en la respuesta no se lleva el documento. Se sigue llamando
     * `publicUrl` porque es el campo que leen el panel y la app; cambiarle el
     * nombre aquí sería romper las dos subidas por un asunto de estilo.
     */
    const publicUrl = alCajonPublico
      ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
      : `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

    return res.json({ signedUrl, publicUrl });
  } catch (err) {
    return res.status(500).json({ error: "presign_error", detail: err?.message });
  }
};
