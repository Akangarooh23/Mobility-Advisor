const crypto = require("crypto");
const { listInventoryOffers } = require("../lib/inventoryStore");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildStableId(offer = {}) {
  const seed = String(
    offer?.url
    || offer?.id
    || `${offer?.brand || ""}|${offer?.model || ""}|${offer?.year || ""}|${offer?.price || ""}|${offer?.mileage || ""}`
  );

  return `vo-${crypto.createHash("sha1").update(seed).digest("hex").slice(0, 12)}`;
}

function buildPortalScore(offer = {}) {
  const year = toNumber(offer?.year) || 0;
  const mileage = toNumber(offer?.mileage) || 0;
  const warrantyMonths = toNumber(offer?.warrantyMonths) || 0;
  const hasPrice = Number.isFinite(toNumber(offer?.price));

  let score = 80;

  if (year >= 2023) score += 7;
  else if (year >= 2020) score += 4;
  else if (year >= 2017) score += 2;

  if (mileage > 0 && mileage <= 30000) score += 6;
  else if (mileage > 0 && mileage <= 80000) score += 3;

  if (warrantyMonths >= 12) score += 4;
  if (hasPrice) score += 2;

  return Math.max(70, Math.min(99, score));
}

function mapInventoryOffer(offer = {}) {
  const brand = normalizeText(offer?.brand);
  const model = normalizeText(offer?.model);
  const version = normalizeText(offer?.version);
  const year = toNumber(offer?.year);
  const mileage = toNumber(offer?.mileage);
  const price = toNumber(offer?.price);
  const displacement = toNumber(offer?.displacement);
  const powerCv = toNumber(offer?.powerCv);
  const fuel = normalizeText(offer?.fuel) || "Sin especificar";
  const color = normalizeText(offer?.color) || "Sin especificar";
  const location = normalizeText(offer?.city) || normalizeText(offer?.province) || "España";
  const seller = normalizeText(offer?.dealerName) || normalizeText(offer?.portal) || "Portal";
  const warrantyMonths = Math.max(0, toNumber(offer?.warrantyMonths) || 0);
  const title = normalizeText(offer?.title) || [brand, model, version].filter(Boolean).join(" ");

  if (!brand || !model || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return {
    id: buildStableId(offer),
    title,
    brand,
    model,
    price: Math.round(price),
    year: Number.isFinite(year) ? Math.round(year) : null,
    mileage: Number.isFinite(mileage) ? Math.round(mileage) : 0,
    location,
    color,
    displacement: Number.isFinite(displacement) ? Math.round(displacement) : 0,
    fuel,
    power: Number.isFinite(powerCv) ? `${Math.round(powerCv)} CV` : "",
    seller,
    hasGuaranteeSeal: warrantyMonths >= 12,
    portalScore: buildPortalScore(offer),
    warrantyMonths,
    description: normalizeText(offer?.title) || `${brand} ${model} disponible en ${location}.`,
    image: normalizeText(offer?.image),
    url: normalizeText(offer?.url),
    portal: normalizeText(offer?.portal),
  };
}

module.exports = async function marketplaceVoHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.max(20, Math.min(1500, Number(req?.query?.limit || 500)));

  try {
    const inventory = await listInventoryOffers({
      desiredType: "compra",
      modelCandidates: [],
      limit,
    });

    const dedupe = new Map();
    for (const rawOffer of Array.isArray(inventory?.offers) ? inventory.offers : []) {
      const mapped = mapInventoryOffer(rawOffer);
      if (!mapped) {
        continue;
      }

      const dedupeKey = mapped.url || mapped.id;
      if (!dedupe.has(dedupeKey)) {
        dedupe.set(dedupeKey, mapped);
      }
    }

    const offers = Array.from(dedupe.values())
      .sort((a, b) => b.portalScore - a.portalScore || a.price - b.price)
      .slice(0, limit);

    return res.status(200).json({
      ok: true,
      source: inventory?.source || "unknown",
      totalUniverse: Number(inventory?.totalUniverse || offers.length),
      offers,
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      source: "fallback",
      totalUniverse: 0,
      offers: [],
      warning: error instanceof Error ? error.message : "No se pudo cargar marketplace desde inventario.",
    });
  }
};
