const { resolveAccount } = require("../billingStore");
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

module.exports = async function billingPortalHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseBody(req.body);
  const requireSession = String(process.env.AUTH_BILLING_REQUIRE_SESSION || "true").toLowerCase() !== "false";
  const sessionPayload = await authHandler.getSessionUserFromRequest?.(req);
  const sessionUserId = normalizeText(sessionPayload?.user?.id);
  const sessionEmail = normalizeText(sessionPayload?.user?.email).toLowerCase();
  const bodyCustomerId = normalizeText(body.customerId);
  const customerEmail = sessionEmail || (requireSession ? "" : normalizeText(body.customerEmail).toLowerCase());
  const identity = { userId: sessionUserId, email: customerEmail };
  const origin = normalizeText(body.origin) || normalizeText(req.headers?.origin) || "";
  const stripeSecretKey = normalizeText(process.env.STRIPE_SECRET_KEY);
  const account = customerEmail ? resolveAccount(identity) : null;
  const customerId = bodyCustomerId || normalizeText(account?.billingState?.stripeCustomerId);

  if (!customerEmail && !customerId) {
    return res.status(401).json({ error: "Sesion no valida. Debes iniciar sesion para abrir el portal." });
  }

  if (!stripeSecretKey) {
    return res.status(200).json({
      ok: true,
      simulated: true,
      provider: "stripe",
      message: "Portal de cliente preparado en modo simulado. Configura STRIPE_SECRET_KEY para activarlo.",
      url: "",
      account,
    });
  }

  if (!customerId) {
    return res.status(409).json({
      error: "No hay customerId de Stripe guardado para este usuario. Completa primero un checkout real.",
    });
  }

  const returnUrl = normalizeText(process.env.STRIPE_PORTAL_RETURN_URL) || `${origin || "https://example.com"}/panel/cuenta`;

  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodeForm({ customer: customerId, return_url: returnUrl }),
    });

    const data = await stripeResponse.json().catch(() => ({}));

    if (!stripeResponse.ok) {
      const detail = normalizeText(data?.error?.message || stripeResponse.statusText);
      return res.status(502).json({ error: detail || "No se pudo crear el portal de Stripe." });
    }

    return res.status(200).json({
      ok: true,
      simulated: false,
      provider: "stripe",
      url: normalizeText(data?.url),
      message: "Portal de cliente listo.",
      account,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "No se pudo abrir el portal de facturacion.",
    });
  }
};