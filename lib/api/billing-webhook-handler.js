const crypto = require("crypto");
const {
  appendOrUpdateInvoice,
  getEmailByStripeCustomerId,
  getEmailByStripeSubscriptionId,
  resolveAccount,
  updateBillingState,
} = require("../billingStore");
const { resolvePlanById, resolvePlanByStripePriceId } = require("../billingCatalog");

let _webhookPgPool = null;
function getWebhookPgPool() {
  if (_webhookPgPool) return _webhookPgPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _webhookPgPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _webhookPgPool;
}

async function syncPlanToPostgres(email, planId, status, extra = {}) {
  const pool = getWebhookPgPool();
  if (!pool || !email) return;
  try {
    await pool.query(
      `UPDATE moveadvisor_users
       SET plan_id = $1, plan_status = $2, plan_updated_at = NOW(),
           stripe_customer_id      = COALESCE(NULLIF($4, ''), stripe_customer_id),
           stripe_subscription_id  = COALESCE(NULLIF($5, ''), stripe_subscription_id),
           next_billing_date       = CASE WHEN $6::text <> '' THEN $6::timestamptz ELSE next_billing_date END,
           cancel_at_period_end    = COALESCE($7, cancel_at_period_end)
       WHERE lower(email) = lower($3)`,
      [
        planId || "free",
        status || "inactivo",
        email,
        extra.stripeCustomerId || "",
        extra.stripeSubscriptionId || "",
        extra.nextBillingDate || "",
        extra.cancelAtPeriodEnd ?? null,
      ]
    );
  } catch (e) {
    console.error("[webhook] syncPlanToPostgres error:", e.message);
  }
}

async function upsertInvoiceToPostgres(email, invoice) {
  const pool = getWebhookPgPool();
  if (!pool || !email || !invoice?.id) return;
  try {
    await pool.query(
      `INSERT INTO moveadvisor_user_invoices (id, email, number, date, amount, status, pdf_url)
       VALUES ($1, lower($2), $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status   = EXCLUDED.status,
         pdf_url  = EXCLUDED.pdf_url,
         amount   = EXCLUDED.amount`,
      [
        invoice.id,
        email,
        invoice.number || "",
        invoice.date || null,
        invoice.amount || 0,
        invoice.status || "",
        invoice.pdfUrl || "",
      ]
    );
  } catch (e) {
    console.error("[webhook] upsertInvoiceToPostgres error:", e.message);
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRawBody(value) {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
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
    if (key && val) values[key] = val;
  });

  return { timestamp: values.t || "", signature: values.v1 || "" };
}

function verifyStripeSignature(rawBody = "", header = "", webhookSecret = "") {
  const { timestamp, signature } = parseStripeSignature(header);
  if (!timestamp || !signature || !webhookSecret) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function resolvePlanLabel(planId = "") {
  return normalizeText(resolvePlanById(planId)?.label) || "Plan MoveAdvisor";
}

function toIsoDateFromEpoch(seconds) {
  const safe = Number(seconds || 0);
  if (!Number.isFinite(safe) || safe <= 0) return "";
  return new Date(safe * 1000).toISOString();
}

function normalizeStripeSubscriptionStatus(status = "") {
  const normalized = normalizeText(status).toLowerCase();

  if (normalized === "active" || normalized === "trialing") {
    return "activa";
  }

  if (normalized === "past_due" || normalized === "unpaid" || normalized === "incomplete") {
    return "pendiente";
  }

  if (normalized === "canceled" || normalized === "incomplete_expired") {
    return "cancelado";
  }

  return normalized || "inactiva";
}

function resolvePlanFromSubscriptionObject(subscription = {}) {
  const subscriptionPlanId = normalizeText(subscription?.metadata?.plan_id).toLowerCase();
  if (subscriptionPlanId) {
    const planById = resolvePlanById(subscriptionPlanId);
    if (planById) {
      return planById;
    }
  }

  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  for (const item of items) {
    const candidatePriceId = normalizeText(item?.price?.id);
    if (!candidatePriceId) {
      continue;
    }

    const planByPrice = resolvePlanByStripePriceId(candidatePriceId);
    if (planByPrice) {
      return planByPrice;
    }
  }

  return null;
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
    const planId = normalizeText(eventData?.metadata?.plan_id).toLowerCase();
    const resolvedPlan = resolvePlanById(planId);
    const resolvedPlanId = normalizeText(resolvedPlan?.id).toLowerCase();
    const resolvedPlanLabel = normalizeText(resolvedPlan?.label) || resolvePlanLabel(resolvedPlanId);

    if (email) {
      const newPlanId = resolvedPlanId || normalizeText(resolveAccount(email)?.billingState?.planId).toLowerCase() || "free";
      updateBillingState(email, {
        planId: newPlanId,
        planLabel: resolvedPlanLabel,
        status: "activa",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      });
      await syncPlanToPostgres(email, newPlanId, "activa", {
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
      const resolvedPlan = resolvePlanFromSubscriptionObject(eventData);
      const currentAccount = resolveAccount(email);
      const newPlanId = normalizeText(resolvedPlan?.id).toLowerCase() || normalizeText(currentAccount?.billingState?.planId).toLowerCase() || "free";
      const newStatus = normalizeStripeSubscriptionStatus(eventData?.status);

      // Never downgrade an already-active plan to a transient/intermediate status.
      // checkout.session.completed is the authoritative source for initial activation.
      const currentDbStatus = normalizeText(currentAccount?.billingState?.status).toLowerCase();
      const ACTIVE_DB = new Set(["activa", "trialing"]);
      const DOWNGRADE_BLOCKED = new Set(["pendiente"]);
      if (ACTIVE_DB.has(currentDbStatus) && DOWNGRADE_BLOCKED.has(newStatus)) {
        console.log(`[webhook] blocking status downgrade ${currentDbStatus} → ${newStatus} for ${email}`);
      } else {
        updateBillingState(email, {
          planId: newPlanId,
          planLabel: normalizeText(resolvedPlan?.label) || normalizeText(currentAccount?.billingState?.planLabel) || "Plan CarsWise",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          status: newStatus,
          nextBillingDate: toIsoDateFromEpoch(eventData?.current_period_end),
          cancelAtPeriodEnd: Boolean(eventData?.cancel_at_period_end),
        });
        await syncPlanToPostgres(email, newPlanId, newStatus, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          nextBillingDate: toIsoDateFromEpoch(eventData?.current_period_end),
          cancelAtPeriodEnd: Boolean(eventData?.cancel_at_period_end),
        });
      }
    }
  }

  if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
    const customerId = normalizeText(eventData?.customer);
    const email =
      normalizeText(eventData?.customer_email).toLowerCase() ||
      getEmailByStripeCustomerId(customerId);

    if (email) {
      const invoiceData = {
        id: normalizeText(eventData?.id),
        number: normalizeText(eventData?.number),
        date: toIsoDateFromEpoch(eventData?.created),
        amount: Number(eventData?.amount_paid || eventData?.amount_due || 0) / 100,
        status: eventType === "invoice.paid" ? "Pagada" : "Pago fallido",
        pdfUrl: normalizeText(eventData?.invoice_pdf || eventData?.hosted_invoice_url),
      };
      appendOrUpdateInvoice(email, invoiceData);
      await upsertInvoiceToPostgres(email, invoiceData);
    }
  }

  return res.status(200).json({ ok: true, received: true, eventType });
};