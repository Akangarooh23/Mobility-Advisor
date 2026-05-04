const workshopsNearbyHandler = require("../lib/api/workshops-nearby-handler");
const workshopAvailabilityHandler = require("../lib/api/workshop-availability-handler");

function resolveRoute(req) {
  const explicitRoute = String(req.query?.route || "").trim().toLowerCase();
  if (explicitRoute) {
    return explicitRoute;
  }

  const url = String(req.url || "").toLowerCase();
  if (url.includes("workshops-nearby")) return "nearby";
  if (url.includes("workshop-availability")) return "availability";
  return "";
}

module.exports = async function workshopsRouter(req, res) {
  switch (resolveRoute(req)) {
    case "nearby":
      return workshopsNearbyHandler(req, res);
    case "availability":
      return workshopAvailabilityHandler(req, res);
    default:
      return res.status(404).json({ error: "Workshop route not found" });
  }
};