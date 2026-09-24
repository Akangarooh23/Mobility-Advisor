"use strict";

/**
 * Traduce lo que pide el consejero a condiciones SQL.
 *
 * ## Lo que pasaba
 *
 * `readInventoryUniverse` recibía todos los criterios —combustible, carrocería,
 * etiqueta, precio, año— y **solo le pasaba el modelo a la consulta**. Lo demás
 * se filtraba después, en JavaScript, sobre las 30.000 ofertas más recientemente
 * actualizadas del pool entero.
 *
 * Con 1.579.000 ofertas visibles, eso es lo mismo que buscar un compacto con
 * etiqueta CERO mirando las treinta mil últimas que tocó el scraper. Medido
 * contra producción, con cinco perfiles distintos y el más abierto incluido:
 * entre 25 y 103 segundos, y **cero ofertas en los cinco**. La pantalla corta a
 * los 16 s y no dice nada, así que se quedaba en blanco sin explicación.
 *
 * ## Lo que hace esto
 *
 * Mete en el `WHERE` lo que se puede meter sin riesgo de dejar fuera una oferta
 * que el filtro fino de JavaScript sí habría aceptado. Esa es la regla: **aquí
 * solo se estrecha; quien decide sigue siendo el filtro de después.**
 *
 * Por eso los textos no se comparan con `=` sino con una lista de formas
 * —«hibrido» tiene que encontrar «Híbrido», «HIBRIDO» y «Híbrido enchufable»—
 * y por eso lo que no se sabe traducir no se filtra.
 *
 * ## Y si estrechando no sale nada
 *
 * Quien llama vuelve a preguntar sin condiciones. Estrechar de más deja al
 * cliente sin ofertas, que es exactamente lo que veníamos a arreglar.
 */

const { losQueEncajan } = require("./los-valores-que-existen");

const texto = (v) => String(v ?? "").trim();

/** Sin tildes y en minúsculas, para comparar lo que escriben los portales. */
function plano(v) {
  return texto(v)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Las formas en que los portales escriben cada combustible.
 *
 * Salen de mirar los once valores distintos que hay de verdad en la columna,
 * no de imaginarlos: los portales mezclan «Diésel» con `diesel`, «Híbrido
 * enchufable» con `plug_in_hybrid`, y el eléctrico llega como «Eléctrico» y
 * como `electric`.
 */
const FORMAS_DEL_COMBUSTIBLE = {
  electrico: ["electr", "bev", "eléctric"],
  electrico_puro: ["electr", "bev", "eléctric"],
  hibrido: ["hibrid", "híbrid", "hybrid", "hev", "mhev"],
  hibrido_no_enchufable: ["hibrid", "híbrid", "hybrid", "hev", "mhev"],
  hibrido_enchufable: ["enchufable", "plug", "phev"],
  phev: ["enchufable", "plug", "phev"],
  gasolina: ["gasolina", "petrol", "gasoline"],
  diesel: ["diesel", "diésel", "gasoleo", "gasóleo"],
  glp: ["glp", "gpl", "licuado"],
  gnc: ["gnc", "cng", "comprimido"],
  glp_gnc: ["glp", "gpl", "gnc", "cng", "licuado", "comprimido"],
};

/**
 * Y las etiquetas de la DGT.
 *
 * «CERO» y «0» son la misma, y algunos portales la escriben «0 emisiones».
 */
const FORMAS_DE_LA_ETIQUETA = {
  cero: ["cero", "0 emis", "zero"],
  eco: ["eco"],
  c: ["c"],
  b: ["b"],
  /*
   * Lo que de verdad hace falta para entrar en una ZBE.
   *
   * No es una etiqueta: son las dos que dejan pasar. A Madrid Central no se
   * entra con una B ni con una C, así que a quien ha dicho que las zonas
   * restringidas le afectan mucho se le buscan las dos juntas.
   */
  eco_o_cero: ["eco", "cero", "0 emis", "zero"],
};

/**
 * El cambio, con las dos formas en que aparece escrito.
 *
 * Medido sobre el pool: solo hay dos valores, «manual» y «automatica», y están
 * en el 100% de las ofertas. Por eso esta pregunta filtra de verdad.
 */
const FORMAS_DEL_CAMBIO = {
  automatico: ["automat"],
  manual: ["manual"],
};

/** Y quién vende: «profesional» o «particular», también en el 100%. */
const FORMAS_DEL_VENDEDOR = {
  profesional: ["profesional"],
  particular: ["particular"],
};

/**
 * Las carrocerías.
 *
 * Aquí se hila más fino que en lo demás porque hay 48 valores distintos y un
 * «compacto» es también un «berlina compacta» y un «hatchback».
 */
const FORMAS_DE_LA_CARROCERIA = {
  compacto: ["compact", "hatchback", "utilitario", "berlina compacta"],
  berlina: ["berlina", "sedan", "sedán", "saloon"],
  suv: ["suv", "todoterreno", "4x4", "crossover"],
  familiar: ["familiar", "ranchera", "estate", "avant", "touring", "sw"],
  monovolumen: ["monovolumen", "mpv", "minivan"],
  furgoneta: ["furgon", "van", "comercial"],
  coupe: ["coupe", "coupé"],
  cabrio: ["cabrio", "descapotable", "roadster"],
  pickup: ["pick", "pickup"],
  urbano: ["urbano", "citycar", "city car", "mini"],
};

/** Las formas de un valor, o nada si no se sabe traducir. */
function formasDe(tabla, valor) {
  const clave = plano(valor).replace(/[\s-]+/g, "_");
  if (!clave) return null;
  if (tabla[clave]) return tabla[clave];
  // Por si llega ya escrito como en la base: «Híbrido», «SUV».
  const suelto = plano(valor);
  return suelto.length >= 3 ? [suelto] : null;
}

/**
 * Monta las condiciones. Devuelve `{ condiciones, valores }` para pegar al
 * `WHERE` que ya tiene la consulta, con los parámetros numerados desde
 * `desde + 1`.
 */
function condicionesDelConsejero(criterios = {}, desde = 0, losQueHayEnLaBase = null) {
  const condiciones = [];
  const valores = [];
  const parametro = (v) => {
    valores.push(v);
    return `$${desde + valores.length}`;
  };

  /**
   * Un texto contra los valores que de verdad hay en esa columna.
   *
   * ## Por qué esto y no `LIKE`
   *
   * Antes era `lower(fuel) LIKE ANY('{%gasolina%,...}')`. Un `LIKE` con
   * comodín delante **no puede usar ningún índice**, así que cada búsqueda
   * recorría la tabla entera. Medido con `EXPLAIN` contra producción:
   * 784.466 filas descartadas, 448.243 bloques leídos, 118 segundos. Y no
   * se arregla con más índices —se probaron siete, más `ANALYZE` y
   * `VACUUM`—: esa condición no puede usar ninguno.
   *
   * En el pool hay once combustibles distintos y cuarenta y ocho
   * carrocerías, así que no hace falta buscar por parecido: se puede saber
   * cuáles son y preguntar por ellos con `=`, que sí usa índice. El
   * parecido se calcula una vez sobre cuarenta y ocho valores en vez de un
   * millón y medio de veces sobre las ofertas.
   *
   * Si no se han podido leer esos valores, se vuelve al `LIKE`: lento, pero
   * encuentra. Cambiar una pantalla lenta por una vacía sería peor.
   */
  const porFormas = (columna, tabla, valor, tipoEnLaVista) => {
    const formas = formasDe(tabla, valor);
    if (!formas || !formas.length) return;

    const deLaBase = losQueHayEnLaBase && tipoEnLaVista
      ? losQueEncajan(losQueHayEnLaBase.get(tipoEnLaVista), formas)
      : null;

    if (deLaBase) {
      condiciones.push(`lower(${columna}) = ANY(${parametro(deLaBase)}::text[])`);
      return;
    }

    const p = parametro(formas.map((f) => `%${f}%`));
    condiciones.push(`lower(${columna}) LIKE ANY(${p}::text[])`);
  };

  const marca = texto(criterios.brand);
  if (marca) condiciones.push(`lower(brand) = ${parametro(marca.toLowerCase())}`);

  porFormas("COALESCE(fuel,'')", FORMAS_DEL_COMBUSTIBLE, criterios.fuel, "fuel");
  porFormas("COALESCE(body_type,'')", FORMAS_DE_LA_CARROCERIA, criterios.bodyType, "body_type");
  /*
   * La etiqueta se queda con `LIKE` a propósito: no está en la vista de los
   * desplegables, y son cuatro valores que casi nadie filtra.
   */
  porFormas("COALESCE(environmental_label,'')", FORMAS_DE_LA_ETIQUETA, criterios.environmentalLabel);
  /*
   * La transmision va contra los valores que de verdad hay en la columna, que
   * es lo que permite comparar con `=` y usar indice. Con `LIKE '%automat%'`
   * una sola busqueda tardaba 111 segundos; el `LIKE` con comodin delante no
   * puede usar ninguno. La lista esta en mmo_facetas, que ya guardaba esta
   * columna.
   */
  porFormas("COALESCE(transmission,'')", FORMAS_DEL_CAMBIO, criterios.transmission, "transmission");
  /*
   * El vendedor no esta en esa vista, pero solo tiene dos valores y son
   * exactamente las dos respuestas del test, asi que se compara con `=`
   * directamente en vez de por parecido.
   */
  const vendedor = texto(criterios.sellerType).toLowerCase();
  if (FORMAS_DEL_VENDEDOR[vendedor]) {
    condiciones.push(`lower(COALESCE(seller_type,'')) = ${parametro(vendedor)}`);
  }

  /*
   * De donde viene el coche.
   *
   * La columna esta rellena en el 100% de las ofertas y lleva codigos de dos
   * letras, asi que se compara con `=`. Ver DE_DONDE_VIENE en
   * el-encargo-de-busqueda.js: esto lo pide quien no quiere papeleo de
   * matriculacion.
   */
  const pais = texto(criterios.country).toUpperCase();
  if (/^[A-Z]{2}$/.test(pais)) condiciones.push(`upper(COALESCE(country,'')) = ${parametro(pais)}`);

  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const min = num(criterios.minPrice);
  const max = num(criterios.maxPrice);
  if (Number.isFinite(min) && min > 0) condiciones.push(`price >= ${parametro(min)}`);
  if (Number.isFinite(max) && max > 0) condiciones.push(`price <= ${parametro(max)}`);

  const anioMin = num(criterios.minYear);
  const anioMax = num(criterios.maxYear);
  if (Number.isFinite(anioMin) && anioMin > 1950) condiciones.push(`"year" >= ${parametro(anioMin)}`);
  if (Number.isFinite(anioMax) && anioMax > 1950) condiciones.push(`"year" <= ${parametro(anioMax)}`);

  const kmMax = num(criterios.maxMileage);
  if (Number.isFinite(kmMax) && kmMax > 0) condiciones.push(`mileage <= ${parametro(kmMax)}`);

  /*
   * La potencia, solo como minimo.
   *
   * La columna esta rellena en el 95% de las ofertas, asi que el 5% restante
   * se queda fuera cuando se pide potencia. Es lo correcto: quien necesita 150
   * CV para arrastrar una caravana no puede llevarse un coche cuya potencia no
   * sabemos.
   */
  const cvMin = num(criterios.minPowerCv);
  if (Number.isFinite(cvMin) && cvMin > 0) condiciones.push(`power_cv >= ${parametro(cvMin)}`);

  /*
   * La provincia, con todas sus escrituras.
   *
   * Antes se comparaba el nombre SIN TILDES contra una columna que SI las
   * lleva: buscar en Malaga no devolvia ni una de las 44.469 ofertas
   * malaguenas. Y no fallaba, devolvia cero. Ahora la lista de formas la pone
   * `de-donde-quiere-el-coche.js`, que guarda las dos escrituras de cada una
   * y ademas los nombres en catalan, gallego y euskera.
   */
  const formas = Array.isArray(criterios.provinciaFormas) ? criterios.provinciaFormas : null;
  if (formas && formas.length) {
    const exactas = losQueHayEnLaBase
      ? losQueEncajan(losQueHayEnLaBase.get("province"), formas)
      : null;

    if (exactas) {
      condiciones.push(`lower(COALESCE(province,'')) = ANY(${parametro(exactas)}::text[])`);
    } else {
      const p = parametro(formas.map((f) => `%${f}%`));
      condiciones.push(`lower(COALESCE(province,'')) LIKE ANY(${p}::text[])`);
    }
  } else {
    const provincia = texto(criterios.province || criterios.location);
    if (provincia) {
      condiciones.push(`lower(COALESCE(province,'')) LIKE ${parametro("%" + plano(provincia) + "%")}`);
    }
  }

  /*
   * Lo que no se le puede enseñar a nadie.
   *
   * Contado sobre las 1.579.332 ofertas visibles del pool:
   *
   *     sin ninguna foto                360.891   (el 23 %)
   *     por debajo de 500 €               3.437
   *     por encima de 200.000 €           2.889
   *     con kilómetros imposibles         4.041
   *     marcadas como «no es un coche»      378
   *
   * En el consejero una oferta sin foto es una tarjeta con un hueco, y las diez
   * primeras que devolvía la consulta no tenían ninguna. Y una autocaravana a
   * 0 € encabezando «lo que mejor encaja» no es un fallo de cálculo: es que
   * nadie miró lo que se estaba enseñando.
   *
   * Va aparte de los criterios porque no es lo que pide el cliente: es lo que
   * se puede enseñar. Por eso la tasación no lo lleva —un comparable sin foto
   * sigue siendo un precio válido— y el consejero sí.
   */
  if (criterios.soloPresentables) {
    condiciones.push(`COALESCE(image_url, '') <> ''`);
    condiciones.push(`price BETWEEN 500 AND 200000`);
    condiciones.push(`(mileage IS NULL OR mileage BETWEEN 0 AND 500000)`);
    condiciones.push(`es_coche IS NOT FALSE`);
  }

  return { condiciones, valores };
}

/**
 * Los criterios que esta función entiende.
 *
 * ## Por qué existe esta lista
 *
 * Porque quien llama a la búsqueda los copiaba a mano, uno por uno, y tres
 * veces se dejó alguno por el camino sin que nada fallara:
 *
 *   - La provincia: buscar en Málaga devolvía ofertas de Madrid.
 *   - Los kilómetros: un Isuzu de 322.000 km a quien pidió 100.000.
 *   - El cambio y el vendedor: llegaban a la función y morían ahí, porque el
 *     objeto de criterios que se arma más abajo no los nombraba.
 *
 * Ninguno de los tres dio error. La búsqueda encontraba coches; encontraba
 * otros. Así que la lista la declara quien la usa, y quien llama la recorre.
 *
 * Un criterio nuevo se añade AQUÍ y llega solo a la consulta.
 */
const LOS_CRITERIOS = [
  "brand",
  "fuel",
  "bodyType",
  "environmentalLabel",
  "transmission",
  "sellerType",
  "minPrice",
  "maxPrice",
  "minYear",
  "maxYear",
  "maxMileage",
  "minPowerCv",
  "provinciaFormas",
  "country",
];

module.exports = {
  condicionesDelConsejero,
  LOS_CRITERIOS,
  FORMAS_DEL_COMBUSTIBLE,
  FORMAS_DE_LA_CARROCERIA,
  FORMAS_DE_LA_ETIQUETA,
  FORMAS_DEL_CAMBIO,
  FORMAS_DEL_VENDEDOR,
};
