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
  const s = String(Math.round(Number(n)));
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ".";
    out += s[i];
  }
  return out;
}

function alfabetico(lista) {
  return [...lista].sort((a, b) =>
    String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));
}

function texto(v) {
  return typeof v === "string" ? v.trim() : "";
}
function entero(v) {
  const n = Number.parseInt(String(v ?? "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/* ── Marcas escritas de varias formas ──────────────────────────────────────
 *
 * El volcado de portales trae la misma marca con grafias distintas: Yudo llega
 * como «Yoodoo», «Yoodooo», «Yooudoo» y «YOOUDOO 6», y cada una abria su propia
 * entrada en el desplegable con una oferta suelta. Quien decide cual es la
 * buena es `moveadvisor_brand_aliases`, la misma tabla que ya consulta el
 * tasador. Aqui no se inventa criterio: se lee el suyo.
 *
 * Se compara la grafia literal en minusculas, no la clave normalizada que
 * calcula la base. Las grafias que hay que unir estan escritas una a una en esa
 * tabla, asi que la comparacion directa basta, y evita mantener en JavaScript
 * una copia de la funcion SQL `normalize_alias_token` — que es justo por donde
 * las dos versiones se separarian con el tiempo.
 */
const ALIAS_TTL_MS = 5 * 60 * 1000;
let aliasCache = null;
let aliasCaduca = 0;

async function aliasDeMarcas(pool) {
  const ahora = Date.now();
  if (aliasCache && ahora < aliasCaduca) return aliasCache;

  const r = await pool.query(
    `SELECT alias_name, canonical_name
       FROM moveadvisor_brand_aliases
      WHERE is_active AND alias_key <> canonical_key`
  );

  const mapa = new Map();
  for (const fila of r.rows) {
    const de = texto(fila.alias_name).toLowerCase();
    const a = texto(fila.canonical_name);
    if (de && a) mapa.set(de, a);
  }

  aliasCache = mapa;
  aliasCaduca = ahora + ALIAS_TTL_MS;
  return mapa;
}

/**
 * Aqui no se recorta el nombre. Cinco ofertas tienen la marca guardada con un
 * espacio al final —«aixam », «Rieju »— y limpiarlas solo al agrupar uniria la
 * entrada del desplegable sin unir el filtro, que compara contra la columna tal
 * cual: el recuento diria una cosa y el listado daria otra. Recortar tambien en
 * el filtro obligaria a `btrim(brand)`, que deja fuera el indice sobre
 * `lower(brand)` y sube la consulta de 313 ms a 1.4 s. Se arregla en el dato,
 * no aqui.
 */
function canonica(nombre, mapa) {
  const n = String(nombre ?? "");
  return mapa.get(n.toLowerCase()) || n;
}

/**
 * Todas las grafias que hay que buscar para la marca elegida, en minusculas.
 * Si llega un alias en vez de la canonica —un enlace antiguo, por ejemplo— se
 * resuelve primero, para que el filtro devuelva el grupo entero igualmente.
 */
async function grupoDeMarca(pool, marca) {
  const mapa = await aliasDeMarcas(pool);
  const canon = canonica(marca, mapa).toLowerCase();
  const grupo = new Set([canon]);
  for (const [de, a] of mapa) {
    if (a.toLowerCase() === canon) grupo.add(de);
  }
  return [...grupo];
}

/** Suma en una sola entrada las filas que apuntan a la misma marca. */
function agrupar(filas, mapa) {
  const por = new Map();
  for (const f of filas) {
    const nombre = String(f.nombre ?? "");
    if (!nombre.trim()) continue;
    const canon = canonica(nombre, mapa);
    const clave = canon.toLowerCase();
    const previo = por.get(clave);
    if (previo) previo.n += Number(f.n) || 0;
    else por.set(clave, { nombre: canon, n: Number(f.n) || 0 });
  }
  return [...por.values()];
}

/**
 * Traduce los filtros de la peticion a condiciones SQL con parametros.
 * `grupoMarca` son las grafias equivalentes de la marca elegida; llega resuelto
 * desde fuera porque calcularlo necesita la base y esta funcion es sincrona.
 */
function construirFiltros(q, grupoMarca) {
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
  if (marca) {
    if (grupoMarca && grupoMarca.length > 1) añadir("lower(brand) = ANY($?)", grupoMarca);
    else añadir("lower(brand) = $?", marca.toLowerCase());
  }
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

function mapear(f, mapa) {
  let imagenes = [];
  try {
    const p = JSON.parse(f.images || "[]");
    if (Array.isArray(p)) imagenes = p.filter((x) => typeof x === "string" && x);
  } catch { /* el campo puede venir vacío o mal formado; no es motivo de error */ }

  const cv = f.power_cv != null ? Number(f.power_cv) : null;
  const imagen = f.image_url || imagenes[0] || "";
  // La marca se muestra ya unificada. El titulo no se toca: son las palabras
  // del anuncio original, y ahi responde el portal de lo que escribio.
  const marca = f.brand ? canonica(f.brand, mapa) : "";

  return {
    id: f.id,
    portal: f.portal || "",
    url: f.url || "",
    searchUrl: f.url || "",
    title: f.title || [marca, f.model, f.version].filter(Boolean).join(" "),
    brand: marca,
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
  const { where, valores } = construirFiltros({ ...q, brand: "", model: "" }, null);

  const bruto = await pool.query(
    `SELECT (array_agg(brand ORDER BY cnt DESC))[1] AS nombre, SUM(cnt)::int AS n
       FROM (SELECT brand, COUNT(*)::int AS cnt
               FROM moveadvisor_market_offers
              WHERE ${where} AND brand <> ''
              GROUP BY brand) x
      GROUP BY lower(brand)`,
    valores
  );

  const mapa = await aliasDeMarcas(pool);
  const conOfertas = agrupar(bruto.rows, mapa);

  // Una marca del catalogo que sea alias de otra con ofertas no vuelve a
  // aparecer abajo: ya esta arriba, con su nombre bueno.
  const conocidas = new Set(conOfertas.map((r) => r.nombre.toLowerCase()));
  const catalogo = await pool.query(
    `SELECT name FROM moveadvisor_vehicle_brands WHERE is_active`
  );
  const sinOfertas = catalogo.rows
    .map((r) => r.name)
    .filter((n) => n && !conocidas.has(canonica(n, mapa).toLowerCase()))
    .map((n) => ({ nombre: n, n: 0 }));

  return { conOfertas: alfabetico(conOfertas), sinOfertas: alfabetico(sinOfertas) };
}

async function facetaModelos(pool, q, grupoMarca) {
  const marca = texto(q.brand);
  if (!marca) return { conOfertas: [], sinOfertas: [] };

  const { where, valores } = construirFiltros({ ...q, model: "" }, grupoMarca);
  const conOfertas = await pool.query(
    `SELECT (array_agg(model ORDER BY cnt DESC))[1] AS nombre, SUM(cnt)::int AS n
       FROM (SELECT model, COUNT(*)::int AS cnt
               FROM moveadvisor_market_offers
              WHERE ${where} AND model <> ''
              GROUP BY model) x
      GROUP BY lower(model)`,
    valores
  );

  const conocidos = new Set(conOfertas.rows.map((r) => r.nombre.toLowerCase()));
  const catalogo = await pool.query(
    `SELECT m.name
       FROM moveadvisor_vehicle_models m
       JOIN moveadvisor_vehicle_brands b ON b.id = m.brand_id
      WHERE m.is_active AND b.is_active AND lower(b.name) = $1`,
    [marca.toLowerCase()]
  );
  const sinOfertas = catalogo.rows
    .map((r) => r.name)
    .filter((n) => n && !conocidos.has(n.toLowerCase()))
    .map((n) => ({ nombre: n, n: 0 }));

  return { conOfertas: alfabetico(conOfertas.rows), sinOfertas: alfabetico(sinOfertas) };
}

async function facetaCampo(pool, q, columna, sinFiltroPropio, grupoMarca) {
  const { where, valores } = construirFiltros({ ...q, [sinFiltroPropio]: "" }, grupoMarca);
  const r = await pool.query(
    `SELECT (array_agg(v ORDER BY cnt DESC))[1] AS nombre, SUM(cnt)::int AS n
       FROM (SELECT ${columna} AS v, COUNT(*)::int AS cnt
               FROM moveadvisor_market_offers
              WHERE ${where} AND ${columna} <> ''
              GROUP BY ${columna}) x
      GROUP BY lower(v)
      HAVING SUM(cnt) >= 20
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

    // Se resuelve una vez y viaja a todo lo que consulte con la marca puesta.
    const marcaPedida = texto(q.brand);
    const grupoMarca = marcaPedida ? await grupoDeMarca(pool, marcaPedida) : null;

    if (facets === "brands") {
      return res.status(200).json({ ok: true, ...(await facetaMarcas(pool, q)) });
    }
    if (facets === "models") {
      return res.status(200).json({ ok: true, ...(await facetaModelos(pool, q, grupoMarca)) });
    }
    if (facets === "extra") {
      const [combustible, cambio, carroceria, provincia] = await Promise.all([
        facetaCampo(pool, q, "fuel", "fuel", grupoMarca),
        facetaCampo(pool, q, "transmission", "transmission", grupoMarca),
        facetaCampo(pool, q, "body_type", "bodyType", grupoMarca),
        facetaCampo(pool, q, "province", "province", grupoMarca),
      ]);
      return res.status(200).json({ ok: true, combustible, cambio, carroceria, provincia });
    }

    const limite = Math.min(MAX_LIMITE, Math.max(1, entero(q.limit) ?? LIMITE_POR_DEFECTO));
    const desde = Math.max(0, entero(q.offset) ?? 0);
    const orden = ORDENES[texto(q.sort)] || ORDENES.recientes;

    const { where, valores } = construirFiltros(q, grupoMarca);

    // El total y la pagina van en paralelo: son dos consultas independientes y
    // esperarlas en serie duplicaba el tiempo de respuesta.
    const [total, pagina, mapa] = await Promise.all([
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
      aliasDeMarcas(pool),
    ]);

    return res.status(200).json({
      ok: true,
      total: total.rows[0].n,
      limite,
      desde,
      ofertas: pagina.rows.map((f) => mapear(f, mapa)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Error al buscar ofertas." });
  }
};
