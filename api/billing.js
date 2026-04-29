const billingAccountHandler = require("../lib/api/billing-account-handler");
const billingCheckoutHandler = require("../lib/api/billing-checkout-handler");
const billingPortalHandler = require("../lib/api/billing-portal-handler");
const billingWebhookHandler = require("../lib/api/billing-webhook-handler");

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
  return "";
}

module.exports = async function billingRouter(req, res) {
  switch (resolveRoute(req)) {
    case "account":
      return billingAccountHandler(req, res);
    case "checkout":
      return billingCheckoutHandler(req, res);
    case "portal":
      return billingPortalHandler(req, res);
    case "webhook":
      return billingWebhookHandler(req, res);
    default:
      return res.status(404).json({ error: "Billing route not found" });
  }
};