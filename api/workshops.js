const workshopsNearbyHandler      = require("../lib/api/workshops-nearby-handler");
const workshopAvailabilityHandler = require("../lib/api/workshop-availability-handler");

module.exports = async function workshopsRouter(req, res) {
  const url = String(req.url || "").toLowerCase();
  if (url.includes("availability")) return workshopAvailabilityHandler(req, res);
  return workshopsNearbyHandler(req, res);
};
