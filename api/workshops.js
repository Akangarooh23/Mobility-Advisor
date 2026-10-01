/**
 * Los talleres cercanos y sus huecos.
 *
 * En producción estas dos rutas no entran por aquí: `vercel.json` las manda a
 * `/api/market`, que reparte con el enrutador y ya aplica CORS. Esta puerta es
 * la que usa el servidor local (`local-api-server.js`), y lleva `aplicaCors`
 * para que en desarrollo se comporte igual: una diferencia entre los dos lados
 * es exactamente lo que hace que un fallo de CORS no se vea hasta producción.
 */
const workshopsNearbyHandler      = require("../lib/api/workshops-nearby-handler");
const workshopAvailabilityHandler = require("../lib/api/workshop-availability-handler");
const { aplicaCors } = require("../lib/cors");

module.exports = async function workshopsRouter(req, res) {
  if (aplicaCors(req, res)) return undefined;

  const url = String(req.url || "").toLowerCase();
  if (url.includes("availability")) return workshopAvailabilityHandler(req, res);
  return workshopsNearbyHandler(req, res);
};
