"use strict";

const { listInventoryOffers } = require("../lib/inventoryStore");

module.exports = async function inventoryCheckHandler(req, res) {
  const brand = String(req?.query?.brand || "Jaguar");
  const model = String(req?.query?.model || "E-Pace");
  const modelCandidates = [`${brand} ${model}`];

  try {
    const result = await listInventoryOffers({
      desiredType: "compra",
      modelCandidates,
      limit: 20,
    });

    return res.status(200).json({
      ok: true,
      query: { brand, model, candidate: modelCandidates[0] },
      source: result.source,
      totalUniverse: result.totalUniverse,
      matchCount: result.offers.length,
      offers: result.offers.slice(0, 5).map((o) => ({
        brand: o.brand,
        model: o.model,
        version: (o.version || "").slice(0, 60),
        year: o.year,
        mileage: o.mileage,
        price: o.price,
        url: (o.url || "").slice(0, 80),
      })),
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: err?.message || "unknown error",
      query: { brand, model },
    });
  }
};
