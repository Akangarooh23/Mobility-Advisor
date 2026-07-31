// Orden de marcas destacadas (se muestran primero, alfabético en el bloque de "otras").
// Las claves son el nombre canónico de display; el matching ignora tildes y mayúsculas.
const KNOWN_BRANDS = [
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
function stripAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

function sortBySpanishLocale(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

export function getBrandOptionSegments(catalogMap = {}) {
  const allCatalogBrands = Object.keys(catalogMap || {})
    .map((b) => String(b || "").trim())
    .filter(Boolean);

  // Mapa de clave normalizada → nombre original del catálogo
  const catalogByNormalized = new Map(
    allCatalogBrands.map((b) => [stripAccents(b), b])
  );

  const knownBrands = [];
  const usedNormalized = new Set();

  for (const displayName of KNOWN_BRANDS) {
    const key = stripAccents(displayName);
    if (catalogByNormalized.has(key)) {
      // Siempre mostramos el nombre canónico (displayName) aunque el catálogo tenga el
      // carácter corrupto (p.ej. "Citro� n" del API) — así evitamos caracteres raros.
      knownBrands.push(displayName);
      usedNormalized.add(key);
    } else {
      // La marca no está en el catálogo actual pero la incluimos igualmente para que
      // el usuario pueda seleccionarla (el catálogo puede estar cargando o ser incompleto).
      knownBrands.push(displayName);
    }
  }

  const otherBrands = sortBySpanishLocale(
    allCatalogBrands.filter((b) => !usedNormalized.has(stripAccents(b)))
  );

  return {
    knownBrands,
    otherBrands,
    knownBrandSet: new Set(knownBrands),
  };
}
