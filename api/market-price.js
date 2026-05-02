const { getMarketPriceSnapshot } = require("../lib/inventoryStore");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeJsonParse(value) {
  if (!value) {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

module.exports = async function marketPriceHandler(req, res) {
  if (req.method && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = safeJsonParse(req.body);
    const payload = body?.payload || body || {};

    const brand = normalizeText(payload?.brand);
    const model = normalizeText(payload?.model);

    if (!brand || !model) {
      res.status(400).json({ error: "brand y model son obligatorios." });
      return;
    }

    const snapshot = await getMarketPriceSnapshot({
      desiredType: "compra",
      brand,
      model,
      version: normalizeText(payload?.version),
      fuel: normalizeText(payload?.fuel),
      year: payload?.year,
      mileage: payload?.mileage,
      location: normalizeText(payload?.location),
    });

    res.status(200).json({
      ok: true,
      ...snapshot,
    });
  } catch (error) {
    res.status(500).json({
      error: error?.message || "No se pudo calcular la referencia de mercado.",
    });
  }
};
