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

// ── Table setup (once per instance) ────────────────────────────────────────
let _tableReady = false;
let _alertsTableReady = false;

async function ensureTable(pool) {
  if (_tableReady) return;
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
      ADD COLUMN IF NOT EXISTS confirmed_at         TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS utm_source           VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_medium           VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_campaign         VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_content          VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS utm_term             VARCHAR(255) NOT NULL DEFAULT ''
  `);
  _tableReady = true;
}

async function ensureAlertsTable(pool) {
  if (_alertsTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moveadvisor_vehicle_alerts (
      id            VARCHAR(64)  PRIMARY KEY,
      email         VARCHAR(255) NOT NULL,
      vehicle_url   TEXT         NOT NULL,
      vehicle_title VARCHAR(255) NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      notified_at   TIMESTAMPTZ
    )
  `);
  _alertsTableReady = true;
}

// ── Rate limiting (in-memory, per email) ───────────────────────────────────
const _rateLimitMap = new Map();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 min

function isRateLimited(email) {
  const now = Date.now();
  const entry = _rateLimitMap.get(email);
  if (!entry || now > entry.resetAt) {
    _rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ALLOWED_TYPES     = ["info", "visit", "question", "renting"];
const TYPE_LABELS       = { info: "Solicitar información", visit: "Agendar visita", question: "Preguntar sobre el coche", renting: "Solicitar oferta de renting" };
const INTERNAL_LEADS_EMAIL = process.env.INTERNAL_LEADS_EMAIL || "akangarooh23@gmail.com";

// ── Email senders ────────────────────────────────────────────────────────────
async function sendConfirmationEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey) { console.error("[leads-handler] RESEND_API_KEY not set — skipping confirmation email"); return; }

  const apptDate = lead.appointment_date
    ? new Date(
        (lead.appointment_date instanceof Date
          ? lead.appointment_date.toISOString()
          : String(lead.appointment_date)
        ).slice(0, 10) + "T12:00:00"
      ).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#059669">🎉 ¡Cita confirmada!</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Has confirmado tu visita para ver el vehículo <strong>${esc(lead.vehicle_title)}</strong>. Te esperamos en la fecha acordada.</p>
      <div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;margin:20px 0">
        <p style="margin:0 0 10px 0;font-size:14px;font-weight:700;color:#065f46">✅ Detalles de tu cita</p>
        ${apptDate ? `<p style="margin:4px 0;color:#166534">📅 <strong>${esc(apptDate)}</strong></p>` : ""}
        ${lead.appointment_time    ? `<p style="margin:4px 0;color:#166534">⏰ ${esc(lead.appointment_time)}</p>` : ""}
        ${lead.appointment_address ? `<p style="margin:4px 0;color:#166534">📍 ${esc(lead.appointment_address)}</p>` : ""}
        ${lead.appointment_contact ? `<p style="margin:4px 0;color:#166534">👤 Pregunta por <strong>${esc(lead.appointment_contact)}</strong></p>` : ""}
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:20px 0;font-size:13px;color:#475569">
        Si necesitas cancelar o cambiar la fecha, puedes gestionarlo desde tu panel antes de la cita.
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
    body: JSON.stringify({ from, to: lead.user_email, subject: `Cita confirmada — ${lead.vehicle_title || "CarsWise"}`, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${errBody.message || JSON.stringify(errBody)}`);
  }
}

async function sendAvailableAgainEmail(email, vehicleTitle, vehicleUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey) return;
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#2563eb">🚗 ¡El vehículo que seguías vuelve a estar disponible!</h2>
      <p>El vehículo <strong>${esc(vehicleTitle)}</strong> que marcaste para seguir acaba de quedar libre. La reserva anterior fue cancelada.</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#1e40af">⚡ Actúa rápido — otros usuarios también pueden estar esperando este vehículo.</p>
      </div>
      ${vehicleUrl ? `<p><a href="${esc(vehicleUrl)}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">Ver vehículo y solicitar visita →</a></p>` : ""}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: email, subject: `🚗 Disponible de nuevo — ${vehicleTitle || "Vehículo"}`, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    console.error("[leads-handler] available-again email error:", errBody.message || JSON.stringify(errBody));
  }
}

async function sendNewLeadEmails({ name, phone, email, when, leadType, vehicle_title, vehicle_url, portal }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey) return;

  const isRenting = leadType === "renting" || portal === "marketplace-vo-renting";
  const typeLabel = TYPE_LABELS[leadType] || leadType;

  const clientHtml = isRenting
    ? `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <h2 style="color:#059669">🔑 Solicitud de renting recibida</h2>
        <p>Hola <strong>${esc(name)}</strong>,</p>
        <p>Hemos recibido tu solicitud de <strong>renting</strong> para <strong>${esc(vehicle_title)}</strong>.</p>
        ${when ? `<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:14px 16px;margin:16px 0;font-size:14px;color:#065f46"><strong>Opción seleccionada:</strong> ${esc(when)}</div>` : ""}
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:16px 0;font-size:14px;color:#1e40af">
          ⏱️ Te contactaremos en menos de <strong>2 horas</strong> para confirmar los detalles del contrato.
        </div>
        <p style="font-size:13px;color:#475569">Puedes consultar el estado de tu solicitud en cualquier momento desde:<br>
        <a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">carswiseai.com/panel/solicitudes</a></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
      </div>`
    : `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <h2 style="color:#2563eb">Hemos recibido tu solicitud</h2>
        <p>Hola <strong>${esc(name)}</strong>,</p>
        <p>Tu solicitud de <strong>${esc(typeLabel.toLowerCase())}</strong> sobre el vehículo <strong>${esc(vehicle_title)}</strong> ha sido recibida correctamente.</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:20px 0;font-size:14px;color:#1e40af">
          ⏱️ Te contactaremos en menos de <strong>2 horas</strong>${when ? ` (preferiblemente: ${esc(when)})` : ""}.
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
        <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
      </div>`;

  const isPortalExterno = portal && !portal.startsWith("marketplace-vo");
  const portalLabel = isRenting ? "Marketplace · Renting"
    : portal === "marketplace-vo-compra" || portal === "marketplace-vo" ? "Marketplace · Compra"
    : isPortalExterno ? `Portal externo: ${portal}`
    : portal || "Marketplace";

  const internalHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#0f172a">${isRenting ? "🔑 Nuevo lead de renting" : isPortalExterno ? `🔔 Nuevo lead — Portal: ${esc(portal)}` : "🔔 Nuevo lead en el marketplace"}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:8px 0;color:#64748b;width:140px">Origen</td><td style="font-weight:700">${esc(portalLabel)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Tipo</td><td style="font-weight:700">${esc(typeLabel)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Vehículo</td><td style="font-weight:700">${esc(vehicle_title)}</td></tr>
        ${vehicle_url ? `<tr><td style="padding:8px 0;color:#64748b">URL</td><td><a href="${esc(vehicle_url)}">${esc(vehicle_url)}</a></td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#64748b">Nombre</td><td>${esc(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Teléfono</td><td><strong>${esc(phone)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        ${when ? `<tr><td style="padding:8px 0;color:#64748b">${isRenting ? "Opción solicitada" : "Cuándo"}</td><td style="font-weight:${isRenting ? "700" : "400"}">${esc(when)}</td></tr>` : ""}
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">CarsWise — Panel ERP: <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const clientSubject = isRenting
    ? `Solicitud de renting recibida — ${vehicle_title || "CarsWise"}`
    : `Solicitud recibida — ${vehicle_title || "CarsWise"}`;
  const internalSubject = isRenting
    ? `🔑 Nuevo lead renting: ${vehicle_title || "sin vehículo"}`
    : `🔔 Nuevo lead: ${typeLabel} — ${vehicle_title || "sin vehículo"}`;

  const results = await Promise.allSettled([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject: clientSubject, html: clientHtml }),
    }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: INTERNAL_LEADS_EMAIL, subject: internalSubject, html: internalHtml }),
    }),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[leads-handler] sendNewLeadEmails[${i}] error:`, r.reason?.message);
  });
}

async function sendCancellationClientEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey || !lead.user_email) return;

  const isRenting  = lead.portal === "marketplace-vo-renting" || lead.lead_type === "renting";
  const isVisit    = lead.lead_type === "visit";
  const isQuestion = lead.lead_type === "question";

  const solicitudLabel = isRenting  ? "solicitud de renting"
    : isVisit    ? "solicitud de visita"
    : isQuestion ? "consulta"
    : "solicitud de información";

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#64748b">Tu ${esc(solicitudLabel)} ha sido cancelada</h2>
      <p>Hola <strong>${esc(lead.contact_name || lead.user_email)}</strong>,</p>
      <p>Tu ${esc(solicitudLabel)} para el vehículo <strong>${esc(lead.vehicle_title)}</strong> ha sido cancelada correctamente.</p>
      <p style="color:#64748b;font-size:14px">Si tienes cualquier pregunta o quieres volver a contactar con nosotros, puedes hacerlo desde el marketplace en cualquier momento.</p>
      <p style="font-size:13px"><a href="https://carswiseai.com/panel/solicitudes" style="${isRenting ? "color:#059669" : "color:#2563eb"};font-weight:600">Ver mi panel →</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const subject = isRenting
    ? `Solicitud de renting cancelada — ${lead.vehicle_title || "CarsWise"}`
    : `Solicitud cancelada — ${lead.vehicle_title || "CarsWise"}`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: lead.user_email, subject, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    console.error("[leads-handler] cancellation client email error:", errBody.message || JSON.stringify(errBody));
  }
}

async function sendDescartadoClientEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey || !lead.user_email) return;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#475569">Gracias por tu tiempo</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Entendemos que el vehículo <strong>${esc(lead.vehicle_title)}</strong> finalmente no era lo que buscabas. No pasa nada, encontrar el coche perfecto lleva su tiempo.</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;text-align:center">
        <p style="margin:0 0 12px 0;font-size:14px;font-weight:600;color:#374151">¿Podemos ayudarte a encontrar otro vehículo?</p>
        <a href="https://carswiseai.com"
           style="display:inline-block;background:#2563eb;color:#ffffff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
          Ver más vehículos →
        </a>
      </div>
      <p style="font-size:13px;color:#475569">Nuestro equipo está disponible para ayudarte a encontrar el vehículo que mejor se adapte a tus necesidades.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: lead.user_email, subject: `¿Podemos ayudarte con otro vehículo? — CarsWise`, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${errBody.message || JSON.stringify(errBody)}`);
  }
}

async function sendInterestedClientEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey || !lead.user_email) return;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:#059669">¡Hemos recibido tu interés!</h2>
      <p>Hola <strong>${esc(lead.contact_name) || "cliente"}</strong>,</p>
      <p>Nos has confirmado que estás interesado en el vehículo <strong>${esc(lead.vehicle_title)}</strong>. ¡Perfecto!</p>
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin:20px 0">
        <p style="margin:0;font-size:14px;color:#065f46">El equipo de CarsWise se pondrá en contacto contigo <strong>en breve</strong> para gestionar los siguientes pasos de la compra.</p>
      </div>
      <p style="font-size:13px;color:#475569">Si tienes alguna pregunta mientras tanto, puedes consultar el estado de tu solicitud desde tu panel:</p>
      <p style="font-size:13px"><a href="https://carswiseai.com/panel/solicitudes" style="color:#2563eb;font-weight:600">Ir a mi panel →</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">El equipo de CarsWise — <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: lead.user_email, subject: `Tu interés en ${lead.vehicle_title || "el vehículo"} — CarsWise`, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`Resend ${resp.status}: ${errBody.message || JSON.stringify(errBody)}`);
  }
}

async function sendInternalStatusEmail(lead, newStatus, extra = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL || process.env.ALERT_EMAIL_FROM || "CarsWise <onboarding@resend.dev>";
  if (!apiKey) { console.error("[leads-handler] RESEND_API_KEY not set — skipping status email"); return; }

  const statusColors = { "Cancelado": "#dc2626", "Reagendar solicitado": "#d97706", "Cita confirmada": "#059669" };
  const color = statusColors[newStatus] || "#2563eb";

  let proposalsHtml = "";
  if (extra.message) {
    proposalsHtml = `<p style="margin:8px 0;font-size:14px;font-weight:600;color:#374151">${esc(extra.message)}</p>`;
  } else if (extra.proposals && extra.proposals.length) {
    proposalsHtml = `
      <p style="margin:8px 0 4px 0;font-weight:700;font-size:13px;color:#374151">Opciones propuestas:</p>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151">
        ${extra.proposals.map((p) => `<li>${esc(p.date)}${p.time ? " a las " + esc(p.time) : ""}</li>`).join("")}
      </ul>`;
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
      <h2 style="color:${color}">🔄 Lead actualizado — ${esc(newStatus)}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:8px 0;color:#64748b;width:140px">Estado</td><td style="font-weight:700;color:${color}">${esc(newStatus)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Lead ID</td><td style="font-family:monospace;font-size:12px">${esc(lead.id)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Vehículo</td><td style="font-weight:700">${esc(lead.vehicle_title)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Cliente</td><td>${esc(lead.contact_name)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Teléfono</td><td><strong>${esc(lead.contact_phone)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td><a href="mailto:${esc(lead.user_email)}">${esc(lead.user_email)}</a></td></tr>
        ${lead.appointment_date ? `<tr><td style="padding:8px 0;color:#64748b">Cita</td><td>${esc(String(lead.appointment_date))}${lead.appointment_time ? " " + esc(lead.appointment_time) : ""}</td></tr>` : ""}
      </table>
      ${proposalsHtml}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="font-size:12px;color:#64748b">CarsWise — Panel ERP: <a href="https://carswiseai.com">carswiseai.com</a></p>
    </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: INTERNAL_LEADS_EMAIL, subject: `🔄 Lead ${newStatus} — ${lead.vehicle_title || "sin vehículo"}`, html }),
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    console.error("[leads-handler] status email error:", errBody.message || JSON.stringify(errBody));
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function leadsHandler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = new Set([
    "https://carswiseai.com",
    "https://www.carswiseai.com",
    "http://localhost:3000",
    "http://localhost:3001",
  ]);
  res.setHeader("Access-Control-Allow-Origin", allowedOrigins.has(origin) ? origin : "https://carswiseai.com");
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
      const [urlResult, idResult] = await Promise.all([
        pool.query(`SELECT DISTINCT vehicle_url FROM moveadvisor_market_leads WHERE status = 'Cita confirmada' AND vehicle_url <> ''`),
        pool.query(`SELECT DISTINCT vehicle_id FROM moveadvisor_market_leads WHERE status = 'Cita confirmada' AND portal = 'marketplace-vo' AND vehicle_id IS NOT NULL AND vehicle_id <> ''`),
      ]);
      return res.status(200).json({
        ok: true,
        reservedUrls: urlResult.rows.map((r) => r.vehicle_url),
        reservedMarketplaceIds: idResult.rows.map((r) => r.vehicle_id),
      });
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
        const before = await pool.query(
          `SELECT id, status, vehicle_url, vehicle_title, user_email, contact_name, contact_phone, appointment_date, appointment_time, portal, lead_type
           FROM moveadvisor_market_leads WHERE id = $1 AND user_email = $2`,
          [id, normalizedEmail]
        );
        if (before.rowCount === 0) return res.status(404).json({ error: "Solicitud no encontrada" });
        const wasConfirmed = before.rows[0].status === "Cita confirmada";
        const vehicleUrl   = before.rows[0].vehicle_url   || "";
        const vehicleTitle = before.rows[0].vehicle_title || "";

        await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Cancelado',
               appointment_date = NULL, appointment_time = '',
               appointment_address = '', appointment_contact = '',
               notified_at = NULL, confirmed_at = NULL
           WHERE id = $1 AND user_email = $2`,
          [id, normalizedEmail]
        );

        try { await sendInternalStatusEmail({ ...before.rows[0], id }, "Cancelado"); }
        catch (e) { console.error("[leads-handler] cancel internal email error:", e.message); }
        try { await sendCancellationClientEmail({ ...before.rows[0], id }); }
        catch (e) { console.error("[leads-handler] cancel client email error:", e.message); }

        if (wasConfirmed && vehicleUrl) {
          try {
            await ensureAlertsTable(pool);
            const alerts = await pool.query(
              `SELECT id, email FROM moveadvisor_vehicle_alerts WHERE vehicle_url = $1 AND notified_at IS NULL`,
              [vehicleUrl]
            );
            for (const row of alerts.rows) {
              await sendAvailableAgainEmail(row.email, vehicleTitle, vehicleUrl);
              await pool.query(`UPDATE moveadvisor_vehicle_alerts SET notified_at = NOW() WHERE id = $1`, [row.id]);
            }
          } catch (e) {
            console.error("[leads-handler] alert notification error:", e.message);
          }
        }

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

        const beforeReschedule = await pool.query(
          `SELECT id, status, vehicle_url, vehicle_title, user_email, contact_name, contact_phone
           FROM moveadvisor_market_leads WHERE id = $1 AND user_email = $2`,
          [id, normalizedEmail]
        );
        const wasReserved         = beforeReschedule.rows[0]?.status === "Cita confirmada";
        const reschedVehicleUrl   = beforeReschedule.rows[0]?.vehicle_url   || "";
        const reschedVehicleTitle = beforeReschedule.rows[0]?.vehicle_title || "";

        const result = await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Reagendar solicitado', reschedule_proposals = $1, confirmed_at = NULL
           WHERE id = $2 AND user_email = $3`,
          [JSON.stringify(validProposals), id, normalizedEmail]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

        try { await sendInternalStatusEmail({ ...beforeReschedule.rows[0], id }, "Reagendar solicitado", { proposals: validProposals }); }
        catch (e) { console.error("[leads-handler] reschedule internal email error:", e.message); }

        if (wasReserved && reschedVehicleUrl) {
          try {
            await ensureAlertsTable(pool);
            const alerts = await pool.query(
              `SELECT id, email FROM moveadvisor_vehicle_alerts WHERE vehicle_url = $1 AND notified_at IS NULL`,
              [reschedVehicleUrl]
            );
            for (const row of alerts.rows) {
              await sendAvailableAgainEmail(row.email, reschedVehicleTitle, reschedVehicleUrl);
              await pool.query(`UPDATE moveadvisor_vehicle_alerts SET notified_at = NOW() WHERE id = $1`, [row.id]);
            }
          } catch (e) {
            console.error("[leads-handler] reschedule alert notification error:", e.message);
          }
        }

        return res.status(200).json({ ok: true });
      }

      if (action === "client_outcome") {
        const { outcome } = body;
        if (!["interested", "not_interested"].includes(outcome)) {
          return res.status(400).json({ error: "outcome debe ser 'interested' o 'not_interested'" });
        }
        const newStatus = outcome === "interested" ? "Interesado" : "Descartado";

        const result = await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = $1
           WHERE id = $2 AND user_email = $3
             AND status = 'Visita realizada'
           RETURNING *`,
          [newStatus, id, normalizedEmail]
        );
        if (result.rowCount === 0) {
          return res.status(409).json({ error: "Solicitud no encontrada o ya procesada" });
        }

        const lead = result.rows[0];
        const outcomeMsg = outcome === "interested"
          ? `El cliente ${lead.contact_name} quiere comprar el vehículo ${lead.vehicle_title}.`
          : `El cliente ${lead.contact_name} ha indicado que no está interesado en ${lead.vehicle_title}.`;
        try { await sendInternalStatusEmail(lead, newStatus, { message: outcomeMsg }); }
        catch (e) { console.error("[leads-handler] client_outcome internal email error:", e.message); }

        if (outcome === "interested") {
          try { await sendInterestedClientEmail(lead); }
          catch (e) { console.error("[leads-handler] client_outcome interested email error:", e.message); }
        } else {
          try { await sendDescartadoClientEmail(lead); }
          catch (e) { console.error("[leads-handler] client_outcome descartado email error:", e.message); }
        }

        return res.status(200).json({ ok: true, status: newStatus });
      }

      if (action === "confirm") {
        // Atomic update: only succeeds if the lead is still in a confirmable state.
        // Prevents race conditions where two requests confirm the same appointment simultaneously.
        const result = await pool.query(
          `UPDATE moveadvisor_market_leads
           SET status = 'Cita confirmada', confirmed_at = NOW()
           WHERE id = $1 AND user_email = $2
             AND lead_type = 'visit'
             AND appointment_date IS NOT NULL
             AND status IN ('Contactado', 'En proceso')
           RETURNING *`,
          [id, normalizedEmail]
        );
        if (result.rowCount === 0) {
          return res.status(409).json({ error: "Solicitud no encontrada, sin cita asignada, o ya confirmada" });
        }

        const lead = result.rows[0];

        let emailError = null;
        try { await sendConfirmationEmail(lead); }
        catch (e) { emailError = e.message; console.error("[leads-handler] confirm email error:", e.message); }

        try { await sendInternalStatusEmail(lead, "Cita confirmada"); }
        catch (e) { console.error("[leads-handler] confirm internal email error:", e.message); }

        return res.status(200).json({ ok: true, ...(emailError ? { email_error: emailError } : {}) });
      }

      return res.status(400).json({ error: "Acción inválida" });
    } catch (err) {
      console.error("[leads-handler] PATCH error:", err.message);
      return res.status(500).json({ error: "Error al actualizar la solicitud" });
    }
  }

  // ── POST: create new lead or save vehicle alert ─────────────────────────
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, phone, email, when, type, vehicle_id, vehicle_title, vehicle_url, portal, action,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term } = body;

  if (action === "alert") {
    if (!email || !vehicle_url) return res.status(400).json({ error: "email y vehicle_url son obligatorios" });
    try {
      const pool = getPool();
      await ensureAlertsTable(pool);
      const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await pool.query(
        `INSERT INTO moveadvisor_vehicle_alerts (id, email, vehicle_url, vehicle_title)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [alertId, email.toLowerCase().trim(), vehicle_url, vehicle_title || ""]
      );
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[leads-handler] alert save error:", err.message);
      return res.status(500).json({ error: "Error al guardar la alerta" });
    }
  }

  if (!email || !phone || !name) {
    return res.status(400).json({ error: "name, phone y email son obligatorios" });
  }

  // Rate limit: max 3 new leads per email per 10 min
  if (isRateLimited(email.toLowerCase().trim())) {
    return res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo en unos minutos." });
  }

  const leadType = ALLOWED_TYPES.includes(type) ? type : "info";
  const id = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  try {
    const pool = getPool();
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO moveadvisor_market_leads
         (id, user_email, lead_type, vehicle_id, vehicle_title, vehicle_url, portal,
          contact_name, contact_phone, contact_when,
          utm_source, utm_medium, utm_campaign, utm_content, utm_term)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
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
        utm_source || "",
        utm_medium || "",
        utm_campaign || "",
        utm_content || "",
        utm_term || "",
      ]
    );

    try {
      await sendNewLeadEmails({ name, phone, email, when, leadType, vehicle_title: vehicle_title || "", vehicle_url: vehicle_url || "", portal: portal || "" });
    } catch (err) {
      console.error("[leads-handler] email error:", err.message);
    }

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
