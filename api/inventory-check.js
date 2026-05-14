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

    const firstOffer = result.offers[0] || null;

    return res.status(200).json({
      ok: true,
      query: { brand, model, candidate: modelCandidates[0] },
      source: result.source,
      totalUniverse: result.totalUniverse,
      matchCount: result.offers.length,
      // Raw fields of first offer — shows which fields are null/empty
      firstOfferFields: firstOffer ? {
        brand: firstOffer.brand,
        model: firstOffer.model,
        version: firstOffer.version,
        fuel: firstOffer.fuel,
        year: firstOffer.year,
        mileage: firstOffer.mileage,
        price: firstOffer.price,
        monthlyPrice: firstOffer.monthlyPrice,
        listingType: firstOffer.listingType,
        url: (firstOffer.url || "").slice(0, 80),
        image: (firstOffer.image || "").slice(0, 120),
        province: firstOffer.province,
        city: firstOffer.city,
        bodyType: firstOffer.bodyType,
        transmission: firstOffer.transmission,
        powerCv: firstOffer.powerCv,
        portal: firstOffer.portal,
      } : null,
      offers: result.offers.slice(0, 5).map((o) => ({
        brand: o.brand,
        model: o.model,
        version: (o.version || "").slice(0, 60),
        year: o.year,
        mileage: o.mileage,
        price: o.price,
        fuel: o.fuel,
        listingType: o.listingType,
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
