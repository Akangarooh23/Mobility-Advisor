"use strict";

/**
 * Avisa por correo cuando un informe de estado queda listo.
 *
 * Va aquí y no en CarsWise Check por una razón sencilla: **el correo del cliente
 * lo tiene el marketplace**, no la aplicación de captura. Allí la sesión cuelga
 * del vehículo y el usuario es informativo; mandarle una copia de las direcciones
 * de correo solo para poder avisar sería duplicar datos personales en una segunda
 * base sin necesidad.
 *
 * Es un cron y no un webhook desde la captura porque este proyecto ya tiene ese
 * patrón montado —recordatorios de cita, alertas— y porque un aviso que llega
 * cinco minutos tarde no le importa a nadie. Un webhook añadiría un endpoint
 * público más que proteger a cambio de esos cinco minutos.
 *
 * El PDF se adjunta. Un enlace obligaría a iniciar sesión para ver lo que uno
 * acaba de pedir, y el informe es del usuario.
 */

const { Pool } = require("pg");
const carswiseCheck = require("./carswise-check-client");
const { MARCA } = require("../marca");

/** Estados en los que ya hay informe que enviar. */
const LISTO = new Set(["informe_listo", "verificada", "publicada"]);
/** Y aquellos en los que ya no hay nada que consultar. */
const CERRADOS = new Set(["caducada", "anulada"]);

/** Cuántos avisos por ejecución. El cron vuelve a pasar; la bandeja no. */
const MAX_POR_PASADA = 20;

function normalizeText(v) {
  return typeof v === "string" ? v.trim() : "";
}

function esc(v) {
  return normalizeText(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
}

function baseDelSitio() {
  return (normalizeText(process.env.PUBLIC_SITE_URL) || MARCA.sitioUrl).replace(
    /\/$/,
    ""
  );
}

/**
 * El correo.
 *
 * Dice dónde está el informe con la ruta exacta —IDCar, editar, informe de
 * estado— y no solo «entra en tu cuenta»: quien recibe esto ha fotografiado su
 * coche una vez en su vida y no sabe cómo se llaman nuestras pantallas.
 *
 * Sin precios y sin la palabra peritaje, como el propio documento: esto se
 * reenvía igual que el PDF.
 */
function construirCorreo(fila, pdfBase64) {
  const coche = [normalizeText(fila.brand), normalizeText(fila.model)].filter(Boolean).join(" ");
  const titulo = coche || "tu vehículo";
  const enlace = `${baseDelSitio()}/?volver=idcar`;

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
      <h1 style="font-size:20px;color:#12233F;margin:0 0 8px">El informe de estado de ${esc(titulo)} ya está listo</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55">
        Lo tienes adjunto en este correo, en PDF. Describe el estado aparente del coche a partir
        de las fotos que hiciste, con los daños situados sobre un esquema del vehículo.
      </p>

      <div style="background:#FDF6E7;border-radius:10px;padding:14px 16px;margin:0 0 20px">
        <p style="margin:0;font-size:13px;line-height:1.5;color:#8A5A00">
          <strong>Es una estimación visual, no una revisión mecánica.</strong> Motor, transmisión y
          estructura no se pueden valorar desde una fotografía y figuran como sin datos.
        </p>
      </div>

      <p style="margin:0 0 8px;font-size:14px">También puedes consultarlo cuando quieras en tu cuenta:</p>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563">
        <strong>IDCar</strong> → <strong>Gestionar</strong> → <strong>Informe de estado</strong>
      </p>

      <p style="margin:0 0 24px">
        <a href="${enlace}"
           style="display:inline-block;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;
                  text-decoration:none;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700">
          Ver mi informe en el IDCar
        </a>
      </p>

      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5">
        Las matrículas y las caras salen difuminadas en todo lo que se puede compartir.
        Las fotos originales no salen de nuestros servidores.
      </p>
    </div>`;

  return {
    subject: `El informe de estado de ${titulo} ya está listo`,
    html,
    attachments: [{ filename: "informe-de-estado.pdf", content: pdfBase64 }],
  };
}

async function enviar(destinatario, correo) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, motivo: "sin RESEND_API_KEY" };

  const from =
    normalizeText(process.env.RESEND_FROM_EMAIL) ||
    normalizeText(process.env.ALERT_EMAIL_FROM) ||
    MARCA.remitentePorDefecto;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: destinatario, ...correo }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return { ok: false, motivo: `Resend ${r.status}: ${err.message || ""}`.slice(0, 160) };
  }
  return { ok: true };
}

/**
 * Lo dispara Vercel Cron, y también se puede llamar a mano con la clave de
 * servicio cuando un aviso se atasca.
 */
function autorizado(req) {
  const interna = normalizeText(process.env.INTERNAL_API_KEY);
  const recibida = normalizeText(req.headers["x-internal-key"]);
  if (interna && recibida && recibida === interna) return true;
  const secreto = normalizeText(process.env.CRON_SECRET);
  if (secreto && req.headers.authorization === `Bearer ${secreto}`) return true;
  // Vercel firma sus cron; sin secreto configurado se acepta su cabecera.
  return !secreto && normalizeText(req.headers["user-agent"]).includes("vercel-cron");
}

module.exports = async function cronConditionReportReadyHandler(req, res) {
  if (!autorizado(req)) {
    return res.status(401).json({ error: "Credencial de servicio no válida" });
  }

  const pool = getPool();
  const enviados = [];

  try {
    // Solo expedientes sin avisar. Los ya cerrados no se consultan: no van a
    // producir un informe nuevo.
    const { rows } = await pool.query(
      `SELECT r.capture_session_id, r.vehicle_id, r.status, r.created_by_email,
              v.brand, v.model, v.user_email
         FROM moveadvisor_vehicle_condition_reports r
         LEFT JOIN moveadvisor_user_vehicles v ON v.id = r.vehicle_id
        WHERE r.notified_at IS NULL
          AND r.status <> ALL($1::text[])
        ORDER BY r.created_at ASC
        LIMIT $2`,
      [[...CERRADOS], MAX_POR_PASADA]
    );

    for (const fila of rows) {
      // El espejo puede estar desfasado: manda lo que diga la captura.
      let estado = normalizeText(fila.status);
      if (!LISTO.has(estado) && carswiseCheck.estaConfigurado()) {
        const consulta = await carswiseCheck.leerEstadoDeSesion(fila.capture_session_id);
        if (consulta.ok) {
          estado = normalizeText(consulta.datos?.status) || estado;
        } else if (consulta.status === 404) {
          // La sesión ya no existe al otro lado: se borró o se purgó. Sin esto
          // la fila se quedaba en "iniciada" y el cron volvía a preguntar por
          // ella cada quince minutos, para siempre.
          estado = "anulada";
        } else if (consulta.status === 410) {
          // Un 410 por token vencido no puede caducar un informe ya emitido:
          // el token protege el enlace de captura, no el documento. Aquí solo
          // llegan filas sin avisar, pero la regla se respeta igual.
          const cancelada = consulta.error === "SESSION_CANCELLED";
          if (cancelada || !LISTO.has(estado)) estado = cancelada ? "anulada" : "caducada";
        }
        if (estado !== normalizeText(fila.status)) {
          await pool
            .query(
              `UPDATE moveadvisor_vehicle_condition_reports
                  SET status = $2, status_checked_at = NOW(), updated_at = NOW()
                WHERE capture_session_id = $1`,
              [fila.capture_session_id, estado]
            )
            .catch(() => {});
        }
      }
      if (!LISTO.has(estado)) continue;

      const destinatario =
        normalizeText(fila.created_by_email) || normalizeText(fila.user_email);
      if (!destinatario) {
        enviados.push({ session: fila.capture_session_id, ok: false, motivo: "sin correo" });
        continue;
      }

      const pdf = await carswiseCheck.descargarInformePdf(fila.capture_session_id);
      if (!pdf.ok) {
        // Sin PDF no se manda un correo a medias, y tampoco se marca como
        // avisado: la próxima pasada volverá a intentarlo.
        enviados.push({ session: fila.capture_session_id, ok: false, motivo: `pdf ${pdf.status}` });
        continue;
      }

      const resultado = await enviar(
        destinatario,
        construirCorreo(fila, pdf.bytes.toString("base64"))
      );
      if (!resultado.ok) {
        enviados.push({ session: fila.capture_session_id, ok: false, motivo: resultado.motivo });
        continue;
      }

      // Se marca DESPUÉS de que Resend acepte. Marcarlo antes convertiría un
      // fallo de envío en un aviso que nunca llega y que nadie reintenta.
      await pool.query(
        `UPDATE moveadvisor_vehicle_condition_reports
            SET notified_at = NOW(), updated_at = NOW()
          WHERE capture_session_id = $1`,
        [fila.capture_session_id]
      );
      enviados.push({ session: fila.capture_session_id, ok: true });
    }

    return res.status(200).json({ revisados: rows.length, enviados });
  } catch (err) {
    console.error("[cron-condition-report-ready]", err?.message);
    return res.status(500).json({ error: "Error al avisar de los informes listos" });
  } finally {
    try {
      await pool.end();
    } catch {}
  }
};
