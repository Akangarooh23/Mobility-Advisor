const { Pool } = require("pg");
const authHandler = require("../../api/auth");

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

function parseBody(raw) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "{}")); } catch { return {}; }
}

function generateId() {
  return "svcreq-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

async function sendConfirmationEmail(userEmail, request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const serviceLabels = {
    itv: "ITV",
    aceite: "Cambio de aceite y filtros",
    revision: "Revisión general",
    frenos: "Revisión de frenos",
    neumaticos: "Neumáticos",
    cristales: "Cristales y parabrisas",
    diagnosis: "Diagnosis electrónica",
    carroceria: "Carrocería y pintura",
    otro: "Otro servicio",
  };

  const partnerLabels = {
    norauto: "Norauto",
    midas: "Midas",
    carglass: "Carglass",
    euromaster: "Euromaster",
    mejor_precio: "Mejor precio disponible",
  };

  const serviceLabel = serviceLabels[request.service_type] || request.service_type;
  const partnerLabel = partnerLabels[request.preferred_partner] || request.preferred_partner || "Cualquier taller";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a2e">
      <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
        <h2 style="color:#fff;margin:0;font-size:20px">Solicitud de servicio recibida</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:14px">CarsWise — Tarifa profesional</p>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
        <p style="color:#475569;font-size:15px">Hemos recibido tu solicitud y nos pondremos en contacto contigo en <strong>24-48h hábiles</strong> para confirmarte precio y disponibilidad.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:140px">Servicio</td><td style="padding:8px 0;font-weight:600;font-size:14px">${serviceLabel}</td></tr>
          ${request.vehicle_title ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Vehículo</td><td style="padding:8px 0;font-size:14px">${request.vehicle_title}</td></tr>` : ""}
          <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Taller preferido</td><td style="padding:8px 0;font-size:14px">${partnerLabel}</td></tr>
          ${request.preferred_province ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Zona</td><td style="padding:8px 0;font-size:14px">${request.preferred_province}</td></tr>` : ""}
          ${request.preferred_dates ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Fechas preferidas</td><td style="padding:8px 0;font-size:14px">${request.preferred_dates}</td></tr>` : ""}
        </table>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-top:8px">
          <p style="margin:0;font-size:13px;color:#1e40af">
            <strong>Tarifa profesional CarsWise:</strong> Como usuario de CarsWise accedes a precios negociados para flotas y profesionales, normalmente entre un 15% y 30% por debajo del precio de mostrador.
          </p>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:20px">Ref: ${request.id} · CarsWise Servicios Profesionales</p>
      </div>
    </div>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
      to: [userEmail],
      subject: `Solicitud recibida: ${serviceLabel} · CarsWise Pro`,
      html,
    }),
  }).catch(() => {});
}

async function sendInternalAlert(userEmail, request) {
  const apiKey = process.env.RESEND_API_KEY;
  const internalEmail = process.env.INTERNAL_ALERT_EMAIL || process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !internalEmail) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM || "onboarding@resend.dev",
      to: [internalEmail],
      subject: `[CarsWise] Nueva solicitud de servicio — ${request.service_type} · ${userEmail}`,
      html: `<pre>${JSON.stringify({ userEmail, ...request }, null, 2)}</pre>`,
    }),
  }).catch(() => {});
}

module.exports = async function serviceRequestsHandler(req, res) {
  const method = (req.method || "GET").toUpperCase();

  const session = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = (session?.user?.email || "").toLowerCase().trim();
  if (!sessionEmail) return res.status(401).json({ error: "Sesión no válida." });

  // GET: listar solicitudes del usuario
  if (method === "GET") {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, service_type, preferred_partner, preferred_province, preferred_dates,
                vehicle_title, notes, status, created_at
         FROM moveadvisor_service_requests
         WHERE lower(user_email) = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [sessionEmail]
      );
      return res.status(200).json({ ok: true, requests: rows });
    } finally {
      client.release();
    }
  }

  // POST: crear solicitud
  if (method === "POST") {
    const body = parseBody(req.body);
    const { service_type, vehicle_id, vehicle_title, preferred_partner,
            preferred_province, preferred_dates, notes, user_id } = body;

    if (!service_type) return res.status(400).json({ error: "service_type es obligatorio." });

    const id = generateId();
    const request = {
      id, user_id: user_id || null, user_email: sessionEmail,
      vehicle_id: vehicle_id || null, vehicle_title: vehicle_title || null,
      service_type, preferred_partner: preferred_partner || null,
      preferred_province: preferred_province || null,
      preferred_dates: preferred_dates || null,
      notes: notes || null, status: "pending",
    };

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO moveadvisor_service_requests
           (id, user_id, user_email, vehicle_id, vehicle_title, service_type,
            preferred_partner, preferred_province, preferred_dates, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, request.user_id, request.user_email, request.vehicle_id, request.vehicle_title,
         request.service_type, request.preferred_partner, request.preferred_province,
         request.preferred_dates, request.notes, request.status]
      );
    } finally {
      client.release();
    }

    // Emails en background — no bloqueamos la respuesta
    sendConfirmationEmail(sessionEmail, request).catch(() => {});
    sendInternalAlert(sessionEmail, request).catch(() => {});

    return res.status(200).json({ ok: true, id, status: "pending" });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
