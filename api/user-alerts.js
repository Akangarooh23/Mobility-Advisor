/**
 * GET    /api/user-alerts              – lista alertas + estado de visto
 * POST   /api/user-alerts              – upsert alerta
 * DELETE /api/user-alerts?id=<id>      – elimina alerta
 * POST   /api/user-alerts?scope=status – actualiza seenCount de una alerta
 */

const {
  shouldUseSqlServerMobility,
  listMarketAlertsSqlServer,
  upsertMarketAlertSqlServer,
  removeMarketAlertSqlServer,
  getMarketAlertStatusSqlServer,
  upsertMarketAlertStatusSqlServer,
} = require("../lib/sqlserverMobilityStore");
const authHandler = require("./auth");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBody(body) {
  if (body && typeof body === "object") {
    return body;
  }

  try {
    return JSON.parse(String(body || "{}"));
  } catch {
    return {};
  }
}

module.exports = async function userAlertsHandler(req, res) {
  const method = normalizeText(req.method).toUpperCase();

  if (!["GET", "POST", "DELETE"].includes(method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();

  if (!sessionEmail) {
    return res.status(401).json({ error: "Sesion no valida. Inicia sesion para gestionar alertas de mercado." });
  }

  if (!shouldUseSqlServerMobility()) {
    return res.status(503).json({ error: "Backend de movilidad no configurado.", fallback: true });
  }

  const scope = normalizeText(req.query?.scope).toLowerCase();

  // GET – devuelve alertas + estado de visto en un solo payload
  if (method === "GET") {
    const alerts = listMarketAlertsSqlServer(sessionEmail);
    const alertStatus = getMarketAlertStatusSqlServer(sessionEmail);
    return res.status(200).json({ ok: true, alerts, alertStatus });
  }

  // DELETE – elimina una alerta por id
  if (method === "DELETE") {
    const id = normalizeText(req.query?.id);

    if (!id) {
      return res.status(400).json({ error: "Falta el parametro 'id' para eliminar." });
    }

    const alerts = removeMarketAlertSqlServer(sessionEmail, id);
    const alertStatus = getMarketAlertStatusSqlServer(sessionEmail);
    return res.status(200).json({ ok: true, alerts, alertStatus });
  }

  // POST
  const body = parseBody(req.body);

  // scope=status – actualiza seenCount
  if (scope === "status") {
    const alertId = normalizeText(body.alertId || body.id);
    const seenCount = Number(body.seenCount || 0);

    if (!alertId) {
      return res.status(400).json({ error: "Falta el campo 'alertId'." });
    }

    const alertStatus = upsertMarketAlertStatusSqlServer(sessionEmail, alertId, seenCount);
    return res.status(200).json({ ok: true, alertStatus });
  }

  // upsert alerta
  const payload = body.alert || body;
  const id = normalizeText(payload?.id);

  if (!id) {
    return res.status(400).json({ error: "El payload de la alerta debe incluir un campo 'id'." });
  }

  const alerts = upsertMarketAlertSqlServer(sessionEmail, payload);
  const alertStatus = getMarketAlertStatusSqlServer(sessionEmail);
  return res.status(200).json({ ok: true, alerts, alertStatus });
};
