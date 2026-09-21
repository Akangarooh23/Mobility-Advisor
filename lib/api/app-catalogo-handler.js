"use strict";

/**
 * El catálogo entero, en una sola lista, para la app.
 *
 * ## Por qué existe
 *
 * En la web hay tres catálogos y tres pantallas, y está bien así: quien entra
 * en «Buscar coche» sabe que está mirando anuncios de portales, y quien entra
 * en el Marketplace sabe que está mirando lo nuestro. En un móvil eso no se
 * sostiene: quien busca un Fiat 500 quiere ver los Fiat 500, y elegir después.
 *
 * Así que esto **no cambia nada de la web**. Es un mostrador nuevo que pregunta
 * a los tres buscadores que ya hay y devuelve una lista con el origen escrito
 * en cada coche.
 *
 * ## Por qué llama a los manejadores en vez de consultar la base
 *
 * Cada buscador sabe cosas que no están en su SQL: el de portales resuelve las
 * grafías de las marcas —«Citroen» y «Citroën» son 30.471 anuncios repartidos
 * en dos—, y el de importación calcula el precio **puesto en España**, que es
 * el único que se le puede enseñar a alguien. Copiar ese SQL aquí sería tener
 * dos verdades y arreglar cada cosa dos veces. Se les llama por dentro, con una
 * petición y una respuesta de mentira, y se traduce lo que devuelven.
 *
 * ## Las tres fuentes, y los tres botones de la app
 *
 *   · `todo`        — el Marketplace, los portales y la importación.
 *   · `popcar`      — solo el Marketplace: los coches que podemos enseñar.
 *   · `importacion` — solo los alemanes, con su ahorro.
 *
 * ## Cómo se ordena y se pagina
 *
 * Se pide a cada fuente lo que haría falta para llenar la página —el principio
 * de la lista, no su trozo— y se ordena aquí el conjunto. Es la única forma de
 * que «por precio» signifique lo mismo mirando las tres a la vez; con tres
 * paginaciones separadas, la página 2 mezclaría el coche más barato de una con
 * el más caro de otra.
 */

const buscarEnPortales = require("./search-offers-handler");
const marketplaceVo = require("./marketplace-vo-handler");
const importacion = require("./import-offers-handler");
const { getPostgresPool } = require("../inventoryStore");

const POR_DEFECTO = 24;
const MAXIMO = 48;
/** Lo más que se le pide a una fuente para armar una página. */
const TOPE_POR_FUENTE = 200;

const ORDENES = new Set(["recientes", "precio_asc", "precio_desc", "km_asc", "anio_desc"]);

const texto = (v) => (typeof v === "string" ? v.trim() : "");
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/**
 * Llamar a un manejador por dentro y quedarse con su JSON.
 *
 * No hay red por medio: se le pasa una petición y una respuesta de mentira. Si
 * el manejador se cae, esto devuelve null y el mostrador sigue con las demás
 * fuentes: que la importación falle no puede dejar sin buscador a nadie.
 */
async function preguntaA(manejador, query) {
  /*
   * La petición lleva los parámetros dos veces, y hace falta.
   *
   * No todos leen igual: el del Marketplace y el de importación miran
   * `req.query`, y el de portales se construye una URL y lee su cadena de
   * consulta. Mandando solo uno de los dos, ese buscador contestaba **el
   * catálogo entero sin filtrar**: se pedía un Fiat 500 y llegaban Mini,
   * Mercedes y Hyundai. Salió en la primera prueba contra la base de verdad.
   */
  const limpios = Object.entries(query || {})
    .filter(([, v]) => v !== null && v !== undefined && String(v) !== "")
    .map(([k, v]) => [k, String(v)]);
  const cadena = new URLSearchParams(limpios).toString();

  return new Promise((resolve) => {
    let contestado = false;
    const responde = (cuerpo) => {
      // Un `ok: false` es una fuente caída, aunque venga con un 200 delante:
      // dos de los tres buscadores contestan así cuando la base falla.
      if (!contestado) { contestado = true; resolve(cuerpo && cuerpo.ok === false ? null : cuerpo); }
    };
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      setHeader() { return this; },
      json(cuerpo) { responde(this.statusCode >= 400 ? null : cuerpo); return this; },
      send(cuerpo) { responde(this.statusCode >= 400 ? null : cuerpo); return this; },
      end() { responde(null); return this; },
    };
    const peticion = {
      method: "GET",
      url: cadena ? `/interno?${cadena}` : "/interno",
      query: Object.fromEntries(limpios),
      headers: {},
    };
    Promise.resolve(manejador(peticion, res))
      .catch((e) => {
        console.error("[app-catalogo] una fuente no ha contestado:", e.message);
        responde(null);
      });
  });
}

/**
 * Lo que se pide a cada fuente: el principio de su lista, ya filtrado.
 *
 * Uno más de los que caben, y por eso: pidiendo justo los de la página, una
 * página llena no se distingue de la última y el botón de «ver más»
 * desaparecía teniendo doce mil coches detrás.
 */
function cuantasPedir(desde, cuantas) {
  return Math.min(TOPE_POR_FUENTE, desde + cuantas + 1);
}

/* ---------- traducir cada fuente al mismo coche ---------- */

/**
 * Un coche, dicho igual venga de donde venga.
 *
 * `origen` es lo que decide qué se puede hacer con él, y por eso viaja: en el
 * del Marketplace se pide visita, en el de un portal se pide información y se
 * puede abrir su anuncio, y en el de importación se pide la importación.
 */
function cochePortal(o) {
  return {
    id: String(o.id ?? ""),
    origen: "portal",
    titulo: texto(o.title) || [o.brand, o.model].filter(Boolean).join(" "),
    marca: texto(o.brand),
    modelo: texto(o.model),
    version: texto(o.version),
    precio: numero(o.price),
    cuota: numero(o.monthlyPrice),
    anio: numero(o.year),
    km: numero(o.mileage),
    combustible: texto(o.fuel),
    cambio: texto(o.transmission),
    potencia: numero(o.powerCv),
    donde: texto(o.location) || [o.city, o.province].filter(Boolean).join(", "),
    vendedor: texto(o.dealerName),
    tipoDeVendedor: texto(o.sellerType),
    etiqueta: texto(o.environmentalLabel),
    foto: texto(o.image) || texto(o.imageUrl),
    fotos: Array.isArray(o.images) ? o.images.filter(Boolean).slice(0, 15) : [],
    portal: texto(o.portal),
    // El anuncio de verdad, en la web de quien lo publica.
    enlaceOriginal: texto(o.url),
  };
}

function cocheDelMarketplace(o) {
  return {
    id: String(o.id ?? ""),
    origen: "popcar",
    titulo: texto(o.title) || [o.brand, o.model].filter(Boolean).join(" "),
    marca: texto(o.brand),
    modelo: texto(o.model),
    version: texto(o.version),
    precio: numero(o.price),
    cuota: null,
    anio: numero(o.year),
    km: numero(o.mileage),
    combustible: texto(o.fuel),
    cambio: texto(o.transmission),
    // Aquí la potencia es texto —«150 CV»—, no un número.
    potencia: numero(String(o.power || "").replace(/[^\d]/g, "")),
    donde: texto(o.location),
    vendedor: texto(o.seller),
    tipoDeVendedor: texto(o.sellerType),
    etiqueta: "",
    foto: texto(o.image),
    fotos: Array.isArray(o.images) ? o.images.filter(Boolean).slice(0, 15) : [],
    portal: texto(o.portal),
    enlaceOriginal: "",
    garantia: numero(o.warrantyMonths),
    conSello: Boolean(o.hasGuaranteeSeal),
  };
}

function cocheDeImportacion(o) {
  return {
    ...cocheDelMarketplace(o),
    origen: "importacion",
    // Lo que se ahorra frente a lo que cuesta aquí, que es el motivo de traerlo.
    ahorro: numero(o.importSavings),
    ahorroPct: Number.isFinite(Number(o.importSavingsPct)) ? Number(o.importSavingsPct) : null,
  };
}

/* ---------- qué se le pide a cada fuente ---------- */

function paraPortales(q, cuantas) {
  const pet = {
    query: texto(q.q),
    brand: texto(q.marca),
    model: texto(q.modelo),
    minPrice: q.precioMin, maxPrice: q.precioMax,
    minYear: q.anioMin, maxYear: q.anioMax,
    maxMileage: q.kmMax,
    fuel: texto(q.combustible),
    transmission: texto(q.cambio),
    province: texto(q.provincia),
    sort: q.orden,
    limit: Math.min(cuantas, 48),
    offset: 0,
  };
  return pet;
}

const ORDEN_VO = { precio_asc: "price_asc", precio_desc: "price_desc" };

function paraMarketplace(q, cuantas) {
  return {
    query: texto(q.q),
    brand: texto(q.marca),
    model: texto(q.modelo),
    minPrice: q.precioMin, maxPrice: q.precioMax,
    minYear: q.anioMin, maxYear: q.anioMax,
    maxMileage: q.kmMax,
    fuel: texto(q.combustible),
    transmission: texto(q.cambio),
    sort: ORDEN_VO[q.orden] || "",
    modalityMode: "compra",
    limit: cuantas,
    offset: 0,
  };
}

const ORDEN_IMPORT = {
  precio_asc: "price_asc", precio_desc: "price_desc",
  anio_desc: "year_desc", km_asc: "km_asc",
};

function paraImportacion(q, cuantas) {
  return {
    query: texto(q.q),
    brand: texto(q.marca),
    model: texto(q.modelo),
    minPrice: q.precioMin, maxPrice: q.precioMax,
    minYear: q.anioMin, maxYear: q.anioMax,
    maxMileage: q.kmMax,
    fuel: texto(q.combustible),
    transmission: texto(q.cambio),
    sort: ORDEN_IMPORT[q.orden] || "",
    limit: Math.min(cuantas, 200),
    offset: 0,
  };
}

/* ---------- juntar, ordenar y recortar ---------- */

/**
 * El orden del conjunto.
 *
 * «Recientes» no se puede comparar entre fuentes —cada una guarda su fecha a su
 * manera, y la del Marketplace no es cuándo se publicó sino cuándo se miró por
 * última vez—, así que ahí manda el origen: primero lo nuestro, que es lo único
 * que se puede ir a ver mañana, luego la importación y después los portales.
 */
const PESO_DEL_ORIGEN = { popcar: 0, importacion: 1, portal: 2 };

function ordena(coches, orden) {
  const por = {
    precio_asc: (a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity),
    precio_desc: (a, b) => (b.precio ?? -Infinity) - (a.precio ?? -Infinity),
    km_asc: (a, b) => (a.km ?? Infinity) - (b.km ?? Infinity),
    anio_desc: (a, b) => (b.anio ?? -Infinity) - (a.anio ?? -Infinity),
  }[orden];
  const porOrigen = (a, b) => PESO_DEL_ORIGEN[a.origen] - PESO_DEL_ORIGEN[b.origen];
  return coches.sort((a, b) => (por ? por(a, b) || porOrigen(a, b) : porOrigen(a, b)));
}

/**
 * El mismo coche en dos sitios sale una vez, y sale el nuestro.
 *
 * Un concesionario que trabaja con nosotros también anuncia en los portales, y
 * ver dos veces el mismo coche —uno con «pide visita» y otro con «ver anuncio»—
 * hace dudar de las dos. Se comparan los datos que no cambian entre anuncios.
 */
function sinRepetidos(coches) {
  const vistos = new Set();
  const salida = [];
  for (const c of coches) {
    const huella = [c.marca, c.modelo, c.anio, c.km, c.precio]
      .map((x) => String(x ?? "").toLowerCase().trim())
      .join("|");
    const completa = c.marca && c.anio && c.km !== null && c.precio !== null;
    if (completa && vistos.has(huella)) continue;
    if (completa) vistos.add(huella);
    salida.push(c);
  }
  return salida;
}

/* ---------- los desplegables ---------- */

/**
 * Las marcas y los modelos que de verdad hay, con cuántos coches tiene cada uno.
 *
 * Un desplegable de marcas sacado del catálogo maestro ofrece cuatrocientas
 * setenta marcas y la mitad no tiene ni un coche: se elige una, sale «nada con
 * eso» y parece que la app está rota. Aquí solo salen las que tienen algo, y
 * con el número al lado, que además dice por dónde empezar.
 *
 * Cada botón pregunta a lo suyo: buscando en el Marketplace no pueden salir las
 * marcas de los ochocientos mil anuncios de los portales.
 */
/**
 * Lo que puede ser una marca o un modelo de verdad.
 *
 * En ochocientos mil anuncios raspados hay de todo: modelos llamados «-»,
 * marcas que son en realidad una versión —«320D»— y caravanas. Un desplegable
 * que empieza por «320D (1)» y «Adria (19)» parece roto antes de usarlo.
 */
function pareceUnNombre(x) {
  const t = texto(x.nombre);
  return t.length >= 2 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(t);
}

/** Primero lo que más hay: en un móvil se ve media lista, no la lista. */
function losMasHabituales(lista, cuantos = 60) {
  return (lista || [])
    .map((x) => ({ nombre: texto(x.nombre), n: Number(x.n) || 0 }))
    .filter((x) => x.nombre && pareceUnNombre(x))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"))
    // Una marca puede venir en las dos listas: sale una vez.
    .filter((x, i, todas) => todas.findIndex((y) => y.nombre.toLowerCase() === x.nombre.toLowerCase()) === i)
    .slice(0, cuantos);
}

async function marcasDe(fuente, q) {
  if (fuente === "popcar") return marcasDelMarketplace();
  if (fuente === "importacion") return marcasDeImportacion();
  const r = await preguntaA(buscarEnPortales, { ...paraPortales(q, 1), facets: "brands" });
  /*
   * Las dos listas, juntas. El buscador devuelve por un lado las marcas
   * principales y por otro el resto con ofertas, porque la web las pinta en dos
   * grupos. Leyendo solo el segundo, el desplegable empezaba por Kia y SWM y no
   * aparecían ni Volkswagen ni Renault.
   *
   * Las del catálogo maestro sin un solo coche se quedan fuera: elegir una es
   * que no salga nada.
   */
  return losMasHabituales([...(r?.principales || []), ...(r?.conOfertas || [])]);
}

async function modelosDe(fuente, q) {
  const marca = texto(q.marca);
  if (!marca) return [];
  if (fuente === "popcar") return modelosDelMarketplace(marca);
  if (fuente === "importacion") return modelosDeImportacion(marca);
  const r = await preguntaA(buscarEnPortales, { ...paraPortales(q, 1), brand: marca, facets: "models" });
  return losMasHabituales([...(r?.principales || []), ...(r?.conOfertas || [])]);
}

/** Combustible, cambio y provincia, con lo que hay hoy en el mercado. */
async function extrasDe(q) {
  const r = await preguntaA(buscarEnPortales, { ...paraPortales(q, 1), facets: "extra" });
  const lista = (x) => losMasHabituales(x, 40);
  return {
    combustible: lista(r?.combustible),
    cambio: lista(r?.cambio),
    provincia: lista(r?.provincia),
  };
}

/*
 * Las dos fuentes que no tienen desplegables propios se cuentan aquí.
 *
 * Son dos GROUP BY sobre tablas que ya se consultan, y viven en este fichero a
 * propósito: son para la app y para nadie más. Si el día de mañana la web los
 * necesita, se mudan a su buscador.
 */
const VIVO_EN_MARKETPLACE = `is_active = TRUE AND COALESCE(available_for_purchase, TRUE) = TRUE`;
const VIVO_EN_IMPORTACION =
  `country = 'DE' AND import_published = TRUE AND COALESCE(is_active, TRUE) = TRUE` +
  ` AND COALESCE(import_locked, FALSE) = FALSE`;

async function cuenta(sql, valores = []) {
  try {
    const pool = getPostgresPool();
    if (!pool) return [];
    const r = await pool.query(sql, valores);
    return losMasHabituales(r.rows);
  } catch (e) {
    console.error("[app-catalogo] no se han podido contar los desplegables:", e.message);
    return [];
  }
}

const marcasDelMarketplace = () => cuenta(
  `SELECT brand AS nombre, COUNT(*)::int AS n
     FROM moveadvisor_marketplace_vo_offers
    WHERE ${VIVO_EN_MARKETPLACE} AND COALESCE(brand, '') <> ''
    GROUP BY brand ORDER BY n DESC, brand ASC LIMIT 100`
);

const modelosDelMarketplace = (marca) => cuenta(
  `SELECT model AS nombre, COUNT(*)::int AS n
     FROM moveadvisor_marketplace_vo_offers
    WHERE ${VIVO_EN_MARKETPLACE} AND lower(brand) = $1 AND COALESCE(model, '') <> ''
    GROUP BY model ORDER BY n DESC, model ASC LIMIT 100`,
  [marca.toLowerCase()]
);

const marcasDeImportacion = () => cuenta(
  `SELECT brand AS nombre, COUNT(*)::int AS n
     FROM moveadvisor_market_offers
    WHERE ${VIVO_EN_IMPORTACION} AND COALESCE(brand, '') <> ''
    GROUP BY brand ORDER BY n DESC, brand ASC LIMIT 100`
);

const modelosDeImportacion = (marca) => cuenta(
  `SELECT model AS nombre, COUNT(*)::int AS n
     FROM moveadvisor_market_offers
    WHERE ${VIVO_EN_IMPORTACION} AND lower(brand) = $1 AND COALESCE(model, '') <> ''
    GROUP BY model ORDER BY n DESC, model ASC LIMIT 100`,
  [marca.toLowerCase()]
);

module.exports = async function appCatalogoHandler(req, res) {
  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  const q = req.query || {};
  const fuente = ["todo", "popcar", "importacion"].includes(texto(q.fuente)) ? texto(q.fuente) : "todo";
  const orden = ORDENES.has(texto(q.orden)) ? texto(q.orden) : "recientes";
  const cuantas = Math.min(MAXIMO, Math.max(1, Number(q.limit) || POR_DEFECTO));
  const desde = Math.max(0, Number(q.offset) || 0);
  const pedir = cuantasPedir(desde, cuantas);
  const consulta = { ...q, orden };

  /*
   * Los desplegables se piden por separado, no con cada búsqueda: cambian poco
   * y la app los guarda mientras esté abierta.
   */
  const facetas = texto(q.facetas);
  if (facetas) {
    if (facetas === "marcas") {
      return res.status(200).json({ ok: true, marcas: await marcasDe(fuente, q) });
    }
    if (facetas === "modelos") {
      return res.status(200).json({ ok: true, modelos: await modelosDe(fuente, q) });
    }
    if (facetas === "extra") {
      return res.status(200).json({ ok: true, ...(await extrasDe(q)) });
    }
    return res.status(400).json({ ok: false, error: "Ese desplegable no existe" });
  }

  const conPortales = fuente === "todo";
  const conMarketplace = fuente === "todo" || fuente === "popcar";
  const conImportacion = fuente === "todo" || fuente === "importacion";

  const [portales, propios, alemanes] = await Promise.all([
    conPortales ? preguntaA(buscarEnPortales, paraPortales(consulta, pedir)) : null,
    conMarketplace ? preguntaA(marketplaceVo, paraMarketplace(consulta, pedir)) : null,
    conImportacion ? preguntaA(importacion, paraImportacion(consulta, pedir)) : null,
  ]);

  const deLosPortales = (portales?.ofertas || []).map(cochePortal);
  /*
   * Del Marketplace se quitan los alemanes y los que no están a la venta: la
   * importación va por su propia fuente —con el precio puesto aquí— y colarla
   * dos veces sería enseñar el mismo coche con dos precios distintos.
   */
  const delMarketplace = (propios?.offers || [])
    .filter((o) => o.availableForPurchase !== false && !o.isImport)
    .map(cocheDelMarketplace);
  const deImportacion = (alemanes?.offers || []).map(cocheDeImportacion);

  // La provincia, para el Marketplace, se mira aquí: su ubicación es un texto
  // suelto y el buscador de allí solo sabe compararla entera.
  const provincia = texto(q.provincia).toLowerCase();
  const deAqui = provincia
    ? delMarketplace.filter((c) => c.donde.toLowerCase().includes(provincia))
    : delMarketplace;

  const todos = sinRepetidos(ordena([...deAqui, ...deImportacion, ...deLosPortales], orden));
  const pagina = todos.slice(desde, desde + cuantas);

  const total =
    Number(portales?.total || 0) + Number(propios?.totalUniverse || 0) + Number(alemanes?.total || 0);

  return res.status(200).json({
    ok: true,
    fuente,
    orden,
    // Lo que hay en total, para poder decir «1.284 coches». Es una suma de las
    // tres cuentas, así que un repetido cuenta dos veces: sirve para el rótulo,
    // no para paginar.
    total,
    desde,
    /*
     * Si merece la pena pedir más. No se deduce del total por lo de arriba.
     *
     * Y tampoco basta con que sobren coches en esta vuelta: al quitar los
     * repetidos la lista encoge, y una página que encoge justo hasta su tamaño
     * parecía la última. Si alguna fuente ha devuelto todo lo que le cabía, es
     * que tiene más.
     */
    hayMas:
      todos.length > desde + cuantas ||
      [deLosPortales, delMarketplace, deImportacion].some((l) => l.length >= pedir),
    coches: pagina,
    // Por si una fuente se cae: la app puede decir «esto no está completo» en
    // vez de enseñar media lista como si fuera toda.
    fuentes: {
      portales: !conPortales ? null : Boolean(portales),
      popcar: !conMarketplace ? null : Boolean(propios),
      importacion: !conImportacion ? null : Boolean(alemanes),
    },
  });
};
