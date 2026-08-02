const { listMarketplaceVoOffers, getMarketplaceVoOfferById, getMarketplaceVoOfferByUrl, listUserPublishedVehiclesForMarketplace, getMarketplaceShowcase } = require("../inventoryStore");

let _statsPgPool = null;
function getStatsPool() {
  if (_statsPgPool) return _statsPgPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _statsPgPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _statsPgPool;
}

module.exports = async function marketplaceVoHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Showcase "una de cada sección" (VO CarsWise + importación + portales)
  if (req?.query?.showcase) {
    try {
      const sections = await getMarketplaceShowcase();
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ ok: true, sections });
    } catch (err) {
      return res.status(200).json({ ok: false, sections: [], warning: err?.message });
    }
  }

  // Stats endpoint: increments view_count and returns viewCount + contactCount
  const vehicleId = req?.query?.vehicleId ? String(req.query.vehicleId) : null;
  if (req?.query?.stats === "1" && vehicleId) {
    const pool = getStatsPool();
    if (!pool) return res.status(200).json({ ok: true, stats: { viewCount: 0, contactCount: 0 } });
    try {
      const [contactResult, viewResult] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS cnt FROM moveadvisor_market_leads WHERE vehicle_id = $1`,
          [vehicleId]
        ).catch(() => ({ rows: [{ cnt: 0 }] })),
        pool.query(
          `UPDATE moveadvisor_marketplace_vo_offers SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1 RETURNING COALESCE(view_count, 0)::int AS cnt`,
          [vehicleId]
        ).catch(() => ({ rows: [] })),
      ]);
      return res.status(200).json({
        ok: true,
        stats: {
          viewCount: Number(viewResult?.rows?.[0]?.cnt || 0),
          contactCount: Number(contactResult?.rows?.[0]?.cnt || 0),
        },
      });
    } catch {
      return res.status(200).json({ ok: true, stats: { viewCount: 0, contactCount: 0 } });
    }
  }

  // Fetch single offer by ID
  const offerId = req?.query?.id ? String(req.query.id).trim() : null;
  if (offerId) {
    try {
      const offer = await getMarketplaceVoOfferById(offerId);
      if (!offer) return res.status(404).json({ ok: false, offer: null });
      return res.status(200).json({ ok: true, offer });
    } catch (err) {
      return res.status(500).json({ ok: false, offer: null, error: err?.message });
    }
  }

  const sourceUrl = req?.query?.url ? decodeURIComponent(String(req.query.url)) : null;
  if (sourceUrl) {
    try {
      const offer = await getMarketplaceVoOfferByUrl(sourceUrl);
      if (!offer) return res.status(404).json({ ok: false, offer: null });
      return res.status(200).json({ ok: true, offer });
    } catch (err) {
      return res.status(500).json({ ok: false, offer: null, error: err?.message });
    }
  }

  const limit  = req?.query?.limit  ? Number(req.query.limit)  : 50;
  const offset = req?.query?.offset ? Number(req.query.offset) : 0;

  const filters = {
    query:          String(req?.query?.query         || "").trim(),
    brand:          String(req?.query?.brand          || "").trim(),
    model:          String(req?.query?.model          || "").trim(),
    minPrice:       req?.query?.minPrice     ? Number(req.query.minPrice)    : null,
    maxPrice:       req?.query?.maxPrice     ? Number(req.query.maxPrice)    : null,
    minYear:        req?.query?.minYear      ? Number(req.query.minYear)     : null,
    maxYear:        req?.query?.maxYear      ? Number(req.query.maxYear)     : null,
    minMileage:     req?.query?.minMileage   ? Number(req.query.minMileage)  : null,
    maxMileage:     req?.query?.maxMileage   ? Number(req.query.maxMileage)  : null,
    location:       String(req?.query?.location      || "").trim(),
    color:          String(req?.query?.color          || "").trim(),
    fuel:           String(req?.query?.fuel           || "").trim(),
    transmission:   String(req?.query?.transmission   || "").trim(),
    displacement:   String(req?.query?.displacement   || "").trim(),
    onlyGuaranteed: req?.query?.onlyGuaranteed === "true",
    sort:               String(req?.query?.sort            || "").trim(),
    modalityMode:       String(req?.query?.modalityMode    || "").trim(),
    sellerTypes:        String(req?.query?.seller_type     || "").trim().split(',').map(s => s.trim()).filter(Boolean),
    excludeSellerTypes: String(req?.query?.exclude_seller_type || "").trim().split(',').map(s => s.trim()).filter(Boolean),
  };

  const isRenting = filters.modalityMode === "renting";
  // Los "user vehicles" (garaje de particulares publicados) son SIEMPRE seller_type='particular'.
  // Solo deben incluirse cuando el filtro admite particulares: si la pestaña pide
  // concesionario/importador (o excluye 'particular'), NO deben colarse. Sin este guard
  // aparecían en la pestaña Concesionarios pese al filtro seller_type (p.ej. el IDCar 123AAA).
  const includeUserVehicles = !isRenting
    && (filters.sellerTypes.length === 0 || filters.sellerTypes.includes("particular"))
    && !filters.excludeSellerTypes.includes("particular");

  try {
    const [marketplaceTable, userVehicles] = await Promise.all([
      listMarketplaceVoOffers({ limit, offset, onlyActive: true, ...filters }),
      includeUserVehicles ? listUserPublishedVehiclesForMarketplace(filters) : Promise.resolve([]),
    ]);

    const source = String(marketplaceTable?.source || "").toLowerCase();

    // Una consulta que falló NO es una respuesta con cero ofertas.
    //
    // `postgres-marketplace-table-error` estaba en la lista de fuentes buenas,
    // así que un fallo de base salía por la puerta del éxito: `ok: true`,
    // `offers: []`. El cliente veía "no hay coches" y el equipo no veía nada.
    // La maquinaria para decirlo ya existía aquí abajo — solo que este caso no
    // llegaba a usarla.
    if (source === "postgres-marketplace-table-error") {
      return res.status(200).json({
        ok: false,
        source,
        totalUniverse: 0,
        offers: [],
        warning: marketplaceTable?.error || "No se pudo consultar el inventario.",
      });
    }

    const isDedicatedSource = source === "postgres-marketplace-table" || source === "no-postgres";

    if (!isDedicatedSource) {
      return res.status(200).json({
        ok: false,
        source: "marketplace-vo-guard",
        totalUniverse: 0,
        offers: [],
        warning: "Marketplace VO must only use dedicated marketplace table source.",
      });
    }

    const inventoryOffers = Array.isArray(marketplaceTable?.offers) ? marketplaceTable.offers : [];
    const allOffers = [...userVehicles, ...inventoryOffers];

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      source: marketplaceTable.source || "postgres-marketplace-table",
      totalUniverse: Number(marketplaceTable.totalUniverse || inventoryOffers.length) + userVehicles.length,
      offers: allOffers,
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