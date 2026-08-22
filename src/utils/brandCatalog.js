// Orden de marcas destacadas (se muestran primero, alfabético en el bloque de "otras").
// Las claves son el nombre canónico de display; el matching ignora tildes y mayúsculas.
export const KNOWN_BRANDS = [
  "Alfa Romeo",
  "Alpine",
  "Audi",
  "BMW",
  "BYD",
  "Citroën",
  "Cupra",
  "Dacia",
  "DS",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jaguar",
  "Jeep",
  "Kia",
  "Land Rover",
  "Lexus",
  "Mazda",
  "Mercedes-Benz",
  "MG",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Polestar",
  "Porsche",
  "Renault",
  "Seat",
  "Skoda",
  "Smart",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

// Strip diacritics + uppercase para matching tolerante a tildes y codificaciones rotas.
export function stripAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function sortBySpanishLocale(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Parte las marcas en dos bloques: las que tienen anuncios y las que no.
 *
 * Cada bloque va de la A a la Z. Antes el primer bloque era una lista de
 * cuarenta marcas escrita a mano, que envejecía sola: no tenía Omoda ni Jaecoo
 * aunque hubiera coches suyos, y sí marcas de las que no se vendía ninguno.
 *
 * Ahora lo decide el inventario. De las trescientas y pico del catálogo,
 * alrededor de la mitad no tiene ni un anuncio; ponerlas detrás evita que el
 * comprador elija una marca y se encuentre con que no hay nada.
 *
 * `cobertura` es el mapa de marcas con anuncios. Si no llega —la primera
 * pintada, antes de que responda el API— se cae a la lista de siempre, que para
 * ese instante es mejor que un orden aleatorio.
 */
export function getBrandOptionSegments(catalogMap = {}, cobertura = null) {
  const allCatalogBrands = Object.keys(catalogMap || {})
    .map((b) => String(b || "").trim())
    .filter(Boolean);

  const conAnuncios = new Set(
    Object.keys(cobertura || {}).map((b) => stripAccents(b)).filter(Boolean)
  );

  if (conAnuncios.size === 0) {
    // Sin datos de inventario todavía: el orden de siempre.
    const catalogByNormalized = new Map(allCatalogBrands.map((b) => [stripAccents(b), b]));
    const usadas = new Set();
    const conocidas = [];
    for (const displayName of KNOWN_BRANDS) {
      const key = stripAccents(displayName);
      conocidas.push(displayName);
      if (catalogByNormalized.has(key)) usadas.add(key);
    }
    return {
      knownBrands: conocidas,
      otherBrands: sortBySpanishLocale(allCatalogBrands.filter((b) => !usadas.has(stripAccents(b)))),
      knownBrandSet: new Set(conocidas),
    };
  }

  const knownBrands = sortBySpanishLocale(
    allCatalogBrands.filter((b) => conAnuncios.has(stripAccents(b)))
  );
  const otherBrands = sortBySpanishLocale(
    allCatalogBrands.filter((b) => !conAnuncios.has(stripAccents(b)))
  );

  return { knownBrands, otherBrands, knownBrandSet: new Set(knownBrands) };
}
