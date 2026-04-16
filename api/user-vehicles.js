const authHandler = require("./auth");
const {
  listVehiclesByEmail,
  addVehicleByEmail,
  removeVehicleByEmail,
} = require("./_userVehiclesStore");

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

module.exports = async function userVehiclesHandler(req, res) {
  if (req.method && !["GET", "POST", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const defaultRequireSession = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const requireSession = String(process.env.AUTH_GARAGE_REQUIRE_SESSION || (defaultRequireSession ? "true" : "false")).toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const requestEmail = normalizeText(req.query?.email || body.email).toLowerCase();
  const email = sessionEmail || (requireSession ? "" : requestEmail);

  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para gestionar tus vehiculos." });
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, vehicles: listVehiclesByEmail(email) });
  }

  const action = normalizeText(body.action || "").toLowerCase();

  if (req.method === "DELETE" || action === "remove") {
    const vehicles = removeVehicleByEmail(email, body.vehicleId || body.id);
    return res.status(200).json({ ok: true, vehicles });
  }

  if (action === "add" || req.method === "POST") {
    const vehicles = addVehicleByEmail(email, body.vehicle || body);
    return res.status(200).json({ ok: true, vehicles });
  }

  return res.status(400).json({ error: "Accion no valida para user-vehicles." });
};
