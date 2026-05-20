const billingWebhookHandler = require("../lib/api/billing-webhook-handler");

// Disable Vercel's automatic body parsing so raw bytes are preserved
// for Stripe webhook HMAC signature verification
async function handler(req, res) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", resolve);
    req.on("error", reject);
  });

  const rawBody = Buffer.concat(chunks).toString("utf8");
  req.rawBody = rawBody;

  try {
    req.body = JSON.parse(rawBody || "{}");
  } catch {
    req.body = {};
  }

  return billingWebhookHandler(req, res);
}

handler.config = { api: { bodyParser: false } };

module.exports = handler;
