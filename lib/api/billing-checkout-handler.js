const { resolveAccount, updateBillingState } = require("../billingStore");
const { resolvePlanById, resolvePlanPriceId, getCheckoutPlansCatalog } = require("../billingCatalog");
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

function encodeForm(payload = {}) {
  return new URLSearchParams(payload).toString();
}

function buildStripeCustomerForm(profile = {}, customerEmail = "") {
  const fullName = normalizeText(profile?.fullName);
  const phone = normalizeText(profile?.phone);
  const billingAddress = normalizeText(profile?.billingAddress);
  const taxId = normalizeText(profile?.taxId);
  const company = normalizeText(profile?.company);
  const payload = {
    email: customerEmail,
    name: fullName || customerEmail,
  };

  if (phone) payload.phone = phone;
  if (billingAddress) payload["address[line1]"] = billingAddress;
  if (taxId) payload["metadata[tax_id]"] = taxId;
  if (company) payload["metadata[company]"] = company;

  return payload;
}

async function upsertStripeCustomer({ stripeSecretKey, account = {}, customerEmail = "" }) {
  const existingCustomerId = normalizeText(account?.billing?.stripeCustomerId);
  const customerPayload = buildStripeCustomerForm(account?.profile, customerEmail);
  const targetUrl = existingCustomerId
    ? `https://api.stripe.com/v1/customers/${encodeURIComponent(existingCustomerId)}`
    : "https://api.stripe.com/v1/customers";

  const stripeResponse = await fetch(targetUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm(customerPayload),
  });

  const data = await stripeResponse.json().catch(() => ({}));

  if (!stripeResponse.ok) {
    const detail = normalizeText(data?.error?.message || stripeResponse.statusText);
    throw new Error(detail || "No se pudo preparar el cliente de Stripe.");
  }

  return normalizeText(data?.id);
}

module.exports = async function billingCheckoutHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const requestedPlanId = normalizeText(body.planId).toLowerCase();

  // One-time payment: vehicle valuation/tasación report
  if (requestedPlanId === "valuation") {
    const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
    const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
    const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
    const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
    if (!customerEmail) return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para solicitar la tasacion." });

    const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const priceId = normalizeText(process.env.STRIPE_PRICE_VALUATION);
    const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";
    const successUrl = `${origin || "https://example.com"}/vender?tasacion=ok`;
    const cancelUrl = `${origin || "https://example.com"}/vender?tasacion=cancel`;

    if (!stripeSecretKey || !priceId) {
      return res.status(200).json({ ok: true, simulated: true, message: "Tasacion en modo simulado. Configura STRIPE_SECRET_KEY y STRIPE_PRICE_VALUATION.", url: "" });
    }

    try {
      const stripeCustomerId = await upsertStripeCustomer({ stripeSecretKey, account: {}, customerEmail });
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          customer: stripeCustomerId,
          "metadata[plan_id]": "valuation",
          "metadata[customer_email]": customerEmail,
          "metadata[veh_brand]":    normalizeText(body.brand).slice(0, 100),
          "metadata[veh_model]":    normalizeText(body.model).slice(0, 100),
          "metadata[veh_version]":  normalizeText(body.version).slice(0, 100),
          "metadata[veh_year]":     normalizeText(String(body.year || "")),
          "metadata[veh_mileage]":  normalizeText(String(body.mileage || "")),
          "metadata[veh_fuel]":     normalizeText(body.fuel).slice(0, 40),
          "metadata[veh_plate]":    normalizeText(body.plate).slice(0, 20),
          "metadata[veh_damage]":   normalizeText(body.damageLevel).slice(0, 40),
          "metadata[veh_damage_desc]": normalizeText(body.damageDescription).slice(0, 400),
          "metadata[veh_province]": normalizeText(body.province).slice(0, 80),
        }),
      });
      const data = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) return res.status(502).json({ error: normalizeText(data?.error?.message) || "Error al crear sesion de pago." });
      return res.status(200).json({ ok: true, url: normalizeText(data?.url) });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Error interno al procesar el pago." });
    }
  }

  if (requestedPlanId === "valuation_fleet") {
    const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
    const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
    const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
    const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
    if (!customerEmail) return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para solicitar la tasacion." });

    const vehicles = Array.isArray(body.fleetVehicles) ? body.fleetVehicles : [];
    if (!vehicles.length) return res.status(400).json({ error: "No se han seleccionado vehiculos para tasar." });

    const TIERS = [
      { max: 1,  price: 1000 },
      { max: 4,  price: 900  },
      { max: 9,  price: 800  },
      { max: 19, price: 700  },
      { max: 49, price: 600  },
      { max: 99, price: 500  },
    ];
    const count = vehicles.length;
    const tier = TIERS.find((t) => count <= t.max);
    if (!tier) return res.status(400).json({ error: "Para flotas de 100+ vehiculos contacta con nuestro equipo comercial." });
    const unitAmountCents = tier.price;
    const totalCents = unitAmountCents * count;

    const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
    const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";
    const successUrl = `${origin || "https://example.com"}/vender?tasacion=ok&fleet=${count}`;
    const cancelUrl  = `${origin || "https://example.com"}/vender?tasacion=cancel`;

    if (!stripeSecretKey) {
      return res.status(200).json({ ok: true, simulated: true, message: "Flota en modo simulado.", url: "" });
    }

    // Serialize vehicles into chunks of max 480 chars each
    const compact = vehicles.map((v) => ({
      b: String(v.brand   || "").slice(0, 20),
      m: String(v.model   || "").slice(0, 20),
      y: String(v.year    || ""),
      k: String(v.mileage || ""),
      f: String(v.fuel    || "").slice(0, 12),
      p: String(v.plate   || "").slice(0, 10),
      pr: String(v.province || "").slice(0, 20),
    }));
    const fleetJson = JSON.stringify(compact);
    const fleetMeta = {};
    const chunkSize = 480;
    for (let i = 0; i * chunkSize < fleetJson.length; i++) {
      fleetMeta[`metadata[fleet_${i}]`] = fleetJson.slice(i * chunkSize, (i + 1) * chunkSize);
    }
    fleetMeta[`metadata[fleet_chunks]`] = String(Math.ceil(fleetJson.length / chunkSize));

    try {
      const stripeCustomerId = await upsertStripeCustomer({ stripeSecretKey, account: {}, customerEmail });
      const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeSecretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm({
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          "line_items[0][price_data][currency]": "eur",
          "line_items[0][price_data][unit_amount]": String(totalCents),
          "line_items[0][price_data][product_data][name]": `Informe de Tasacion de Mercado · ${count} vehiculo${count !== 1 ? "s" : ""}`,
          "line_items[0][price_data][product_data][description]": `${count} informes PDF · ${unitAmountCents / 100} €/unidad · Entrega automatica por email`,
          "line_items[0][quantity]": "1",
          customer: stripeCustomerId,
          "metadata[plan_id]": "valuation_fleet",
          "metadata[customer_email]": customerEmail,
          "metadata[fleet_count]": String(count),
          ...fleetMeta,
        }),
      });
      const data = await stripeResponse.json().catch(() => ({}));
      if (!stripeResponse.ok) return res.status(502).json({ error: normalizeText(data?.error?.message) || "Error al crear sesion de pago." });
      return res.status(200).json({ ok: true, url: normalizeText(data?.url) });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Error interno al procesar el pago de flota." });
    }
  }

  const billingMode = normalizeText(body.billingMode).toLowerCase() === "annual" ? "annual" : "monthly";
  const selectedPlan = resolvePlanById(requestedPlanId);
  const planId = normalizeText(selectedPlan?.id).toLowerCase();
  const planLabel = normalizeText(selectedPlan?.label) || "Plan CarsWise";
  const priceId = resolvePlanPriceId(planId, billingMode);
  const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionUserId = normalizeText(sessionPayload?.user?.id);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
  const identity = { userId: sessionUserId, email: customerEmail };
  const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";

  if (!customerEmail) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para iniciar checkout." });
  }

  const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
  const successUrl = normalizeText(process.env.STRIPE_CHECKOUT_SUCCESS_URL) || `${origin || "https://example.com"}/panel/cuenta?checkout=ok`;
  const cancelUrl = normalizeText(process.env.STRIPE_CHECKOUT_CANCEL_URL) || `${origin || "https://example.com"}/panel/cuenta?checkout=cancel`;
  const accountSnapshot = resolveAccount(identity);

  if (!selectedPlan) {
    return res.status(400).json({
      error: "Plan no valido para checkout.",
      plans: getCheckoutPlansCatalog(),
    });
  }

  if (!priceId) {
    return res.status(400).json({
      error: "Este plan no tiene precio de Stripe configurado para checkout.",
      planId,
      planLabel,
      plans: getCheckoutPlansCatalog(),
    });
  }

  if (!stripeSecretKey || !priceId) {
    const account = updateBillingState(customerEmail, {
      planId,
      planLabel,
      status: "pendiente",
    });

    return res.status(200).json({
      ok: true,
      simulated: true,
      provider: "stripe",
      message: "Checkout preparado en modo simulado. Configura STRIPE_SECRET_KEY y los precios (BILLING_PLANS_JSON o STRIPE_PRICE_*).",
      url: "",
      account,
      plans: getCheckoutPlansCatalog(),
    });
  }

  try {
    const stripeCustomerId = await upsertStripeCustomer({
      stripeSecretKey,
      account: accountSnapshot,
      customerEmail,
    });

    // Guard against duplicate subscription: check if customer already has an active subscription
    if (planId === "plus") {
      const subsRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=active&limit=1`, {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      });
      const subsData = await subsRes.json().catch(() => ({}));
      if (Array.isArray(subsData?.data) && subsData.data.length > 0) {
        return res.status(409).json({
          error: "Ya tienes una suscripcion Plus activa. Ve a 'Gestionar metodo de pago' para administrarla.",
          alreadyActive: true,
        });
      }
    }

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodeForm({
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        customer: stripeCustomerId,
        "metadata[plan_id]": planId,
        "metadata[billing_mode]": billingMode,
      }),
    });

    const data = await stripeResponse.json().catch(() => ({}));

    if (!stripeResponse.ok) {
      const detail = normalizeText(data?.error?.message || stripeResponse.statusText);
      return res.status(502).json({ error: detail || "No se pudo crear la sesion de checkout en Stripe." });
    }

    return res.status(200).json({
      ok: true,
      simulated: false,
      provider: "stripe",
      sessionId: normalizeText(data?.id),
      url: normalizeText(data?.url),
      message: "Checkout de Stripe listo.",
      account: updateBillingState(customerEmail, {
        planId,
        planLabel,
        status: "checkout_abierto",
        stripeCustomerId,
      }),
      plans: getCheckoutPlansCatalog(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "No se pudo iniciar checkout.",
    });
  }
};