const { Pool } = require("pg");

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
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey) return;

  const apptDate = formatDate(lead.appointment_date);

  const apptBlock = `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin:20px 0">
      <p style="margin:4px 0">📅 <strong>${esc(apptDate)}</strong></p>
      ${lead.appointment_time    ? `<p style="margin:4px 0">⏰ <strong>${esc(lead.appointment_time)}</strong></p>` : ""}
      ${lead.appointment_address ? `<p style="margin:4px 0">📍 ${esc(lead.appointment_address)}</p>` : ""}
      ${lead.appointment_contact ? `<p style="margin:4px 0">👤 Pregunta por <strong>${esc(lead.appointment_contact)}</strong></p>` : ""}
    </div>`;

  let html, subject;

  if (type === "day_before") {
    subject = `Recordatorio: tu cita es mañana — ${lead.vehicle_title || "CarsWise"}`;
    html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#2563eb">📅 Recordatorio — Tu cita es mañana</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Te recordamos que mañana tienes una visita programada para ver el vehículo <strong>${esc(lead.vehicle_title)}</strong>.</p>
      ${apptBlock}
      <p style="font-size:13px;color:#475569">Si necesitas cancelar o cambiar la fecha, puedes gestionarlo desde tu panel antes de la cita.</p>
      <p style="font-size:13px"><a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">Gestionar mi cita →</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;
  } else if (type === "day_of") {
    subject = `¡Hoy es tu cita! — ${lead.vehicle_title || "CarsWise"}`;
    html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#059669">🚗 ¡Hoy es tu cita!</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Hoy tienes tu visita para ver el vehículo <strong>${esc(lead.vehicle_title)}</strong>. ¡Te esperamos!</p>
      ${apptBlock}
      <p style="font-size:13px;color:#475569">Si necesitas cancelar o cambiar la fecha, puedes gestionarlo desde tu panel.</p>
      <p style="font-size:13px"><a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">Gestionar mi cita →</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;
  } else if (type === "followup") {
    subject = `¿Qué tal fue la visita? — ${lead.vehicle_title || "CarsWise"}`;
    html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#7c3aed">👋 ¿Qué tal fue la visita?</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Esperamos que tu visita para ver el vehículo <strong>${esc(lead.vehicle_title)}</strong> haya ido genial.</p>
      <p>¿Te ha convencido el coche? Si quieres seguir adelante o tienes alguna duda, nuestro equipo está disponible para ayudarte.</p>
      <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:16px;margin:20px 0;text-align:center">
        <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#5b21b6">¿Quieres dar el siguiente paso?</p>
        <a href="https://carswiseai.com/panel/solicitudes"
           style="display:inline-block;background:#7c3aed;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
          Contactar con el equipo →
        </a>
      </div>
      <p style="font-size:13px;color:#475569">Si finalmente has decidido no seguir adelante, no pasa nada — puedes cancelar la solicitud desde tu panel en cualquier momento.</p>
      <p style="font-size:13px"><a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">Ir a mi panel →</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: lead.user_email, subject, html }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${err.message || JSON.stringify(err)}`);
  }
}

module.exports = async function cronAppointmentReminders(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"] || "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pool = getPool();

  let leadsTomorrow, leadsToday, leadsYesterday;
  try {
    const [r1, r2, r3] = await Promise.all([
      // 24h reminder: appointment is tomorrow
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE status = 'Cita confirmada'
          AND lead_type = 'visit'
          AND appointment_date = CURRENT_DATE + INTERVAL '1 day'
          AND reminder_sent_at IS NULL
          AND user_email <> ''
      `),
      // Same-day reminder: appointment is today
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE status = 'Cita confirmada'
          AND lead_type = 'visit'
          AND appointment_date = CURRENT_DATE
          AND reminder_day_of_sent_at IS NULL
          AND user_email <> ''
      `),
      // Post-visit: appointment date has passed → mark as "Visita realizada" + send follow-up
      pool.query(`
        SELECT id, user_email, contact_name, vehicle_title,
               appointment_date, appointment_time, appointment_address, appointment_contact
        FROM moveadvisor_market_leads
        WHERE status = 'Cita confirmada'
          AND lead_type = 'visit'
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
      // Mark as "Visita realizada" and send follow-up in parallel
      await Promise.all([
        pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Visita realizada', followup_sent_at = NOW()
           WHERE id = $1`,
          [lead.id]
        ),
        sendEmail(lead, "followup"),
      ]);
      results.push({ id: lead.id, type: "followup", ok: true });
    } catch (err) {
      results.push({ id: lead.id, type: "followup", ok: false, error: err.message });
      console.error(`[cron-reminders] followup error for ${lead.id}:`, err.message);
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
};
