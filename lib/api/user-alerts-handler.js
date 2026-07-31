const authHandler = require("../../api/auth");
const { upsertAlert, listAlerts, removeAlert, updateSeenCount } = require("../alertsStore");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBody(body) {
  if (body && typeof body === "object") return body;
  try { return JSON.parse(String(body || "{}")); } catch { return {}; }
}

function alertsToClientShape(alerts, userEmail) {
  const alertStatus = {};
  const clientAlerts = alerts.map((a) => {
    if (a.seenCount != null) alertStatus[a.id] = { seenCount: a.seenCount };
    return {
      ...a,
      email: userEmail,
      ownerEmail: userEmail,
      notifyByEmail: a.notifyByEmail !== false,
      status: "Vigilando mercado",
      createdAt: a.createdAt
        ? new Date(a.createdAt).toLocaleString("es-ES", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          })
        : "",
    };
  });
  return { clientAlerts, alertStatus };
}

module.exports = async function userAlertsHandler(req, res) {
  const method = normalizeText(req.method).toUpperCase();
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();

  if (!sessionEmail) {
    return res.status(401).json({ error: "Sesión no válida. Inicia sesión para gestionar alertas." });
  }

  try {
    if (method === "GET") {
      const alerts = await listAlerts(sessionEmail);
      const { clientAlerts, alertStatus } = alertsToClientShape(alerts, sessionEmail);
      return res.status(200).json({ ok: true, alerts: clientAlerts, alertStatus });
    }

    if (method === "DELETE") {
      const id = normalizeText(req.query?.id);
      if (!id) return res.status(400).json({ error: "Falta el parámetro 'id'." });
      const alerts = await removeAlert(sessionEmail, id);
      const { clientAlerts, alertStatus } = alertsToClientShape(alerts, sessionEmail);
      return res.status(200).json({ ok: true, alerts: clientAlerts, alertStatus });
    }

    const body = parseBody(req.body);
    const scope = normalizeText(req.query?.scope).toLowerCase();

    if (scope === "status") {
      const alertId = normalizeText(body.alertId || body.id);
      const seenCount = Number(body.seenCount || 0);
      if (!alertId) return res.status(400).json({ error: "Falta el campo 'alertId'." });
      await updateSeenCount(sessionEmail, alertId, seenCount);
      return res.status(200).json({ ok: true });
    }

    const payload = body.alert || body;
    const id = normalizeText(payload?.id);
    if (!id) return res.status(400).json({ error: "El payload debe incluir un campo 'id'." });

    const alerts = await upsertAlert(sessionEmail, { ...payload, email: sessionEmail });
    const { clientAlerts, alertStatus } = alertsToClientShape(alerts, sessionEmail);
    return res.status(200).json({ ok: true, alerts: clientAlerts, alertStatus });

  } catch (err) {
    console.error("[user-alerts] error:", err?.message);
    return res.status(500).json({ error: "Error interno. Inténtalo de nuevo.", detail: err?.message });
  }
};
