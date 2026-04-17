const {
  resolveAccountByEmail,
  updateProfile,
  updateBillingState,
  listGarageVehiclesByEmail,
  addGarageVehicleByEmail,
  removeGarageVehicleByEmail,
} = require("../lib/billingStore");
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
  const defaultRequireSession = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || (defaultRequireSession ? "true" : "false")).toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const requestEmail = normalizeText(req.query?.email || body.email).toLowerCase();
  const email = sessionEmail || (requireSession ? "" : requestEmail);

  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para gestionar facturacion." });
  }

  if (req.method === "GET") {
    if (normalizeText(req.query?.scope).toLowerCase() === "garage") {
      return res.status(200).json({ ok: true, vehicles: listGarageVehiclesByEmail(email) });
    }

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

  if (action === "garage_add") {
    const vehicles = addGarageVehicleByEmail(email, body.vehicle || body);
    return res.status(200).json({ ok: true, vehicles, message: "Vehiculo guardado." });
  }

  if (action === "garage_remove") {
    const vehicles = removeGarageVehicleByEmail(email, body.vehicleId || body.id);
    return res.status(200).json({ ok: true, vehicles, message: "Vehiculo eliminado." });
  }

  return res.status(400).json({ error: "Accion no valida para billing-account." });
};
