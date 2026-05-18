const { Pool } = require("pg");

let _pool = null;
function getPool() {
  if (!_pool) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({ connectionString: url, max: 5, ssl: { rejectUnauthorized: false } });
  }
  return _pool;
}

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_market_leads (
      id             VARCHAR(64)  PRIMARY KEY,
      user_email     VARCHAR(255) NOT NULL,
      lead_type      VARCHAR(40)  NOT NULL DEFAULT 'info',
      vehicle_id     VARCHAR(255),
      vehicle_title  VARCHAR(255) NOT NULL DEFAULT '',
      vehicle_url    TEXT         NOT NULL DEFAULT '',
      portal         VARCHAR(100) NOT NULL DEFAULT '',
      contact_name   VARCHAR(255) NOT NULL DEFAULT '',
      contact_phone  VARCHAR(80)  NOT NULL DEFAULT '',
      contact_when   VARCHAR(80)  NOT NULL DEFAULT '',
      status         VARCHAR(80)  NOT NULL DEFAULT 'Pendiente',
      erp_notes      TEXT         NOT NULL DEFAULT '',
      created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE moveadvisor_market_leads
      ADD COLUMN IF NOT EXISTS erp_response         TEXT         NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS appointment_date     DATE,
      ADD COLUMN IF NOT EXISTS appointment_time     VARCHAR(10)  NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS appointment_address  TEXT         NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS appointment_contact  VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS notified_at          TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reschedule_proposals JSONB,
      ADD COLUMN IF NOT EXISTS confirmed_at         TIMESTAMPTZ
  `);
}

function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

async function sendConfirmationEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = "CarsWise <onboarding@resend.dev>";
  if (!apiKey) { console.error("[leads-handler] RESEND_API_KEY not set — skipping confirmation email"); return; }

  const apptDate = lead.appointment_date
    ? new Date(lead.appointment_date + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#059669">🎉 ¡Cita confirmada! Tu vehículo está reservado</h2>
      <p>Hola <strong>${lead.contact_name || "cliente"}</strong>,</p>
      <p>Has confirmado tu cita para el vehículo <strong>${lead.vehicle_title}</strong>. El vehículo queda reservado para ti.</p>

      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 10px 0;font-size:14px;font-weight:700;color:#065f46">✅ Detalles de tu cita confirmada</p>
        ${apptDate ? `<p style="margin:4px 0;color:#166534">📅 <strong>${apptDate}</strong></p>` : ""}
        ${lead.appointment_time ? `<p style="margin:4px 0;color:#166534">⏰ ${lead.appointment_time}</p>` : ""}
        ${lead.appointment_address ? `<p style="margin:4px 0;color:#166534">📍 ${lead.appointment_address}</p>` : ""}
        ${lead.appointment_contact ? `<p style="margin:4px 0;color:#166534">👤 Pregunta por <strong>${lead.appointment_contact}</strong></p>` : ""}
      </div>

      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin:20px 0;font-size:13px;color:#713f12">
        🔒 El vehículo queda reservado hasta la fecha de tu visita. Si necesitas cancelar o cambiar la fecha, puedes hacerlo desde tu panel antes de la cita.
      </div>

      <div style="margin:20px 0;font-size:13px;color:#475569">
        Gestiona tu cita desde el panel:<br>
        <a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">carswiseai.com/panel/solicitudes</a>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: lead.user_email, subject: `¡Cita confirmada! Reserva tu vehículo — ${lead.vehicle_title || "CarsWise"}`, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${errBody.message || JSON.stringify(errBody)}`);
  }
}

const ALLOWED_TYPES = ["info", "visit", "question"];
const TYPE_LABELS   = { info: "Solicitar información", visit: "Agendar visita", question: "Preguntar sobre el coche" };

module.exports = async function leadsHandler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: reserved vehicle URLs ──────────────────────────────────────────
  if (req.method === "GET") {
    const q = req.query || {};
    if (q.reserved !== "1") return res.status(400).json({ error: "invalid query" });
    try {
      const pool = getPool();
      await ensureTable(pool);
      const result = await pool.query(
        `SELECT DISTINCT vehicle_url FROM moveadvisor_market_leads WHERE status = 'Cita confirmada' AND vehicle_url <> ''`
      );
      return res.status(200).json({ ok: true, reservedUrls: result.rows.map((r) => r.vehicle_url) });
    } catch (err) {
      console.error("[leads-handler] GET error:", err.message);
      return res.status(500).json({ error: "Error al obtener reservas" });
    }
  }

  const body = parseBody(req.body);

  // ── PATCH: cancel, reschedule, or confirm ───────────────────────────────
  if (req.method === "PATCH") {
    const { id, email, action, proposals } = body;
    if (!id || !email || !action) {
      return res.status(400).json({ error: "id, email y action son obligatorios" });
    }

    const pool = getPool();
    await ensureTable(pool);
    const normalizedEmail = email.toLowerCase().trim();

    try {
      if (action === "cancel") {
        const result = await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Cancelado',
               appointment_date = NULL, appointment_time = '',
               appointment_address = '', appointment_contact = '',
               notified_at = NULL, confirmed_at = NULL
           WHERE id = $1 AND user_email = $2`,
          [id, normalizedEmail]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Solicitud no encontrada" });
        return res.status(200).json({ ok: true });
      }

      if (action === "reschedule") {
        if (!Array.isArray(proposals) || proposals.length === 0) {
          return res.status(400).json({ error: "Se requieren opciones de fecha" });
        }
        const validProposals = proposals
          .filter((p) => p && p.date)
          .slice(0, 3)
          .map((p) => ({ date: String(p.date), time: String(p.time || "") }));
        if (!validProposals.length) return res.status(400).json({ error: "Fechas inválidas" });

        const result = await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Reagendar solicitado', reschedule_proposals = $1, confirmed_at = NULL
           WHERE id = $2 AND user_email = $3`,
          [JSON.stringify(validProposals), id, normalizedEmail]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Solicitud no encontrada" });
        return res.status(200).json({ ok: true });
      }

      if (action === "confirm") {
        // Only allowed for visit leads with an appointment_date set by the operator
        const check = await pool.query(
          `SELECT * FROM moveadvisor_market_leads
           WHERE id = $1 AND user_email = $2 AND lead_type = 'visit' AND appointment_date IS NOT NULL`,
          [id, normalizedEmail]
        );
        if (check.rowCount === 0) return res.status(404).json({ error: "Solicitud no encontrada o sin cita asignada" });

        const lead = check.rows[0];
        // Only allow confirming from Contactado status
        if (!["Contactado", "En proceso"].includes(lead.status)) {
          return res.status(400).json({ error: "La cita no está en estado confirmable" });
        }

        await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Cita confirmada', confirmed_at = NOW()
           WHERE id = $1 AND user_email = $2`,
          [id, normalizedEmail]
        );

        // Send confirmation email — await so errors surface in response
        let emailError = null;
        try {
          await sendConfirmationEmail(lead);
        } catch (e) {
          emailError = e.message;
          console.error("[leads-handler] confirm email error:", e.message);
        }

        return res.status(200).json({ ok: true, ...(emailError ? { email_error: emailError } : {}) });
      }

      return res.status(400).json({ error: "Acción inválida" });
    } catch (err) {
      console.error("[leads-handler] PATCH error:", err.message);
      return res.status(500).json({ error: "Error al actualizar la solicitud" });
    }
  }

  // ── POST: create new lead ───────────────────────────────────────────────
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, phone, email, when, type, vehicle_id, vehicle_title, vehicle_url, portal } = body;

  if (!email || !phone || !name) {
    return res.status(400).json({ error: "name, phone y email son obligatorios" });
  }

  const leadType = ALLOWED_TYPES.includes(type) ? type : "info";
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const pool = getPool();
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal,
          contact_name, contact_phone, contact_when)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        email.toLowerCase().trim(),
        leadType,
        vehicle_id || null,
        vehicle_title || "",
        vehicle_url || "",
        portal || "",
        name || "",
        phone || "",
        when || "",
      ]
    );

    return res.status(201).json({
      ok: true,
      id,
      message: `Solicitud de "${TYPE_LABELS[leadType]}" recibida. Te contactaremos en menos de 2 horas.`,
    });
  } catch (err) {
    console.error("[leads-handler] DB error:", err.message);
    return res.status(500).json({ error: "Error al guardar la solicitud" });
  }
};
