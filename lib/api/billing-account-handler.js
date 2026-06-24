const {
  resolveAccount,
  updateProfile,
  updateBillingState,
  listGarageVehicleSummaries,
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
} = require("../billingStore");
const { getCheckoutPlansCatalog } = require("../billingCatalog");
const authHandler = require("../../api/auth");

let _accountPgPool = null;
function getAccountPgPool() {
  if (_accountPgPool) return _accountPgPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _accountPgPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _accountPgPool;
}

const ACTIVE_STATUSES = new Set(["activa", "trialing"]);

async function getPlanFromPostgres(email) {
  const pool = getAccountPgPool();
  if (!pool || !email) return null;
  try {
    const result = await pool.query(
      `SELECT plan_id, plan_status, stripe_customer_id, stripe_subscription_id, next_billing_date, cancel_at_period_end
       FROM moveadvisor_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
      planId: row.plan_id || "free",
      status: row.plan_status || "inactivo",
      stripeCustomerId: row.stripe_customer_id || "",
      stripeSubscriptionId: row.stripe_subscription_id || "",
      nextBillingDate: row.next_billing_date ? new Date(row.next_billing_date).toISOString() : "",
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    };
  } catch {
    return null;
  }
}

async function getProfileFromPostgres(email) {
  const pool = getAccountPgPool();
  if (!pool || !email) return null;
  try {
    const result = await pool.query(
      `SELECT name, apellidos, phone, company_name, tax_id, billing_address,
              billing_street, billing_postal_code, billing_province, client_type, iban
       FROM moveadvisor_users WHERE lower(email) = lower($1) LIMIT 1`,
      [email]
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    const clientType = normalizeText(row.client_type) || "individual";
    const fullName = clientType === "business"
      ? normalizeText(row.company_name)
      : [normalizeText(row.name), normalizeText(row.apellidos)].filter(Boolean).join(" ");
    return {
      fullName,
      phone: normalizeText(row.phone),
      companyName: normalizeText(row.company_name),
      taxId: normalizeText(row.tax_id),
      billingAddress: normalizeText(row.billing_address),
      billingStreet: normalizeText(row.billing_street),
      billingPostalCode: normalizeText(row.billing_postal_code),
      billingProvince: normalizeText(row.billing_province),
      clientType,
      iban: normalizeText(row.iban),
    };
  } catch {
    return null;
  }
}

async function saveProfileToPostgres(email, profile) {
  const pool = getAccountPgPool();
  if (!pool || !email) return;
  try {
    const clientType = normalizeText(profile?.clientType) || "individual";
    const street   = normalizeText(profile?.billingStreet);
    const postal   = normalizeText(profile?.billingPostalCode);
    const province = normalizeText(profile?.billingProvince);
    const generatedAddress = [street, postal, province].filter(Boolean).join(", ");

    let firstName, lastName, companyName;
    if (clientType === "business") {
      firstName   = "";
      lastName    = "";
      companyName = normalizeText(profile?.companyName || profile?.fullName);
    } else {
      const nameParts = normalizeText(profile?.fullName).split(/\s+/).filter(Boolean);
      firstName   = nameParts[0] || "";
      lastName    = nameParts.slice(1).join(" ");
      companyName = normalizeText(profile?.companyName);
    }

    await pool.query(
      `UPDATE moveadvisor_users
       SET name = $2, apellidos = $3, phone = $4, company_name = $5, tax_id = $6,
           billing_address = $7, iban = $8,
           billing_street = $9, billing_postal_code = $10, billing_province = $11,
           client_type = $12, profile_updated_at = NOW()
       WHERE lower(email) = lower($1)`,
      [
        email,
        firstName,
        lastName,
        normalizeText(profile?.phone),
        companyName,
        normalizeText(profile?.taxId),
        generatedAddress || normalizeText(profile?.billingAddress),
        normalizeText(profile?.iban),
        street,
        postal,
        province,
        clientType,
      ]
    );
  } catch {}
}

async function getInvoicesFromPostgres(email) {
  const pool = getAccountPgPool();
  if (!pool || !email) return null;
  try {
    const result = await pool.query(
      `SELECT id, number, date, amount, status, pdf_url, cw_pdf_url, cw_invoice_number
       FROM moveadvisor_user_invoices
       WHERE lower(email) = lower($1)
       ORDER BY date DESC NULLS LAST
       LIMIT 50`,
      [email]
    );
    return result.rows.map((row) => ({
      id: row.id || "",
      number: row.cw_invoice_number || row.number || "",
      date: row.date ? new Date(row.date).toISOString() : "",
      amount: Number(row.amount || 0),
      status: row.status || "",
      pdfUrl: row.cw_pdf_url || row.pdf_url || "",
    }));
  } catch {
    return null;
  }
}

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

function encodeForm(payload = {}) {
  return new URLSearchParams(payload).toString();
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
      if (String(req.query?.summary || "").toLowerCase() === "true") {
        return res.status(200).json({ ok: true, vehicles: await listGarageVehicleSummaries(identity) });
      }
      return res.status(200).json({ ok: true, vehicles: await listGarageVehicles(identity) });
    }

    if (normalizeText(req.query?.scope).toLowerCase() === "mobility") {
      const [mobilityData, garageVehicles] = await Promise.all([
        getUserMobilityData(identity),
        listGarageVehicles(identity),
      ]);
      return res.status(200).json({ ok: true, ...mobilityData, garageVehicleCount: Array.isArray(garageVehicles) ? garageVehicles.length : 0 });
    }

    const account = resolveAccount(identity);
    const [pgPlan, pgInvoices, pgProfile] = await Promise.all([
      getPlanFromPostgres(email),
      getInvoicesFromPostgres(email),
      getProfileFromPostgres(email),
    ]);
    if (pgPlan) {
      account.billingState = account.billingState || {};
      account.billingState.planId = pgPlan.planId;
      account.billingState.status = pgPlan.status;
      if (pgPlan.planId === "plus") {
        account.billingState.planLabel = "Plus";
      } else if (pgPlan.planId === "free") {
        account.billingState.planLabel = "Free";
      }
      if (pgPlan.stripeCustomerId) account.billingState.stripeCustomerId = pgPlan.stripeCustomerId;
      if (pgPlan.stripeSubscriptionId) account.billingState.stripeSubscriptionId = pgPlan.stripeSubscriptionId;
      if (pgPlan.nextBillingDate) account.billingState.nextBillingDate = pgPlan.nextBillingDate;
      account.billingState.cancelAtPeriodEnd = pgPlan.cancelAtPeriodEnd;
    }
    if (pgInvoices) {
      account.billingState = account.billingState || {};
      account.billingState.invoices = pgInvoices;
    }
    if (pgProfile) {
      account.profile = account.profile || {};
      if (pgProfile.fullName) account.profile.fullName = pgProfile.fullName;
      if (pgProfile.phone) account.profile.phone = pgProfile.phone;
      account.profile.email = email;
    }

    // If plan is plus but status is not confirmed active, verify with Stripe and auto-heal
    const currentStatus = normalizeText(account?.billingState?.status).toLowerCase();
    const currentPlanId = normalizeText(account?.billingState?.planId).toLowerCase();
    const stripeKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const needsStripeVerification = stripeKey && (currentPlanId === "plus" && !ACTIVE_STATUSES.has(currentStatus));
    if (needsStripeVerification) {
      try {
        const custRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const custData = await custRes.json().catch(() => ({}));
        const stripeCustomerId = normalizeText(custData?.data?.[0]?.id);
        if (stripeCustomerId) {
          const subsRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`, {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          const subsData = await subsRes.json().catch(() => ({}));
          if (Array.isArray(subsData?.data) && subsData.data.length > 0) {
            const sub = subsData.data[0];
            const subId = normalizeText(sub?.id);
            const nextBillingDate = sub?.current_period_end
              ? new Date(Number(sub.current_period_end) * 1000).toISOString()
              : "";
            account.billingState = account.billingState || {};
            account.billingState.planId = "plus";
            account.billingState.planLabel = "Plus";
            account.billingState.status = "activa";
            account.billingState.stripeCustomerId = stripeCustomerId;
            if (subId) account.billingState.stripeSubscriptionId = subId;
            if (nextBillingDate) account.billingState.nextBillingDate = nextBillingDate;
            account.billingState.cancelAtPeriodEnd = Boolean(sub?.cancel_at_period_end);
            const pool = getAccountPgPool();
            if (pool) {
              pool.query(
                `UPDATE moveadvisor_users
                 SET plan_id = 'plus', plan_status = 'activa', plan_updated_at = NOW(),
                     stripe_customer_id = $2, stripe_subscription_id = $3,
                     next_billing_date = CASE WHEN $4 <> '' THEN $4::timestamptz ELSE next_billing_date END,
                     cancel_at_period_end = $5
                 WHERE lower(email) = lower($1)`,
                [email, stripeCustomerId, subId, nextBillingDate, Boolean(sub?.cancel_at_period_end)]
              ).catch(() => {});
            }
          }
        }
      } catch {}
    }
    return res.status(200).json({
      ok: true,
      account,
      billingCatalog: {
        plans: getCheckoutPlansCatalog(),
      },
    });
  }

  const action = normalizeText(body.action || "").toLowerCase();

  if (action === "update_profile") {
    const profile = body.profile || {};
    updateProfile(email, profile);
    await saveProfileToPostgres(email, profile);
    const updatedAccount = resolveAccount({ email, userId: identity.userId });
    const st = normalizeText(profile.billingStreet);
    const pc = normalizeText(profile.billingPostalCode);
    const pv = normalizeText(profile.billingProvince);
    updatedAccount.profile = {
      ...(updatedAccount.profile || {}),
      fullName: normalizeText(profile.fullName),
      phone: normalizeText(profile.phone),
      companyName: normalizeText(profile.companyName),
      taxId: normalizeText(profile.taxId),
      billingStreet: st,
      billingPostalCode: pc,
      billingProvince: pv,
      billingAddress: [st, pc, pv].filter(Boolean).join(", ") || normalizeText(profile.billingAddress),
      clientType: normalizeText(profile.clientType) || "individual",
      iban: normalizeText(profile.iban),
      email,
      updatedAt: new Date().toISOString(),
    };
    return res.status(200).json({ ok: true, account: updatedAccount, message: "Perfil actualizado." });
  }

  if (action === "update_billing_state") {
    const account = updateBillingState(email, body.billingState || {});
    return res.status(200).json({ ok: true, account, message: "Estado de facturacion actualizado." });
  }

  if (action === "garage_add") {
    const vehicle = body.vehicle || body;
    const brand = normalizeText(vehicle?.brand);
    const model = normalizeText(vehicle?.model);

    if (!brand || !model) {
      return res.status(400).json({ error: "Debes indicar marca y modelo para guardar el vehiculo." });
    }

    const vehicles = await addGarageVehicle(identity, body.vehicle || body);
    const persistedVehicleId = normalizeText(vehicle?.id);
    const persistedVehicle = vehicles.find((item) => normalizeText(item?.id) === persistedVehicleId) || vehicles[0] || null;

    const persistedDocumentSummary = persistedVehicle
      ? {
          photos: Array.isArray(persistedVehicle?.photos) ? persistedVehicle.photos.length : 0,
          documents: Array.isArray(persistedVehicle?.documents) ? persistedVehicle.documents.length : 0,
          technicalSheetDocuments: Array.isArray(persistedVehicle?.technicalSheetDocuments) ? persistedVehicle.technicalSheetDocuments.length : 0,
          circulationPermitDocuments: Array.isArray(persistedVehicle?.circulationPermitDocuments) ? persistedVehicle.circulationPermitDocuments.length : 0,
          itvDocuments: Array.isArray(persistedVehicle?.itvDocuments) ? persistedVehicle.itvDocuments.length : 0,
          insuranceDocuments: Array.isArray(persistedVehicle?.insuranceDocuments) ? persistedVehicle.insuranceDocuments.length : 0,
          maintenanceInvoices: Array.isArray(persistedVehicle?.maintenanceInvoices) ? persistedVehicle.maintenanceInvoices.length : 0,
        }
      : null;

    return res.status(200).json({ ok: true, vehicles, message: "Vehiculo guardado.", persistedDocumentSummary });
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

  if (action === "cancel_subscription") {
    const account = resolveAccount(identity);
    const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const subscriptionId = normalizeText(body.subscriptionId) || normalizeText(account?.billingState?.stripeSubscriptionId);
    const cancelMode = normalizeText(body.cancelMode).toLowerCase() === "immediate" ? "immediate" : "end_of_period";

    if (!subscriptionId) {
      return res.status(409).json({ error: "No hay suscripcion activa para cancelar.", account });
    }

    if (!stripeSecretKey) {
      const nextAccount = updateBillingState(email, {
        status: "cancelado",
        cancelAtPeriodEnd: true,
      });

      return res.status(200).json({
        ok: true,
        simulated: true,
        message: "Cancelacion simulada. Configura STRIPE_SECRET_KEY para cancelar en Stripe real.",
        account: nextAccount,
      });
    }

    try {
      const endpoint = `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`;
      const stripeResponse = await fetch(endpoint, {
        method: cancelMode === "immediate" ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: cancelMode === "immediate" ? undefined : encodeForm({ cancel_at_period_end: "true" }),
      });

      const data = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) {
        const detail = normalizeText(data?.error?.message || stripeResponse.statusText);
        return res.status(502).json({ error: detail || "No se pudo cancelar la suscripcion en Stripe." });
      }

      const nextBillingState = {
        stripeSubscriptionId: normalizeText(data?.id) || subscriptionId,
        status: cancelMode === "immediate" ? "cancelado" : "activa",
        cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
        nextBillingDate: Number(data?.current_period_end)
          ? new Date(Number(data.current_period_end) * 1000).toISOString()
          : normalizeText(account?.billingState?.nextBillingDate),
      };

      const nextAccount = updateBillingState(email, nextBillingState);
      return res.status(200).json({
        ok: true,
        simulated: false,
        message: cancelMode === "immediate"
          ? "Suscripcion cancelada inmediatamente."
          : "Suscripcion marcada para cancelarse al final del periodo.",
        account: nextAccount,
      });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "No se pudo cancelar la suscripcion.",
      });
    }
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