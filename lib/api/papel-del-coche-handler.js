/**
 * Un papel del coche, servido a quien es su dueño y a nadie más.
 *
 * Los papeles del garaje —permiso de circulación, ficha técnica, ITV y lo que se
 * suba como documento— iban al cubo público del almacén, el mismo que las fotos
 * del anuncio. Con la dirección delante se abrían sin sesión, y la dirección
 * viajaba en la respuesta del panel y de la app. Un permiso de circulación lleva
 * matrícula, bastidor y el nombre del titular.
 *
 * Ahora van al cubo privado y esta es la única puerta: se comprueba que el coche
 * es de quien lo pide y se firma una dirección que caduca en cinco minutos.
 *
 * Lo de antes sigue abriendo. Hay papeles guardados con su dirección pública, y
 * romper el enlace de un cliente para arreglar la seguridad de un cubo sería
 * cambiar un problema por otro: con esos se hace un reenvío. Se irán quedando
 * atrás solos, y los que ya están se mudan con
 * `scripts/muda-los-papeles-al-cajon-privado.mjs`.
 */
const { Pool } = require("pg");
const { identidadDeLaPeticion } = require("./identidad");
const { urlFirmada, caminoPrivado } = require("../supabaseStorage");

function nt(v) {
  return typeof v === "string" ? v.trim() : String(v ?? "").trim();
}

function getPool() {
  const cadena = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return cadena ? new Pool({ connectionString: cadena }) : null;
}

/**
 * ¿Ese coche es de quien lo pide?
 *
 * La misma pregunta que hace el firmador de subidas, y por el mismo motivo: el
 * identificador del coche es un obstáculo, no un permiso.
 */
async function esSuyo(pool, vehicleId, email) {
  const { rowCount } = await pool.query(
    `SELECT 1
       FROM moveadvisor_user_vehicles v
       LEFT JOIN moveadvisor_users u ON lower(u.email) = $1
      WHERE v.id = $2 AND (lower(v.user_email) = $1 OR v.user_id = u.id)
      LIMIT 1`,
    [email, vehicleId]
  );
  return rowCount > 0;
}

/**
 * ¿Ese camino es de ese coche, y está guardado de verdad?
 *
 * Dos cosas, y las dos hacen falta. Que el camino empiece por la carpeta del
 * coche evita que con un coche propio se pida el papel de otro. Y que el camino
 * esté en la base evita que valga cualquier cosa que se escriba: se sirve lo que
 * hay guardado, no lo que se pida.
 */
async function estaGuardado(pool, vehicleId, camino) {
  const comoSeGuarda = `%${camino}`;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM moveadvisor_user_vehicle_files
       WHERE vehicle_id = $1 AND file_url <> '' AND file_url LIKE $2
     UNION ALL
     SELECT 1 FROM moveadvisor_user_vehicle_documents
       WHERE vehicle_id = $1 AND file_url <> '' AND file_url LIKE $2
     LIMIT 1`,
    [vehicleId, comoSeGuarda]
  );
  return rowCount > 0;
}

module.exports = async function papelDelCocheHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = await identidadDeLaPeticion(req);
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const vehicleId = nt(req.query?.coche);
  const camino = nt(req.query?.camino).replace(/^\/+/, "");
  if (!vehicleId || !camino) {
    return res.status(400).json({ error: "faltan_datos" });
  }
  // Ni subir de carpeta ni salir de la del coche.
  if (camino.includes("..") || !camino.startsWith(`vehicles/${vehicleId}/`)) {
    return res.status(400).json({ error: "camino_no_valido" });
  }

  const pool = getPool();
  if (!pool) return res.status(503).json({ error: "sin_base_de_datos" });

  try {
    if (!(await esSuyo(pool, vehicleId, email))) {
      return res.status(403).json({ error: "coche_no_encontrado" });
    }
    if (!(await estaGuardado(pool, vehicleId, camino))) {
      return res.status(404).json({ error: "papel_no_encontrado" });
    }

    const url = await urlFirmada(caminoPrivado(camino) || camino, 300);
    if (!url) return res.status(502).json({ error: "no_se_puede_firmar" });

    res.setHeader("Cache-Control", "private, no-store");

    /*
     * Para la app, la dirección; para el panel, el reenvío.
     *
     * En el móvil la sesión va en una cabecera, y una cabecera no viaja en un
     * `<a href>` ni en un `<img src>`: el reenvío llegaría sin sesión y la app
     * vería un 401. Así que la app pide `json=1`, se lleva la dirección firmada
     * —que lleva su propia llave dentro— y la usa donde la necesite.
     *
     * En el navegador la sesión es una cookie y el reenvío funciona solo, que es
     * mejor: el enlace de la pantalla no enseña nunca la dirección del almacén.
     */
    if (nt(req.query?.json)) return res.json({ url });

    // Un reenvío, no el fichero: así el almacén sirve los bytes y esta función
    // no se traga un PDF de veinte megas en memoria para volver a escupirlo.
    return res.redirect(302, url);
  } catch (err) {
    console.error("[papel-del-coche]", err?.message);
    return res.status(500).json({ error: "papel_failed" });
  } finally {
    pool.end().catch(() => {});
  }
};
