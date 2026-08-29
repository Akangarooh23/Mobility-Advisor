const { Pool } = require("pg");
const authHandler = require("../../api/auth");
const { MARCA, remitente, respuestaA, correoInterno } = require("../marca");
const { plantilla, parrafo, datos, aviso, esc } = require("../correo");

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

  const html = plantilla({
    titulo: "Hemos recibido tu solicitud de servicio",
    cuerpo:
      parrafo("Te llamamos en 24-48 horas hábiles para confirmarte precio y disponibilidad.") +
      datos([
        ["Servicio", esc(serviceLabel)],
        ["Vehículo", esc(request.vehicle_title)],
        ["Taller preferido", esc(partnerLabel)],
        ["Zona", esc(request.preferred_province)],
        ["Fechas preferidas", esc(request.preferred_dates)],
      ]) +
      aviso(
        `Tarifa profesional de ${MARCA.nombre}`,
        "Como cliente accedes a precios negociados para flotas, normalmente entre un 15 % y un 30 % por debajo del precio de mostrador."
      ),
    pie: `Referencia: ${esc(request.id)}`,
  });

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(),
      reply_to: respuestaA(),
      to: [userEmail],
      subject: `Solicitud recibida: ${serviceLabel} · ${MARCA.nombre} Pro`,
      html,
    }),
  }).catch(() => {});
}

async function sendInternalAlert(userEmail, request) {
  const apiKey = process.env.RESEND_API_KEY;
  // A donde va el aviso interno. Si no hay INTERNAL_ALERT_EMAIL cae en la
  // direccion del remitente, que es una casualidad que funciona solo mientras
  // esa direccion sea un buzon atendido. En cuanto el remitente pase a ser un
  // notifications@ sin bandeja, estos avisos se pierden y nadie se entera.
  // Conviene poner INTERNAL_ALERT_EMAIL antes de tocar lo otro.
  const internalEmail = process.env.INTERNAL_ALERT_EMAIL || correoInterno();
  if (!apiKey || !internalEmail) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remitente(),
      to: [internalEmail],
      subject: `[${MARCA.nombre}] Nueva solicitud de servicio — ${request.service_type} · ${userEmail}`,
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

    // Se esperan los correos. Lanzarlos «en segundo plano» aquí no existe: la
    // función se apaga al responder y el envío se queda a medias.
    await Promise.all([
      sendConfirmationEmail(sessionEmail, request).catch((err) => {
        console.error("[service-requests] no ha salido la confirmación:", err?.message);
      }),
      sendInternalAlert(sessionEmail, request).catch((err) => {
        console.error("[service-requests] no ha salido el aviso interno:", err?.message);
      }),
    ]);

    return res.status(200).json({ ok: true, id, status: "pending" });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
