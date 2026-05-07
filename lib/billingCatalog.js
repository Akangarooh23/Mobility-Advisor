function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlan(rawPlan = {}, index = 0) {
  const id = normalizeText(rawPlan?.id).toLowerCase();
  if (!id) {
    return null;
  }

  return {
    id,
    label: normalizeText(rawPlan?.label) || `Plan ${id}`,
    stripePriceId: normalizeText(rawPlan?.stripePriceId),
    isDefault: Boolean(rawPlan?.isDefault),
    order: Number.isFinite(Number(rawPlan?.order)) ? Number(rawPlan.order) : index,
  };
}

function parseCatalogFromJsonEnv() {
  const raw = normalizeText(process.env.BILLING_PLANS_JSON);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => normalizePlan(item, index))
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);
  } catch {
    return [];
  }
}

function buildLegacyCatalog() {
  return [
    { id: "gratis", label: "Plan Gratis", stripePriceId: normalizeText(process.env.STRIPE_PRICE_GRATIS), isDefault: false, order: 0 },
    { id: "bronce", label: "Plan Bronce", stripePriceId: normalizeText(process.env.STRIPE_PRICE_BRONCE), isDefault: false, order: 1 },
    { id: "plata", label: "Plan Plata", stripePriceId: normalizeText(process.env.STRIPE_PRICE_PLATA), isDefault: true, order: 2 },
    { id: "oro", label: "Plan Oro", stripePriceId: normalizeText(process.env.STRIPE_PRICE_ORO), isDefault: false, order: 3 },
    { id: "platino", label: "Plan Platino", stripePriceId: normalizeText(process.env.STRIPE_PRICE_PLATINO), isDefault: false, order: 4 },
  ];
}

function getBillingPlansCatalog() {
  const custom = parseCatalogFromJsonEnv();
  if (custom.length > 0) {
    return custom;
  }

  return buildLegacyCatalog();
}

function findDefaultPlan(catalog = []) {
  const configuredDefault = normalizeText(process.env.BILLING_DEFAULT_PLAN_ID).toLowerCase();
  if (configuredDefault) {
    const byId = catalog.find((item) => item.id === configuredDefault);
    if (byId) {
      return byId;
    }
  }

  const explicitDefault = catalog.find((item) => item.isDefault);
  if (explicitDefault) {
    return explicitDefault;
  }

  const firstPayable = catalog.find((item) => normalizeText(item.stripePriceId));
  if (firstPayable) {
    return firstPayable;
  }

  return catalog[0] || null;
}

function resolvePlanById(planId = "") {
  const normalized = normalizeText(planId).toLowerCase();
  const catalog = getBillingPlansCatalog();

  if (!normalized) {
    return findDefaultPlan(catalog);
  }

  return catalog.find((item) => item.id === normalized) || null;
}

function resolvePlanByStripePriceId(priceId = "") {
  const normalized = normalizeText(priceId);
  if (!normalized) {
    return null;
  }

  return getBillingPlansCatalog().find((item) => normalizeText(item.stripePriceId) === normalized) || null;
}

function getCheckoutPlansCatalog() {
  return getBillingPlansCatalog().map((item) => ({
    id: item.id,
    label: item.label,
    checkoutEnabled: Boolean(normalizeText(item.stripePriceId)),
    isDefault: Boolean(item.isDefault),
  }));
}

module.exports = {
  normalizeText,
  getBillingPlansCatalog,
  getCheckoutPlansCatalog,
  resolvePlanById,
  resolvePlanByStripePriceId,
  findDefaultPlan,
};
