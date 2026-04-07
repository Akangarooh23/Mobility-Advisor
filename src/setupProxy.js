const analyzeHandler = require("../api/analyze");

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
  app.post("/api/analyze", async (req, res) => {
    try {
      req.body = await readRequestBody(req);
      await analyzeHandler(req, res);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "Local API proxy error",
      });
    }
  });
};
