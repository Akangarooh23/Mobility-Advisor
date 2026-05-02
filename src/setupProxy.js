const analyzeHandler = require("../api/analyze");
const findListingHandler = require("../api/find-listing");
const sendAlertEmailHandler = require("../api/send-alert-email");
const authHandler = require("../api/auth");
const authStatusHandler = require("../api/auth-status");
const vehicleCatalogHandler = require("../api/vehicle-catalog");
const marketPriceHandler = require("../api/market-price");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      resolve(req.body);
      return;
    }

    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", reject);
  });
}

module.exports = function setupProxy(app) {
  [
    ["/api/analyze", analyzeHandler],
    ["/api/find-listing", findListingHandler],
    ["/api/market-price", marketPriceHandler],
    ["/api/send-alert-email", sendAlertEmailHandler],
    ["/api/auth", authHandler],
  ].forEach(([route, handler]) => {
    app.post(route, async (req, res) => {
      try {
        req.body = await readRequestBody(req);
        await handler(req, res);
      } catch (error) {
        res.status(500).json({
          error: error?.message || "Local API proxy error",
        });
      }
    });
  });

  app.get("/api/auth-status", async (req, res) => {
    try {
      await authStatusHandler(req, res);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Local API proxy error",
      });
    }
  });

  app.get("/api/auth", async (req, res) => {
    try {
      await authHandler(req, res);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Local API proxy error",
      });
    }
  });

    app.get("/api/vehicle-catalog", async (req, res) => {
      try {
        await vehicleCatalogHandler(req, res);
      } catch (error) {
        res.status(500).json({
          error: error?.message || "Local API proxy error",
        });
      }
    });
};
