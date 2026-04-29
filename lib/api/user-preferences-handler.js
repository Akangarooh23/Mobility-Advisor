const {
  shouldUseSqlServerMobility,
  getUserPreferencesSqlServer,
  upsertUserPreferencesSqlServer,
} = require("../sqlserverMobilityStore");
const authHandler = require("../../api/auth");

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

module.exports = async function userPreferencesHandler(req, res) {
  const method = normalizeText(req.method).toUpperCase();
  if (!["GET", "PUT", "POST"].includes(method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  if (!sessionEmail) {
    return res.status(401).json({ error: "Sesion no valida. Inicia sesion para gestionar preferencias." });
  }

  if (!shouldUseSqlServerMobility()) {
    return res.status(503).json({ error: "Backend de movilidad no configurado.", fallback: true });
  }

  if (method === "GET") {
    const preferences = getUserPreferencesSqlServer(sessionEmail);
    return res.status(200).json({ ok: true, preferences: preferences || null });
  }

  const body = parseBody(req.body);
  const payload = body.preferences || body;
  const preferences = upsertUserPreferencesSqlServer(sessionEmail, payload);
  return res.status(200).json({ ok: true, preferences, message: "Preferencias guardadas correctamente." });
};