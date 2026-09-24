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
function condicionesDelConsejero(criterios = {}, desde = 0) {
  const condiciones = [];
  const valores = [];
  const parametro = (v) => {
    valores.push(v);
    return `$${desde + valores.length}`;
  };

  /* Un texto contra una lista de formas: `lower(col) LIKE ANY(...)`. */
  const porFormas = (columna, tabla, valor) => {
    const formas = formasDe(tabla, valor);
    if (!formas || !formas.length) return;
    const p = parametro(formas.map((f) => `%${f}%`));
    condiciones.push(`lower(${columna}) LIKE ANY(${p}::text[])`);
  };

  const marca = texto(criterios.brand);
  if (marca) condiciones.push(`lower(brand) = ${parametro(marca.toLowerCase())}`);

  porFormas("COALESCE(fuel,'')", FORMAS_DEL_COMBUSTIBLE, criterios.fuel);
  porFormas("COALESCE(body_type,'')", FORMAS_DE_LA_CARROCERIA, criterios.bodyType);
  porFormas("COALESCE(environmental_label,'')", FORMAS_DE_LA_ETIQUETA, criterios.environmentalLabel);

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

  const provincia = texto(criterios.province || criterios.location);
  if (provincia) {
    condiciones.push(`lower(COALESCE(province,'')) LIKE ${parametro("%" + plano(provincia) + "%")}`);
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

module.exports = {
  condicionesDelConsejero,
  FORMAS_DEL_COMBUSTIBLE,
  FORMAS_DE_LA_CARROCERIA,
  FORMAS_DE_LA_ETIQUETA,
};
