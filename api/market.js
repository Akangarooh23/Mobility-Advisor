const marketPriceHandler        = require("../lib/api/market-price-handler");
const marketplaceVoHandler      = require("../lib/api/marketplace-vo-handler");
const marketplaceOgHandler      = require("../lib/api/marketplace-og-handler");
const workshopsNearbyHandler    = require("../lib/api/workshops-nearby-handler");
const workshopAvailabilityHandler = require("../lib/api/workshop-availability-handler");

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) return explicitRoute;

  const url = String(req.url || "").toLowerCase();
  if (url.includes("market-price")) return "price";
  if (url.includes("marketplace-vo")) return "vo";
  if (url.includes("workshops-nearby")) return "nearby";
  if (url.includes("workshop-availability")) return "availability";
  return "";
}

module.exports = async function marketRouter(req, res) {
  switch (resolveRoute(req)) {
    case "price":       return marketPriceHandler(req, res);
    case "vo":          return marketplaceVoHandler(req, res);
    case "og":          return marketplaceOgHandler(req, res);
    case "nearby":      return workshopsNearbyHandler(req, res);
    case "availability":return workshopAvailabilityHandler(req, res);
    default:
      return res.status(404).json({ error: "Market route not found" });
  }
};