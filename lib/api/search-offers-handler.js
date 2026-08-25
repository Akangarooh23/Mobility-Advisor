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
 * El volcado de portales trae la misma marca escrita de muchas maneras, y son
 * dos problemas distintos que se arreglan en dos sitios distintos.
 *
 * Uno son las erratas y los nombres comerciales: «Yoodoo» por Yudo, «bwm» por
 * BMW, «DS Automobiles» por DS. Ahi no hay regla que valga, hace falta que
 * alguien diga cual es la buena, y quien lo dice es `moveadvisor_brand_aliases`
 * —la misma tabla que ya consulta el tasador—. Aqui no se inventa criterio: se
 * lee el suyo.
 *
 * El otro son tildes, guiones, espacios y mayusculas: «Citroën» y «Citroen»,
 * «Mercedes-Benz» y «Mercedes Benz», «Land Rover» y «LAND-ROVER». Eso si es una
 * regla, y declararlo alias a alias seria una lista infinita que hay que ir
 * ampliando cada vez que un portal escribe distinto. Se agrupa por la clave que
 * calcula `normalize_alias_token`, la misma funcion SQL con la que la tabla de
 * alias genera las suyas, para que las dos formas de agrupar no se separen.
 *
 * El nombre que se ensena es el de la grafia con mas ofertas, salvo que un
 * alias diga otra cosa: entre 29.865 «Citroen» y 606 «Citroën» manda la mayoria.
 *
 * Nada de esto toca las ofertas. La columna sigue guardando lo que mando el
 * portal, y el filtro busca todas las grafias del grupo a la vez.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
let aliasCache = null;
let aliasCaduca = 0;
let grafiasCache = null;
let grafiasCaduca = 0;

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
  aliasCaduca = ahora + CACHE_TTL_MS;
  return mapa;
}

/**
 * Las grafias que hay en las ofertas, agrupadas por clave normalizada, con el
 * nombre de la que mas ofertas tiene.
 *
 * La cuenta va sobre las ofertas que se enseñan —activas y de España— y no
 * sobre lo que quede tras los filtros del usuario. Las dos cosas importan:
 *
 *   - Si dependiera de los filtros, «Mercedes-Benz» podria pasar a llamarse
 *     «Mercedes Benz» por acotar los kilometros. El nombre de una marca no
 *     cambia porque muevas un filtro.
 *   - Y si contara la tabla entera, mandarian ofertas que nadie ve: sobre el
 *     total gana «Byd» 524 a 166, pero entre las que se enseñan gana «BYD» 155
 *     a 91. El nombre lo deciden las ofertas que existen para quien mira.
 *
 * Las grafias del grupo si salen de la tabla entera: el filtro tiene que
 * encontrarlas todas, y una grafia de mas no hace dano —no habra ofertas que
 * la lleven— mientras que una de menos deja ofertas fuera.
 *
 * La funcion normalizadora se ejecuta una vez por grafia distinta —unas 470—,
 * no una vez por oferta: agrupar primero por `brand` deja el trabajo caro
 * dentro del indice.
 */
async function mapaGrafias(pool) {
  const ahora = Date.now();
  if (grafiasCache && ahora < grafiasCaduca) return grafiasCache;

  const r = await pool.query(
    `SELECT normalize_alias_token(brand) AS clave,
            (array_agg(brand ORDER BY visibles DESC, cnt DESC))[1] AS nombre,
            array_agg(brand) AS grafias
       FROM (SELECT brand,
                    COUNT(*)::int AS cnt,
                    COUNT(*) FILTER (WHERE ${BASE})::int AS visibles
               FROM moveadvisor_market_offers
              WHERE brand <> ''
              GROUP BY brand) x
      GROUP BY 1`
  );

  const porClave = new Map();
  const porGrafia = new Map();
  for (const fila of r.rows) {
    const clave = texto(fila.clave);
    if (!clave) continue;
    const grafias = (fila.grafias || []).filter(Boolean);
    porClave.set(clave, { nombre: texto(fila.nombre), grafias });
    for (const g of grafias) porGrafia.set(String(g).toLowerCase(), clave);
  }

  grafiasCache = { porClave, porGrafia };
  grafiasCaduca = ahora + CACHE_TTL_MS;
  return grafiasCache;
}

/**
 * El nombre con el que se ensena una marca. Manda el alias si lo hay; si no, la
 * grafia mayoritaria de su grupo; y si la marca no aparece en ninguna oferta,
 * lo que venga.
 */
function canonica(nombre, alias, grafias) {
  const n = String(nombre ?? "");
  const declarado = alias.get(n.toLowerCase());
  if (declarado) return declarado;
  if (!grafias) return n;
  const clave = grafias.porGrafia.get(n.toLowerCase());
  const grupo = clave ? grafias.porClave.get(clave) : null;
  return (grupo && grupo.nombre) || n;
}

/**
 * Todas las grafias que hay que buscar para la marca elegida, en minusculas.
 *
 * Se parte de la canonica —si llega un alias, un enlace antiguo por ejemplo, se
 * resuelve primero—, se anaden las grafias que un alias manda a esa marca, y de
 * cada una se anade su grupo normalizado entero. Asi elegir «BMW» encuentra
 * tambien las guardadas como «bwm», y elegir «Citroen» las guardadas con
 * dieresis.
 */
async function grupoDeMarca(pool, marca) {
  const alias = await aliasDeMarcas(pool);
  const grafias = await mapaGrafias(pool);

  const canon = canonica(marca, alias, grafias);
  const grupo = new Set([canon.toLowerCase(), String(marca ?? "").toLowerCase()]);

  for (const [de, a] of alias) {
    if (a.toLowerCase() === canon.toLowerCase()) grupo.add(de);
  }
  for (const g of [...grupo]) {
    const clave = grafias.porGrafia.get(g);
    const grupoNorm = clave ? grafias.porClave.get(clave) : null;
    if (grupoNorm) for (const otra of grupoNorm.grafias) grupo.add(String(otra).toLowerCase());
  }

  return [...grupo].filter(Boolean);
}

/**
 * Suma en una sola entrada las filas que son la misma marca.
 *
 * La consulta ya llega agrupada por clave normalizada, asi que aqui solo queda
 * juntar lo que ademas una la tabla de alias, que si cruza claves distintas:
 * «bwm» y «bmw» no se parecen para la funcion normalizadora, y son la misma
 * marca porque alguien lo ha dicho.
 */
function agrupar(filas, alias, grafias) {
  const por = new Map();
  for (const f of filas) {
    const nombre = String(f.nombre ?? "");
    if (!nombre.trim()) continue;
    const canon = canonica(nombre, alias, grafias);
    const clave = canon.toLowerCase();
    const previo = por.get(clave);
    if (previo) previo.n += Number(f.n) || 0;
    else por.set(clave, { nombre: canon, n: Number(f.n) || 0 });
  }
  return [...por.values()];
}

/**
 * Los modelos se parten igual que las marcas, y peor: «Leon» y «León» son 7.812
 * ofertas de Seat, y el C-HR de Toyota llega de cinco maneras. Se resuelve en el
 * momento y no en un mapa guardado como el de marcas: hay decenas de miles de
 * modelos distintos, y siempre se pregunta por uno dentro de una marca ya
 * elegida, asi que la consulta sale barata.
 */
async function grupoDeModelo(pool, grupoMarca, modelo) {
  const m = texto(modelo);
  if (!m) return null;

  const marcas = (grupoMarca && grupoMarca.length ? grupoMarca : null);
  const r = await pool.query(
    `SELECT array_agg(DISTINCT model) AS grafias
       FROM moveadvisor_market_offers
      WHERE ${BASE}
        AND normalize_alias_token(model) = normalize_alias_token($1)
        ${marcas ? "AND lower(brand) = ANY($2)" : ""}`,
    marcas ? [m, marcas] : [m]
  );

  const grafias = (r.rows[0] && r.rows[0].grafias) || [];
  const grupo = new Set([m.toLowerCase()]);
  for (const g of grafias) if (g) grupo.add(String(g).toLowerCase());
  return [...grupo];
}

/**
 * Traduce los filtros de la peticion a condiciones SQL con parametros.
 * Los grupos de marca y modelo son las grafias equivalentes de lo elegido;
 * llegan resueltos desde fuera porque calcularlos necesita la base y esta
 * funcion es sincrona.
 */
function construirFiltros(q, grupoMarca, grupoModelo) {
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
  if (modelo) {
    if (grupoModelo && grupoModelo.length > 1) añadir("lower(model) = ANY($?)", grupoModelo);
    else añadir("lower(model) = $?", modelo.toLowerCase());
  }
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

function mapear(f, alias, grafias) {
  let imagenes = [];
  try {
    const p = JSON.parse(f.images || "[]");
    if (Array.isArray(p)) imagenes = p.filter((x) => typeof x === "string" && x);
  } catch { /* el campo puede venir vacío o mal formado; no es motivo de error */ }

  const cv = f.power_cv != null ? Number(f.power_cv) : null;
  const imagen = f.image_url || imagenes[0] || "";
  // La marca se muestra con el mismo nombre que en el desplegable: si la lista
  // dice «Citroen», la ficha no puede decir «Citroën». El titulo no se toca:
  // son las palabras del anuncio original, y de esas responde el portal.
  const marca = f.brand ? canonica(f.brand, alias, grafias) : "";

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
    `SELECT normalize_alias_token(brand) AS clave,
            (array_agg(brand ORDER BY cnt DESC))[1] AS nombre,
            SUM(cnt)::int AS n
       FROM (SELECT brand, COUNT(*)::int AS cnt
               FROM moveadvisor_market_offers
              WHERE ${where} AND brand <> ''
              GROUP BY brand) x
      GROUP BY 1`,
    valores
  );

  const [alias, grafias] = await Promise.all([aliasDeMarcas(pool), mapaGrafias(pool)]);
  const conOfertas = agrupar(bruto.rows, alias, grafias);

  /* El catalogo se compara por clave, no por nombre. «Citroën» esta en el
   * catalogo y «Citroen» en las ofertas: comparando el texto no se reconocerian
   * y la misma marca saldria arriba con ofertas y otra vez abajo en «Mas
   * marcas», que es precisamente el duplicado que veniamos a quitar. */
  const conClave = new Set(bruto.rows.map((r) => texto(r.clave)).filter(Boolean));
  for (const c of conOfertas) {
    const k = grafias.porGrafia.get(c.nombre.toLowerCase());
    if (k) conClave.add(k);
  }

  const catalogo = await pool.query(
    `SELECT name, normalize_alias_token(name) AS clave
       FROM moveadvisor_vehicle_brands WHERE is_active`
  );
  const vistas = new Set();
  const sinOfertas = [];
  for (const fila of catalogo.rows) {
    const nombre = texto(fila.name);
    const clave = texto(fila.clave) || nombre.toLowerCase();
    if (!nombre || conClave.has(clave) || vistas.has(clave)) continue;
    vistas.add(clave);
    sinOfertas.push({ nombre, n: 0 });
  }

  return { conOfertas: alfabetico(conOfertas), sinOfertas: alfabetico(sinOfertas) };
}

async function facetaModelos(pool, q, grupoMarca) {
  const marca = texto(q.brand);
  if (!marca) return { conOfertas: [], sinOfertas: [] };

  const { where, valores } = construirFiltros({ ...q, model: "" }, grupoMarca, null);
  const conOfertas = await pool.query(
    `SELECT normalize_alias_token(model) AS clave,
            (array_agg(model ORDER BY cnt DESC))[1] AS nombre,
            SUM(cnt)::int AS n
       FROM (SELECT model, COUNT(*)::int AS cnt
               FROM moveadvisor_market_offers
              WHERE ${where} AND model <> ''
              GROUP BY model) x
      GROUP BY 1`,
    valores
  );

  // Igual que con las marcas: el catalogo se compara por clave, o «Leon» saldria
  // arriba y «León» otra vez abajo en «Mas modelos».
  const conClave = new Set(conOfertas.rows.map((r) => texto(r.clave)).filter(Boolean));
  const catalogo = await pool.query(
    `SELECT m.name, normalize_alias_token(m.name) AS clave
       FROM moveadvisor_vehicle_models m
       JOIN moveadvisor_vehicle_brands b ON b.id = m.brand_id
      WHERE m.is_active AND b.is_active AND lower(b.name) = $1`,
    [marca.toLowerCase()]
  );
  const vistos = new Set();
  const sinOfertas = [];
  for (const fila of catalogo.rows) {
    const nombre = texto(fila.name);
    const clave = texto(fila.clave) || nombre.toLowerCase();
    if (!nombre || conClave.has(clave) || vistos.has(clave)) continue;
    vistos.add(clave);
    sinOfertas.push({ nombre, n: 0 });
  }

  const lista = conOfertas.rows.map((r) => ({ nombre: texto(r.nombre), n: Number(r.n) || 0 }));
  return { conOfertas: alfabetico(lista), sinOfertas: alfabetico(sinOfertas) };
}

async function facetaCampo(pool, q, columna, sinFiltroPropio, grupoMarca, grupoModelo) {
  const { where, valores } = construirFiltros({ ...q, [sinFiltroPropio]: "" }, grupoMarca, grupoModelo);
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
    const grupoModelo = texto(q.model) ? await grupoDeModelo(pool, grupoMarca, q.model) : null;

    if (facets === "brands") {
      return res.status(200).json({ ok: true, ...(await facetaMarcas(pool, q)) });
    }
    if (facets === "models") {
      return res.status(200).json({ ok: true, ...(await facetaModelos(pool, q, grupoMarca)) });
    }
    if (facets === "extra") {
      const [combustible, cambio, carroceria, provincia] = await Promise.all([
        facetaCampo(pool, q, "fuel", "fuel", grupoMarca, grupoModelo),
        facetaCampo(pool, q, "transmission", "transmission", grupoMarca, grupoModelo),
        facetaCampo(pool, q, "body_type", "bodyType", grupoMarca, grupoModelo),
        facetaCampo(pool, q, "province", "province", grupoMarca, grupoModelo),
      ]);
      return res.status(200).json({ ok: true, combustible, cambio, carroceria, provincia });
    }

    const limite = Math.min(MAX_LIMITE, Math.max(1, entero(q.limit) ?? LIMITE_POR_DEFECTO));
    const desde = Math.max(0, entero(q.offset) ?? 0);
    const orden = ORDENES[texto(q.sort)] || ORDENES.recientes;

    const { where, valores } = construirFiltros(q, grupoMarca, grupoModelo);

    // El total y la pagina van en paralelo: son dos consultas independientes y
    // esperarlas en serie duplicaba el tiempo de respuesta.
    const [total, pagina, alias, grafias] = await Promise.all([
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
      mapaGrafias(pool),
    ]);

    return res.status(200).json({
      ok: true,
      total: total.rows[0].n,
      limite,
      desde,
      ofertas: pagina.rows.map((f) => mapear(f, alias, grafias)),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Error al buscar ofertas." });
  }
};
