// Ofertas de importación (coches DE auto-seleccionados por el motor de scoring)
// para el marketplace público. Solo devuelve los publicados (import_published),
// con la info de "por qué es buena oferta" respecto al mercado español.

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

module.exports = async function importOffersHandler(req, res) {
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const pool = getImportPool();
  if (!pool) {
    return res.status(200).json({ ok: false, offers: [], total: 0, warning: "No database configured" });
  }

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
        `SELECT id, title, brand, model, version, year, mileage, price::numeric AS price,
                fuel, transmission, color, image_url, images, url, dealer_name,
                COALESCE(province, location, '') AS location,
                market_price_es, import_comps, import_cost, import_margin, import_margin_pct,
                (price::numeric + COALESCE(import_cost, 0)) AS landed_price
         FROM moveadvisor_market_offers
         ${where}
         ORDER BY import_score DESC NULLS LAST, import_margin DESC NULLS LAST
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM moveadvisor_market_offers ${where}`, values),
    ]);

    const offers = rows.rows.map((r) => {
      const marketEs   = r.market_price_es != null ? Math.round(Number(r.market_price_es)) : null;
      const landed     = r.landed_price     != null ? Math.round(Number(r.landed_price))     : null;
      const savings     = (marketEs != null && landed != null) ? marketEs - landed : null;
      const savingsPct  = (savings != null && marketEs) ? Math.round((savings / marketEs) * 100) : null;
      return {
        id: r.id,
        title: r.title,
        brand: r.brand,
        model: r.model,
        version: r.version,
        year: r.year,
        mileage: r.mileage != null ? Number(r.mileage) : null,
        fuel: r.fuel,
        transmission: r.transmission,
        color: r.color,
        image_url: r.image_url,
        images: parseImages(r.images),
        source_url: r.url,
        origin: "Alemania",
        location: r.location,
        // Precio orientativo importado (coste en origen + gastos de importación estimados)
        import_price: landed,
        // "Por qué es buena oferta" respecto al mercado español
        market_price_es: marketEs,
        comparables: r.import_comps != null ? Number(r.import_comps) : null,
        savings,
        savings_pct: savingsPct,
      };
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, offers, total: totalRes.rows[0].total, limit, offset });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      offers: [],
      total: 0,
      warning: error instanceof Error ? error.message : "No se pudieron cargar las ofertas de importación.",
    });
  }
};
