/**
 * Las franjas de visita, también para la app.
 *
 * Esta puerta se escribía sus propias cabeceras de CORS a mano, y le faltaba
 * la que importa: `Access-Control-Allow-Headers: Content-Type`, sin
 * `Authorization` ni `X-PopCar-Client`. La app instalada no vive en el
 * dominio —su origen es `https://localhost`— y manda la sesión en
 * `Authorization`, así que el navegador embebido pedía permiso antes de
 * enviar, no lo recibía para esa cabecera, y descartaba la petición. Lo que
 * veía el cliente era «Failed to fetch» al guardar sus franjas: ni un error
 * del servidor, porque la petición no llegó a salir.
 *
 * Y el `Access-Control-Allow-Origin: *` tampoco servía para lo que parecía:
 * con credenciales de por medio el navegador lo rechaza, y hay que devolver
 * el origen concreto. Eso es justo lo que hace `aplicaCors`, que es lo que
 * usan las demás puertas de la app y lee la lista de `CORS_ORIGENES`.
 */
const handler = require("../lib/api/visit-availability-handler");
const { aplicaCors } = require("../lib/cors");

module.exports = async function visitAvailabilityApi(req, res) {
  if (aplicaCors(req, res)) return undefined;

  return handler(req, res);
};
