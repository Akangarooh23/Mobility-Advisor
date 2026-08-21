"use strict";

/**
 * Lo que un coche **publicado en el marketplace** enseña sin pedir registro:
 *
 *   GET /api/modelo-3d/:vehicleId/coche.glb    el volumen, para Android
 *   GET /api/modelo-3d/:vehicleId/coche.usdz   el volumen, para iOS
 *   GET /api/informe-publico/:vehicleId/informe-de-estado.pdf
 *
 * Es lo mismo que ve el dueño desde el IDCar; lo que cambia es la puerta.
 *
 * El informe se sirve entero y sin recortar porque está escrito para esto: es
 * el documento que el vendedor enseña al comprador. No lleva bastidor, y sus
 * fotos son las anonimizadas — las matrículas y las caras vienen tapadas de
 * origen. La matrícula del titular sí aparece en la cabecera, igual que ya
 * aparece en las fotos del anuncio.
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
  const pedido = normalizeText(req.query?.formato).toLowerCase();
  const formato =
    pedido === "usdz" || pedido === "pdf" || pedido === "info" ? pedido : "glb";

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

    /**
     * `?formato=info` solo dice si hay informe.
     *
     * La ficha lo pregunta antes de pintar nada: sin esto, un coche sin informe
     * enseñaba igualmente el botón de realidad aumentada y el visitante se
     * encontraba con un visor vacío. Es una consulta a la base y ninguna
     * llamada a CarsWise.
     */
    if (formato === "info") {
      res.setHeader("Cache-Control", "public, max-age=120");
      return res.status(200).json({ ok: true, informe: rows.length > 0 });
    }

    const fila = rows[0];
    if (!fila) {
      // Mismo 404 si el coche no está publicado, no existe o no tiene informe:
      // distinguirlos convertiría esto en un oráculo de qué coches hay.
      return res.status(404).json({ error: "Ese vehículo no tiene modelo público" });
    }

    if (formato === "pdf") {
      // Cabe por aquí: el documento ronda el mega, no las decenas.
      const pdf = await carswiseCheck.descargarInformePdf(fila.capture_session_id);
      if (!pdf.ok) {
        console.error("[informe-publico] no se pudo descargar:", pdf.status, pdf.error);
        return res.status(502).json({ error: "No se ha podido descargar el informe." });
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="informe-de-estado.pdf"');
      // Se genera del informe vigente: si el informe cambia, el documento
      // cambia con él, así que poca caché.
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.status(200).send(pdf.bytes);
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
