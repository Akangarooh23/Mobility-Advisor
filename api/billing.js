const billingAccountHandler = require("../lib/api/billing-account-handler");
const billingCheckoutHandler = require("../lib/api/billing-checkout-handler");
const billingPortalHandler = require("../lib/api/billing-portal-handler");
const invoicePdfHandler = require("../lib/api/invoice-pdf-handler");
const { Pool } = require("pg");

let _pingPool = null;
async function pingHandler(req, res) {
  const hardTimeout = new Promise((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), 8000)
  );
  try {
    if (!_pingPool) {
      const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!cs) return res.status(200).json({ ok: true, db: false });
      _pingPool = new Pool({
        connectionString: cs,
        ssl: { rejectUnauthorized: false },
        max: 1,
        connectionTimeoutMillis: 7000,
        idleTimeoutMillis: 10000,
      });
    }
    const result = await Promise.race([
      _pingPool.query("SELECT 1").then(() => ({ db: true })),
      hardTimeout,
    ]);
    return res.status(200).json({ ok: true, db: result.db === true });
  } catch {
    return res.status(200).json({ ok: true, db: false });
  }
}

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) {
    return explicitRoute;
  }

  const url = String(req.url || "").toLowerCase();
  if (url.includes("billing-account")) return "account";
  if (url.includes("billing-checkout")) return "checkout";
  if (url.includes("billing-portal")) return "portal";
  if (url.includes("billing-webhook")) return "webhook";
  if (url.includes("invoice-pdf")) return "invoice-pdf";
  return "";
}

module.exports = async function billingRouter(req, res) {
  switch (resolveRoute(req)) {
    case "ping":
      return pingHandler(req, res);
    case "account":
      return billingAccountHandler(req, res);
    case "checkout":
      return billingCheckoutHandler(req, res);
    case "portal":
      return billingPortalHandler(req, res);
    case "invoice-pdf":
      return invoicePdfHandler(req, res);
    default:
      return res.status(404).json({ error: "Billing route not found" });
  }
};