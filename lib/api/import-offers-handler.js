const { MARCA } = require("../marca");
const {
  desgloseParaElCliente, sqlPrecioPuestoAqui, sqlAhorroPct, margenDePopCar, costeDeTraerlo,
} = require("../coste-importacion");
const { opcionesParaElCoche, catalogoDeGarantias } = require("../garantias");
const { serviciosParaElCliente } = require("../servicios");
// Ofertas de importación (coches DE auto-seleccionados por el motor de scoring)
// para el marketplace público. Solo devuelve los publicados (import_published).
// Cada oferta se devuelve en el MISMO shape que las ofertas VO (para reutilizar
// PortalVoDetailPage) + extras de importación (isImport, ahorro, comparables, fianza).

const FUEL_COMPAT_PG = {
  'híbrido':  ['híbrido', 'híbrido enchufable'],
  'gas':      ['gas', 'gnc', 'glp'],
  'gnc':      ['gas', 'gnc', 'glp'],
  'glp':      ['gas', 'gnc', 'glp'],
};

function pgFuelCondition(fuelValue, values, colExpr) {
  const fuelLower = String(fuelValue).toLowerCase();
  const compat = FUEL_COMPAT_PG[fuelLower];
  if (compat) {
    const startIdx = values.length + 1;
    compat.forEach(v => values.push(v));
    return `${colExpr} IN (${compat.map((_, i) => `$${startIdx + i}`).join(', ')})`;
  }
  values.push(fuelLower);
  return `${colExpr} = $${values.length}`;
}

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

/**
 * El precio de un coche de importación tal y como lo ve el cliente: lo que
 * cuesta puesto aquí. Es el que se pinta en la tarjeta, así que es el que tiene
 * que mandar cuando se ordena por precio y cuando se filtra por horquilla.
 *
 * Se genera desde las mismas constantes con las que se pinta, y no de la columna
 * `import_cost`. Esa columna la escribe el flujo de n8n una vez al día: mientras
 * no haya vuelto a pasar, ordenar por ella daría un orden que no se corresponde
 * con los números en pantalla, y eso se lee como que el filtro está roto.
 */
const PRECIO_PUESTO = sqlPrecioPuestoAqui();

/**
 * Lo que se ahorra, para poder ordenar por ello.
 *
 * Sale de las mismas constantes que el porcentaje de la tarjeta. Si fueran dos
 * cuentas distintas, «mayor ahorro primero» daría un orden que no se
 * corresponde con los porcentajes en pantalla.
 */
const AHORRO_PCT = sqlAhorroPct();

/**
 * Por qué se ordena la lista.
 *
 * El precio que se enseña de un coche de importación **no es el del anuncio**:
 * es lo que cuesta puesto aquí, o sea el precio más el coste de traerlo. Ordenar
 * por el precio alemán daría un orden que no se corresponde con los números que
 * el cliente está viendo, y eso se lee como que el filtro está roto.
 *
 * Sin orden pedido manda el `import_score`, que es lo que hace que arriba estén
 * las que más compensan: eso es la «relevancia» de esta sección.
 */
function ordenSql(sort) {
  // El `id` al final desempata. Hay muchos coches con el mismo precio, y sin un
  // criterio fijo Postgres puede devolverlos en otro orden en cada consulta: al
  // pedir las siguientes 60 aparecería repetido lo que ya estaba en pantalla.
  const desempate = ", id ASC";
  if (sort === "price_asc")  return `${PRECIO_PUESTO} ASC NULLS LAST${desempate}`;
  if (sort === "price_desc") return `${PRECIO_PUESTO} DESC NULLS LAST${desempate}`;
  if (sort === "year_desc")  return `year DESC NULLS LAST${desempate}`;
  if (sort === "km_asc")     return `mileage ASC NULLS LAST${desempate}`;
  // Lo que más se ahorra en proporción, no en euros. Un coche de 8.000 € que
  // ahorra 2.000 es mejor negocio que uno de 30.000 que ahorra 3.000, y por
  // euros salía al revés.
  if (sort === "ahorro_desc") return `${AHORRO_PCT} DESC NULLS LAST${desempate}`;
  return `import_score DESC NULLS LAST, import_margin DESC NULLS LAST${desempate}`;
}
const SELECT_COLS = `id, title, brand, model, version, year, mileage, price::numeric AS price,
  fuel, transmission, color, power_cv, displacement, image_url, images, url, dealer_name,
  COALESCE(province, location, '') AS location,
  market_price_es, import_comps, import_cost, import_margin, import_margin_pct,
  (price::numeric + COALESCE(import_cost, 0)) AS landed_price`;

function mapOffer(r, garantias) {
  const marketEs  = r.market_price_es != null ? Math.round(Number(r.market_price_es)) : null;

  /**
   * El precio, partido, calculado aquí y no leído de la base.
   *
   * `landed_price` sale de `import_cost`, que escribe el flujo de n8n. Calcularlo
   * aquí con la misma función que hace el desglose es lo que garantiza que las
   * tres líneas sumen exactamente el precio que se enseña arriba. Leerlo de dos
   * sitios distintos sería enseñar un total que no cuadra con su desglose.
   */
  const desglose  = desgloseParaElCliente(r.price, marketEs);
  const landed    = desglose.total;
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
    price: landed,            // precio mostrado = puesto aquí, con todo dentro
    salePrice: null,
    year: r.year != null ? Number(r.year) : null,
    mileage: r.mileage != null ? Number(r.mileage) : 0,
    location: r.location || "Alemania",
    color: r.color || "",
    displacement: r.displacement != null ? Number(r.displacement) : 0,
    fuel: r.fuel || "Sin especificar",
    power: cv != null ? `${cv} CV` : "",
    transmission: r.transmission || null,
    seller: `${MARCA.nombre} Importación`,
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
    // Las tres líneas que se le enseñan al cliente, y lo que se factura aparte.
    importDesglose: desglose.lineas,
    importAparte: desglose.aparte,
    /**
     * Las garantías que se le pueden dar a **este** coche.
     *
     * Se filtran por su edad y sus kilómetros: enseñar una que luego no se le
     * puede dar es peor que no enseñarla, porque ya ha contado con ella.
     */
    garantias: opcionesParaElCoche(garantias, r),
    /**
     * Lo que puede contratar aparte: seguro y reacondicionado.
     *
     * La entrega en su casa no esta aqui: va dentro del precio, porque el
     * transporte que se le cobra cubre el viaje entero.
     *
     * Los dos van sin precio. El reacondicionado no lo puede tener hasta que el
     * coche llegue a la campa y se mire, y el seguro no lo tendra hasta que haya
     * correduria. Un servicio sin precio se ensena como «a consultar» y **no
     * suma** al total: no se puede sumar lo que no se sabe.
     */
    servicios: serviciosParaElCliente(),
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
         WHERE id = $1 AND country = 'DE' AND import_published = TRUE AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
        [offerId]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, offer: null });
      res.setHeader("Cache-Control", "no-store");
      const garantias = await catalogoDeGarantias(pool);
      return res.status(200).json({ ok: true, offer: mapOffer(r.rows[0], garantias) });
    } catch (error) {
      return res.status(500).json({ ok: false, offer: null, error: error?.message });
    }
  }

  // ── Listado ──
  const limit  = Math.min(200, Math.max(1, Number(req?.query?.limit)  || 60));
  const offset = Math.max(0, Number(req?.query?.offset) || 0);
  const brand  = String(req?.query?.brand || "").trim();
  const sort   = String(req?.query?.sort  || "").trim();
  const q      = String(req?.query?.query || "").trim();
  const model        = String(req?.query?.model || "").trim();
  const fuel         = String(req?.query?.fuel || "").trim();
  const color        = String(req?.query?.color || "").trim();
  const transmission = String(req?.query?.transmission || "").trim();
  const displacement = String(req?.query?.displacement || "").trim();
  const minPrice   = Number(req?.query?.minPrice)   || null;
  const maxPrice   = Number(req?.query?.maxPrice)   || null;
  const minYear    = Number(req?.query?.minYear)    || null;
  const maxYear    = Number(req?.query?.maxYear)    || null;
  const minMileage = Number(req?.query?.minMileage) || null;
  const maxMileage = Number(req?.query?.maxMileage) || null;

  /**
   * Solo las que siguen vivas.
   *
   * `import_published` dice si el ahorro es bueno; `is_active`, si el coche
   * existe todavia. Faltaba lo segundo: el 1 de septiembre habia 454 coches
   * publicados de 484 que estaban vendidos desde julio, y se podia pedir uno
   * y pagar la fianza.
   *
   * Con COALESCE porque una fila sin revisar todavia no es una fila muerta.
   */
  const conditions = ["country = 'DE'", "import_published = TRUE", "price IS NOT NULL", "COALESCE(is_active, TRUE) = TRUE"];
  const values = [];
  if (brand) { values.push(`%${brand.toLowerCase()}%`); conditions.push(`lower(COALESCE(brand,'')) LIKE $${values.length}`); }
  if (model) { values.push(`%${model.toLowerCase()}%`); conditions.push(`lower(COALESCE(model,'')) LIKE $${values.length}`); }
  if (q)     { values.push(`%${q.toLowerCase()}%`);     conditions.push(`(lower(COALESCE(title,'')) LIKE $${values.length} OR lower(COALESCE(brand,'')) LIKE $${values.length} OR lower(COALESCE(model,'')) LIKE $${values.length})`); }
  // El precio de la horquilla es el que el cliente está viendo: lo que cuesta
  // puesto aquí, no el del anuncio alemán. Filtrando por `price` a secas, pedir
  // «hasta 15.000» sacaba coches con 18.000 en la tarjeta.
  if (minPrice)   { values.push(minPrice);   conditions.push(`${PRECIO_PUESTO} >= $${values.length}`); }
  if (maxPrice)   { values.push(maxPrice);   conditions.push(`${PRECIO_PUESTO} <= $${values.length}`); }
  if (minYear)    { values.push(minYear);    conditions.push(`year >= $${values.length}`); }
  if (maxYear)    { values.push(maxYear);    conditions.push(`year <= $${values.length}`); }
  if (minMileage) { values.push(minMileage); conditions.push(`mileage >= $${values.length}`); }
  if (maxMileage) { values.push(maxMileage); conditions.push(`mileage <= $${values.length}`); }
  if (fuel)         { conditions.push(pgFuelCondition(fuel, values, `lower(COALESCE(fuel,''))`)); }
  if (color)        { values.push(color.toLowerCase());        conditions.push(`(color IS NULL OR color = '' OR lower(color) LIKE $${values.length} || '%')`); }
  if (transmission) { values.push(transmission.toLowerCase()); conditions.push(`lower(COALESCE(transmission,'')) = $${values.length}`); }
  if (displacement) {
    const dcol = `(CASE WHEN COALESCE(displacement,'') ~ '^[0-9]+$' THEN displacement::int ELSE NULL END)`;
    if (displacement === "electric")        conditions.push(`${dcol} = 0`);
    else if (displacement === "0_1200")     conditions.push(`${dcol} > 0 AND ${dcol} <= 1200`);
    else if (displacement === "1200_1600")  conditions.push(`${dcol} > 1200 AND ${dcol} <= 1600`);
    else if (displacement === "1600_2000")  conditions.push(`${dcol} > 1600 AND ${dcol} <= 2000`);
    else if (displacement === "2000_plus")  conditions.push(`${dcol} > 2000`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  try {
    // El catálogo de garantías va en la misma tanda: es una fila por producto.
    const [rows, totalRes, marcasRes, garantias] = await Promise.all([
      pool.query(
        `SELECT ${SELECT_COLS} FROM moveadvisor_market_offers ${where}
         ORDER BY ${ordenSql(sort)}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM moveadvisor_market_offers ${where}`, values),
      // Qué marcas hay de verdad para importar.
      //
      // Son tres —lo que el motor haya seleccionado— y el desplegable de la
      // pantalla enseña el catálogo entero. Elegir una marca de la que no hay
      // nada devuelve cero y se lee como que el filtro está roto, cuando lo que
      // pasa es que no hay ningún coche de esa marca. Con esta lista, la
      // pantalla puede poner arriba las que sí tienen.
      //
      // Va sin el `where` a propósito: es lo que hay disponible en total, no lo
      // que queda después de filtrar. Si dependiera del filtro, elegir una marca
      // dejaría el desplegable con esa sola.
      pool.query(`SELECT brand, COUNT(*)::int AS n FROM moveadvisor_market_offers
                   WHERE country = 'DE' AND import_published = TRUE AND COALESCE(is_active, TRUE) = TRUE
                     AND COALESCE(brand,'') <> ''
                   GROUP BY brand ORDER BY n DESC`),
      catalogoDeGarantias(pool),
    ]);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      offers: rows.rows.map((f) => mapOffer(f, garantias)),
      total: totalRes.rows[0].total,
      // Las marcas que hay para importar, con cuántos coches de cada una: la
      // pantalla las pone arriba del desplegable.
      brands: (marcasRes.rows || []).map((r) => ({ name: r.brand, count: r.n })),
      limit,
      offset,
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      offers: [],
      total: 0,
      warning: error instanceof Error ? error.message : "No se pudieron cargar las ofertas de importación.",
    });
  }
};

/**
 * Una oferta de importación, por su id.
 *
 * Vive aquí porque la consulta y el mapeo ya estaban aquí, y la vista previa
 * de un enlace compartido necesita exactamente lo mismo. Sin esto, el
 * generador de vistas previas solo sabía mirar en el marketplace y mandaba al
 * listado cualquier enlace a un coche de importación.
 */
async function ofertaDeImportacionPorId(offerId) {
  const pool = getImportPool();
  if (!pool || !offerId) return null;
  try {
    const r = await pool.query(
      `SELECT ${SELECT_COLS} FROM moveadvisor_market_offers
       WHERE id = $1 AND country = 'DE' AND import_published = TRUE AND COALESCE(is_active, TRUE) = TRUE LIMIT 1`,
      [String(offerId).trim()]
    );
    return r.rows.length ? mapOffer(r.rows[0], await catalogoDeGarantias(pool)) : null;
  } catch {
    return null;
  }
}

module.exports.ofertaDeImportacionPorId = ofertaDeImportacionPorId;
