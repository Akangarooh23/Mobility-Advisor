const marketPriceHandler          = require("../lib/api/market-price-handler");
const marketplaceVoHandler        = require("../lib/api/marketplace-vo-handler");
const marketplaceOgHandler        = require("../lib/api/marketplace-og-handler");
const workshopsNearbyHandler      = require("../lib/api/workshops-nearby-handler");
const workshopAvailabilityHandler = require("../lib/api/workshop-availability-handler");
const workshopsEnrichHandler      = require("../lib/api/workshops-enrich-handler");
const workshopsPhotoHandler       = require("../lib/api/workshops-photo-handler");
const whatsappHandler             = require("../lib/api/whatsapp-handler");
const erpAppointmentHandler        = require("../lib/api/erp-appointment-handler");
const userErpAppointmentsHandler   = require("../lib/api/user-erp-appointments-handler");

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) return explicitRoute;

  const url = String(req.url || "").toLowerCase();
  if (url.includes("market-price")) return "price";
  if (url.includes("marketplace-vo")) return "vo";
  if (url.includes("workshops-nearby")) return "nearby";
  if (url.includes("workshop-availability")) return "availability";
  if (url.includes("workshops-enrich")) return "enrich";
  if (url.includes("workshops-photo")) return "photo";
  return "";
}

module.exports = async function marketRouter(req, res) {
  switch (resolveRoute(req)) {
    case "price":       return marketPriceHandler(req, res);
    case "vo":          return marketplaceVoHandler(req, res);
    case "og":          return marketplaceOgHandler(req, res);
    case "nearby":      return workshopsNearbyHandler(req, res);
    case "availability":return workshopAvailabilityHandler(req, res);
    case "enrich":      return workshopsEnrichHandler(req, res);
    case "photo":       return workshopsPhotoHandler(req, res);
    case "whatsapp":    return whatsappHandler(req, res);
    case "erp-appointment":       return erpAppointmentHandler(req, res);
    case "user-erp-appointments": return userErpAppointmentsHandler(req, res);
    default:
      return res.status(404).json({ error: "Market route not found" });
  }
};