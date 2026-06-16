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

function formatDate(dateStr) {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

async function sendReminderEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || "CarsWise <onboarding@resend.dev>";
  if (!apiKey) return;

  const apptDate = formatDate(String(lead.appointment_date).slice(0, 10));

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#2563eb">📅 Recordatorio — Tu cita es mañana</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Te recordamos que mañana tienes una visita programada para ver el vehículo <strong>${esc(lead.vehicle_title)}</strong>.</p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px;margin:20px 0">
        <p style="margin:4px 0">📅 <strong>${esc(apptDate)}</strong></p>
        ${lead.appointment_time    ? `<p style="margin:4px 0">⏰ <strong>${esc(lead.appointment_time)}</strong></p>` : ""}
        ${lead.appointment_address ? `<p style="margin:4px 0">📍 ${esc(lead.appointment_address)}</p>` : ""}
        ${lead.appointment_contact ? `<p style="margin:4px 0">👤 Pregunta por <strong>${esc(lead.appointment_contact)}</strong></p>` : ""}
      </div>
      <p style="font-size:13px;color:#475569">Si necesitas cancelar o cambiar la fecha, puedes gestionarlo desde tu panel antes de la cita.</p>
      <p style="font-size:13px">
        <a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">Gestionar mi cita →</a>
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: lead.user_email,
      subject: `Recordatorio: tu cita es mañana — ${lead.vehicle_title || "CarsWise"}`,
      html,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${err.message || JSON.stringify(err)}`);
  }
}

module.exports = async function cronAppointmentReminders(req, res) {
  // Vercel cron calls use GET; protect with a shared secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"] || "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const pool = getPool();

  // Find confirmed visits whose appointment_date is tomorrow (Spain timezone UTC+1/+2)
  // We check a window of appointment_date = today + 1 day in UTC+1, handled by casting to date in the DB
  let leads;
  try {
    const result = await pool.query(`
      SELECT id, user_email, contact_name, vehicle_title,
             appointment_date, appointment_time, appointment_address, appointment_contact
      FROM moveadvisor_market_leads
      WHERE status = 'Cita confirmada'
        AND lead_type = 'visit'
        AND appointment_date = (CURRENT_DATE AT TIME ZONE 'Europe/Madrid') + INTERVAL '1 day'
        AND reminder_sent_at IS NULL
        AND user_email <> ''
    `);
    leads = result.rows;
  } catch (err) {
    console.error("[cron-reminders] DB query error:", err.message);
    return res.status(500).json({ error: "DB error", detail: err.message });
  }

  const results = [];
  for (const lead of leads) {
    try {
      await sendReminderEmail(lead);
      await pool.query(
        `UPDATE moveadvisor_market_leads SET reminder_sent_at = NOW() WHERE id = $1`,
        [lead.id]
      );
      results.push({ id: lead.id, email: lead.user_email, ok: true });
      console.log(`[cron-reminders] sent reminder to ${lead.user_email} for lead ${lead.id}`);
    } catch (err) {
      results.push({ id: lead.id, email: lead.user_email, ok: false, error: err.message });
      console.error(`[cron-reminders] error for lead ${lead.id}:`, err.message);
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
};
