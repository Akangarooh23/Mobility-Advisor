const KNOWN_BRAND_ORDER = [
  "ALFA ROMEO",
  "AUDI",
  "BMW",
  "BYD",
  "CITROEN",
  "CUPRA",
  "DACIA",
  "DS",
  "FIAT",
  "FORD",
  "HONDA",
  "HYUNDAI",
  "JAGUAR",
  "JEEP",
  "KIA",
  "LAND ROVER",
  "LEXUS",
  "MAZDA",
  "MERCEDES-BENZ",
  "MG",
  "MINI",
  "MITSUBISHI",
  "NISSAN",
  "OPEL",
  "PEUGEOT",
  "PORSCHE",
  "RENAULT",
  "SEAT",
  "SKODA",
  "SMART",
  "SUBARU",
  "SUZUKI",
  "TESLA",
  "TOYOTA",
  "VOLKSWAGEN",
  "VOLVO",
];

function sortBySpanishLocale(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "es"));
}

export function getBrandOptionSegments(catalogMap = {}) {
  const allBrands = sortBySpanishLocale(
    Object.keys(catalogMap || {})
      .map((brand) => String(brand || "").trim())
      .filter(Boolean)
  );

  const allBrandsByUppercase = new Map(allBrands.map((brand) => [brand.toUpperCase(), brand]));
  const knownBrands = [];

  for (const knownBrand of KNOWN_BRAND_ORDER) {
    const match = allBrandsByUppercase.get(String(knownBrand).toUpperCase());

    if (match) {
      knownBrands.push(match);
      allBrandsByUppercase.delete(String(knownBrand).toUpperCase());
    }
  }

  const otherBrands = sortBySpanishLocale(Array.from(allBrandsByUppercase.values()));

  return {
    knownBrands,
    otherBrands,
    knownBrandSet: new Set(knownBrands),
  };
}
