const { Pool } = require("pg");
const { MARCA, remitente, respuestaA } = require("../marca");
const { deReserva } = require("../citas");
const { plantilla, parrafo, datos, boton, enlace } = require("../correo");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 3, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function formatDate(dateVal) {
  try {
    const iso = dateVal instanceof Date
      ? dateVal.toISOString().slice(0, 10)
      : String(dateVal).slice(0, 10);
    return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return String(dateVal);
  }
}

async function sendEmail(lead, type) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = remitente();
  if (!apiKey) return;

  const apptDate = formatDate(lead.appointment_date);

  // Los datos de la cita, iguales en los tres.
  const cita = datos([
    ["Fecha", esc(apptDate)],
    ["Hora", esc(lead.appointment_time)],
    ["Dirección", esc(lead.appointment_address)],
    ["Pregunta por", esc(lead.appointment_contact)],
  ]);

  const hola = parrafo(`Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,`);
  // Que sea «la visita para ver el coche» o «tu cita» depende de para qué es.
  //
  // Los avisos se mandaban solo a las visitas, porque el texto era de visita.
  // Pero la condicion que importa es que haya una cita confirmada con fecha:
  // si un trabajador queda con alguien para entregarle un coche de importacion,
  // ese cliente merece el mismo aviso. Lo que cambia es como se le llama.
  const esVisita = String(lead.lead_type || "visit") === "visit";
  const loQueEs = esVisita ? "la visita para ver" : "tu cita por";

  /*
   * Una entrega a domicilio muchas veces no tiene hora, y no es un descuido.
   *
   * La pone el conductor el mismo dia, cuando llama antes de llegar: nosotros
   * sabemos el dia porque nos lo dio el transportista al aceptar el viaje, y la
   * hora no la sabe nadie todavia.
   *
   * Sin decirlo, el cliente recibe un recordatorio de una cita sin hora y la
   * pregunta es inmediata. Con esto, la respuesta ya esta en el correo. Y se
   * dice solo cuando falta la hora: repetirlo con una hora escrita al lado
   * haria dudar de la hora.
   */
  const sinHora = !esVisita && !String(lead.appointment_time || "").trim();
  const loDeLaHora = sinHora
    ? parrafo("La hora exacta la pone el transportista: te llama antes de llegar. Tiene que haber alguien para recibir el coche y firmar la entrega.", 14)
    : "";
  // Una visita reservada con el calendario no se gestiona desde el panel de
  // solicitudes: tiene su propia pagina, con el testigo que le permite mover o
  // anular la cita sin contrasena.
  const gestionar = enlace("Gestionar mi cita", lead.gestionar_url || `${MARCA.sitioUrl}/panel/solicitudes`);

  let html, subject;

  if (type === "day_before") {
    subject = `Tu cita es mañana — ${lead.vehicle_title || MARCA.nombre}`;
    html = plantilla({
      titulo: "Tu cita es mañana",
      cuerpo:
        hola +
        parrafo(`Mañana tienes ${loQueEs} <strong>${esc(lead.vehicle_title)}</strong>.`) +
        cita +
        loDeLaHora +
        parrafo("Si necesitas cancelar o cambiar la fecha, puedes hacerlo desde tu panel antes de la cita.", 14) +
        gestionar,
    });
  } else if (type === "day_of") {
    subject = `Tu cita es hoy — ${lead.vehicle_title || MARCA.nombre}`;
    html = plantilla({
      titulo: "Tu cita es hoy",
      cuerpo:
        hola +
        parrafo(`Hoy tienes ${loQueEs} <strong>${esc(lead.vehicle_title)}</strong>. Te esperamos.`) +
        cita +
        loDeLaHora +
        gestionar,
    });
  } else if (type === "followup") {
    subject = esVisita
      ? `¿Qué tal fue la visita? — ${lead.vehicle_title || MARCA.nombre}`
      : `¿Qué tal fue? — ${lead.vehicle_title || MARCA.nombre}`;
    html = plantilla({
      titulo: esVisita ? "¿Qué tal fue la visita?" : "¿Qué tal fue?",
      cuerpo:
        hola +
        parrafo(`Esperamos que ${loQueEs} <strong>${esc(lead.vehicle_title)}</strong> fuera bien.`) +
        parrafo("Si quieres seguir adelante o te ha quedado alguna duda, respóndenos a este correo y lo vemos.") +
        // Quien reservo con el calendario puede no tener cuenta: mandarle al
        // panel de solicitudes es mandarle a una pagina que no es suya.
        boton("Hablar con el equipo", lead.gestionar_url || `${MARCA.sitioUrl}/panel/solicitudes`) +
        (lead.gestionar_url
          ? ""
          : parrafo("Y si has decidido no seguir, puedes cancelar la solicitud desde tu panel cuando quieras.", 14)),
    });
  }


  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, reply_to: respuestaA(), to: lead.user_email, subject, html }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${err.message || JSON.stringify(err)}`);
  }
}

/**
 * Las reservas que toca avisar hoy.
 *
 * Solo las confirmadas: una pendiente es una solicitud sobre un horario que
 * nadie ha publicado, y recordarle a alguien una cita que todavia no le hemos
 * dado es peor que no decirle nada.
 */
async function reservasQueAvisar(pool, columna, condicionFecha) {
  const { rows } = await pool.query(
    `SELECT id, buyer_email, buyer_name, vehicle_title, starts_at, token_buyer, meeting_place, meeting_contact
       FROM vehicle_visit_bookings
      WHERE status = 'confirmed'
        AND ${condicionFecha}
        AND ${columna} IS NULL
        AND COALESCE(buyer_email, '') <> ''`
  );
  return rows;
}

/**
 * Quién puede disparar esta tarea. Mismo criterio que las otras dos: con
 * `CRON_SECRET` puesto se exige, y sin él solo pasa la llamada de Vercel Cron.
 *
 * Antes la condición estaba al revés —`if (cronSecret && ...)`—, así que no
 * tener la variable configurada dejaba la dirección abierta sin avisar.
 */
function autorizado(req) {
  const secreto = String(process.env.CRON_SECRET || "").trim();
  if (secreto) return String(req.headers?.authorization || "") === `Bearer ${secreto}`;
  return String(req.headers?.["user-agent"] || "").toLowerCase().includes("vercel-cron");
}

module.exports = async function cronAppointmentReminders(req, res) {
  if (!autorizado(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pool = getPool();

  let leadsTomorrow, leadsToday, leadsYesterday;
  try {
    const [r1, r2, r3] = await Promise.all([
      // 24h reminder: appointment is tomorrow
      //
      // Vale también para una entrega de importación.
      //
      // Antes solo se miraba «Cita confirmada», y ese no es un estado por el que
      // pase una importación: sus etapas son las suyas. Para que el cliente
      // recibiera el aviso había que sacar el expediente de su etapa, y entonces
      // desaparecía del tablero de Importaciones. Lo que importa no es el estado
      // sino que haya un día apalabrado.
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title, lead_type,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE (status = 'Cita confirmada' OR lead_type = 'import')
          AND appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND reminder_sent_at IS NULL
          AND user_email <> ''
      `),
      // Same-day reminder: appointment is today. Igual: también las entregas.
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title, lead_type,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE (status = 'Cita confirmada' OR lead_type = 'import')
          AND appointment_date = CURRENT_DATE
          AND reminder_day_of_sent_at IS NULL
          AND user_email <> ''
      `),
      // Post-visit: appointment date has passed → mark as "Visita realizada" + send follow-up
      //
      // Aquí las importaciones se quedan fuera, a propósito. Este paso cambia el
      // estado, y a un expediente de importación lo dejaría en «En proceso», que
      // no es ninguna de sus etapas: se saldría del tablero. Además ya tiene su
      // correo propio cuando se marca Entregado, que dice lo que hay que decir.
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title, lead_type,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE status = 'Cita confirmada'
          AND appointment_date < CURRENT_DATE
          AND followup_sent_at IS NULL
          AND user_email <> ''
      `),
    ]);
    leadsTomorrow  = r1.rows;
    leadsToday     = r2.rows;
    leadsYesterday = r3.rows;
  } catch (err) {
    console.error("[cron-reminders] DB query error:", err.message);
    return res.status(500).json({ error: "DB error", detail: err.message });
  }

  const results = [];

  for (const lead of leadsTomorrow) {
    try {
      await sendEmail(lead, "day_before");
      await pool.query(`UPDATE moveadvisor_market_leads SET reminder_sent_at = NOW() WHERE id = $1`, [lead.id]);
      results.push({ id: lead.id, type: "day_before", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "day_before", ok: false, error: err.message });
      console.error(`[cron-reminders] day_before error for ${lead.id}:`, err.message);
    }
  }

  for (const lead of leadsToday) {
    try {
      await sendEmail(lead, "day_of");
      await pool.query(`UPDATE moveadvisor_market_leads SET reminder_day_of_sent_at = NOW() WHERE id = $1`, [lead.id]);
      results.push({ id: lead.id, type: "day_of", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "day_of", ok: false, error: err.message });
      console.error(`[cron-reminders] day_of error for ${lead.id}:`, err.message);
    }
  }

  for (const lead of leadsYesterday) {
    try {
      // El estado de despues, con el nombre que le toque: a una solicitud de
      // importacion no se le puede poner «Visita realizada», porque no la hubo.
      const hecha = String(lead.lead_type || "visit") === "visit" ? "Visita realizada" : "En proceso";
      await Promise.all([
        pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = $2, followup_sent_at = NOW()
           WHERE id = $1`,
          [lead.id, hecha]
        ),
        sendEmail(lead, "followup"),
      ]);
      results.push({ id: lead.id, type: "followup", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "followup", ok: false, error: err.message });
      console.error(`[cron-reminders] followup error for ${lead.id}:`, err.message);
    }
  }

  // ── Y las visitas reservadas desde el marketplace ─────────────────────────
  //
  // Viven en otra tabla y hasta ahora no recibian ningun aviso: el cron solo
  // miraba los leads. Se recorren igual, con las mismas plantillas, y cada envio
  // deja su marca para no repetirse.
  const DE_RESERVAS = [
    ["day_before", "reminder_sent_at",        "starts_at::date = CURRENT_DATE + 1"],
    ["day_of",     "reminder_day_of_sent_at", "starts_at::date = CURRENT_DATE"],
    // Con ventana: sin ella, la primera vez que esto corra saldria un «¿que tal
    // fue la visita?» a todo el que tenga una reserva pasada sin avisar —hay una
    // de hace un mes—. Y un seguimiento a destiempo no es un seguimiento.
    ["followup",   "followup_sent_at",        "starts_at < NOW() AND starts_at > NOW() - INTERVAL '3 days'"],
  ];

  for (const [tipo, columna, condicion] of DE_RESERVAS) {
    let reservas = [];
    try {
      reservas = await reservasQueAvisar(pool, columna, condicion);
    } catch (err) {
      console.error(`[cron-reminders] no se han podido leer las reservas (${tipo}):`, err.message);
      continue;
    }
    for (const reserva of reservas) {
      try {
        await sendEmail(deReserva(reserva, { sitioUrl: MARCA.sitioUrl }), tipo);
        await pool.query(
          `UPDATE vehicle_visit_bookings SET ${columna} = NOW() WHERE id = $1`,
          [reserva.id]
        );
        results.push({ id: reserva.id, type: tipo, origen: "reserva", ok: true });
      } catch (err) {
        results.push({ id: reserva.id, type: tipo, origen: "reserva", ok: false, error: err.message });
        console.error(`[cron-reminders] ${tipo} de la reserva ${reserva.id}:`, err.message);
      }
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
};
