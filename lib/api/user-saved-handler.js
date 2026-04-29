const {
  shouldUseSqlServerMobility,
  listSavedComparisonsSqlServer,
  upsertSavedComparisonSqlServer,
  removeSavedComparisonSqlServer,
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

module.exports = async function userSavedHandler(req, res) {
  const method = normalizeText(req.method).toUpperCase();
  if (!["GET", "POST", "DELETE"].includes(method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  if (!sessionEmail) {
    return res.status(401).json({ error: "Sesion no valida. Inicia sesion para gestionar comparaciones guardadas." });
  }

  if (!shouldUseSqlServerMobility()) {
    return res.status(503).json({ error: "Backend de movilidad no configurado.", fallback: true });
  }

  if (method === "GET") {
    const comparisons = listSavedComparisonsSqlServer(sessionEmail);
    return res.status(200).json({ ok: true, comparisons });
  }

  if (method === "DELETE") {
    const id = normalizeText(req.query?.id);
    if (!id) {
      return res.status(400).json({ error: "Falta el parametro 'id' para eliminar." });
    }

    const comparisons = removeSavedComparisonSqlServer(sessionEmail, id);
    return res.status(200).json({ ok: true, comparisons });
  }

  const body = parseBody(req.body);
  const payload = body.comparison || body;
  const id = normalizeText(payload?.id);
  if (!id) {
    return res.status(400).json({ error: "El payload de la comparacion debe incluir un campo 'id'." });
  }

  const comparisons = upsertSavedComparisonSqlServer(sessionEmail, payload);
  return res.status(200).json({ ok: true, comparisons });
};