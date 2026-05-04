const marketPriceHandler = require("../lib/api/market-price-handler");
const marketplaceVoHandler = require("../lib/api/marketplace-vo-handler");

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) {
    return explicitRoute;
  }

  const url = String(req.url || "").toLowerCase();
  if (url.includes("market-price")) return "price";
  if (url.includes("marketplace-vo")) return "vo";
  return "";
}

module.exports = async function marketRouter(req, res) {
  switch (resolveRoute(req)) {
    case "price":
      return marketPriceHandler(req, res);
    case "vo":
      return marketplaceVoHandler(req, res);
    default:
      return res.status(404).json({ error: "Market route not found" });
  }
};