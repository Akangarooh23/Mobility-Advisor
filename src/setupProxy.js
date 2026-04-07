const analyzeHandler = require("../api/analyze");
const findListingHandler = require("../api/find-listing");

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
};
