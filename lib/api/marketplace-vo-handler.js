const { listMarketplaceVoOffers } = require("../inventoryStore");

module.exports = async function marketplaceVoHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = Math.max(20, Math.min(1500, Number(req?.query?.limit || 500)));

  try {
    const marketplaceTable = await listMarketplaceVoOffers({
      limit,
      onlyActive: true,
    });

    const source = String(marketplaceTable?.source || "").toLowerCase();
    const isDedicatedSource = source === "postgres-marketplace-table" || source === "no-postgres" || source === "postgres-marketplace-table-error";

    if (!isDedicatedSource) {
      return res.status(200).json({
        ok: false,
        source: "marketplace-vo-guard",
        totalUniverse: 0,
        offers: [],
        warning: "Marketplace VO must only use dedicated marketplace table source.",
      });
    }

    return res.status(200).json({
      ok: true,
      source: marketplaceTable.source || "postgres-marketplace-table",
      totalUniverse: Number(marketplaceTable.totalUniverse || marketplaceTable.offers.length),
      offers: Array.isArray(marketplaceTable?.offers) ? marketplaceTable.offers : [],
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      source: "fallback",
      totalUniverse: 0,
      offers: [],
      warning: error instanceof Error ? error.message : "No se pudo cargar marketplace desde inventario.",
    });
  }
};