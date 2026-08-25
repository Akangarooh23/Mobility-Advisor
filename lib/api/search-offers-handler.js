/**
 * Buscador de ofertas — Comprar › Buscar coche.
 *
 * Sirve el listado completo de `moveadvisor_market_offers` y lo va recortando
 * segun los filtros. Dos cosas quedan siempre fuera y no son negociables desde
 * el cliente: las ofertas inactivas y las de importacion alemana. Van en la
 * base de la consulta, no como filtro, para que no puedan colarse pasando un
 * parametro.
 *
 * Tiene dos modos:
 *   ?facets=brands            → las marcas con cuantas ofertas tiene cada una
 *   ?facets=models&brand=...  → los modelos de esa marca, igual
 *   (sin facets)              → la pagina de ofertas y el total que cumple
 *
 * Los desplegables se construyen con lo que hay en las ofertas, no con el
 * catalogo maestro: asi nunca se ofrece una marca que no devuelve nada.
 */

const { getPostgresPool } = require("../inventoryStore");

// Solo activas y de España. Nunca se toca desde fuera.
const BASE = `is_active AND country = 'ES'`;

const MAX_LIMITE = 48;
const LIMITE_POR_DEFECTO = 24;

const ORDENES = {
  recientes: `last_seen_at DESC NULLS LAST`,
  precio_asc: `price ASC NULLS LAST`,
  precio_desc: `price DESC NULLS LAST`,
  km_asc: `mileage ASC NULLS LAST`,
  anio_desc: `"year" DESC NULLS LAST`,
};

function miles(n) {
  return String(Math.round(Number(n))).replace(/B(?=(d{3})+(?!d))/g, ".");
}

function texto(v) {
  return typeof v === "string" ? v.trim() : "";
}
function entero(v) {
  const n = Number.parseInt(String(v ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** Traduce los filtros de la petición a condiciones SQL con parámetros. */
function construirFiltros(q) {
  const condiciones = [BASE];
  const valores = [];
  const añadir = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.replace("$?", `$${valores.length}`));
  };

  const marca = texto(q.brand);
  const modelo = texto(q.model);
  const busqueda = texto(q.query);

  // Marca y modelo van por igualdad, no por LIKE: la columna esta limpia y un
  // LIKE haria que «Seat» arrastrase «Seat Comerciales».
  if (marca) añadir("lower(brand) = $?", marca.toLowerCase());
  if (modelo) añadir("lower(model) = $?", modelo.toLowerCase());
  if (busqueda) {
    valores.push(`%${busqueda.toLowerCase()}%`);
    condiciones.push(
      `(lower(COALESCE(title,'')) LIKE $${valores.length}` +
      ` OR lower(COALESCE(brand,'')) LIKE $${valores.length}` +
      ` OR lower(COALESCE(model,'')) LIKE $${valores.length}` +
      ` OR lower(COALESCE(version,'')) LIKE $${valores.length})`
    );
  }

  for (const [clave, sql] of [
    ["minPrice", "price >= $?"], ["maxPrice", "price <= $?"],
    ["minYear", '"year" >= $?'], ["maxYear", '"year" <= $?'],
    ["minMileage", "mileage >= $?"], ["maxMileage", "mileage <= $?"],
    ["minPower", "power_cv >= $?"], ["maxPower", "power_cv <= $?"],
  ]) {
    const n = entero(q[clave]);
    if (n !== null) añadir(sql, n);
  }

  for (const [clave, columna] of [
    ["fuel", "fuel"], ["transmission", "transmission"],
    ["bodyType", "body_type"], ["color", "color"],
    ["province", "province"], ["sellerType", "seller_type"],
  ]) {
    const v = texto(q[clave]);
    if (v) añadir(`lower(${columna}) = $?`, v.toLowerCase());
  }

  return { where: condiciones.join(" AND "), valores };
}

function mapear(f) {
  let imagenes = [];
  try {
    const p = JSON.parse(f.images || "[]");
    if (Array.isArray(p)) imagenes = p.filter((x) => typeof x === "string" && x);
  } catch { /* el campo puede venir vacío o mal formado; no es motivo de error */ }

  const cv = f.power_cv != null ? Number(f.power_cv) : null;
  const imagen = f.image_url || imagenes[0] || "";

  return {
    id: f.id,
    portal: f.portal || "",
    url: f.url || "",
    searchUrl: f.url || "",
    title: f.title || [f.brand, f.model, f.version].filter(Boolean).join(" "),
    brand: f.brand || "",
    model: f.model || "",
    version: f.version || "",
    price: f.price === null ? null : Number(f.price),
    priceText: f.price === null ? "" : miles(f.price) + " €",
    monthlyPrice: f.monthly_price === null ? null : Number(f.monthly_price),
    financePrice: f.finance_price === null ? null : Number(f.finance_price),
    year: f.year != null ? Number(f.year) : null,
    mileage: f.mileage != null ? Number(f.mileage) : null,
    fuel: f.fuel || "",
    transmission: f.transmission || "",
    bodyType: f.body_type || "",
    body: f.body_type || "",
    color: f.color || "",
    powerCv: cv,
    powerKw: f.power_kw != null ? Number(f.power_kw) : null,
    power: cv != null ? cv + " CV" : "",
    province: f.province || "",
    city: f.city || "",
    location: [f.city, f.province].filter(Boolean).join(", "),
    dealerName: f.dealer_name || "",
    sellerType: f.seller_type || "",
    environmentalLabel: f.environmental_label || "",
    label: f.environmental_label || "",
    displacement: f.displacement || "",
    image: imagen,
    imageUrl: imagen,
    images: imagenes.length ? imagenes : (imagen ? [imagen] : []),
  };
}

async function facetaMarcas(pool, q) {
  // El recuento respeta el resto de filtros menos la propia marca, para que el
  // desplegable diga cuantas ofertas hay realmente con lo que ya has elegido.
  const { where, valores } = construirFiltros({ ...q, brand: "", model: "" });
  const r = await pool.query(
    `SELECT brand AS nombre, COUNT(*)::int AS n
       FROM moveadvisor_market_offers
      WHERE ${where} AND brand <> ''
      GROUP BY brand
      ORDER BY n DESC, brand ASC`,
    valores
  );
  return r.rows;
}

async function facetaModelos(pool, q) {
  if (!texto(q.brand)) return [];
  const { where, valores } = construirFiltros({ ...q, model: "" });
  const r = await pool.query(
    `SELECT model AS nombre, COUNT(*)::int AS n
       FROM moveadvisor_market_offers
      WHERE ${where} AND model <> ''
      GROUP BY model
      ORDER BY n DESC, model ASC`,
    valores
  );
  return r.rows;
}

async function facetaCampo(pool, q, columna, sinFiltroPropio) {
  const { where, valores } = construirFiltros({ ...q, [sinFiltroPropio]: "" });
  const r = await pool.query(
    `SELECT ${columna} AS nombre, COUNT(*)::int AS n
       FROM moveadvisor_market_offers
      WHERE ${where} AND ${columna} <> ''
      GROUP BY ${columna}
      HAVING COUNT(*) >= 20
      ORDER BY n DESC
      LIMIT 40`,
    valores
  );
  return r.rows;
}

module.exports = async function handler(req, res) {
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(503).json({ ok: false, error: "La base de ofertas no está disponible." });
  }

  const url = new URL(req.url, "http://local");
  const q = Object.fromEntries(url.searchParams.entries());

  try {
    const facets = texto(q.facets);

    if (facets === "brands") {
      return res.status(200).json({ ok: true, marcas: await facetaMarcas(pool, q) });
    }
    if (facets === "models") {
      return res.status(200).json({ ok: true, modelos: await facetaModelos(pool, q) });
    }
    if (facets === "extra") {
      const [combustible, cambio, carroceria, provincia] = await Promise.all([
        facetaCampo(pool, q, "fuel", "fuel"),
        facetaCampo(pool, q, "transmission", "transmission"),
        facetaCampo(pool, q, "body_type", "bodyType"),
        facetaCampo(pool, q, "province", "province"),
      ]);
      return res.status(200).json({ ok: true, combustible, cambio, carroceria, provincia });
    }

    const limite = Math.min(MAX_LIMITE, Math.max(1, entero(q.limit) ?? LIMITE_POR_DEFECTO));
    const desde = Math.max(0, entero(q.offset) ?? 0);
    const orden = ORDENES[texto(q.sort)] || ORDENES.recientes;

    const { where, valores } = construirFiltros(q);

    // El total y la pagina van en paralelo: son dos consultas independientes y
    // esperarlas en serie duplicaba el tiempo de respuesta.
    const [total, pagina] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM moveadvisor_market_offers WHERE ${where}`, valores),
      pool.query(
        `SELECT id, portal, url, brand, model, version, title, price, monthly_price,
                "year", mileage, fuel, transmission, body_type, color, power_cv,
                province, seller_type, image_url, images
           FROM moveadvisor_market_offers
          WHERE ${where}
          ORDER BY ${orden}
          LIMIT ${limite} OFFSET ${desde}`,
        valores
      ),
    ]);

    return res.status(200).json({
      ok: true,
      total: total.rows[0].n,
      limite,
      desde,
      ofertas: pagina.rows.map(mapear),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Error al buscar ofertas." });
  }
};
