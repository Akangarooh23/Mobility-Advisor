const crypto = require("crypto");
const {
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
  updateBillingState,
} = require("../lib/billingStore");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRawBody(value) {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return "";
}

function safeJsonParse(value) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    return {};
  }
}

function parseStripeSignature(header = "") {
  const parts = String(header || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const values = {};
  parts.forEach((part) => {
    const [key, val] = part.split("=");
    if (key && val) {
      values[key] = val;
    }
  });

  return {
    timestamp: values.t || "",
    signature: values.v1 || "",
  };
}

function verifyStripeSignature(rawBody = "", header = "", webhookSecret = "") {
  const { timestamp, signature } = parseStripeSignature(header);

  if (!timestamp || !signature || !webhookSecret) {
    return false;
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function resolvePlanLabel(planId = "") {
  const normalized = normalizeText(planId).toLowerCase();

  const labels = {
    gratis: "Plan Gratis",
    bronce: "Plan Bronce",
    plata: "Plan Plata",
    oro: "Plan Oro",
    platino: "Plan Platino",
  };

  return labels[normalized] || "Plan MoveAdvisor";
}

function toIsoDateFromEpoch(seconds) {
  const safe = Number(seconds || 0);
  if (!Number.isFinite(safe) || safe <= 0) {
    return "";
  }

  return new Date(safe * 1000).toISOString();
}

module.exports = async function billingWebhookHandler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = normalizeText(process.env.STRIPE_WEBHOOK_SECRET);
  const rawBody = normalizeRawBody(req.rawBody) || JSON.stringify(req.body || {});
  const signatureHeader = normalizeText(req.headers?.["stripe-signature"]);

  if (webhookSecret) {
    const isValid = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);

    if (!isValid) {
      return res.status(400).json({ error: "Firma de webhook no valida." });
    }
  }

  const event = safeJsonParse(rawBody);
  const eventType = normalizeText(event?.type);
  const eventData = event?.data?.object || {};

  if (!eventType) {
    return res.status(400).json({ error: "Evento de Stripe invalido." });
  }

  if (eventType === "checkout.session.completed") {
    const email = normalizeText(eventData?.customer_email || eventData?.customer_details?.email).toLowerCase();
    const customerId = normalizeText(eventData?.customer);
    const subscriptionId = normalizeText(eventData?.subscription);
    const planId = normalizeText(eventData?.metadata?.plan_id || "plata").toLowerCase();

    if (email) {
      updateBillingState(email, {
        planId,
        planLabel: resolvePlanLabel(planId),
        status: "activa",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
    }
  }

  if (eventType === "customer.subscription.updated" || eventType === "customer.subscription.created" || eventType === "customer.subscription.deleted") {
    const customerId = normalizeText(eventData?.customer);
    const subscriptionId = normalizeText(eventData?.id);
    const email = getEmailByStripeCustomerId(customerId) || getEmailByStripeSubscriptionId(subscriptionId);

    if (email) {
      updateBillingState(email, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: normalizeText(eventData?.status) || "inactiva",
        nextBillingDate: toIsoDateFromEpoch(eventData?.current_period_end),
      });
    }
  }

  if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
    const customerId = normalizeText(eventData?.customer);
    const email = getEmailByStripeCustomerId(customerId);

    if (email) {
      appendOrUpdateInvoice(email, {
        id: normalizeText(eventData?.id),
        number: normalizeText(eventData?.number),
        date: toIsoDateFromEpoch(eventData?.created),
        amount: Number(eventData?.amount_paid || eventData?.amount_due || 0) / 100,
        status: eventType === "invoice.paid" ? "Pagada" : "Pago fallido",
        pdfUrl: normalizeText(eventData?.invoice_pdf || eventData?.hosted_invoice_url),
      });
    }
  }

  return res.status(200).json({ ok: true, received: true, eventType });
};
