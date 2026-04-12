const {
  resolveAccountByEmail,
  updateProfile,
  updateBillingState,
} = require("./_billingStore");
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

module.exports = async function billingAccountHandler(req, res) {
  if (req.method && !["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const requestEmail = normalizeText(req.query?.email || body.email).toLowerCase();
  const email = sessionEmail || (requireSession ? "" : requestEmail);

  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para gestionar facturacion." });
  }

  if (req.method === "GET") {
    const account = resolveAccountByEmail(email);
    return res.status(200).json({ ok: true, account });
  }

  const action = normalizeText(body.action || "").toLowerCase();

  if (action === "update_profile") {
    const account = updateProfile(email, body.profile || {});
    return res.status(200).json({ ok: true, account, message: "Perfil actualizado." });
  }

  if (action === "update_billing_state") {
    const account = updateBillingState(email, body.billingState || {});
    return res.status(200).json({ ok: true, account, message: "Estado de facturacion actualizado." });
  }

  return res.status(400).json({ error: "Accion no valida para billing-account." });
};
