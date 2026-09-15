const serviceRequestsHandler = require("../lib/api/service-requests-handler");
const { aplicaCors } = require("../lib/cors");

module.exports = async function serviceRequestsApi(req, res) {
  if (aplicaCors(req, res)) return undefined;

  return serviceRequestsHandler(req, res);
};
