const { resolveAccount } = require("./billingStore");

const ACTIVE_STATUSES = new Set(["activa", "trialing"]);

/**
 * Returns "plus" if the user has an active Plus subscription, "free" otherwise.
 * Source of truth is billingStore, which is kept in sync by the Stripe webhook.
 */
function getUserPlan(email = "") {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return "free";

  const account = resolveAccount({ email: normalized });
  const planId = String(account?.billingState?.planId || "").toLowerCase();
  const status = String(account?.billingState?.status || "").toLowerCase();

  // "gratis" is the legacy ID for the free tier
  if (planId === "plus" && ACTIVE_STATUSES.has(status)) return "plus";
  return "free"; // covers "free", "gratis", empty, or any unrecognized value
}

/**
 * Returns true if the user meets the required plan level.
 * Usage: if (!isAllowed(email, "plus")) return res.status(403).json({ error: "Requiere plan Plus." });
 */
function isAllowed(email, requiredPlan) {
  if (requiredPlan === "plus") return getUserPlan(email) === "plus";
  return true;
}

module.exports = { getUserPlan, isAllowed };
