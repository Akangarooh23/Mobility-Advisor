const { resolveAccountByEmail, updateBillingState } = require("./_billingStore");
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

  if (phone) {
    payload.phone = phone;
  }

  if (billingAddress) {
    payload["address[line1]"] = billingAddress;
  }

  if (taxId) {
    payload["metadata[tax_id]"] = taxId;
  }

  if (company) {
    payload["metadata[company]"] = company;
  }

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

function getPlanPriceId(planId = "") {
  const normalized = normalizeText(planId).toLowerCase();

  const map = {
    gratis: normalizeText(process.env.STRIPE_PRICE_GRATIS),
    bronce: normalizeText(process.env.STRIPE_PRICE_BRONCE),
    plata: normalizeText(process.env.STRIPE_PRICE_PLATA),
    oro: normalizeText(process.env.STRIPE_PRICE_ORO),
    platino: normalizeText(process.env.STRIPE_PRICE_PLATINO),
  };

  return map[normalized] || "";
}

module.exports = async function billingCheckoutHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const planId = normalizeText(body.planId || "plata").toLowerCase();
  const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
  const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";

  if (!customerEmail) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para iniciar checkout." });
  }

  const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
  const priceId = getPlanPriceId(planId);
  const successUrl = normalizeText(process.env.STRIPE_CHECKOUT_SUCCESS_URL) || `${origin || "https://example.com"}/panel/cuenta?checkout=ok`;
  const cancelUrl = normalizeText(process.env.STRIPE_CHECKOUT_CANCEL_URL) || `${origin || "https://example.com"}/panel/cuenta?checkout=cancel`;
  const accountSnapshot = resolveAccountByEmail(customerEmail);
  const planLabelMap = {
    gratis: "Plan Gratis",
    bronce: "Plan Bronce",
    plata: "Plan Plata",
    oro: "Plan Oro",
    platino: "Plan Platino",
  };
  const planLabel = planLabelMap[planId] || "Plan MoveAdvisor";

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
      message: "Checkout preparado en modo simulado. Configura STRIPE_SECRET_KEY y STRIPE_PRICE_* para activarlo.",
      url: "",
      account,
    });
  }

  try {
    const stripeCustomerId = await upsertStripeCustomer({
      stripeSecretKey,
      account: accountSnapshot,
      customerEmail,
    });

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
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "No se pudo iniciar checkout.",
    });
  }
};
