const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { upsertMarketplaceVoOffers } = require("../lib/inventoryStore");

function loadFallbackImageMap() {
  const helperPath = path.join(__dirname, "..", "src", "utils", "offerHelpers.js");
  const helperSource = fs.readFileSync(helperPath, "utf8");
  const match = helperSource.match(/export const OFFER_MODEL_FALLBACK_IMAGES = (\{[\s\S]*?\n\});/);

  if (!match || !match[1]) {
    return {};
  }

  const script = new vm.Script(`const OFFER_MODEL_FALLBACK_IMAGES = ${match[1]};\nOFFER_MODEL_FALLBACK_IMAGES;`);
  const context = vm.createContext({});
  const parsed = script.runInContext(context);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function loadMarketplaceOffersFromSource() {
  const sourcePath = path.join(__dirname, "..", "src", "data", "portalVoOffers.js");
  const source = fs.readFileSync(sourcePath, "utf8");
  const fallbackImages = loadFallbackImageMap();

  const arrayStart = source.indexOf("export const PORTAL_VO_OFFERS = [");
  if (arrayStart === -1) {
    throw new Error("No se encontro PORTAL_VO_OFFERS en src/data/portalVoOffers.js");
  }

  const rawArray = source
    .slice(arrayStart)
    .replace("export const PORTAL_VO_OFFERS =", "const PORTAL_VO_OFFERS =")
    .replace(/import\s+\{[^}]+\}\s+from\s+"\.\.\/utils\/offerHelpers";?/g, "")
    .replace(/OFFER_MODEL_FALLBACK_IMAGES\[[^\]]+\]/g, (match) => {
      const keyMatch = match.match(/\["([^"]+)"\]/);
      if (!keyMatch || !keyMatch[1]) {
        return "\"\"";
      }

      const resolved = fallbackImages[keyMatch[1]];
      return JSON.stringify(typeof resolved === "string" ? resolved : "");
    });

  const script = new vm.Script(`${rawArray}\nPORTAL_VO_OFFERS;`);
  const sandbox = {};
  const context = vm.createContext(sandbox);
  const parsed = script.runInContext(context);

  if (!Array.isArray(parsed)) {
    throw new Error("PORTAL_VO_OFFERS no es un array valido");
  }

  return parsed;
}

async function main() {
  const offers = loadMarketplaceOffersFromSource();

  const normalized = offers.map((offer) => ({
    id: offer.id,
    title: offer.title,
    brand: offer.brand,
    model: offer.model,
    price: offer.price,
    year: offer.year,
    mileage: offer.mileage,
    location: offer.location,
    color: offer.color,
    displacement: offer.displacement,
    fuel: offer.fuel,
    power: offer.power,
    seller: offer.seller,
    hasGuaranteeSeal: Boolean(offer.hasGuaranteeSeal),
    portalScore: offer.portalScore,
    warrantyMonths: offer.warrantyMonths,
    description: offer.description,
    image: offer.image || "",
    url: offer.url || "",
    portal: offer.portal || "marketplace-vo",
    isActive: true,
  }));

  const result = await upsertMarketplaceVoOffers(normalized);
  if (!result?.ok) {
    throw new Error(`No se pudo hacer seed en BD (source=${result?.source || "unknown"})`);
  }

  console.log(`Marketplace VO seed completado: ${result.upserted} ofertas en ${result.source}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
