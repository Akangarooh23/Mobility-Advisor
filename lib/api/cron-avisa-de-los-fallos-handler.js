"use strict";

const { elPoolObligatorio } = require("../postgres");
const { cronAutorizado } = require("../cron-autorizado");
const { MARCA, remitente, respuestaA, correoInterno } = require("../marca");
const { plantilla, parrafo, boton, textoPlano, esc } = require("../correo");

/**
 * El aviso de que algo se ha roto, una vez por hora.
 *
 * ## Por qué esto es la pieza que faltaba
 *
 * Guardar los fallos en una tabla no sirve de nada por sí solo: nadie abre una
 * tabla por gusto. Lo que convierte las filas en información es esto —agrupar,
 * contar y avisar— y es exactamente lo que se paga en Sentry.
 *
 * ## Solo de lo nuevo, y eso es lo importante
 *
 * Un aviso que llega siempre se deja de leer en una semana. Así que solo se avisa
 * de **huellas de las que no se ha avisado todavía**: la primera vez que aparece
 * un fallo, y no las cuatrocientas siguientes.
 *
 * Y cuando se avisa, se marca la huella como avisada. Eso hace que el correo
 * conteste a la pregunta que de verdad importa —«¿ha aparecido algo nuevo?»— en
 * vez de a «¿cuántos errores hay?», que es un número que nunca baja y que por eso
 * no dice nada.
 *
 * ## Lo que lleva el correo
 *
 * Por cada fallo nuevo: cuántas veces, **a cuánta gente distinta**, desde cuándo,
 * y de qué lado viene. «A cuánta gente» es el dato que separa «un móvil raro» de
 * «esto le pasa a todo el mundo», y es la diferencia entre mirarlo el lunes y
 * mirarlo ahora.
 */

/** Cuántos fallos distintos caben en un correo antes de resumir. */
const CABEN = 15;

/** Cuánto atrás se mira. Un poco más que la hora del cron, por si se salta una. */
const HORAS = 3;

let _pool = null;
function elPool() {
  if (!_pool) _pool = elPoolObligatorio();
  return _pool;
}

async function mandaElCorreo(para, asunto, html) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[cron-fallos] Sin RESEND_API_KEY — correo a ${para}: ${asunto}`);
    return true;
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(),
      reply_to: respuestaA(),
      to: [para],
      subject: asunto,
      html,
      text: textoPlano(html),
    }),
  });

  if (!resp.ok) {
    const cuerpo = await resp.text().catch(() => "");
    console.error(`[cron-fallos] Resend ${resp.status}: ${cuerpo}`);
  }

  return resp.ok;
}

function comoSeCuenta(fila) {
  const veces = Number(fila.veces || 0);
  const personas = Number(fila.personas || 0);
  const trozos = [`${veces} ${veces === 1 ? "vez" : "veces"}`];

  /*
   * «A cuánta gente» solo se dice cuando se sabe: un fallo del servidor sin
   * sesión no tiene a quién atribuirse, y poner «0 personas» haría pensar que no
   * afectó a nadie.
   */
  if (personas > 0) trozos.push(`${personas} ${personas === 1 ? "persona" : "personas"}`);
  trozos.push(fila.lado === "navegador" ? "en el navegador" : "en el servidor");

  return trozos.join(" · ");
}

module.exports = async function cronAvisaDeLosFallosHandler(req, res) {
  if (!cronAutorizado(req)) return res.status(401).json({ error: "No autorizado" });

  /*
   * A quién se avisa ya lo sabe `correoInterno()`, que es lo que usan los demás
   * avisos internos y que ya se queja una vez en el registro si no hay ninguno.
   * Una variable de entorno menos que configurar y que olvidar.
   */
  const paraQuien = correoInterno();
  if (!paraQuien) {
    return res.status(200).json({ ok: true, avisados: 0, motivo: "sin destinatario" });
  }

  const pool = elPool();

  try {
    /*
     * Las huellas con algo sin avisar, agrupadas. `personas` cuenta correos
     * distintos —ya tapados— y por eso dice a cuánta gente le pasa sin guardar
     * quién es.
     */
    const { rows } = await pool.query(
      `SELECT huella,
              MIN(donde)                        AS donde,
              MIN(mensaje)                      AS mensaje,
              COUNT(*)                          AS veces,
              COUNT(DISTINCT quien)             AS personas,
              MIN(cuando)                       AS desde,
              MAX(cuando)                       AS hasta,
              MIN(lado)                         AS lado,
              MIN(pantalla)                     AS pantalla
         FROM moveadvisor_errores
        WHERE avisado_en IS NULL
          AND cuando > NOW() - ($1 || ' hours')::interval
        GROUP BY huella
        ORDER BY COUNT(*) DESC`,
      [String(HORAS)]
    );

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, avisados: 0 });
    }

    const tarjetas = rows
      .slice(0, CABEN)
      .map((fila) => {
        const cuando = new Date(fila.desde).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
        return (
          parrafo(`<strong>${esc(fila.donde)}</strong>`, 14) +
          parrafo(esc(String(fila.mensaje || "").slice(0, 300)), 13) +
          parrafo(
            `${comoSeCuenta(fila)} · desde ${esc(cuando)}` +
              (fila.pantalla ? ` · pantalla <strong>${esc(fila.pantalla)}</strong>` : ""),
            12
          )
        );
      })
      .join("<hr />");

    const resto = rows.length - Math.min(rows.length, CABEN);

    const html = plantilla({
      titulo: `${rows.length} ${rows.length === 1 ? "fallo nuevo" : "fallos nuevos"}`,
      cuerpo:
        parrafo(
          `Esto es lo que ha aparecido y no se había visto antes, de las últimas ${HORAS} horas.`,
          14
        ) +
        tarjetas +
        (resto > 0 ? parrafo(`Y ${resto} más que no caben aquí.`, 13) : "") +
        boton("Verlos en el ERP", `${process.env.ERP_BASE_URL || ""}/errores`),
      pie: `Un aviso por hora, y solo de lo nuevo: de lo ya avisado no se vuelve a escribir. ${MARCA.nombre}`,
    });

    await mandaElCorreo(
      paraQuien,
      `[${MARCA.nombre}] ${rows.length} ${rows.length === 1 ? "fallo nuevo" : "fallos nuevos"}`,
      html
    );

    /*
     * Y se marcan, para que el siguiente correo hable de lo siguiente.
     *
     * Se marca DESPUÉS de mandarlo: si el correo falla, no se marcan y el próximo
     * intento lo vuelve a incluir. Al revés se perdería el aviso justo el día que
     * Resend tenga un problema.
     */
    await pool.query(
      `UPDATE moveadvisor_errores
          SET avisado_en = NOW()
        WHERE avisado_en IS NULL
          AND huella = ANY($1::text[])`,
      [rows.map((f) => f.huella)]
    );

    return res.status(200).json({ ok: true, avisados: rows.length });
  } catch (error) {
    console.error(`[cron-fallos] error: ${error?.message || error}`);
    return res.status(500).json({ error: "No se pudo avisar de los fallos" });
  }
};

module.exports.CABEN = CABEN;
module.exports.HORAS = HORAS;
