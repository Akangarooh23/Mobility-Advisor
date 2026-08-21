"use strict";

/**
 * `GET /api/modelo-3d/:vehicleId/coche.glb` y `…/coche.usdz` — público.
 *
 * El modelo 3D de un coche **publicado en el marketplace**, para que cualquier
 * visitante de la ficha pueda plantárselo en el garaje sin registrarse. Es el
 * mismo modelo que ve el dueño desde el IDCar; lo que cambia es la puerta.
 *
 * La puerta es que el coche esté listado. No hace falta sesión: si la ficha del
 * vehículo es pública, su volumen también lo es — enseña menos que las fotos
 * que ya están ahí.
 *
 * **Responde con una redirección, no con el fichero.** Un modelo con textura
 * pesa decenas de megas y por una función serverless no cabe. Se le pide a
 * CarsWise Check la dirección firmada del objeto y se reenvía al navegador
 * allí; esa URL caduca sola y no sirve para nada más.
 *
 * ---
 *
 * **Pendiente antes de que esto lo use gente de verdad: anonimizar el modelo.**
 *
 * Hoy sirve para un volumen genérico, que no lleva nada. Pero un escaneo real
 * del coche lleva la matrícula en la textura y las caras que se reflejaran en
 * la chapa al grabar, y esto lo publicaría sin preguntar. El invariante de que
 * el original nunca se sirve vale también en tres dimensiones: cuando entren
 * modelos escaneados, esta ruta tiene que exigir que estén anonimizados antes
 * de abrirlos al público.
 */

const { Pool } = require("pg");
const carswiseCheck = require("./carswise-check-client");

/** Estados con informe emitido, que es de donde sale el modelo. */
const LISTO = new Set(["informe_listo", "verificada", "publicada"]);

function normalizeText(v) {
  return typeof v === "string" ? v.trim() : "";
}

module.exports = async function vehicleModelPublicHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // La ficha pública identifica la oferta como `user_<id del vehículo>`; se
  // admiten las dos formas para no obligar a nadie a recortar la cadena.
  const bruto = normalizeText(req.query?.vehicleId);
  const vehicleId = bruto.startsWith("user_") ? bruto.slice(5) : bruto;
  const formato = normalizeText(req.query?.formato).toLowerCase() === "usdz" ? "usdz" : "glb";

  if (!vehicleId) return res.status(400).json({ error: "vehicleId requerido" });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
  try {
    const { rows } = await pool.query(
      `SELECT r.capture_session_id
         FROM moveadvisor_vehicle_condition_reports r
         JOIN moveadvisor_user_vehicle_states s ON s.vehicle_id = r.vehicle_id
        WHERE r.vehicle_id = $1
          AND COALESCE(s.is_listed, false) = true
          AND r.status = ANY($2::text[])
        ORDER BY r.updated_at DESC
        LIMIT 1`,
      [vehicleId, [...LISTO]]
    );

    const fila = rows[0];
    if (!fila) {
      // Mismo 404 si el coche no está publicado, no existe o no tiene informe:
      // distinguirlos convertiría esto en un oráculo de qué coches hay.
      return res.status(404).json({ error: "Ese vehículo no tiene modelo público" });
    }

    const modelo = await carswiseCheck.urlDelModelo3d(fila.capture_session_id, formato);
    if (!modelo.ok) {
      console.error("[modelo-3d] no se pudo resolver:", modelo.status, modelo.error);
      return res.status(502).json({ error: "No se ha podido cargar la vista en 3D." });
    }

    if (modelo.url) {
      // Se cachea poco: la URL de destino caduca y una copia intermedia vieja
      // dejaría al visitante con un enlace muerto.
      res.setHeader("Cache-Control", "public, max-age=60");
      res.writeHead(302, { Location: modelo.url });
      return res.end();
    }

    // Sin modelo propio, CarsWise genera el esquema al vuelo y sí cabe por aquí.
    const esquema = await carswiseCheck.descargarModelo3d(fila.capture_session_id, formato);
    if (!esquema.ok) {
      return res.status(502).json({ error: "No se ha podido cargar la vista en 3D." });
    }
    res.setHeader("Content-Type", esquema.contentType);
    res.setHeader("Content-Disposition", `inline; filename="coche.${esquema.extension}"`);
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(esquema.bytes);
  } catch (err) {
    console.error("[modelo-3d]", err?.message);
    return res.status(500).json({ error: "Error al cargar la vista en 3D" });
  } finally {
    try {
      await pool.end();
    } catch {}
  }
};
