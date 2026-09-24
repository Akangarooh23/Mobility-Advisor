/**
 * Un coche es un coche, aunque esté anunciado diecisiete veces.
 *
 * Esto no filtra ni decide qué se enseña: solo sabe agrupar. Lo usa el
 * buscador para que una misma oferta no ocupe siete tarjetas.
 *
 * ── El problema, con números ───────────────────────────────────────────────
 *
 * Buscando «Volkswagen T-Roc» entre lo presentable salen 8.415 tarjetas para
 * 5.243 coches: el 38 % son copias. El grupo más grande son DIECISIETE: el
 * mismo coche de 15.890 €, 136.072 km y 150 CV, publicado en Alicante,
 * Córdoba, Granada, Madrid y ocho sitios más.
 *
 * No es un fallo nuestro. Las cadenas -Flexicar, OcasionPlus, Clicars- publican
 * su stock central bajo la cuenta de cada sucursal, y además el mismo coche
 * aparece en varios portales. Medido sobre el pool entero el 23-sep-2026:
 * 519.451 de 1.148.098 filas están en algún grupo así.
 *
 * ── La huella, y por qué ESTA y no otra ────────────────────────────────────
 *
 *     marca + modelo + versión + año + kilómetros + combustible + CV + precio
 *
 * Es la misma que usa el comparable del scoring, a propósito: que «el mismo
 * coche» signifique lo mismo en toda la casa.
 *
 * Con una más floja -marca+modelo+año+km- salía un 53 % de repetidos, pero el
 * control lo tumbó: las repeticiones DENTRO de un mismo portal, donde el mismo
 * coche no se publica dos veces, ya daban 40,8 %. Casi todo era casualidad,
 * porque el 26 % de los kilometrajes acaban en 000 y se cruzan solos. Con esta
 * huella ese ruido desaparece.
 *
 * El precio va DENTRO de la huella. Dos anuncios del mismo coche a precios
 * distintos se quedan separados, y es lo correcto: son dos ofertas distintas
 * para quien compra.
 *
 * ── La provincia se agrupa, no se pierde ───────────────────────────────────
 *
 * La tarjeta dice en qué provincias está, y al filtrar por una de ellas el
 * coche sigue apareciendo. Por eso el filtro de provincia va DESPUÉS de
 * agrupar: si fuera antes, buscar en Málaga escondería que ese coche también
 * está en Almería.
 *
 * Y hay que normalizarlas para juntarlas. La columna `province` es un desastre
 * heredado -17.639 valores distintos, con municipios entre las provincias y
 * «MADRID» conviviendo con «Madrid»-, así que sin normalizar una tarjeta dice
 * «CORDOBA, Córdoba» como si fueran dos sitios.
 */
"use strict";

/**
 * Las columnas que identifican a un coche. En este orden y sin `id`: dos filas
 * con estos ocho valores iguales son el mismo coche anunciado dos veces.
 */
const COLUMNAS_DE_LA_HUELLA = [
  "brand", "model", "version", "year", "mileage", "fuel", "power_cv", "price",
];

/** La huella como expresión SQL, para agrupar por ella. */
function huellaSql(alias = "") {
  const a = alias ? alias + "." : "";
  return COLUMNAS_DE_LA_HUELLA
    .map((c) => (c === "version" ? `NULLIF(${a}version, '')` : a + c))
    .join(", ");
}

/*
 * Para comparar provincias: minúsculas y sin acentos.
 *
 * translate() y no unaccent(): la extensión unaccent no está instalada en esta
 * base, y añadirla por esto sería pedirle a producción una extensión para
 * quitar tildes.
 */
const PROVINCIA_NORMAL = (col) =>
  `NULLIF(lower(translate(${col}, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '')`;

/**
 * Envuelve una consulta para que devuelva un coche por tarjeta.
 *
 * `sqlInterior` es cualquier SELECT que traiga, como mínimo, las ocho columnas
 * de la huella más `province`, `portal` e `id`. No se le toca nada: así esto
 * sirve sea cual sea la lista de columnas que pida el buscador.
 *
 * Devuelve las mismas filas más tres columnas:
 *
 *     copias       cuántos anuncios hay de ese coche
 *     provincias   todas las suyas, ya normalizadas y ordenadas
 *     portales     en cuáles está publicado
 *
 * ── Cuál de los anuncios se enseña ─────────────────────────────────────────
 *
 * El que tenga la ficha MÁS COMPLETA, y a igualdad el de id menor.
 *
 * No el más barato: el precio está dentro de la huella, así que todas las
 * copias valen lo mismo y no distingue nada. Y no uno al azar: el mismo coche
 * puede estar en coches.net con foto, carrocería y puertas, y en OcasionPlus
 * solo con la foto. Enseñar el segundo sería tirar datos que tenemos.
 *
 * El desempate por id no es decoración: sin él, dos anuncios igual de completos
 * se turnarían y la misma búsqueda devolvería una tarjeta distinta en cada
 * recarga.
 *
 * @param {string} sqlInterior  el SELECT de siempre, sin ORDER BY ni LIMIT.
 *                              Tiene que traer las ocho columnas de la huella,
 *                              `id`, `portal`, `province` y las de CAMPOS_DE_CALIDAD.
 * @param {object} opciones
 * @param {string}   [opciones.provincia]  si viene, solo los grupos que la tengan
 * @param {number}   [opciones.desde]      cuántos $1..$n lleva ya la consulta
 * @param {string[]} [opciones.campos]     qué cuenta como ficha completa
 */
function agrupaPorCoche(sqlInterior, opciones = {}) {
  const valores = [];
  const desde = Number(opciones.desde || 0);
  const parametro = (v) => { valores.push(v); return `$${desde + valores.length}`; };

  const campos = Array.isArray(opciones.campos) && opciones.campos.length
    ? opciones.campos : CAMPOS_DE_CALIDAD;
  const calidad = calidadSql(campos, "f");

  const provincia = String(opciones.provincia || "").trim();
  /*
   * El filtro va contra la LISTA del grupo, no contra la fila. Es lo que hace
   * que buscar en Málaga encuentre un coche cuyo anuncio más barato está en
   * Almería, que es justo lo que se pedía.
   */
  const dondeProvincia = provincia
    ? `WHERE EXISTS (SELECT 1 FROM unnest(g.provincias) p
                      WHERE p LIKE ${parametro("%" + normalizaProvincia(provincia) + "%")})`
    : "";

  const sql = `
WITH filas AS (
${sqlInterior}
), grupos AS (
  SELECT ${huellaSql("f")} ,
         count(*)::int                                      AS copias,
         array_agg(DISTINCT ${PROVINCIA_NORMAL("f.province")}) FILTER
           (WHERE ${PROVINCIA_NORMAL("f.province")} IS NOT NULL)  AS provincias,
         array_agg(DISTINCT f.portal)                       AS portales,
         max(${calidad})::int                               AS campos_llenos,
         (array_agg(f.id ORDER BY ${calidad} DESC, f.id ASC))[1] AS id_representante
    FROM filas f
   GROUP BY ${huellaSql("f")}
)
SELECT f.*, g.copias, g.provincias, g.portales
  FROM grupos g
  JOIN filas f ON f.id = g.id_representante
  ${dondeProvincia}`;

  return { sql, valores };
}

/**
 * Los campos que hacen que una ficha esté más o menos completa.
 *
 * Solo pueden ser columnas que NO estén en la huella: dentro de un grupo,
 * marca, modelo, versión, año, kilómetros, combustible, potencia y precio son
 * idénticos por construcción, así que no distinguen a nadie. Lo que varía entre
 * el anuncio de un portal y el de otro es esto.
 *
 * La consulta interior tiene que traerlas. Si falta alguna, Postgres se queja
 * al ejecutar y se ve en el acto; es preferible a que el orden se decida en
 * silencio por otra cosa.
 */
const CAMPOS_DE_CALIDAD = [
  "image_url", "transmission", "body_type", "doors", "seats",
  "color", "environmental_label", "province", "dealer_name", "url",
];

/**
 * Cuántos de esos campos trae rellenos una fila, como expresión SQL.
 *
 * Los de texto cuentan si no están vacíos; los numéricos, si no son nulos ni
 * cero -un coche con 0 puertas es un campo sin rellenar, no un dato-.
 */
function calidadSql(campos, alias = "f") {
  const numericos = new Set(["doors", "seats", "power_cv", "year", "mileage"]);
  return campos
    .map((c) => (numericos.has(c)
      ? `(CASE WHEN COALESCE(${alias}.${c}, 0) > 0 THEN 1 ELSE 0 END)`
      : `(CASE WHEN COALESCE(${alias}.${c}, '') <> '' THEN 1 ELSE 0 END)`))
    .join(" + ");
}

/** La misma normalización que hace el SQL, para poder comparar en JavaScript. */
function normalizaProvincia(texto) {
  return String(texto || "").toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .trim();
}

module.exports = {
  COLUMNAS_DE_LA_HUELLA,
  CAMPOS_DE_CALIDAD,
  calidadSql,
  huellaSql,
  agrupaPorCoche,
  normalizaProvincia,
};
