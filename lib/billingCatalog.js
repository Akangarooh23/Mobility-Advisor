function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlan(rawPlan = {}, index = 0) {
  const id = normalizeText(rawPlan?.id).toLowerCase();
  if (!id) return null;

  return {
    id,
    label: normalizeText(rawPlan?.label) || `Plan ${id}`,
    stripePriceIdMonthly: normalizeText(rawPlan?.stripePriceIdMonthly || rawPlan?.stripePriceId),
    stripePriceIdAnnual: normalizeText(rawPlan?.stripePriceIdAnnual),
    isDefault: Boolean(rawPlan?.isDefault),
    order: Number.isFinite(Number(rawPlan?.order)) ? Number(rawPlan.order) : index,
  };
}

function parseCatalogFromJsonEnv() {
  const raw = normalizeText(process.env.BILLING_PLANS_JSON);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => normalizePlan(item, index))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

function buildDefaultCatalog() {
  return [
    {
      id: "free",
      label: "Free",
      stripePriceIdMonthly: "",
      stripePriceIdAnnual: "",
      isDefault: true,
      order: 0,
    },
    {
      id: "plus",
      label: "Plus",
      stripePriceIdMonthly: normalizeText(process.env.STRIPE_PRICE_PLUS_MONTHLY),
      stripePriceIdAnnual: normalizeText(process.env.STRIPE_PRICE_PLUS_ANNUAL),
      isDefault: false,
      order: 1,
    },
  ];
}

function getBillingPlansCatalog() {
  const custom = parseCatalogFromJsonEnv();
  if (custom.length > 0) return custom;
  return buildDefaultCatalog();
}

function findDefaultPlan(catalog = []) {
  const configuredDefault = normalizeText(process.env.BILLING_DEFAULT_PLAN_ID).toLowerCase();
  if (configuredDefault) {
    const byId = catalog.find((item) => item.id === configuredDefault);
    if (byId) return byId;
  }

  const explicitDefault = catalog.find((item) => item.isDefault);
  if (explicitDefault) return explicitDefault;

  return catalog[0] || null;
}

function resolvePlanById(planId = "") {
  const normalized = normalizeText(planId).toLowerCase();
  const catalog = getBillingPlansCatalog();
  if (!normalized) return findDefaultPlan(catalog);
  return catalog.find((item) => item.id === normalized) || null;
}

function resolvePlanByStripePriceId(priceId = "") {
  const normalized = normalizeText(priceId);
  if (!normalized) return null;
  return (
    getBillingPlansCatalog().find(
      (item) =>
        normalizeText(item.stripePriceIdMonthly) === normalized ||
        normalizeText(item.stripePriceIdAnnual) === normalized
    ) || null
  );
}

// Returns the Stripe priceId for a given plan and billing mode
function resolvePlanPriceId(planId = "", billingMode = "monthly") {
  const plan = resolvePlanById(planId);
  if (!plan) return "";
  if (billingMode === "annual") return normalizeText(plan.stripePriceIdAnnual);
  return normalizeText(plan.stripePriceIdMonthly);
}

function getCheckoutPlansCatalog() {
  return getBillingPlansCatalog().map((item) => ({
    id: item.id,
    label: item.label,
    checkoutEnabled: Boolean(
      normalizeText(item.stripePriceIdMonthly) || normalizeText(item.stripePriceIdAnnual)
    ),
    isDefault: Boolean(item.isDefault),
  }));
}

module.exports = {
  normalizeText,
  getBillingPlansCatalog,
  getCheckoutPlansCatalog,
  resolvePlanById,
  resolvePlanByStripePriceId,
  resolvePlanPriceId,
  findDefaultPlan,
};
