/**
 * Proxy endpoint: recibe una solicitud de cita de mantenimiento del frontend CarsWise
 * y la crea en el ERP (erp_appointments) usando un token de servicio.
 *
 * POST /api/erp-appointment
 * Body: { userId, scheduledAt, appointmentType, workshopName, workshopId, notes }
 *
 * Env vars requeridas:
 *   ERP_API_URL       = https://carswise-erp-backoffice-api.vercel.app
 *   ERP_SERVICE_TOKEN = Bearer JWT firmado con el JWT_SECRET del ERP, role=operations
 */

const ERP_TYPE_MAP = {
  "Revision menor":      "oil_change",
  "Revision mayor":      "general",
  "Revision de frenos":  "brakes",
  "Neumaticos":          "tires",
  "Revision ITV":        "itv",
};

function toErpType(cwType = "") {
  return ERP_TYPE_MAP[cwType] || "other";
}

module.exports = async function erpAppointmentHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const erpUrl   = process.env.ERP_API_URL;
  const erpToken = process.env.ERP_SERVICE_TOKEN;

  if (!erpUrl || !erpToken) {
    console.warn("[erp-appointment] ERP_API_URL or ERP_SERVICE_TOKEN not configured — skipping");
    return res.status(200).json({ ok: true, skipped: true });
  }

  const {
    userId,
    scheduledAt,
    appointmentType,
    workshopName,
    workshopId,
    notes,
  } = req.body || {};

  if (!userId || !scheduledAt || !appointmentType) {
    return res.status(400).json({ error: "userId, scheduledAt and appointmentType are required" });
  }

  const payload = {
    user_id:       String(userId),
    scheduled_at:  String(scheduledAt),
    type:          toErpType(appointmentType),
    workshop_name: workshopName ? String(workshopName) : undefined,
    notes:         notes        ? String(notes)        : undefined,
  };

  // Remove undefined keys so the ERP Zod schema doesn't reject them
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

  try {
    const erpRes = await fetch(`${erpUrl}/api/appointments`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${erpToken}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await erpRes.json().catch(() => ({}));

    if (!erpRes.ok) {
      console.error("[erp-appointment] ERP returned", erpRes.status, body);
      return res.status(502).json({ error: "ERP error", detail: body });
    }

    return res.status(200).json({ ok: true, appointment: body });
  } catch (err) {
    console.error("[erp-appointment] Fetch error:", err.message);
    return res.status(502).json({ error: "Could not reach ERP" });
  }
};
