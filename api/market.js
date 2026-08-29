const marketPriceHandler          = require("../lib/api/market-price-handler");
const marketplaceVoHandler        = require("../lib/api/marketplace-vo-handler");
const importOffersHandler         = require("../lib/api/import-offers-handler");
const importLeadHandler           = require("../lib/api/import-lead-handler");
const fianzaDevolucionHandler     = require("../lib/api/fianza-devolucion-handler");
const fianzaConfirmarHandler      = require("../lib/api/fianza-confirmar-handler");
const marketplaceOgHandler        = require("../lib/api/marketplace-og-handler");
const workshopsNearbyHandler      = require("../lib/api/workshops-nearby-handler");
const workshopAvailabilityHandler = require("../lib/api/workshop-availability-handler");
const vehicleModelPublicHandler = require("../lib/api/vehicle-model-public-handler");
const workshopsEnrichHandler      = require("../lib/api/workshops-enrich-handler");
const workshopsPhotoHandler       = require("../lib/api/workshops-photo-handler");
const whatsappHandler             = require("../lib/api/whatsapp-handler");
const erpAppointmentHandler        = require("../lib/api/erp-appointment-handler");
const userErpAppointmentsHandler   = require("../lib/api/user-erp-appointments-handler");
const conditionReportHandler       = require("../lib/api/condition-report-handler");

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) return explicitRoute;

  const url = String(req.url || "").toLowerCase();
  if (url.includes("market-price")) return "price";
  if (url.includes("import-lead")) return "import-lead";
  // La pide el ERP con el secreto compartido: la clave de Stripe vive aqui.
  if (url.includes("fianza-devolucion")) return "fianza-devolucion";
  if (url.includes("fianza-confirmar")) return "fianza-confirmar";
  if (url.includes("import-offers")) return "import";
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
    case "modelo-3d":   return vehicleModelPublicHandler(req, res);
    case "import":      return importOffersHandler(req, res);
    case "import-lead": return importLeadHandler(req, res);
    case "fianza-devolucion": return fianzaDevolucionHandler(req, res);
    case "fianza-confirmar":  return fianzaConfirmarHandler(req, res);
    case "og":          return marketplaceOgHandler(req, res);
    case "nearby":      return workshopsNearbyHandler(req, res);
    case "availability":return workshopAvailabilityHandler(req, res);
    case "enrich":      return workshopsEnrichHandler(req, res);
    case "photo":       return workshopsPhotoHandler(req, res);
    case "whatsapp":    return whatsappHandler(req, res);
    case "erp-appointment":       return erpAppointmentHandler(req, res);
    case "user-erp-appointments": return userErpAppointmentsHandler(req, res);
    case "condition-report":      return conditionReportHandler(req, res);
    default:
      return res.status(404).json({ error: "Market route not found" });
  }
};