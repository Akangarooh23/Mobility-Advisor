const {
  resolveAccount,
  updateProfile,
  updateBillingState,
  listGarageVehicles,
  addGarageVehicle,
  removeGarageVehicle,
  listAppointments,
  addAppointment,
  listMaintenances,
  addMaintenance,
  listInsurances,
  upsertInsurance,
  listValuations,
  addValuation,
  listVehicleStates,
  upsertVehicleState,
  listSavedOffers,
  addSavedOffer,
  removeSavedOffer,
  getUserMobilityData,
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
  const sessionUserId = normalizeText(sessionPayload?.user?.id);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const requestEmail = normalizeText(req.query?.email || body.email).toLowerCase();
  const email = sessionEmail || (requireSession ? "" : requestEmail);
  const identity = {
    userId: sessionUserId,
    email,
  };

  if (!email) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para gestionar facturacion." });
  }

  if (req.method === "GET") {
    if (normalizeText(req.query?.scope).toLowerCase() === "garage") {
      return res.status(200).json({ ok: true, vehicles: await listGarageVehicles(identity) });
    }

    if (normalizeText(req.query?.scope).toLowerCase() === "mobility") {
      return res.status(200).json({ ok: true, ...(await getUserMobilityData(identity)) });
    }

    const account = resolveAccount(identity);
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
    const vehicle = body.vehicle || body;
    const brand = normalizeText(vehicle?.brand);
    const model = normalizeText(vehicle?.model);
    const version = normalizeText(vehicle?.version);

    if (!brand || !model || !version) {
      return res.status(400).json({ error: "Debes indicar marca, modelo y version para guardar el vehiculo." });
    }

    const vehicles = await addGarageVehicle(identity, body.vehicle || body);
    return res.status(200).json({ ok: true, vehicles, message: "Vehiculo guardado." });
  }

  if (action === "garage_remove") {
    const vehicles = await removeGarageVehicle(identity, body.vehicleId || body.id);
    return res.status(200).json({ ok: true, vehicles, message: "Vehiculo eliminado." });
  }

  if (action === "appointment_add") {
    const appointments = await addAppointment(identity, body.appointment || body);
    return res.status(200).json({ ok: true, appointments, message: "Cita guardada." });
  }

  if (action === "valuation_add") {
    const valuations = await addValuation(identity, body.valuation || body);
    return res.status(200).json({ ok: true, valuations, message: "Tasacion guardada." });
  }

  if (action === "maintenance_add") {
    const maintenances = await addMaintenance(identity, body.maintenance || body);
    return res.status(200).json({ ok: true, maintenances, message: "Mantenimiento guardado." });
  }

  if (action === "insurance_upsert") {
    const insurances = await upsertInsurance(identity, body.insurance || body);
    return res.status(200).json({ ok: true, insurances, message: "Seguro actualizado." });
  }

  if (action === "vehicle_state_upsert") {
    const vehicleStates = await upsertVehicleState(identity, body.vehicleState || body);
    return res.status(200).json({ ok: true, vehicleStates, message: "Estado de vehiculo actualizado." });
  }

  if (action === "saved_offer_add") {
    const savedOffers = await addSavedOffer(identity, body.offer || body);
    return res.status(200).json({ ok: true, savedOffers, message: "Oferta guardada." });
  }

  if (action === "saved_offer_remove") {
    const savedOffers = await removeSavedOffer(identity, body.offerId || body.id);
    return res.status(200).json({ ok: true, savedOffers, message: "Oferta eliminada." });
  }

  if (action === "appointments_list") {
    return res.status(200).json({ ok: true, appointments: await listAppointments(identity) });
  }

  if (action === "valuations_list") {
    return res.status(200).json({ ok: true, valuations: await listValuations(identity) });
  }

  if (action === "maintenances_list") {
    return res.status(200).json({ ok: true, maintenances: await listMaintenances(identity) });
  }

  if (action === "insurances_list") {
    return res.status(200).json({ ok: true, insurances: await listInsurances(identity) });
  }

  if (action === "vehicle_states_list") {
    return res.status(200).json({ ok: true, vehicleStates: await listVehicleStates(identity) });
  }

  if (action === "saved_offers_list") {
    return res.status(200).json({ ok: true, savedOffers: await listSavedOffers(identity) });
  }

  return res.status(400).json({ error: "Accion no valida para billing-account." });
};
