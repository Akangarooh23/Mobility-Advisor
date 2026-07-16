// Ofertas de importación (coches DE auto-seleccionados por el motor de scoring)
// para el marketplace público. Solo devuelve los publicados (import_published).
// Cada oferta se devuelve en el MISMO shape que las ofertas VO (para reutilizar
// PortalVoDetailPage) + extras de importación (isImport, ahorro, comparables, fianza).

let _importPool = null;
function getImportPool() {
  if (_importPool) return _importPool;
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connString) return null;
  const { Pool } = require("pg");
  _importPool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
  return _importPool;
}

function parseImages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

const SELECT_COLS = `id, title, brand, model, version, year, mileage, price::numeric AS price,
  fuel, transmission, color, power_cv, displacement, image_url, images, url, dealer_name,
  COALESCE(province, location, '') AS location,
  market_price_es, import_comps, import_cost, import_margin, import_margin_pct,
  (price::numeric + COALESCE(import_cost, 0)) AS landed_price`;

function mapOffer(r) {
  const marketEs  = r.market_price_es != null ? Math.round(Number(r.market_price_es)) : null;
  const landed    = r.landed_price     != null ? Math.round(Number(r.landed_price))     : null;
  const savings    = (marketEs != null && landed != null) ? marketEs - landed : null;
  const savingsPct = (savings != null && marketEs) ? Math.round((savings / marketEs) * 100) : null;
  const deposit    = landed != null ? Math.round(landed * 0.30) : null;
  const imgs = parseImages(r.images);
  const mainImg = r.image_url || imgs[0] || "";
  const cv = r.power_cv != null ? Number(r.power_cv) : null;
  return {
    // ── shape VO (para PortalVoDetailPage) ──
    id: r.id,
    title: r.title,
    brand: r.brand,
    model: r.model,
    version: r.version || null,
    price: landed,            // precio mostrado = importado estimado
    salePrice: null,
    year: r.year != null ? Number(r.year) : null,
    mileage: r.mileage != null ? Number(r.mileage) : 0,
    location: r.location || "Alemania",
    color: r.color || "",
    displacement: r.displacement != null ? Number(r.displacement) : 0,
    fuel: r.fuel || "Sin especificar",
    power: cv != null ? `${cv} CV` : "",
    transmission: r.transmission || null,
    seller: "CarsWise Importación",
    sellerType: "importacion",
    hasGuaranteeSeal: true,
    warrantyMonths: 12,
    portalScore: 90,
    description: "",
    image: mainImg,
    images: imgs.length ? imgs : (mainImg ? [mainImg] : []),
    url: r.url || "",
    portal: "importacion",
    availableForPurchase: true,
    rentingAvailable: false,
    hasStockManagement: false,
    // ── extras de importación ──
    isImport: true,
    origin: "Alemania",
    importPrice: landed,
    marketPriceEs: marketEs,
    importSavings: savings,
    importSavingsPct: savingsPct,
    importComparables: r.import_comps != null ? Number(r.import_comps) : null,
    importDeposit: deposit,
  };
}

module.exports = async function importOffersHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const pool = getImportPool();
  if (!pool) {
    return res.status(200).json({ ok: false, offers: [], total: 0, warning: "No database configured" });
  }

  // ── Ficha individual por id ──
  const offerId = req?.query?.id ? String(req.query.id).trim() : null;
  if (offerId) {
    try {
      const r = await pool.query(
        `SELECT ${SELECT_COLS} FROM moveadvisor_market_offers
         WHERE id = $1 AND country = 'DE' AND import_published = TRUE LIMIT 1`,
        [offerId]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, offer: null });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, offer: mapOffer(r.rows[0]) });
    } catch (error) {
      return res.status(500).json({ ok: false, offer: null, error: error?.message });
    }
  }

  // ── Listado ──
  const limit  = Math.min(200, Math.max(1, Number(req?.query?.limit)  || 60));
  const offset = Math.max(0, Number(req?.query?.offset) || 0);
  const brand  = String(req?.query?.brand || "").trim();
  const q      = String(req?.query?.query || "").trim();

  const conditions = ["country = 'DE'", "import_published = TRUE", "price IS NOT NULL"];
  const values = [];
  if (brand) { values.push(`%${brand.toLowerCase()}%`); conditions.push(`lower(COALESCE(brand,'')) LIKE $${values.length}`); }
  if (q)     { values.push(`%${q.toLowerCase()}%`);     conditions.push(`(lower(COALESCE(title,'')) LIKE $${values.length} OR lower(COALESCE(brand,'')) LIKE $${values.length} OR lower(COALESCE(model,'')) LIKE $${values.length})`); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  try {
    const [rows, totalRes] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS} FROM moveadvisor_market_offers ${where}
         ORDER BY import_score DESC NULLS LAST, import_margin DESC NULLS LAST
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM moveadvisor_market_offers ${where}`, values),
    ]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, offers: rows.rows.map(mapOffer), total: totalRes.rows[0].total, limit, offset });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      offers: [],
      total: 0,
      warning: error instanceof Error ? error.message : "No se pudieron cargar las ofertas de importación.",
    });
  }
};
